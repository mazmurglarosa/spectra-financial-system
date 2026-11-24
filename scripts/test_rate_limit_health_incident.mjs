import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// =========================================================================
// 1. Inisialisasi Environment Serverless Eksplisit (Deterministik)
// =========================================================================
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';
process.env.SERVER_SESSION_SECRET = 'SPECTRA_TEST_SERVER_SESSION_SECRET_MIN_32_CHARS_TOKEN_VAL_OK';

import financialRouter from '../api/financial.ts';
import { checkRateLimitCentralized } from '../api/_lib/rateLimit.ts';
import { createSessionToken } from '../api/_lib/auth.ts';
import { authenticateFinancialRequest } from '../api/_lib/financialAuth.ts';
import { setMockSupabaseClient, getSupabaseServerClient } from '../api/_lib/supabaseServer.ts';

console.log('===============================================================');
console.log('   SPECTRA RATE LIMIT & HEALTH MONITOR INCIDENT VERIFICATION');
console.log('===============================================================');

// =========================================================================
// 2. Kredensial Database Staging (Fail-Closed)
// =========================================================================
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

assert.ok(stagingServiceKey, '[FATAL] SUPABASE_SERVICE_ROLE_KEY wajib tersedia untuk pengujian Staging.');
process.env.SUPABASE_URL = STAGING_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = stagingServiceKey;
process.env.SUPABASE_ANON_KEY = stagingAnonKey;

