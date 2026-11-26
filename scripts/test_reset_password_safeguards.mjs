/**
 * SPECTRA FINANCIAL SYSTEM — NON-DESTRUCTIVE SAFEGUARD TEST SUITE
 * 
 * Pengujian unit & keamanan murni tanpa memodifikasi database (ZERO MUTATION):
 * 1. Validasi URL HTTPS Supabase Presisi: Tolak userinfo, custom port, path, query, hash.
 * 2. Deteksi Eksekusi CLI Windows dengan Spasi & Format URL.
 * 3. Penolakan Input Non-TTY (Pencegahan Unattended Password Injection).
 * 4. Proteksi Akun Target (ID, Username, Role, Status Active, session_version).
 * 5. Validasi Mutlak Algoritma Hashing Argon2id ($argon2id$).
 * 6. Verifikasi Sanitasi Kredensial Environment.
 */

import assert from 'assert';
import {
  validateSupabaseUrl,
  isDirectCliExecution,
  promptHiddenPassword,
  validateTargetAdminRecord,
  getStagingCredentials,
  EXPECTED_STAGING_HOSTNAME,
  FORBIDDEN_PRODUCTION_HOSTNAME,
  TARGET_ADMIN_ID,
  TARGET_ADMIN_USERNAME,
  TARGET_ADMIN_ROLE
} from './reset_staging_admin_password.mjs';
import { hashPassword, verifyPassword } from '../api/_lib/hash.ts';

console.log('===============================================================');
console.log('   SPECTRA — NON-DESTRUCTIVE RESET PASSWORD SAFEGUARD TESTS   ');
console.log('===============================================================');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error('       └─ Error:', err.message);
    process.exitCode = 1;
  }
}

async function runTestAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error('       └─ Error:', err.message);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// 1. UJI VALIDASI URL SUPABASE & ISOLASI ENVIRONMENT (KETAT)
// ---------------------------------------------------------------------------
runTest('Validasi URL: Menerima HTTPS URL Staging yang bersih', () => {
  const validUrl = `https://${EXPECTED_STAGING_HOSTNAME}`;
  const res = validateSupabaseUrl(validUrl);
  assert.strictEqual(res, `https://${EXPECTED_STAGING_HOSTNAME}`);

  // URL dengan slash di akhir tetap dinormalisasi
  const validUrlSlash = `https://${EXPECTED_STAGING_HOSTNAME}/`;
  const resSlash = validateSupabaseUrl(validUrlSlash);
  assert.strictEqual(resSlash, `https://${EXPECTED_STAGING_HOSTNAME}`);
});

runTest('Validasi URL: Menolak protokol HTTP non-aman', () => {
  assert.throws(
    () => validateSupabaseUrl(`http://${EXPECTED_STAGING_HOSTNAME}`),
    /Protocol URL wajib HTTPS/
  );
});

runTest('Validasi URL: Menolak keras URL Supabase Production', () => {
  assert.throws(
    () => validateSupabaseUrl(`https://${FORBIDDEN_PRODUCTION_HOSTNAME}`),
    /Akses ke Supabase Production .* dilarang keras/
  );
});

runTest('Validasi URL: Menolak hostname peniru / spoofing subdomain', () => {
  assert.throws(
    () => validateSupabaseUrl(`https://${EXPECTED_STAGING_HOSTNAME}.attacker.evil`),
    /Hostname target wajib tepat/
  );
  assert.throws(
    () => validateSupabaseUrl('https://evil-supabase.co'),
    /Hostname target wajib tepat/
  );
});

runTest('Validasi URL: Menolak kredensial username/password dalam URL (userinfo injection)', () => {
  assert.throws(
    () => validateSupabaseUrl(`https://admin:secret@${EXPECTED_STAGING_HOSTNAME}`),
    /URL dilarang memuat kredensial username\/password/
  );
});

runTest('Validasi URL: Menolak port khusus non-standar', () => {
  assert.throws(
    () => validateSupabaseUrl(`https://${EXPECTED_STAGING_HOSTNAME}:8443`),
    /URL dilarang menggunakan port non-standar/
  );
  assert.throws(
    () => validateSupabaseUrl(`https://${EXPECTED_STAGING_HOSTNAME}:4433`),
    /URL dilarang menggunakan port non-standar/
  );
});

runTest('Validasi URL: Menolak path tambahan selain root', () => {
  assert.throws(
    () => validateSupabaseUrl(`https://${EXPECTED_STAGING_HOSTNAME}/rest/v1`),
    /URL dilarang memiliki path tambahan/
  );
  assert.throws(
    () => validateSupabaseUrl(`https://${EXPECTED_STAGING_HOSTNAME}/api`),
    /URL dilarang memiliki path tambahan/
  );
});

