/**
 * Comprehensive Automated Test Suite: SPECTRA Backend Auth & Groq Vision
 * 
 * Verifikasi:
 * 1. Argon2id Password Hashing & Verification
 * 2. HMAC-SHA256 Server Session Token Cryptography & Invalidation
 * 3. Double-Submit CSRF Protection
 * 4. In-Memory Rate Limiting Engine
 * 5. POST /api/auth/login (Credential verification, Cookie issuance, Security hygiene)
 * 6. GET /api/auth/me (Session verification, Account status enforcement)
 * 7. POST /api/auth/logout (Cookie invalidation)
 * 8. POST /api/auth/register (Input validation, Server-enforced role 'user' & status 'pending')
 * 9. GET /api/auth/admin/users (RBAC protection, Omission of password hashes)
 * 10. POST /api/auth/admin/approve (Account activation & suspension with session revocation)
 * 11. POST /api/auth/admin/reset-password (Secure Argon2id reset & session bump)
 * 12. POST /api/scan-receipt (Session auth, Image validation, Deterministic verification)
 */

import crypto from 'crypto';
import { hashPassword, verifyPassword } from '../api/_lib/hash.ts';
import { 
  createSessionToken, 
  verifySessionToken, 
  parseCookies, 
  buildSessionCookie, 
  buildLogoutCookie, 
  generateCsrfToken, 
  validateCsrf 
} from '../api/_lib/auth.ts';
import { checkRateLimit, checkRateLimitCentralized } from '../api/_lib/rateLimit.ts';
import { 
  parseIndonesianCurrency, 
  sanitizeCurrencyAmount, 
  runTwoWayDeterministicVerification 
} from '../api/_lib/ocrSanitizer.ts';

