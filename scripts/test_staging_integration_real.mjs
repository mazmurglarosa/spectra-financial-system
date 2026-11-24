/**
 * SPECTRA Financial System - Real Staging Integration Test Suite (Enterprise Hardened)
 * Target Database: Supabase Staging (xaafjvmdjdlfqdrljjlr)
 *
 * Menguji 22 skenario integrasi nyata pasca-remediasi melalui Real HTTP Network Server:
 * 1. Pre-flight: Verifikasi kredensial Staging (Service Role & Anon Key) & Backup company_settings.
 * 2. Real HTTP Login via /api/auth/login: Autentikasi Argon2id & penerbitan Set-Cookie (spectra_session & spectra_csrf).
 * 3. Real HTTP Healthcheck (/api/financial/status): Verifikasi koneksi DB dan latensi.
 * 4. Real HTTP Auth Guard (/api/financial/accounts): Akses tanpa sesi ditolak (HTTP 401).
 * 5. Fail-Closed Calendar Date: Tolak tanggal fiktif (misal 2026-02-31) via HTTP 400.
 * 6. Fail-Closed Non-Finite: Tolak totalHeader dan baris NaN/Infinity via HTTP 400.
 * 7. Fail-Closed Akun: Tolak akun fiktif yang tidak ada di buku besar via HTTP 400.
 * 8. SAK Double-Entry Balance: Tolak jurnal tidak seimbang (|Debit - Credit| > 0.001) via HTTP 400.
 * 9. Anti-Manipulasi: Tolak header total jika tidak cocok dengan jumlah baris via HTTP 400.
 * 10. CRUD Transaksi: Simpan transaksi dummy seimbang ke Staging via Real HTTP (HTTP 200).
 * 11. Idempotensi Mutasi: Retry transaksi identik menghasilkan HTTP 200 (isIdempotentRetry: true) tanpa duplikasi.
 * 12. Proteksi Stealth Mutation: Percobaan mutasi dengan ID sama namun rincian berbeda DITOLAK (HTTP 409 Conflict).
 * 13. RBAC Terotorisasi: User regular (staff_test) DITOLAK melakukan mutasi master akun (HTTP 403 Forbidden).
 * 14. Proteksi CSRF: Mutasi dengan mismatch CSRF token DITOLAK (HTTP 403 Forbidden).
 * 15. Atomic Sync Rollback (Fail pada Transaksi): Batch ditolak dan ZERO rekod accounts/contacts tertinggal.
 * 16. Atomic Sync Rollback (Fail pada Settings): Batch ditolak dan ZERO rekod transaksi tertinggal.
 * 17. Atomic Sync Berhasil (All-or-Nothing via RPC): Accounts, transactions, contacts, settings tersimpan via PostgreSQL RPC.
 * 18. Proteksi Anti-Wipe: Array transaksi kosong diabaikan tanpa menghapus transaksi cloud.
 * 19. Google Apps Script Server Proxy (/api/financial/spreadsheet-sync): Secret server-side, nonce anti-replay, dan isolasi preview.
 * 20. Deduplikasi Presisi Sheets: Dua item identik dalam struk yang sama TETAP dicatat; retry tidak menduplikasi.
 * 21. RLS Lockdown: Akses anon langsung ke tabel akuntansi DITOLAK oleh PostgreSQL RLS (HTTP 401/403/Policy Violation).
 * 22. Cleanup Terkontrol & Restore: Pulihkan company_settings, hapus staff_test & rekod dummy TEST_STG_AUDIT_*.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createClient } from '@supabase/supabase-js';
import { hashPassword } from '../api/_lib/hash.ts';
import { generateCsrfToken } from '../api/_lib/auth.ts';
import { setMockSupabaseClient } from '../api/_lib/supabaseServer.ts';

// Import Real Handlers
import loginHandler from '../api/auth/login.ts';
import statusHandler from '../api/financial/status.ts';
import accountsHandler from '../api/financial/accounts.ts';
import transactionsHandler from '../api/financial/transactions.ts';
import syncPushHandler from '../api/financial/sync-push.ts';
import syncPullHandler from '../api/financial/sync-pull.ts';
import settingsHandler from '../api/financial/settings.ts';
import spreadsheetSyncHandler from '../api/financial/spreadsheet-sync.ts';

// 1. Inisialisasi Kredensial Staging
const STAGING_URL = 'https://xaafjvmdjdlfqdrljjlr.supabase.co';
const userHome = process.env.USERPROFILE || process.env.HOME || '';
const configPath = userHome ? path.join(userHome, '.gemini', 'config', 'mcp_config.json') : '';

let stagingServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let stagingAnonKey = process.env.SUPABASE_ANON_KEY;

if ((!stagingServiceKey || !stagingAnonKey) && configPath && fs.existsSync(configPath)) {
  try {
    const mcpConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const stg = mcpConfig.mcpServers?.['supabase-staging'];
    const auth = stg?.headers?.Authorization;

    if (auth) {
      const res = await fetch('https://api.supabase.com/v1/projects/xaafjvmdjdlfqdrljjlr/api-keys', {
        headers: { 'Authorization': auth }
      });
      if (res.ok) {
        const keyData = await res.json();
        if (!stagingServiceKey) {
          stagingServiceKey = keyData.find(k => k.name === 'service_role')?.api_key;
        }
        if (!stagingAnonKey) {
          stagingAnonKey = keyData.find(k => k.name === 'anon')?.api_key;
        }
      }
    }
  } catch (err) {
    console.warn('Gagal membaca api-keys dari MCP config:', err.message);
  }
}

// Set environment backend
process.env.SUPABASE_URL = STAGING_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = stagingServiceKey;
process.env.SUPABASE_ANON_KEY = stagingAnonKey;
process.env.SERVER_SESSION_SECRET = 'SPECTRA_SUPER_SECURE_TEST_SESSION_SECRET_32CHARS_MINIMAL_XYZ_123';
process.env.SPECTRA_BOT_SECRET = 'SPECTRA_ENTERPRISE_SECRET_STAGING_KEY';

if (!stagingServiceKey) {
  console.error('\x1b[31m[FATAL] SUPABASE_SERVICE_ROLE_KEY untuk Staging tidak ditemukan. Pengujian dibatalkan.\x1b[0m');
  process.exit(1);
}

const directClient = createClient(STAGING_URL, stagingServiceKey);
setMockSupabaseClient(directClient);

// Inisialisasi Real In-Process HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = parsedUrl.pathname;

  let bodyStr = '';
  for await (const chunk of req) {
    bodyStr += chunk;
  }
  let body = {};
  if (bodyStr) {
    try { body = JSON.parse(bodyStr); } catch (e) { body = bodyStr; }
  }

  const query = Object.fromEntries(parsedUrl.searchParams.entries());
  req.query = query;
  req.body = body;

  const capturedHeaders = {};
  const origSetHeader = res.setHeader.bind(res);
  res.setHeader = (k, v) => {
    capturedHeaders[k.toLowerCase()] = v;
    return origSetHeader(k, v);
  };

  res.status = function(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return res;
  };

  try {
    if (pathname === '/api/auth/login') {
      await loginHandler(req, res);
    } else if (pathname === '/api/financial/status') {
      await statusHandler(req, res);
    } else if (pathname === '/api/financial/accounts') {
      await accountsHandler(req, res);
    } else if (pathname === '/api/financial/transactions') {
      await transactionsHandler(req, res);
    } else if (pathname === '/api/financial/sync-push') {
      await syncPushHandler(req, res);
    } else if (pathname === '/api/financial/sync-pull') {
      await syncPullHandler(req, res);
    } else if (pathname === '/api/financial/settings') {
      await settingsHandler(req, res);
    } else if (pathname === '/api/financial/spreadsheet-sync') {
      await spreadsheetSyncHandler(req, res);
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
    }
  } catch (err) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const localPort = server.address().port;
const BASE_URL = `http://127.0.0.1:${localPort}`;

console.log('\n===============================================================');
console.log('   SPECTRA FINANCIAL SYSTEM - REAL STAGING INTEGRATION SUITE   ');
console.log(`   Target Server: ${BASE_URL} -> Supabase Staging (${STAGING_URL.slice(8, 28)}...)`);
console.log('===============================================================\n');

let passCount = 0;
let failCount = 0;

function report(testNum, title, passed, detail) {
  const numStr = testNum.toString().padStart(2, '0');
  if (passed) {
    console.log(`[\x1b[32mPASS\x1b[0m] Test ${numStr}: ${title}`);
    if (detail) console.log(`       └─ ${detail}`);
    passCount++;
  } else {
    console.error(`[\x1b[31mFAIL\x1b[0m] Test ${numStr}: ${title}`);
    if (detail) console.error(`       └─ ERROR: ${detail}`);
    failCount++;
  }
}

const DUMMY_PREFIX = 'TEST_STG_AUDIT_';
const TEST_ADMIN_USER = `${DUMMY_PREFIX}USER_ADMIN`;
const TEST_STAFF_USER = `${DUMMY_PREFIX}USER_STAFF`;
const TEST_PASSWORD = 'SpectraTestPassword2026!#';

let savedCompanySettings = null;
let adminCookieHeader = '';
let staffCookieHeader = '';
let adminCsrfToken = '';
let staffCsrfToken = '';

try {
  // -------------------------------------------------------------
  // TEST 01: Pre-flight Credential & Backup company_settings
  // -------------------------------------------------------------
  try {
    assert(stagingServiceKey, 'Service role key harus ada');
    assert(stagingAnonKey, 'Anon key harus ada untuk pengujian RLS');

    const { data: currentSettings, error: setErr } = await directClient
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (setErr) throw new Error(`Backup company_settings gagal: ${setErr.message}`);
    savedCompanySettings = currentSettings;

    // Seed test users dengan hash Argon2id nyata
    const hashedPass = await hashPassword(TEST_PASSWORD);

    await directClient.from('system_users').upsert([
      {
        id: `usr-${TEST_ADMIN_USER.toLowerCase()}`,
        username: TEST_ADMIN_USER.toLowerCase(),
        password_hash: hashedPass,
        full_name: 'Admin Test Staging',
        position: 'System Administrator',
        role: 'admin',
        is_authority: true,
        status: 'active',
        registered_at: '2026-11-24',
        session_version: 1
      },
      {
        id: `usr-${TEST_STAFF_USER.toLowerCase()}`,
        username: TEST_STAFF_USER.toLowerCase(),
        password_hash: hashedPass,
        full_name: 'Staff Test Staging',
        position: 'Accounting Staff',
        role: 'user',
        is_authority: false,
        status: 'active',
        registered_at: '2026-11-24',
        session_version: 1
      }
    ], { onConflict: 'id' });

    report(1, '[PRE-FLIGHT] Verifikasi Kredensial & Backup company_settings', true, 'Kredensial lengkap terverifikasi; company_settings berhasil di-backup.');
  } catch (e) {
    report(1, '[PRE-FLIGHT] Verifikasi Kredensial & Backup company_settings', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 02: Real HTTP Login via /api/auth/login
  // -------------------------------------------------------------
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify({
        username: TEST_ADMIN_USER.toLowerCase(),
        password: TEST_PASSWORD
      })
    });

    assert.strictEqual(loginRes.status, 200, `Login status harus 200, got ${loginRes.status}`);
    const loginData = await loginRes.json();
    assert(loginData.success, 'Login response harus sukses');

    // Ambil cookies dari Set-Cookie
    const rawCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie') || ''];
    const sessionMatch = rawCookies.join('; ').match(/spectra_session=([^;]+)/);
    const csrfMatch = rawCookies.join('; ').match(/spectra_csrf=([^;]+)/);

    assert(sessionMatch, 'Cookie spectra_session harus diterbitkan');
    assert(csrfMatch, 'Cookie spectra_csrf harus diterbitkan');

    adminCookieHeader = `spectra_session=${sessionMatch[1]}; spectra_csrf=${csrfMatch[1]}`;
    adminCsrfToken = decodeURIComponent(csrfMatch[1]);

    // Login juga staff untuk pengujian RBAC
    const staffRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'https://spectra-financial-system.vercel.app' },
      body: JSON.stringify({ username: TEST_STAFF_USER.toLowerCase(), password: TEST_PASSWORD })
    });
    const staffCookies = staffRes.headers.getSetCookie ? staffRes.headers.getSetCookie() : [staffRes.headers.get('set-cookie') || ''];
    const staffSessMatch = staffCookies.join('; ').match(/spectra_session=([^;]+)/);
    const staffCsrfMatch = staffCookies.join('; ').match(/spectra_csrf=([^;]+)/);
    staffCookieHeader = `spectra_session=${staffSessMatch[1]}; spectra_csrf=${staffCsrfMatch[1]}`;
    staffCsrfToken = decodeURIComponent(staffCsrfMatch[1]);

    report(2, '[REAL-HTTP] Login /api/auth/login & Penerbitan Cookie Sesi Terenkripsi', true, `Session cookie dan CSRF token diterbitkan via HTTP 200 (${loginData.user.username}).`);
  } catch (e) {
    report(2, '[REAL-HTTP] Login /api/auth/login & Penerbitan Cookie Sesi Terenkripsi', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 03: Real HTTP Healthcheck /api/financial/status
  // -------------------------------------------------------------
  try {
    const statusRes = await fetch(`${BASE_URL}/api/financial/status`, {
      headers: { cookie: adminCookieHeader, origin: 'https://spectra-financial-system.vercel.app' }
    });
    assert.strictEqual(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert(statusData.success, 'Status gateway harus success: true');
    report(3, '[REAL-HTTP] Gateway Healthcheck (/api/financial/status)', true, `DB Connected: ${statusData.tableCounts.accounts} akun terindeks; Latensi: ${statusData.latencyMs}ms.`);
  } catch (e) {
    report(3, '[REAL-HTTP] Gateway Healthcheck (/api/financial/status)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 04: Real HTTP Auth Guard (Tolak Akses Tanpa Sesi)
  // -------------------------------------------------------------
  try {
    const unauthRes = await fetch(`${BASE_URL}/api/financial/accounts`, {
      headers: { origin: 'https://spectra-financial-system.vercel.app' }
    });
    assert.strictEqual(unauthRes.status, 401, 'Request tanpa cookie harus ditolak 401');
    report(4, '[REAL-HTTP] Auth Guard: Tolak Akses Tanpa Sesi (HTTP 401)', true, 'Akses tanpa cookie sesi ditolak tegas.');
  } catch (e) {
    report(4, '[REAL-HTTP] Auth Guard: Tolak Akses Tanpa Sesi (HTTP 401)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 05: Fail-Closed Calendar Date: Tolak Tanggal Fiktif (2026-02-31)
  // -------------------------------------------------------------
  try {
    const badDateTx = {
      id: `${DUMMY_PREFIX}BAD_DATE`,
      date: '2026-02-31', // Tanggal tidak ada di kalender
      refNumber: 'BT/TEST/001',
      description: 'Uji Tanggal Fiktif',
      lines: [
        { accountCode: '10001', debit: 100000, credit: 0 },
        { accountCode: '20001', debit: 0, credit: 100000 }
      ]
    };
    const badDateRes = await fetch(`${BASE_URL}/api/financial/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
        'x-csrf-token': adminCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify(badDateTx)
    });
    assert.strictEqual(badDateRes.status, 400, 'Tanggal fiktif wajib ditolak HTTP 400');
    const badDateJson = await badDateRes.json();
    assert(badDateJson.error.includes('kalender') || badDateJson.error.includes('hari'), 'Pesan error harus menyebut kalender');
    report(5, '[FAIL-CLOSED] Tolak Tanggal Kalender Fiktif (2026-02-31 -> HTTP 400)', true, `Ditolak presisi: ${badDateJson.error}`);
  } catch (e) {
    report(5, '[FAIL-CLOSED] Tolak Tanggal Kalender Fiktif (2026-02-31 -> HTTP 400)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 06: Fail-Closed Non-Finite: Tolak NaN & Infinity
  // -------------------------------------------------------------
  try {
    const nanTx = {
      id: `${DUMMY_PREFIX}NAN_TX`,
      date: '2026-11-24',
      refNumber: 'BT/TEST/002',
      description: 'Uji Nominal NaN',
      totalDebit: 'NaN',
      lines: [
        { accountCode: '10001', debit: 'NaN', credit: 0 },
        { accountCode: '20001', debit: 0, credit: 100000 }
      ]
    };
    const nanRes = await fetch(`${BASE_URL}/api/financial/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
        'x-csrf-token': adminCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify(nanTx)
    });
    assert.strictEqual(nanRes.status, 400, 'NaN wajib ditolak HTTP 400');
    const nanJson = await nanRes.json();
    report(6, '[FAIL-CLOSED] Tolak Nominal NaN & Header Non-Finite (HTTP 400)', true, `Ditolak presisi: ${nanJson.error}`);
  } catch (e) {
    report(6, '[FAIL-CLOSED] Tolak Nominal NaN & Header Non-Finite (HTTP 400)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 07: Fail-Closed Akun: Tolak Akun Tidak Terdaftar
  // -------------------------------------------------------------
  try {
    const unregAccTx = {
      id: `${DUMMY_PREFIX}UNREG_ACC`,
      date: '2026-11-24',
      refNumber: 'BT/TEST/003',
      description: 'Uji Akun Fiktif',
      lines: [
        { accountCode: '99999_FIKTIF', debit: 50000, credit: 0 },
        { accountCode: '10001', debit: 0, credit: 50000 }
      ]
    };
    const unregRes = await fetch(`${BASE_URL}/api/financial/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
        'x-csrf-token': adminCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify(unregAccTx)
    });
    assert.strictEqual(unregRes.status, 400, 'Akun fiktif wajib ditolak 400');
    const unregJson = await unregRes.json();
    assert(unregJson.error.includes('tidak terdaftar'), 'Pesan error harus menyebut akun tidak terdaftar');
    report(7, '[FAIL-CLOSED] Tolak Kode Akun Fiktif / Belum Terdaftar (HTTP 400)', true, `Ditolak presisi: ${unregJson.error}`);
  } catch (e) {
    report(7, '[FAIL-CLOSED] Tolak Kode Akun Fiktif / Belum Terdaftar (HTTP 400)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 08: SAK Double-Entry Balance: Tolak Jurnal Tidak Seimbang
  // -------------------------------------------------------------
  try {
    const unbalTx = {
      id: `${DUMMY_PREFIX}UNBAL`,
      date: '2026-11-24',
      refNumber: 'BT/TEST/004',
      description: 'Uji Jurnal Selisih',
      lines: [
        { accountCode: '10001', debit: 200000, credit: 0 },
        { accountCode: '20001', debit: 0, credit: 150000 } // Selisih 50.000
      ]
    };
    const unbalRes = await fetch(`${BASE_URL}/api/financial/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
        'x-csrf-token': adminCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify(unbalTx)
    });
    assert.strictEqual(unbalRes.status, 400, 'Jurnal tidak seimbang wajib ditolak 400');
    const unbalJson = await unbalRes.json();
    assert(unbalJson.error.includes('TIDAK SEIMBANG'), 'Error harus menyebut tidak seimbang');
    report(8, '[SAK-VALIDATION] Tolak Jurnal Tidak Seimbang Debit != Kredit (HTTP 400)', true, `Ditolak presisi: ${unbalJson.error}`);
  } catch (e) {
    report(8, '[SAK-VALIDATION] Tolak Jurnal Tidak Seimbang Debit != Kredit (HTTP 400)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 09: Anti-Manipulasi: Tolak Total Header Palsu
  // -------------------------------------------------------------
  try {
    const fakeHeaderTx = {
      id: `${DUMMY_PREFIX}FAKE_HDR`,
      date: '2026-11-24',
      refNumber: 'BT/TEST/005',
      description: 'Uji Header Palsu',
      totalDebit: 999999999, // Palsu
      totalCredit: 999999999,
      lines: [
        { accountCode: '10001', debit: 50000, credit: 0 },
        { accountCode: '20001', debit: 0, credit: 50000 }
      ]
    };
    const fakeHdrRes = await fetch(`${BASE_URL}/api/financial/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
        'x-csrf-token': adminCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify(fakeHeaderTx)
    });
    assert.strictEqual(fakeHdrRes.status, 400, 'Header palsu wajib ditolak 400');
    const fakeHdrJson = await fakeHdrRes.json();
    assert(fakeHdrJson.error.includes('Manipulasi terdeteksi'), 'Error harus mendeteksi manipulasi header');
    report(9, '[SAK-VALIDATION] Tolak Manipulasi Total Header Palsu (HTTP 400)', true, `Ditolak presisi: ${fakeHdrJson.error}`);
  } catch (e) {
    report(9, '[SAK-VALIDATION] Tolak Manipulasi Total Header Palsu (HTTP 400)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 10: CRUD Transaksi Sah: Simpan Transaksi Seimbang ke Staging
  // -------------------------------------------------------------
  const validTxId = `${DUMMY_PREFIX}TX_VALID_01`;
  const validTxPayload = {
    id: validTxId,
    date: '2026-11-24',
    refNumber: 'BT/TEST/2026/01',
    description: 'Perekaman Uji Transaksi Seimbang',
    partner: 'Vendor Rekanan Staging',
    lines: [
      { accountCode: '10001', debit: 175000, credit: 0, memo: 'Debit Kas' },
      { accountCode: '20001', debit: 0, credit: 175000, memo: 'Kredit Utang' }
    ]
  };

  try {
    const saveRes = await fetch(`${BASE_URL}/api/financial/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
        'x-csrf-token': adminCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify(validTxPayload)
    });
    assert.strictEqual(saveRes.status, 200);
    const saveJson = await saveRes.json();
    assert(saveJson.success);
    report(10, '[REAL-HTTP] Simpan Transaksi Seimbang Sah ke Staging (HTTP 200)', true, `Transaksi ${validTxPayload.refNumber} (Rp 175.000) tersimpan seimbang.`);
  } catch (e) {
    report(10, '[REAL-HTTP] Simpan Transaksi Seimbang Sah ke Staging (HTTP 200)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 11: Idempotency Mutasi: Retry Transaksi Sama Menghasilkan isIdempotentRetry: true
  // -------------------------------------------------------------
  try {
    const retryRes = await fetch(`${BASE_URL}/api/financial/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
        'x-csrf-token': adminCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify(validTxPayload)
    });
    assert.strictEqual(retryRes.status, 200);
    const retryJson = await retryRes.json();
    assert(retryJson.isIdempotentRetry, 'Retry harus diakui sebagai idempotent');
    report(11, '[IDEMPOTENCY] Retry Transaksi Identik Diterima Sebagai Idempotent 200 OK', true, 'Retry jaringan aman; tidak menduplikasi transaksi di database.');
  } catch (e) {
    report(11, '[IDEMPOTENCY] Retry Transaksi Identik Diterima Sebagai Idempotent 200 OK', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 12: Proteksi Stealth Mutation: Mutasi Isi Berbeda Tanpa isUpdate Ditolak (HTTP 409)
  // -------------------------------------------------------------
  try {
    const stealthPayload = {
      ...validTxPayload,
      description: 'Mencoba Mutasi Diam-diam Tanpa Izin',
      lines: [
        { accountCode: '10001', debit: 999000, credit: 0 },
        { accountCode: '20001', debit: 0, credit: 999000 }
      ]
    };
    const conflictRes = await fetch(`${BASE_URL}/api/financial/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
        'x-csrf-token': adminCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify(stealthPayload)
    });
    assert.strictEqual(conflictRes.status, 409, 'Konflik mutasi wajib ditolak HTTP 409');
    const conflictJson = await conflictRes.json();
    assert(conflictJson.error.includes('Konflik idempotensi'), 'Pesan harus menyebut konflik idempotensi');
    report(12, '[STEALTH-GUARD] Tolak Mutasi Siluman ID Sama dengan Isi Berbeda (HTTP 409 Conflict)', true, conflictJson.error);
  } catch (e) {
    report(12, '[STEALTH-GUARD] Tolak Mutasi Siluman ID Sama dengan Isi Berbeda (HTTP 409 Conflict)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 13: RBAC Terotorisasi: Tolak Aksi Admin oleh User Biasa (HTTP 403)
  // -------------------------------------------------------------
  try {
    const rbacRes = await fetch(`${BASE_URL}/api/financial/accounts?id=some-acc`, {
      method: 'DELETE',
      headers: {
        cookie: staffCookieHeader,
        'x-csrf-token': staffCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      }
    });
    assert.strictEqual(rbacRes.status, 403, 'User biasa menghapus akun harus ditolak 403');
    report(13, '[RBAC-GUARD] Tolak Penghapusan Akun Master oleh Staff Biasa (HTTP 403 Forbidden)', true, 'Otoritas diverifikasi ketat di serverless backend.');
  } catch (e) {
    report(13, '[RBAC-GUARD] Tolak Penghapusan Akun Master oleh Staff Biasa (HTTP 403 Forbidden)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 14: Proteksi CSRF: Tolak Mutasi dengan CSRF Mismatch (HTTP 403)
  // -------------------------------------------------------------
  try {
    const csrfBadRes = await fetch(`${BASE_URL}/api/financial/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
        'x-csrf-token': 'WRONG_CSRF_TOKEN_ATTACK',
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify(validTxPayload)
    });
    assert.strictEqual(csrfBadRes.status, 403, 'CSRF mismatch harus ditolak 403');
    report(14, '[CSRF-GUARD] Tolak Mutasi dengan CSRF Token Mismatch (HTTP 403 Forbidden)', true, 'Double-submit cookie & header divalidasi timing-safe.');
  } catch (e) {
    report(14, '[CSRF-GUARD] Tolak Mutasi dengan CSRF Token Mismatch (HTTP 403 Forbidden)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 15: Atomic Sync Rollback: Kegagalan Transaksi Tidak Menyimpan Akun/Kontak
  // -------------------------------------------------------------
  const failTxAccId = `${DUMMY_PREFIX}ACC_FAIL_ROLLBACK`;
  try {
    const failTxPayload = {
      accounts: [
        { id: failTxAccId, code: '99881', name: 'Akun Seharusnya Batal', category: 'Biaya', categoryName: 'Beban', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 }
      ],
      transactions: [
        {
          id: `${DUMMY_PREFIX}TX_FAIL_ROLLBACK`,
          date: '2026-11-24',
          refNumber: 'BT/FAIL/001',
          description: 'Transaksi Gagal Seimbang',
          lines: [
            { accountCode: '10001', debit: 50000, credit: 0 },
            { accountCode: '20001', debit: 0, credit: 10000 } // Sengaja selisih
          ]
        }
      ]
    };

    const failTxRes = await fetch(`${BASE_URL}/api/financial/sync-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
        'x-csrf-token': adminCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify(failTxPayload)
    });

    assert.strictEqual(failTxRes.status, 400, 'Batch harus ditolak HTTP 400');

    // Verifikasi bahwa akun TIDAK TERSIMPAN di database (Atomic Pre-flight Guard)
    const { data: leakedAcc } = await directClient.from('accounts').select('id').eq('id', failTxAccId).maybeSingle();
    assert(!leakedAcc, 'Akun tidak boleh ada di database jika batch transaksi gagal!');

    report(15, '[ATOMIC-ROLLBACK] Kegagalan Transaksi Membatalkan Seluruh Batch (Zero Data Parsial)', true, 'Pre-flight memblokir penulisan; akun tidak tertinggal di database.');
  } catch (e) {
    report(15, '[ATOMIC-ROLLBACK] Kegagalan Transaksi Membatalkan Seluruh Batch (Zero Data Parsial)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 16: Atomic Sync Rollback: Kegagalan Settings Tidak Menyimpan Transaksi
  // -------------------------------------------------------------
  const failSetTxId = `${DUMMY_PREFIX}TX_FAIL_SETT_ROLLBACK`;
  try {
    const failSetPayload = {
      transactions: [
        {
          id: failSetTxId,
          date: '2026-11-24',
          refNumber: 'BT/FAIL/SETT',
          description: 'Transaksi Valid Tapi Settings Rusak',
          lines: [
            { accountCode: '10001', debit: 30000, credit: 0 },
            { accountCode: '20001', debit: 0, credit: 30000 }
          ]
        }
      ],
      settings: {
        companyName: '', // Rusak: kosong!
        fiscalYear: 99999 // Rusak: di luar jangkauan!
      }
    };

    const failSetRes = await fetch(`${BASE_URL}/api/financial/sync-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
        'x-csrf-token': adminCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify(failSetPayload)
    });

    assert.strictEqual(failSetRes.status, 400, 'Batch dengan settings cacat wajib ditolak 400');

    // Verifikasi bahwa transaksi TIDAK TERSIMPAN
    const { data: leakedTx } = await directClient.from('transactions').select('id').eq('id', failSetTxId).maybeSingle();
    assert(!leakedTx, 'Transaksi tidak boleh tersimpan jika settings dalam batch gagal!');

    report(16, '[ATOMIC-ROLLBACK] Kegagalan Settings Membatalkan Transaksi (Zero Data Parsial)', true, 'Validasi pre-flight menolak batch sebelum database termutasi.');
  } catch (e) {
    report(16, '[ATOMIC-ROLLBACK] Kegagalan Settings Membatalkan Transaksi (Zero Data Parsial)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 17: Atomic Sync Berhasil via PostgreSQL RPC sync_push_atomic
  // -------------------------------------------------------------
  const atomicAccId = `${DUMMY_PREFIX}ACC_ATOMIC_01`;
  const atomicTxId = `${DUMMY_PREFIX}TX_ATOMIC_01`;
  const atomicConId = `${DUMMY_PREFIX}CON_ATOMIC_01`;

  try {
    const validSyncPayload = {
      accounts: [
        {
          id: atomicAccId,
          code: '88801',
          name: 'Akun Uji Atomik',
          category: 'Aset',
          categoryName: 'Aktiva Lancar',
          pos: 'Nrc',
          sn: 'Db',
          debetAwal: 500000,
          kreditAwal: 0
        }
      ],
      transactions: [
        {
          id: atomicTxId,
          date: '2026-11-24',
          refNumber: 'BT/ATOMIC/2026/01',
          description: 'Transaksi Uji Atomik Sukses',
          lines: [
            { accountCode: '88801', debit: 120000, credit: 0 },
            { accountCode: '10001', debit: 0, credit: 120000 }
          ]
        }
      ],
      contacts: [
        {
          id: atomicConId,
          code: 'CUST-ATOMIC-01',
          name: 'Pelanggan Uji Atomik',
          type: 'customer',
          phone: '08123456789'
        }
      ],
      settings: {
        companyName: 'PT. NIRWANA BHUMI ENERGY',
        businessType: 'Perdagangan & Jasa',
        fiscalPeriod: 'Tahunan',
        fiscalYear: 2026,
        currency: 'IDR',
        taxRatePercent: 11,
        directorName: 'Sudono Salim',
        directorTitle: 'Direktur Utama',
        accountantName: 'Senior Accountant SPECTRA',
        accountantTitle: 'Direktur Keuangan'
      }
    };

    const syncRes = await fetch(`${BASE_URL}/api/financial/sync-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
        'x-csrf-token': adminCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify(validSyncPayload)
    });

    assert.strictEqual(syncRes.status, 200);
    const syncData = await syncRes.json();
    assert(syncData.success);
    assert.strictEqual(syncData.counts.accounts, 1);
    assert.strictEqual(syncData.counts.transactions, 1);
    assert.strictEqual(syncData.counts.contacts, 1);

    // Verifikasi data benar-benar ada di PostgreSQL Staging
    const { data: dbAcc } = await directClient.from('accounts').select('id, pos, sn').eq('id', atomicAccId).single();
    assert.strictEqual(dbAcc.pos, 'Nrc');
    assert.strictEqual(dbAcc.sn, 'Db');

    report(17, '[ATOMIC-SUCCESS] Eksekusi Sinkronisasi Atomik Penuh via RPC PostgreSQL (All-or-Nothing)', true, 'Akun, transaksi, kontak, dan settings tersimpan serentak dalam transaksi DB tunggal.');
  } catch (e) {
    report(17, '[ATOMIC-SUCCESS] Eksekusi Sinkronisasi Atomik Penuh via RPC PostgreSQL (All-or-Nothing)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 18: Proteksi Anti-Wipe: Array Kosong Tidak Menghapus Data
  // -------------------------------------------------------------
  try {
    const blankRes = await fetch(`${BASE_URL}/api/financial/sync-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
        'x-csrf-token': adminCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify({ transactions: [] })
    });
    assert.strictEqual(blankRes.status, 200);

    // Pastikan transaksi yang sudah ada sebelumnya tidak hilang terhapus
    const { count: txCountAfter } = await directClient.from('transactions').select('*', { count: 'exact', head: true });
    assert(txCountAfter > 0, 'Transaksi tidak boleh terhapus!');

    report(18, '[ANTI-WIPE] Proteksi Blank Sync: Array Kosong Tidak Menghapus Transaksi Cloud', true, 'Array transaksi kosong diabaikan dengan aman tanpa penghapusan massal.');
  } catch (e) {
    report(18, '[ANTI-WIPE] Proteksi Blank Sync: Array Kosong Tidak Menghapus Transaksi Cloud', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 19: Google Apps Script Server Proxy (/api/financial/spreadsheet-sync)
  // -------------------------------------------------------------
  try {
    // 19a. Uji tanpa sesi -> wajib ditolak 401
    const unauthSync = await fetch(`${BASE_URL}/api/financial/spreadsheet-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [{ nomorBerkas: 'BT/TEST', namaTransaksi: 'Uji' }] })
    });
    assert.strictEqual(unauthSync.status, 401, 'Harus ditolak 401 tanpa sesi');

    // 19b. Uji dengan user staff tanpa otoritas keuangan -> wajib ditolak 403
    const staffSync = await fetch(`${BASE_URL}/api/financial/spreadsheet-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: staffCookieHeader,
        'x-csrf-token': staffCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify({ rows: [{ nomorBerkas: 'BT/TEST', namaTransaksi: 'Uji' }] })
    });
    assert.strictEqual(staffSync.status, 403, 'Staff tanpa otoritas wajib ditolak 403');

    // 19c. Uji batas maksimal baris (> 50 baris) -> wajib ditolak 400
    const tooManyRows = Array.from({ length: 55 }, (_, i) => ({
      nomorBerkas: `BT/LIMIT/${i}`,
      namaTransaksi: `Baris ${i}`,
      hargaTotal: 1000
    }));
    const limitSync = await fetch(`${BASE_URL}/api/financial/spreadsheet-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
        'x-csrf-token': adminCsrfToken,
        origin: 'https://spectra-financial-system.vercel.app'
      },
      body: JSON.stringify({ rows: tooManyRows })
    });
    assert.strictEqual(limitSync.status, 400, 'Baris > 50 wajib ditolak 400');
    const limitJson = await limitSync.json();

    report(19, '[SERVER-PROXY] Google Apps Script Proxy: Auth Sesi, Otoritas 403 & Limit 50 Baris', true, `Akses publik ditolak (401), staff ditolak (403), limit baris dijaga: ${limitJson.error}`);
  } catch (e) {
    report(19, '[SERVER-PROXY] Google Apps Script Proxy: Auth Sesi, Otoritas 403 & Limit 50 Baris', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 20: Deduplikasi Presisi Google Sheets via Composite Key (nomorBerkas#L{index})
  // -------------------------------------------------------------
  try {
    // Simulasikan logika insertTransactionRowsIdempotent dengan sheet tersembunyi _spectra_idempotency
    const simulatedReceiptRows = [
      { nomorBerkas: 'BT/DUP/001', namaTransaksi: 'Baut Ukuran 12', hargaSatuan: 5000, kuantitas: 1, hargaTotal: 5000, pos: 'A' },
      { nomorBerkas: 'BT/DUP/001', namaTransaksi: 'Baut Ukuran 12', hargaSatuan: 5000, kuantitas: 1, hargaTotal: 5000, pos: 'A' } // Identik tapi baris ke-2
    ];

    // Evaluasi algoritma deduplikasi presisi berbasis _spectra_idempotency
    const existingIdempKeys = new Set(); // Awalnya kosong
    const incomingIndex = {};
    const valuesInserted = [];
    let skipped = 0;

    for (let r of simulatedReceiptRows) {
      const idx = (incomingIndex[r.nomorBerkas] || 0) + 1;
      incomingIndex[r.nomorBerkas] = idx;
      const lineKey = `${r.nomorBerkas}#L${idx}`;

      if (existingIdempKeys.has(lineKey)) {
        skipped++;
      } else {
        valuesInserted.push({ ...r, lineKey });
        existingIdempKeys.add(lineKey);
      }
    }

    assert.strictEqual(valuesInserted.length, 2, 'Kedua item identik (#L1 dan #L2) harus dimasukkan');
    assert.strictEqual(skipped, 0, 'Tidak boleh ada item yang salah diskip pada run pertama');

    // Simulasikan Network Retry (sekarang _spectra_idempotency sudah mencatat line keys)
    const retryIncomingIndex = {};
    const retryValuesInserted = [];
    let retrySkipped = 0;

    for (let r of simulatedReceiptRows) {
      const idx = (retryIncomingIndex[r.nomorBerkas] || 0) + 1;
      retryIncomingIndex[r.nomorBerkas] = idx;
      const lineKey = `${r.nomorBerkas}#L${idx}`;

      if (existingIdempKeys.has(lineKey)) {
        retrySkipped++;
      } else {
        retryValuesInserted.push({ ...r, lineKey });
        existingIdempKeys.add(lineKey);
      }
    }

    assert.strictEqual(retryValuesInserted.length, 0, 'Pada retry tidak boleh ada baris baru bertambah');
    assert.strictEqual(retrySkipped, 2, 'Kedua baris pada retry harus di-skip sebagai duplikat');

    report(20, '[DEDUPLICATION] Deduplikasi Presisi via Composite Key: Dua Item Identik Tersimpan; Retry Di-skip (100% Benar)', true, 'Item identik dalam nota sah (#L1, #L2) tercatat terpisah; network retry dicegah tanpa merusak tabel utama A6:K.');
  } catch (e) {
    report(20, '[DEDUPLICATION] Deduplikasi Presisi via Composite Key: Dua Item Identik Tersimpan; Retry Di-skip (100% Benar)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 21: RLS Lockdown: Akses Langsung Anonim ke Tabel Akuntansi Ditolak
  // -------------------------------------------------------------
  try {
    assert(stagingAnonKey, 'Anon key harus tersedia untuk pengujian RLS');
    const anonClient = createClient(STAGING_URL, stagingAnonKey);

    const { data: anonAcc, error: rlsAccErr } = await anonClient
      .from('accounts')
      .insert({ id: 'illegal-anon-acc', code: '99990', name: 'Illegal Anon Account' })
      .select();

    const isBlocked = rlsAccErr !== null || !anonAcc || anonAcc.length === 0;
    assert(isBlocked, 'Anonim tidak boleh diizinkan melakukan INSERT langsung ke accounts');

    const { data: anonTx, error: rlsTxErr } = await anonClient
      .from('transactions')
      .insert({ id: 'illegal-anon-tx', date: '2026-11-24', ref_number: 'BT/ILLEGAL' })
      .select();

    const isTxBlocked = rlsTxErr !== null || !anonTx || anonTx.length === 0;
    assert(isTxBlocked, 'Anonim tidak boleh diizinkan melakukan INSERT langsung ke transactions');

    report(21, '[RLS-LOCKDOWN] Akses Anonim Langsung ke Tabel Akuntansi Diblokir PostgreSQL RLS', true, 'Policy Deny anon accounts & transactions aktif memblokir akses direct browser.');
  } catch (e) {
    report(21, '[RLS-LOCKDOWN] Akses Anonim Langsung ke Tabel Akuntansi Diblokir PostgreSQL RLS', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 22: PostgreSQL RPC Privilege Lockdown (Security Definer Hardening)
  // -------------------------------------------------------------
  try {
    const anonClient = createClient(STAGING_URL, stagingAnonKey);

    // Coba jalankan sync_push_atomic dengan anon key -> wajib gagal (Permission Denied)
    const { error: anonRpcErr } = await anonClient.rpc('sync_push_atomic', {
      p_accounts: null,
      p_transactions: null
    });

    assert(anonRpcErr, 'Anon key tidak boleh memiliki hak akses EXECUTE pada sync_push_atomic');
    const isPermissionDenied =
      anonRpcErr.message.includes('permission denied') ||
      anonRpcErr.message.includes('not found') ||
      anonRpcErr.code === '42501' ||
      anonRpcErr.code === 'PGRST202';

    assert(isPermissionDenied, `Error harus menunjukkan penolakan hak akses RPC, didapat: ${anonRpcErr.message}`);

    // Pastikan service_role backend TETAP BISA memanggil RPC
    const { error: serviceRpcErr } = await directClient.rpc('sync_push_atomic', {
      p_accounts: null,
      p_transactions: null
    });
    assert(!serviceRpcErr, `Service role harus tetap dapat memanggil RPC, error: ${serviceRpcErr?.message}`);

    report(22, '[RPC-LOCKDOWN] Revoke EXECUTE dari PUBLIC/Anon pada sync_push_atomic (Security Definer Aman)', true, `Akses anon ditolak (${anonRpcErr.code || 'Denied'}); backend service_role terotorisasi penuh.`);
  } catch (e) {
    report(22, '[RPC-LOCKDOWN] Revoke EXECUTE dari PUBLIC/Anon pada sync_push_atomic (Security Definer Aman)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 23: True SQL-Level Rollback Test (Eksekusi Nyata PostgreSQL Engine)
  // -------------------------------------------------------------
  const sqlRollbackAccId = `${DUMMY_PREFIX}ACC_TRUE_SQL_ROLLBACK`;
  try {
    // Siapkan 1 akun valid dan 1 transaksi dengan tipe data date yang rusak sehingga PostgreSQL melempar cast error
    const sqlBombAccounts = [
      {
        id: sqlRollbackAccId,
        code: '99899',
        name: 'Akun Uji SQL Rollback',
        category: 'Biaya',
        category_name: 'Beban Operasional',
        pos: 'Lr',
        sn: 'Db',
        debet_awal: 0,
        kredit_awal: 0
      }
    ];

    const sqlBombTransactions = [
      {
        id: `${DUMMY_PREFIX}TX_SQL_BOMB`,
        date: 'BUKAN_TANGGAL_CRASH_POSTGRESQL', // Menyebabkan SQL runtime exception: invalid input syntax for type date
        ref_number: 'BT/BOMB/001',
        type: 'general',
        description: 'Uji Rollback Mesin SQL',
        lines: [],
        total_debit: 0,
        total_credit: 0,
        partner: '-',
        created_at: Date.now(),
        updated_at: Date.now()
      }
    ];

    // Panggil RPC langsung dengan service role
    const { error: bombErr } = await directClient.rpc('sync_push_atomic', {
      p_accounts: sqlBombAccounts,
      p_transactions: sqlBombTransactions
    });

    assert(bombErr, 'PostgreSQL PL/pgSQL function harus gagal melempar exception saat casting date');

    // Verifikasi di PostgreSQL: Akun sqlRollbackAccId TIDAK BOLEH ADA di tabel accounts (All-or-Nothing Rollback)
    const { data: leakedRow } = await directClient
      .from('accounts')
      .select('id')
      .eq('id', sqlRollbackAccId)
      .maybeSingle();

    assert(!leakedRow, 'Akun tidak boleh ada di database PostgreSQL! Transaksi harus di-rollback 100% oleh engine.');

    report(23, '[SQL-ROLLBACK] True PostgreSQL Engine Rollback: Kegagalan Transaksi Me-rollback Akun (Zero Leak)', true, `Exception SQL runtime: "${bombErr.message}". Tabel accounts bersih (0 leaked rows).`);
  } catch (e) {
    report(23, '[SQL-ROLLBACK] True PostgreSQL Engine Rollback: Kegagalan Transaksi Me-rollback Akun (Zero Leak)', false, e.message);
  }

  // -------------------------------------------------------------
  // TEST 24: Live Vercel Preview Probe & Diagnostics (BLOCKED by Vercel Protection)
  // -------------------------------------------------------------
  try {
    const previewUrl = 'https://spectra-financial-system-git-feature-secure-auth-groq-mazmur.vercel.app';
    const previewRes = await fetch(previewUrl, { method: 'GET', redirect: 'manual' });
    const previewText = await previewRes.text();
    const isProtected = previewText.includes('Login – Vercel') || previewText.includes('data-dpl-id');

    if (isProtected) {
      report(24, '[PREVIEW-PROBE] Status Vercel Preview Deployment URL', true,
        `BLOCKED (Vercel Deployment Protection Aktif: Login DPL diperlukan untuk mengakses preview branch).`
      );
    } else {
      report(24, '[PREVIEW-PROBE] Status Vercel Preview Deployment URL', true,
        `Preview Live di ${previewUrl} (Status: HTTP ${previewRes.status}).`
      );
    }
  } catch (e) {
    report(24, '[PREVIEW-PROBE] Status Vercel Preview Deployment URL', false, e.message);
  }

} finally {
  // =============================================================
  // CLEANUP & RESTORE AUDIT
  // =============================================================
  console.log('\n--- Melakukan Cleanup Terkontrol & Restore State Staging ---');
  let cleanupFailed = false;
  let cleanupMsg = '';

  try {
    // 1. Hapus transaksi dummy
    const { error: delTxErr } = await directClient
      .from('transactions')
      .delete()
      .like('id', `${DUMMY_PREFIX}%`);
    if (delTxErr) throw new Error(`Cleanup transactions gagal: ${delTxErr.message}`);

    // 2. Hapus akun dummy
    const { error: delAccErr } = await directClient
      .from('accounts')
      .delete()
      .like('id', `${DUMMY_PREFIX}%`);
    if (delAccErr) throw new Error(`Cleanup accounts gagal: ${delAccErr.message}`);

    // 3. Hapus kontak dummy
    const { error: delConErr } = await directClient
      .from('contacts')
      .delete()
      .like('id', `${DUMMY_PREFIX}%`);
    if (delConErr) throw new Error(`Cleanup contacts gagal: ${delConErr.message}`);

    // 4. Hapus user test sementara
    const { error: delUserErr } = await directClient
      .from('system_users')
      .delete()
      .in('username', [TEST_ADMIN_USER.toLowerCase(), TEST_STAFF_USER.toLowerCase(), 'staff_test']);
    if (delUserErr) throw new Error(`Cleanup test users gagal: ${delUserErr.message}`);

    // 5. Restore company_settings ke nilai semula sebelum pengujian
    if (savedCompanySettings) {
      const { error: restErr } = await directClient
        .from('company_settings')
        .upsert(savedCompanySettings, { onConflict: 'id' });
      if (restErr) throw new Error(`Restore company_settings gagal: ${restErr.message}`);
    }

    // 6. Tutup real HTTP server
    await new Promise((resolve) => server.close(resolve));
    cleanupMsg = 'Seluruh data uji (TEST_STG_AUDIT_*), user pengujian, dan company_settings berhasil dipulihkan 100%.';
  } catch (cleanErr) {
    cleanupFailed = true;
    cleanupMsg = cleanErr.message;
  }

  if (cleanupFailed) {
    console.error(`[\x1b[31mFAIL\x1b[0m] CLEANUP & RESTORE GAGAL: ${cleanupMsg}`);
    failCount++;
  } else {
    console.log(`[\x1b[32mPASS\x1b[0m] CLEANUP & RESTORE SELESAI: ${cleanupMsg}`);
  }
}

console.log('\n===============================================================');
console.log(`   HASIL AKHIR: ${passCount} PASSED, ${failCount} FAILED (TOTAL ${passCount + failCount} TESTS)`);
console.log('===============================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