runTest('Validasi URL: Menolak query parameters', () => {
  assert.throws(
    () => validateSupabaseUrl(`https://${EXPECTED_STAGING_HOSTNAME}?apikey=xyz`),
    /URL dilarang memiliki query parameters/
  );
});

runTest('Validasi URL: Menolak fragment/hash', () => {
  assert.throws(
    () => validateSupabaseUrl(`https://${EXPECTED_STAGING_HOSTNAME}#section`),
    /URL dilarang memiliki fragment\/hash/
  );
});

runTest('Validasi URL: Menolak format URL invalid atau kosong', () => {
  assert.throws(() => validateSupabaseUrl(''), /wajib berupa string/);
  assert.throws(() => validateSupabaseUrl('not-a-valid-url'), /Format URL tidak dapat di-parse/);
  assert.throws(() => validateSupabaseUrl(null), /wajib berupa string/);
});

// ---------------------------------------------------------------------------
// 2. UJI DETEKSI EKSEKUSI CLI WINDOWS (PATH DENGAN SPASI)
// ---------------------------------------------------------------------------
runTest('Deteksi CLI Windows: Mencocokkan path dengan spasi antara URL dan argv[1]', () => {
  const metaUrlWithSpaces = 'file:///C:/Users/Mazmur%20Gusti%20Agung%20L/Documents/SIKEU2/scripts/reset_staging_admin_password.mjs';
  const argv1WithSpaces = 'C:\\Users\\Mazmur Gusti Agung L\\Documents\\SIKEU2\\scripts\\reset_staging_admin_password.mjs';

  const isDirect = isDirectCliExecution(metaUrlWithSpaces, argv1WithSpaces);
  assert.strictEqual(isDirect, true, 'isDirectCliExecution harus mengenali path Windows dengan spasi');
});

runTest('Deteksi CLI Windows: Tidak sensitif terhadap huruf besar/kecil (case-insensitive)', () => {
  const metaUrl = 'file:///c:/users/mazmur%20gusti%20agung%20l/documents/sikeu2/scripts/reset_staging_admin_password.mjs';
  const argv1 = 'C:\\Users\\Mazmur Gusti Agung L\\Documents\\SIKEU2\\scripts\\reset_staging_admin_password.mjs';

  const isDirect = isDirectCliExecution(metaUrl, argv1);
  assert.strictEqual(isDirect, true, 'isDirectCliExecution harus case-insensitive pada Windows path');
});

runTest('Deteksi CLI Windows: Menolak file yang berbeda atau saat di-import modul', () => {
  const metaUrl = 'file:///C:/Users/Mazmur%20Gusti%20Agung%20L/Documents/SIKEU2/scripts/reset_staging_admin_password.mjs';
  const argvDifferent = 'C:\\Users\\Mazmur Gusti Agung L\\Documents\\SIKEU2\\scripts\\other_script.mjs';

  assert.strictEqual(isDirectCliExecution(metaUrl, argvDifferent), false);
  assert.strictEqual(isDirectCliExecution(metaUrl, null), false);
  assert.strictEqual(isDirectCliExecution(metaUrl, ''), false);
});

// ---------------------------------------------------------------------------
// 3. UJI INPUT PASSWORD NON-TTY REJECTION (ANTI UNATTENDED INJECTION)
// ---------------------------------------------------------------------------
await runTestAsync('Input Password: Wajib menolak stream non-TTY demi keamanan', async () => {
  const origIsTTY = process.stdin.isTTY;
  try {
    process.stdin.isTTY = false; // Simulasi input piping/headless
    await assert.rejects(
      async () => {
        await promptHiddenPassword('Test prompt: ');
      },
      /Input password interaktif hanya diizinkan melalui terminal TTY interaktif/
    );
  } finally {
    process.stdin.isTTY = origIsTTY;
  }
});

// ---------------------------------------------------------------------------
// 4. UJI VALIDASI TARGET ADMIN RECORD (PRE-FLIGHT CONCURRENCY GUARD & STATUS)
// ---------------------------------------------------------------------------
runTest('Target Admin Guard: Menerima record admin staging yang aktif dan sah', () => {
  const validRecord = {
    id: TARGET_ADMIN_ID,
    username: TARGET_ADMIN_USERNAME,
    role: TARGET_ADMIN_ROLE,
    session_version: 1,
    status: 'active'
  };
  assert.strictEqual(validateTargetAdminRecord(validRecord), true);
});