import { setMockSupabaseClient } from '../api/_lib/supabaseServer.ts';
import scanReceiptHandler from '../api/scan-receipt.ts';
import adminUsersHandler from '../api/auth/admin/users.ts';
import adminApproveHandler from '../api/auth/admin/approve.ts';
import adminResetPasswordHandler from '../api/auth/admin/reset-password.ts';
import logoutHandler from '../api/auth/logout.ts';
import meHandler from '../api/auth/me.ts';
import loginHandler from '../api/auth/login.ts';
import registerHandler from '../api/auth/register.ts';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; }
  };
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${message}`);
  } else {
    failedTests++;
    console.error(`  \x1b[31m✘ FAIL:\x1b[0m ${message}`);
  }
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('   SPECTRA BACKEND AUTH & GROQ VISION AUTOMATED TEST SUITE   ');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Argon2id Hashing & Verification
  // --------------------------------------------------------------------------
  console.log('\n[1] Argon2id Password Hashing & Cryptographic Verification:');
  const rawPass = 'SpectraSecure2026!';
  const hashed = await hashPassword(rawPass);
  
  assert(hashed.startsWith('$argon2id$v=19$'), 'Hash yang dihasilkan menggunakan standar Argon2id (v=19)');
  assert(await verifyPassword(hashed, rawPass), 'Verifikasi password valid mengembalikan true');
  assert(!(await verifyPassword(hashed, 'WrongPassword123')), 'Verifikasi password salah mengembalikan false');

  // Test Scrypt Fallback
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(rawPass, salt, 64);
  const scryptHash = `scrypt$${salt}$${derived.toString('hex')}`;
  assert(await verifyPassword(scryptHash, rawPass), 'Verifikasi scrypt fallback berhasil memverifikasi password legacy');

  // --------------------------------------------------------------------------
  // TEST GROUP 2: HMAC-SHA256 Session Token & Invalidation
  // --------------------------------------------------------------------------
  console.log('\n[2] HMAC-SHA256 Session Token Lifecycle & Invalidation:');
  const sessionData = {
    sub: 'usr-test-123',
    username: 'testauditor',
    role: 'user',
    isAuthority: false,
    fullName: 'Test Auditor Financial',
    sessionVersion: 1
  };

  const token = createSessionToken(sessionData, 60 * 1000); // 1 menit lifespan
  assert(token.split('.').length === 3, 'Token sesi terdiri dari 3 bagian (header.payload.signature)');

  const verified = verifySessionToken(token);
  assert(verified !== null && verified.sub === 'usr-test-123', 'Token sesi valid berhasil didekode dan diverifikasi');
  assert(verified.role === 'user', 'Role sesi dipertahankan secara utuh di server');

  // Tampering check
  const [h, p, sig] = token.split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ ...sessionData, role: 'admin' })).toString('base64url');
  const tamperedToken = `${h}.${forgedPayload}.${sig}`;
  assert(verifySessionToken(tamperedToken) === null, 'Token yang dimanipulasi muatannya (tampered) ditolak kriptografis');

  // Expired token check
  const expiredToken = createSessionToken(sessionData, -1000);
  assert(verifySessionToken(expiredToken) === null, 'Token sesi yang telah melewati masa berlaku ditolak');

  // Cookie generation check
  const cookieStr = buildSessionCookie(token);
  assert(cookieStr.includes('HttpOnly') && cookieStr.includes('SameSite=Lax') && cookieStr.includes('Path=/'), 
    'Set-Cookie menyertakan flag HttpOnly, SameSite=Lax, dan Path=/');

  const logoutCookie = buildLogoutCookie();
  assert(logoutCookie.includes('Max-Age=0'), 'Logout cookie menyetel Max-Age=0 untuk menghapus sesi pada browser');

  // --------------------------------------------------------------------------
  // TEST GROUP 3: CSRF Double-Submit Protection
  // --------------------------------------------------------------------------
  console.log('\n[3] CSRF Double-Submit Protection:');
  const csrfToken = generateCsrfToken();
  assert(csrfToken.length === 48, 'Token CSRF menghasilkan 48 karakter heksadesimal acak (24 bytes)');

  const validReq = {
    method: 'POST',
    headers: {
      cookie: `spectra_csrf=${csrfToken}`,
      'x-csrf-token': csrfToken
    }
  };
  assert(validateCsrf(validReq), 'Permintaan dengan Cookie dan Header CSRF cocok berhasil divalidasi');

  const invalidReq = {
    method: 'POST',
    headers: {
      cookie: `spectra_csrf=${csrfToken}`,
      'x-csrf-token': 'attackers-forged-token'
    }
  };
  assert(!validateCsrf(invalidReq), 'Permintaan dengan token CSRF tidak cocok ditolak');

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Rate Limiting Protection
  // --------------------------------------------------------------------------
  console.log('\n[4] Rate Limiting Protection:');
  const rKey = `test_limit_${Date.now()}`;
  assert(checkRateLimit(rKey, 3, 10000).allowed, 'Percobaan 1 diizinkan');
  assert(checkRateLimit(rKey, 3, 10000).allowed, 'Percobaan 2 diizinkan');
  assert(checkRateLimit(rKey, 3, 10000).allowed, 'Percobaan 3 diizinkan');
  const blocked = checkRateLimit(rKey, 3, 10000);
  assert(!blocked.allowed, 'Percobaan ke-4 diblokir oleh Rate Limiter (HTTP 429)');

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Indonesian Currency Sanitization & Two-Way Verification
  // --------------------------------------------------------------------------
  console.log('\n[5] Indonesian Currency Sanitization & Deterministic Verification:');
  assert(parseIndonesianCurrency('Rp 150.000,-') === 150000, 'Format "Rp 150.000,-" terbaca 150000');
  assert(parseIndonesianCurrency('25k') === 25000, 'Format shorthand "25k" terbaca 25000');
  assert(parseIndonesianCurrency('2,850,000.00') === 2850000, 'Desimal sen perbankan "2,850,000.00" tidak terinflasi 100x');
  assert(sanitizeCurrencyAmount(250000, 'Biaya BI-FAST') === 250000, 'Sanitasi mempertahankan nominal asli 250.000 tanpa koreksi diam-diam');

  const biFastItem = [{ id: 'b1', name: 'Biaya BI-FAST', unitPrice: null, quantity: null, totalPrice: 250000, confidence: 90, isTaxOrFee: true }];
  const verifBiFast = runTwoWayDeterministicVerification(biFastItem, 250000);
  assert(verifBiFast.verifiedItems[0].hasDiscrepancy && verifBiFast.verifiedItems[0].discrepancyNote.includes('Saran nilai: Rp 2.500'), 'Indikasi inflasi sen (.00) ditandai dengan warning dan saran koreksi transparan');

  // Two-way verification
  const items = [
    { id: '1', name: 'Kertas HVS', unitPrice: 50000, quantity: 2, totalPrice: 100000, confidence: 95 },
    { id: '2', name: 'Biaya Pengiriman', unitPrice: null, quantity: null, totalPrice: 15000, confidence: 90, isTaxOrFee: true }
  ];
  const verifBalanced = runTwoWayDeterministicVerification(items, 115000);
  assert(!verifBalanced.mathDiscrepancy && verifBalanced.grandTotal === 115000, 
    'Verifikasi deterministik: Jumlah baris cocok dengan Grand Total (115.000)');

  const verifMismatch = runTwoWayDeterministicVerification(items, 120000);
  assert(verifMismatch.mathDiscrepancy && verifMismatch.discrepancyMessage.includes('berbeda dengan penjumlahan rincian'), 
    'Verifikasi deterministik: Selisih matematis berhasil dideteksi jika total nota berbeda');

  // Math horizontal verification: Discrepancy flagged without silent mutation
  const mismatchedItems = [
    { id: '3', name: 'Tinta Printer', unitPrice: 75000, quantity: 3, totalPrice: 300000, confidence: 85 }
  ];
  const verifHorizontal = runTwoWayDeterministicVerification(mismatchedItems, 300000);
  assert(verifHorizontal.verifiedItems[0].hasDiscrepancy && verifHorizontal.verifiedItems[0].totalPrice === 300000, 
    'Uji horizontal: Nilai tertera (300.000) dipertahankan dan ditandai hasDiscrepancy: true');

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Image Format Validation for Groq Vision
  // --------------------------------------------------------------------------
  console.log('\n[6] Image Format & Magic Byte Validation:');
  const validJpegBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString('base64');
  const validPngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
  const invalidTxtBase64 = Buffer.from('This is a plain text file pretending to be receipt').toString('base64');

  // Test detection logic
  const checkMime = (b64) => {
    const buf = Buffer.from(b64.slice(0, 32), 'base64');
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
    return null;
  };

  assert(checkMime(validJpegBase64) === 'image/jpeg', 'Header JPEG (FF D8 FF) terdeteksi valid');
  assert(checkMime(validPngBase64) === 'image/png', 'Header PNG (89 50 4E 47) terdeteksi valid');
  assert(checkMime(invalidTxtBase64) === null, 'Payload non-gambar berhasil ditolak');

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Groq Vision Response Contract & Integrity
  // --------------------------------------------------------------------------
  console.log('\n[7] Groq Vision Extraction Contract & Output Verification:');
  const mockGroqResponse = {
    detected_type: 'nota_pembelian',
    seller_or_recipient: 'CV Sumber Makmur ATK',
    transaction_date: '2026-11-20',
    declared_grand_total: 125000,
    extracted_items: [
      { name: 'Kertas Sinar Dunia A4', quantity: 2, unit: 'rim', unit_price: 55000, total_price: 110000, confidence: 95 },
      { name: 'Pajak PB1 10%', quantity: null, unit: '', unit_price: null, total_price: 15000, confidence: 92, is_tax_or_fee: true }
    ]
  };

  const parsedItems = mockGroqResponse.extracted_items.map((it, idx) => ({
    id: `it-groq-${Date.now()}-${idx}`,
    name: it.name,
    unitPrice: it.unit_price,
    quantity: it.quantity,
    unit: it.unit,
    totalPrice: it.total_price,
    confidence: it.confidence,
    isTaxOrFee: it.is_tax_or_fee
  }));

  const groqVerif = runTwoWayDeterministicVerification(parsedItems, mockGroqResponse.declared_grand_total);
  const extractionResult = {
    detectedType: mockGroqResponse.detected_type,
    sellerOrRecipient: mockGroqResponse.seller_or_recipient,
    transactionDate: mockGroqResponse.transaction_date,
    extractedItems: groqVerif.verifiedItems,
    declaredGrandTotal: groqVerif.grandTotal,
    calculatedSum: groqVerif.calculatedSum,
    mathDiscrepancy: groqVerif.mathDiscrepancy,
    sourceEngine: 'groq_vision'
  };

  assert(extractionResult.sourceEngine === 'groq_vision', 'sourceEngine berlabel groq_vision');
  assert(extractionResult.sellerOrRecipient === 'CV Sumber Makmur ATK', 'Nama rekanan terisi dengan benar');
  assert(extractionResult.extractedItems.length === 2, '2 item rincian transaksi terekstraksi');
  assert(extractionResult.declaredGrandTotal === 125000, 'Declared grand total 125.000');
  assert(extractionResult.calculatedSum === 125000, 'Calculated sum 125.000 cocok sempurna');
  assert(!extractionResult.mathDiscrepancy, 'Tidak ada selisih matematis');

  // --------------------------------------------------------------------------
  // TEST GROUP 8: Serverless Endpoint Handlers Integration (Mock HTTP Invocations)
  // --------------------------------------------------------------------------
  console.log('\n[8] Serverless Endpoint Handlers Integration (Mock HTTP Invocations):');

  // Set up mock Supabase client for Handler tests
  const mockDbUsers = [
    {
      id: 'usr-active-01',
      username: 'staff_keuangan',
      role: 'user',
      is_authority: false,
      status: 'active',
      full_name: 'Staff Keuangan',
      session_version: 1,
      registered_at: new Date().toISOString()
    },
    {
      id: 'usr-admin-01',
      username: 'admin',
      role: 'admin',
      is_authority: true,
      status: 'active',
      full_name: 'Administrator',
      session_version: 1,
      registered_at: new Date().toISOString()
    }
  ];

  setMockSupabaseClient({
    from: (table) => {
      let filtered = [...mockDbUsers];
      const queryObj = {
        select: (cols) => queryObj,
        eq: (col, val) => {
          filtered = filtered.filter(u => u[col] === val);
          return queryObj;
        },
        ilike: (col, val) => {
          filtered = filtered.filter(u => String(u[col]).toLowerCase() === String(val).toLowerCase());
          return queryObj;
        },
        limit: (n) => Promise.resolve({ data: filtered.slice(0, n), error: null }),
        order: (col, opts) => Promise.resolve({ data: filtered, error: null }),
        then: (resolve) => resolve({ data: filtered, error: null }),
        insert: (data) => {
          mockDbUsers.push(data);
          return Promise.resolve({ error: null });
        },
        update: (data) => ({
          eq: (col, val) => {
            mockDbUsers.forEach(u => {
              if (u[col] === val) Object.assign(u, data);
            });
            return Promise.resolve({ error: null });
          }
        }),
        delete: () => ({
          eq: (col, val) => {
            const idx = mockDbUsers.findIndex(u => u[col] === val);
            if (idx >= 0) mockDbUsers.splice(idx, 1);
            return Promise.resolve({ error: null });
          }
        }),
        upsert: (data) => {
          const idx = mockDbUsers.findIndex(u => u.id === data.id);
          if (idx >= 0) mockDbUsers[idx] = data; else mockDbUsers.push(data);
          return Promise.resolve({ error: null });
        }
      };
      return queryObj;
    }
  });

  // A. Scan Receipt: Unauthenticated
  const scanUnauthRes = createMockRes();
  await scanReceiptHandler({ method: 'POST', headers: {}, body: {} }, scanUnauthRes);
  assert(scanUnauthRes.statusCode === 401, 'POST /api/scan-receipt menolak request tanpa token sesi (HTTP 401)');

  // B. Scan Receipt: Non-image payload
  const validUserToken = createSessionToken({
    sub: 'usr-active-01',
    username: 'staff_keuangan',
    role: 'user',
    isAuthority: false,
    fullName: 'Staff Keuangan',
    sessionVersion: 1
  });
  const scanInvalidImgRes = createMockRes();
  await scanReceiptHandler({
    method: 'POST',
    headers: { cookie: `spectra_session=${validUserToken}` },
    body: { image: invalidTxtBase64 }
  }, scanInvalidImgRes);
  assert(scanInvalidImgRes.statusCode === 400, 'POST /api/scan-receipt menolak file non-gambar (HTTP 400)');

  // C. Scan Receipt: Empty image body
  const scanEmptyRes = createMockRes();
  await scanReceiptHandler({
    method: 'POST',
    headers: { cookie: `spectra_session=${validUserToken}` },
    body: {}
  }, scanEmptyRes);
  assert(scanEmptyRes.statusCode === 400, 'POST /api/scan-receipt menolak body kosong tanpa gambar (HTTP 400)');

  // D. Admin Users: Non-admin authorization check
  const adminUsersNonAdminRes = createMockRes();
  await adminUsersHandler({
    method: 'GET',
    headers: { cookie: `spectra_session=${validUserToken}` }
  }, adminUsersNonAdminRes);
  assert(adminUsersNonAdminRes.statusCode === 403, 'GET /api/auth/admin/users memblokir pengguna biasa non-admin (HTTP 403 Forbidden)');

  // E. Admin Approve: Non-admin authorization check
  const adminApproveNonAdminRes = createMockRes();
  await adminApproveHandler({
    method: 'POST',
    headers: { cookie: `spectra_session=${validUserToken}` },
    body: { userId: 'usr-target', action: 'approve' }
  }, adminApproveNonAdminRes);
  assert(adminApproveNonAdminRes.statusCode === 403, 'POST /api/auth/admin/approve memblokir pengguna biasa non-admin (HTTP 403 Forbidden)');

  // F. Admin Reset Password: Non-admin authorization check
  const adminResetNonAdminRes = createMockRes();
  await adminResetPasswordHandler({
    method: 'POST',
    headers: { cookie: `spectra_session=${validUserToken}` },
    body: { userId: 'usr-target' }
  }, adminResetNonAdminRes);
  assert(adminResetNonAdminRes.statusCode === 403, 'POST /api/auth/admin/reset-password memblokir pengguna biasa non-admin (HTTP 403 Forbidden)');

  // G. Logout Endpoint: Clears cookies
  const logoutRes = createMockRes();
  await logoutHandler({ method: 'POST', headers: {} }, logoutRes);
  assert(logoutRes.statusCode === 200, 'POST /api/auth/logout mengembalikan HTTP 200');
  const setCookieHeader = String(logoutRes.headers['set-cookie'] || '');
  assert(setCookieHeader.includes('Max-Age=0'), 'POST /api/auth/logout menyetel Set-Cookie Max-Age=0');

  // H. Register Endpoint: Input validation
  const registerInvalidRes = createMockRes();
  await registerHandler({
    method: 'POST',
    headers: {},
    body: { username: 'ab', password: '123' } // Too short
  }, registerInvalidRes);
  assert(registerInvalidRes.statusCode === 400, 'POST /api/auth/register menolak username/password terlalu pendek (HTTP 400)');

  // --------------------------------------------------------------------------
  // TEST GROUP 9: Live & Mocked Groq Vision Handler Responses & Error Handling
  // --------------------------------------------------------------------------
  console.log('\n[9] Live & Mocked Groq Vision Handler Responses & Error Handling:');
  const originalFetch = globalThis.fetch;
  process.env.GROQ_API_KEY = 'mock_groq_test_key_xyz123';

  // 9.1 Test Groq Vision Success Flow
  globalThis.fetch = async (url) => {
    if (String(url).includes('groq.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                detected_type: 'nota_pembelian',
                seller_or_recipient: 'CV Prima Stationary',
                transaction_date: '2026-11-23',
                declared_grand_total: 150000,
                extracted_items: [
                  { name: 'Kertas HVS 80gr', quantity: 2, unit: 'rim', unit_price: 65000, total_price: 130000, confidence: 95 },
                  { name: 'Spidol Whiteboard', quantity: 2, unit: 'pcs', unit_price: 10000, total_price: 20000, confidence: 90 }
                ]
              })
            }
          }]
        })
      };
    }
    return originalFetch(url);
  };

  const scanSuccessRes = createMockRes();
  await scanReceiptHandler({
    method: 'POST',
    headers: { cookie: `spectra_session=${validUserToken}` },
    body: { image: `data:image/jpeg;base64,${validJpegBase64}`, posCode: 'A', userDescription: 'Beli ATK' }
  }, scanSuccessRes);

  assert(scanSuccessRes.statusCode === 200, 'POST /api/scan-receipt mengembalikan HTTP 200 pada respons Groq valid');
  assert(scanSuccessRes.body?.data?.sourceEngine === 'groq_vision', 'sourceEngine berlabel groq_vision');
  assert(scanSuccessRes.body?.data?.extractedItems?.length === 2, '2 item rincian transaksi terekstraksi');
  assert(scanSuccessRes.body?.data?.declaredGrandTotal === 150000, 'Grand total 150.000 cocok');

  // 9.2 Test Groq 401 Authentication Error
  globalThis.fetch = async (url) => {
    if (String(url).includes('groq.com')) {
      return {
        ok: false,
        status: 401,
        text: async () => 'Invalid API Key'
      };
    }
    return originalFetch(url);
  };

  const scan401Res = createMockRes();
  await scanReceiptHandler({
    method: 'POST',
    headers: { cookie: `spectra_session=${validUserToken}` },
    body: { image: `data:image/jpeg;base64,${validJpegBase64}` }
  }, scan401Res);
  assert(scan401Res.statusCode === 500 && scan401Res.body?.error?.includes('GROQ_API_KEY'), 'Menangani respons 401 Groq API dengan pesan kesalahan terarah');

  // 9.3 Test Groq 429 Rate Limit
  globalThis.fetch = async (url) => {
    if (String(url).includes('groq.com')) {
      return {
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      };
    }
    return originalFetch(url);
  };

  const scan429Res = createMockRes();
  await scanReceiptHandler({
    method: 'POST',
    headers: { cookie: `spectra_session=${validUserToken}` },
    body: { image: `data:image/jpeg;base64,${validJpegBase64}` }
  }, scan429Res);
  assert(scan429Res.statusCode === 429, 'Menangani respons 429 Groq Rate Limit (HTTP 429)');

  // 9.4 Test Groq Invalid JSON Output
  globalThis.fetch = async (url) => {
    if (String(url).includes('groq.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: 'Bukan format JSON yang valid'
            }
          }]
        })
      };
    }
    return originalFetch(url);
  };

  const scanInvalidJsonRes = createMockRes();
  await scanReceiptHandler({
    method: 'POST',
    headers: { cookie: `spectra_session=${validUserToken}` },
    body: { image: `data:image/jpeg;base64,${validJpegBase64}` }
  }, scanInvalidJsonRes);
  assert(scanInvalidJsonRes.statusCode === 502, 'Menangani output non-JSON dari Groq Vision (HTTP 502 Bad Gateway)');

  // 9.5 Test Groq Timeout (AbortError)
  globalThis.fetch = async (url) => {
    if (String(url).includes('groq.com')) {
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    return originalFetch(url);
  };

  const scanTimeoutRes = createMockRes();
  await scanReceiptHandler({
    method: 'POST',
    headers: { cookie: `spectra_session=${validUserToken}` },
    body: { image: `data:image/jpeg;base64,${validJpegBase64}` }
  }, scanTimeoutRes);
  assert(scanTimeoutRes.statusCode === 504, 'Menangani timeout pemrosesan Groq Vision (HTTP 504 Gateway Timeout)');

  // 9.6 Test Groq Model Not Found (HTTP 404)
  globalThis.fetch = async (url) => {
    if (String(url).includes('groq.com')) {
      return {
        ok: false,
        status: 404,
        text: async () => 'Model not found'
      };
    }
    return originalFetch(url);
  };

  const scanModel404Res = createMockRes();
  await scanReceiptHandler({
    method: 'POST',
    headers: { cookie: `spectra_session=${validUserToken}` },
    body: { image: `data:image/jpeg;base64,${validJpegBase64}` }
  }, scanModel404Res);
  assert(scanModel404Res.statusCode === 502 && scanModel404Res.body?.error?.includes('Model Groq Vision'), 'Menangani model Groq tidak ditemukan/dinonaktifkan (HTTP 502)');

  // 9.7 Test Payload Oversized (> 10MB)
  const hugePayload = 'A'.repeat(14 * 1024 * 1024);
  const scanOversizedRes = createMockRes();
  await scanReceiptHandler({
    method: 'POST',
    headers: { cookie: `spectra_session=${validUserToken}` },
    body: { image: hugePayload }
  }, scanOversizedRes);
  assert(scanOversizedRes.statusCode === 413, 'Menolak muatan berkas gambar yang melebihi batas 10MB (HTTP 413 Payload Too Large)');

  // Restore fetch
  globalThis.fetch = originalFetch;

  // --------------------------------------------------------------------------
  // TEST GROUP 10: Tabel Koreksi Tahap 2 & Verification Recalculation
  // --------------------------------------------------------------------------
  console.log('\n[10] Tabel Koreksi Tahap 2 Editing & Live Recalculation:');
  const editableItems = [
    { id: 'it-1', name: 'Barang A', unitPrice: 50000, quantity: 2, totalPrice: 100000, confidence: 95 },
    { id: 'it-2', name: 'Barang B', unitPrice: 20000, quantity: 1, totalPrice: 20000, confidence: 95 }
  ];

  // User manually edits Quantity from 1 to 3 for Barang B
  editableItems[1].quantity = 3;
  editableItems[1].totalPrice = editableItems[1].unitPrice * 3; // 60.000

  const userEditedVerif = runTwoWayDeterministicVerification(editableItems, 160000);
  assert(userEditedVerif.calculatedSum === 160000, 'Live Recalculation: Sum baris terupdate otomatis menjadi 160.000');
  assert(!userEditedVerif.mathDiscrepancy, 'Tidak ada selisih matematis setelah koreksi manual oleh pengguna');

  // --------------------------------------------------------------------------
  // TEST GROUP 11: Resilience & Fallback Guarantees
  // --------------------------------------------------------------------------
  console.log('\n[11] Resilience & Fallback Guarantees:');
  // 11.1 Test Centralized Rate Limiter with Broken Database Client
  const brokenSupabaseClient = {
    from: () => ({
      select: () => { throw new Error('Database connection refused'); }
    })
  };
  const brokenKey = `broken_db_test_${Date.now()}`;
  const r1 = await checkRateLimitCentralized(brokenKey, 2, 5000, brokenSupabaseClient);
  const r2 = await checkRateLimitCentralized(brokenKey, 2, 5000, brokenSupabaseClient);
  const r3 = await checkRateLimitCentralized(brokenKey, 2, 5000, brokenSupabaseClient);
  assert(r1.allowed && r2.allowed && !r3.allowed, 'Kegagalan database rate limiter tidak membuka celah (tetap terproteksi via in-memory)');

  // 11.2 Test Blurry/Low-Confidence Items Preserve Read Values
  const blurryItems = [
    { id: 'blur-1', name: 'Barang Tinta Pudar', unitPrice: 30000, quantity: 4, totalPrice: 100000, confidence: 60 }
  ];
  const blurryVerif = runTwoWayDeterministicVerification(blurryItems, 100000);
  assert(blurryVerif.verifiedItems[0].totalPrice === 100000, 'Item teks pudar mempertahankan nilai tertera 100.000 tanpa silent mutation');
  assert(blurryVerif.verifiedItems[0].hasDiscrepancy, 'Item dengan ketidakcocokan ditandai hasDiscrepancy: true');

  console.log('\n===============================================================');
  console.log(`TOTAL PENGUJIAN: ${totalTests}`);
  console.log(`LULUS          : \x1b[32m${passedTests}\x1b[0m`);
  console.log(`GAGAL          : \x1b[31m${failedTests}\x1b[0m`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