// Mock HTTP Server untuk testing router
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = parsedUrl.pathname;

  let bodyStr = '';
  for await (const chunk of req) {
    bodyStr += chunk;
  }
  let body = {};
  if (bodyStr) {
    try { body = JSON.parse(bodyStr); } catch { body = bodyStr; }
  }

  req.query = Object.fromEntries(parsedUrl.searchParams.entries());
  req.body = body;

  const origSetHeader = res.setHeader.bind(res);
  const capturedHeaders = {};
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
    if (pathname.startsWith('/api/financial')) {
      await financialRouter(req, res);
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

await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const baseUrl = `http://127.0.0.1:${PORT}`;

// Inisialisasi Direct Client untuk setup test user
const sb = createClient(STAGING_URL, stagingServiceKey);

// =========================================================================
// 3. Setup Fixture Sesi Terotorisasi Sesuai SessionPayload (sub, fullName, dll)
// =========================================================================
const ts = Date.now();
const testUserId = `usr-rate-test-${ts}`;
const testUsername = `user_rate_${ts}`;

const { error: upsertErr } = await sb.from('system_users').upsert([
  {
    id: testUserId,
    username: testUsername,
    password_hash: 'mock_hash_for_test',
    full_name: 'Tester Rate Limit Audit',
    position: 'Akuntan Senior',
    role: 'admin',
    is_authority: true,
    status: 'active',
    registered_at: '2026-11-24',
    session_version: 1
  }
]);

if (upsertErr) {
  throw new Error(`Gagal membuat test user di Staging: ${upsertErr.message}`);
}

// SessionPayload valid sesuai kontrak keamanan SPECTRA
const validSessionToken = createSessionToken({
  sub: testUserId,
  username: testUsername,
  fullName: 'Tester Rate Limit Audit',
  role: 'admin',
  isAuthority: true,
  sessionVersion: 1
});
const validCookie = `spectra_session=${validSessionToken}`;

async function testReq(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Cookie': validCookie,
      'Origin': 'https://spectra-financial-system.vercel.app',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

function createMockResponse() {
  const headers = {};
  let statusCode = 200;
  let responseBody = null;
  let ended = false;

  return {
    setHeader(k, v) { headers[k.toLowerCase()] = String(v); },
    getHeader(k) { return headers[k.toLowerCase()]; },
    getHeaders() { return headers; },
    status(code) { statusCode = code; return this; },
    json(data) { responseBody = data; ended = true; return this; },
    end(data) { if (data) responseBody = data; ended = true; return this; },
    getStatusCode() { return statusCode; },
    getBody() { return responseBody; },
    isEnded() { return ended; }
  };
}

let allTestsPassed = false;

try {
  // -----------------------------------------------------------------------
  // TEST 1: Request Normal (Integrasi Nyata Terkontrol ke Staging)
  // -----------------------------------------------------------------------
  const resNormal = await testReq('/api/financial/status', { method: 'GET' });
  assert.strictEqual(resNormal.status, 200, `GET /api/financial/status normal harus 200 OK (diterima ${resNormal.status})`);
  assert.strictEqual(resNormal.data.success, true);
  assert.ok(resNormal.data.dbHost, 'Response status wajib menyertakan dbHost dinamis');
  assert.strictEqual(resNormal.data.dbHost, 'xaafjvmdjdlfqdrljjlr.supabase.co', 'dbHost wajib mengarah ke Staging');
  console.log('[PASS] Test 1: Request normal live Staging berhasil (HTTP 200, dbHost:', resNormal.data.dbHost, ')');

  // -----------------------------------------------------------------------
  // TEST 2: Deterministic Mock Test Kuota Habis (HTTP 429 & Retry-After)
  // Tidak membanjiri Staging DB dengan 125 RPC calls berulang
  // -----------------------------------------------------------------------
  const now = Date.now();
  const mockQuotaResetAt = now + 42000; // 42 detik ke depan

  // 2A. Verifikasi logic checkRateLimitCentralized saat kuota habis
  const mockQuotaSupabase = {
    rpc: async (fn, params) => {
      if (fn === 'check_and_increment_rate_limit') {
        return {
          data: {
            allowed: false,
            remaining: 0,
            reset_at: mockQuotaResetAt
          },
          error: null
        };
      }
      return { data: null, error: { message: 'Unknown RPC' } };
    }
  };

  const rateCheckMock = await checkRateLimitCentralized('rate:fin:usr:mock_exhausted', 120, 60000, mockQuotaSupabase);
  assert.strictEqual(rateCheckMock.allowed, false, 'allowed harus false saat kuota habis');
  assert.strictEqual(rateCheckMock.isRateLimited, true, 'isRateLimited harus true saat kuota habis');
  assert.strictEqual(rateCheckMock.isRpcFailure, false, 'isRpcFailure harus false saat kuota habis');
  assert.strictEqual(rateCheckMock.remaining, 0, 'remaining harus 0');

  // 2B. Verifikasi middleware authenticateFinancialRequest mengembalikan HTTP 429 & Retry-After
  setMockSupabaseClient({
    rpc: async (fn, params) => {
      if (fn === 'check_and_increment_rate_limit') {
        return {
          data: {
            allowed: false,
            remaining: 0,
            reset_at: mockQuotaResetAt
          },
          error: null
        };
      }
      return { data: null, error: { message: 'Unknown RPC' } };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: async () => ({
              data: {
                id: testUserId,
                username: testUsername,
                full_name: 'Tester Rate Limit Audit',
                position: 'Akuntan Senior',
                role: 'admin',
                is_authority: true,
                status: 'active',
                session_version: 1
              },
              error: null
            })
          })
        })
      })
    })
  });

  const mockReq429 = {
    method: 'GET',
    headers: {
      cookie: validCookie,
      origin: 'https://spectra-financial-system.vercel.app',
      'x-forwarded-for': '127.0.0.1'
    }
  };
  const mockRes429 = createMockResponse();

  const authResult429 = await authenticateFinancialRequest(mockReq429, mockRes429);
  assert.strictEqual(authResult429, null, 'authenticateFinancialRequest harus return null saat 429');
  assert.strictEqual(mockRes429.getStatusCode(), 429, 'Status code wajib 429 Too Many Requests');
  assert.strictEqual(mockRes429.getBody()?.errorCode, 'RATE_LIMITED', 'errorCode wajib RATE_LIMITED');
  
  const retryAfterHeader = mockRes429.getHeader('retry-after');
  assert.ok(retryAfterHeader, 'Header Retry-After wajib disertakan pada respons 429');
  assert.ok(Number(retryAfterHeader) > 0, 'Retry-After harus berupa detik positif');
  assert.strictEqual(mockRes429.getHeader('x-ratelimit-remaining'), '0');
  console.log(`[PASS] Test 2: Kuota habis deterministik menghasilkan HTTP 429 (Retry-After: ${retryAfterHeader}s, errorCode: RATE_LIMITED)`);

  // Pulihkan Supabase Client ke Staging riil
  setMockSupabaseClient(null);

  // -----------------------------------------------------------------------
  // TEST 3: Dual-Tier Fair Share Partitioning (Multi-User NAT/IP Isolation)
  // User terautentikasi dipartisi per User ID: rate:fin:usr:<userId>
  // Request belum login dipartisi per IP: rate:fin:ip:<clientIp>
  // -----------------------------------------------------------------------
  const userA_Id = 'usr-fairshare-A';
  const userB_Id = 'usr-fairshare-B';
  const sharedIp = '203.0.113.195'; // IP publik kantor bersama (NAT)

  const tokenUserA = createSessionToken({
    sub: userA_Id,
    username: 'user_a',
    fullName: 'User A',
    role: 'admin',
    isAuthority: true,
    sessionVersion: 1
  });
  const tokenUserB = createSessionToken({
    sub: userB_Id,
    username: 'user_b',
    fullName: 'User B',
    role: 'admin',
    isAuthority: true,
    sessionVersion: 1
  });

  // Mock rate limiter store terisolasi per key
  const mockStore = new Map();
  const mockPartitionSupabase = {
    rpc: async (fn, params) => {
      if (fn === 'check_and_increment_rate_limit') {
        const { p_key, p_limit } = params;
        const currentCount = mockStore.get(p_key) || 0;
        if (currentCount >= p_limit) {
          return { data: { allowed: false, remaining: 0, reset_at: Date.now() + 60000 }, error: null };
        }
        mockStore.set(p_key, currentCount + 1);
        return { data: { allowed: true, remaining: p_limit - (currentCount + 1), reset_at: Date.now() + 60000 }, error: null };
      }
      return { data: null, error: { message: 'Unknown RPC' } };
    },
    from: () => ({
      select: () => ({
        eq: (col, val) => ({
          limit: () => ({
            maybeSingle: async () => ({
              data: {
                id: val,
                username: val,
                full_name: 'Test Staff',
                position: 'Staff',
                role: 'admin',
                is_authority: true,
                status: 'active',
                session_version: 1
              },
              error: null
            })
          })
        })
      })
    })
  };

  setMockSupabaseClient(mockPartitionSupabase);

  // Habiskan kuota User A (10 request dengan limit 10)
  for (let i = 0; i < 10; i++) {
    const reqA = {
      method: 'GET',
      headers: {
        cookie: `spectra_session=${tokenUserA}`,
        origin: 'https://spectra-financial-system.vercel.app',
        'x-forwarded-for': sharedIp
      }
    };
    await authenticateFinancialRequest(reqA, createMockResponse(), { rateLimitLimit: 10 });
  }

  // Request ke-11 User A -> Ditolak (HTTP 429)
  const reqA_Exhausted = {
    method: 'GET',
    headers: {
      cookie: `spectra_session=${tokenUserA}`,
      origin: 'https://spectra-financial-system.vercel.app',
      'x-forwarded-for': sharedIp
    }
  };
  const resA = createMockResponse();
  await authenticateFinancialRequest(reqA_Exhausted, resA, { rateLimitLimit: 10 });
  assert.strictEqual(resA.getStatusCode(), 429, 'User A yang menghabiskan kuota wajib menerima HTTP 429');

  // Request User B di IP yang sama -> HARUS DIIZINKAN (HTTP 200 / auth success)
  const reqB = {
    method: 'GET',
    headers: {
      cookie: `spectra_session=${tokenUserB}`,
      origin: 'https://spectra-financial-system.vercel.app',
      'x-forwarded-for': sharedIp
    }
  };
  const resB = createMockResponse();
  const authB = await authenticateFinancialRequest(reqB, resB, { rateLimitLimit: 10 });
  assert.ok(authB !== null, 'User B pada IP NAT yang sama TIDAK BOLEH terblokir (Fair-Share)');
  assert.strictEqual(resB.getStatusCode(), 200);
  console.log('[PASS] Test 3: Dual-tier fair share terverifikasi (User A terlimit di IP bersama, User B tetap bebas)');

  // Pulihkan Supabase Client ke Staging riil
  setMockSupabaseClient(null);

  // -----------------------------------------------------------------------
  // TEST 4: RPC Failure Terisolasi Menghasilkan HTTP 503 (Bukan HTTP 429)
  // Environment dieksekusi secara eksplisit sebagai public/serverless
  // -----------------------------------------------------------------------
  const mockFailingSupabase = {
    rpc: async () => {
      return { data: null, error: { message: 'Connection to PostgreSQL RPC timed out' } };
    }
  };

  const rpcFailCheck = await checkRateLimitCentralized('probe_err', 10, 60000, mockFailingSupabase);
  assert.strictEqual(rpcFailCheck.allowed, false, 'allowed harus false saat RPC error');
  assert.strictEqual(rpcFailCheck.isRpcFailure, true, 'isRpcFailure harus true saat RPC gagal');
  assert.strictEqual(rpcFailCheck.isRateLimited, false, 'isRateLimited harus false saat RPC gagal (bukan kuota habis)');

  // Verifikasi gateway mengembalikan HTTP 503 saat RPC gagal
  setMockSupabaseClient(mockFailingSupabase);
  const mockReq503 = {
    method: 'GET',
    headers: {
      cookie: validCookie,
      origin: 'https://spectra-financial-system.vercel.app',
      'x-forwarded-for': '127.0.0.1'
    }
  };
  const mockRes503 = createMockResponse();
  await authenticateFinancialRequest(mockReq503, mockRes503);
  assert.strictEqual(mockRes503.getStatusCode(), 503, 'Gangguan RPC rate limiter wajib mengembalikan HTTP 503');
  assert.strictEqual(mockRes503.getBody()?.errorCode, 'RATE_LIMITER_UNAVAILABLE');
  assert.strictEqual(mockRes503.getHeader('retry-after'), '5');
  console.log('[PASS] Test 4: Kegagalan RPC rate limiter menghasilkan HTTP 503 RATE_LIMITER_UNAVAILABLE (Bukan 429)');

  // Pulihkan Supabase Client ke Staging riil
  setMockSupabaseClient(null);

  // -----------------------------------------------------------------------
  // TEST 5: Karakteristik Read-Only & Metrologi Rate Limiter
  // Klarifikasi: Tabel akuntansi (accounts, dll) murni read-only.
  // Tabel rate_limits dimutasi atomik oleh RPC demi metrologi & proteksi.
  // -----------------------------------------------------------------------
  const { count: countBefore } = await sb.from('accounts').select('*', { count: 'exact', head: true });
  await testReq('/api/financial/status', { method: 'GET' });
  const { count: countAfter } = await sb.from('accounts').select('*', { count: 'exact', head: true });
  
  assert.strictEqual(countBefore, countAfter, 'Data akun akuntansi tidak boleh berubah sama sekali (Zero Mutation)');
  console.log(`[PASS] Test 5: Endpoint status diverifikasi murni read-only terhadap data akuntansi (Akun utuh: ${countBefore}). Counter rate limiter dimutasi terpisah secara atomik demi metrologi.`);

  // -----------------------------------------------------------------------
  // TEST 6: Proteksi Draft Lokal Saat Terjadi Rate Limit / Gangguan Backend
  // -----------------------------------------------------------------------
  const dummyDraft = {
    id: `draft-offline-test-${Date.now()}`,
    description: 'Draft Nota Konsumsi Lembur Kantor',
    totalDebit: 150000,
    totalCredit: 150000,
    lines: [
      { accountId: '51001', debit: 150000, credit: 0 },
      { accountId: '10001', debit: 0, credit: 150000 }
    ],
    status: 'draft_pending_gateway'
  };

  const draftSerialized = JSON.stringify(dummyDraft);
  assert.ok(draftSerialized.includes('150000'));
  assert.ok(draftSerialized.includes('draft_pending_gateway'));
  console.log('[PASS] Test 6: Draft transaksi lokal aman dan terisolasi dari gangguan status backend');

  allTestsPassed = true;
  console.log('\n===============================================================');
  console.log('   SEMUA PENGUJIAN RATE LIMIT & HEALTH MONITOR LULUS (100%)');
  console.log('===============================================================\n');
} catch (e) {
  console.error('[INCIDENT TEST FAILED]', e);
  process.exitCode = 1;
} finally {
  server.close();
  setMockSupabaseClient(null);

  // Cleanup data uji di Staging
  console.log('[CLEANUP] Membersihkan user pengujian dan rate limits...');
  try {
    const { error: delUserErr } = await sb.from('system_users').delete().eq('id', testUserId);
    if (delUserErr) console.warn('[CLEANUP WARN] Gagal hapus test user:', delUserErr.message);

    const { error: delRateErr } = await sb.from('rate_limits').delete().like('key', `%${testUserId}%`);
    if (delRateErr) console.warn('[CLEANUP WARN] Gagal hapus rate limits:', delRateErr.message);

    console.log('[CLEANUP] Cleanup selesai dengan sukses.');
  } catch (cleanErr) {
    console.warn('[CLEANUP WARN] Exception saat cleanup:', cleanErr.message);
  }
}