runTest('Target Admin Guard: Menolak keras akun yang TIDAK aktif (pending/suspended)', () => {
  const pendingRecord = {
    id: TARGET_ADMIN_ID,
    username: TARGET_ADMIN_USERNAME,
    role: TARGET_ADMIN_ROLE,
    session_version: 1,
    status: 'pending'
  };
  assert.throws(
    () => validateTargetAdminRecord(pendingRecord),
    /Akun target tidak aktif! \(status saat ini: "pending"\)/
  );

  const suspendedRecord = {
    id: TARGET_ADMIN_ID,
    username: TARGET_ADMIN_USERNAME,
    role: TARGET_ADMIN_ROLE,
    session_version: 1,
    status: 'suspended'
  };
  assert.throws(
    () => validateTargetAdminRecord(suspendedRecord),
    /Akun target tidak aktif! \(status saat ini: "suspended"\)/
  );
});

runTest('Target Admin Guard: Menolak record dengan ID selain usr-staging-admin-01', () => {
  const invalidId = {
    id: 'usr-attacker-or-fake',
    username: TARGET_ADMIN_USERNAME,
    role: TARGET_ADMIN_ROLE,
    session_version: 1,
    status: 'active'
  };
  assert.throws(() => validateTargetAdminRecord(invalidId), /ID user target tidak cocok/);
});

runTest('Target Admin Guard: Menolak record dengan username selain admin', () => {
  const invalidUser = {
    id: TARGET_ADMIN_ID,
    username: 'staff_finance',
    role: TARGET_ADMIN_ROLE,
    session_version: 1,
    status: 'active'
  };
  assert.throws(() => validateTargetAdminRecord(invalidUser), /Username target tidak cocok/);
});

runTest('Target Admin Guard: Menolak record dengan role bukan admin', () => {
  const invalidRole = {
    id: TARGET_ADMIN_ID,
    username: TARGET_ADMIN_USERNAME,
    role: 'user',
    session_version: 1,
    status: 'active'
  };
  assert.throws(() => validateTargetAdminRecord(invalidRole), /Role target tidak cocok/);
});

runTest('Target Admin Guard: Menolak record tanpa session_version numerik valid', () => {
  const invalidSession = {
    id: TARGET_ADMIN_ID,
    username: TARGET_ADMIN_USERNAME,
    role: TARGET_ADMIN_ROLE,
    session_version: 0,
    status: 'active'
  };
  assert.throws(() => validateTargetAdminRecord(invalidSession), /session_version tidak valid/);
});

// ---------------------------------------------------------------------------
// 5. UJI INTEGRITAS HASHING ARGON2ID & VERIFIKASI RESMI
// ---------------------------------------------------------------------------
await runTestAsync('Hashing: Memverifikasi hashPassword menghasilkan Argon2id ($argon2id$)', async () => {
  const testPlain = 'SpectraAuditTestPassword2026!';
  const generatedHash = await hashPassword(testPlain);

  assert.ok(
    generatedHash.startsWith('$argon2id$'),
    `Hash wajib berformat Argon2id murni ($argon2id$). Diterima: ${generatedHash.substring(0, 15)}...`
  );

  const isValidMatch = await verifyPassword(generatedHash, testPlain);
  assert.strictEqual(isValidMatch, true, 'verifyPassword wajib mengembalikan true untuk password yang cocok');

  const isInvalidMatch = await verifyPassword(generatedHash, 'WrongPasswordCompletely!');
  assert.strictEqual(isInvalidMatch, false, 'verifyPassword wajib mengembalikan false untuk password yang salah');
});

// ---------------------------------------------------------------------------
// 6. UJI SANITASI KREDENSIAL ENVIRONMENT (ZERO LOGGING)
// ---------------------------------------------------------------------------
runTest('Kredensial Environment: Menolak jika SUPABASE_SERVICE_ROLE_KEY kosong', () => {
  const mockEnv = {
    SUPABASE_URL: `https://${EXPECTED_STAGING_HOSTNAME}`,
    SUPABASE_SERVICE_ROLE_KEY: ''
  };
  assert.throws(() => getStagingCredentials(mockEnv), /SUPABASE_SERVICE_ROLE_KEY wajib disediakan/);
});

runTest('Kredensial Environment: Menerima kredensial yang valid tanpa membocorkan key', () => {
  const mockEnv = {
    SUPABASE_URL: `https://${EXPECTED_STAGING_HOSTNAME}`,
    SUPABASE_SERVICE_ROLE_KEY: 'mock_service_role_key_for_test_environment'
  };
  const creds = getStagingCredentials(mockEnv);
  assert.strictEqual(creds.supabaseUrl, `https://${EXPECTED_STAGING_HOSTNAME}`);
  assert.strictEqual(creds.serviceKey, 'mock_service_role_key_for_test_environment');
});

// ---------------------------------------------------------------------------
// HASIL AKHIR
// ---------------------------------------------------------------------------
console.log('\n===============================================================');
console.log(`   HASIL PENGUJIAN: ${passedTests}/${totalTests} PASS (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('   ZERO MUTATION: TIDAK ADA DATA DATABASE YANG DIMODIFIKASI.');
console.log('===============================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
