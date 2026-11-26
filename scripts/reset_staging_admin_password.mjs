/**
 * SPECTRA FINANCIAL SYSTEM — ONE-TIME STAGING ADMIN PASSWORD RESET UTILITY
 * 
 * PERINGATAN KEAMANAN TINGKAT TINGGI:
 * - Utilitas ini HANYA boleh menargetkan Supabase STAGING (xaafjvmdjdlfqdrljjlr.supabase.co).
 * - DILARANG KERAS dijalankan pada database PRODUCTION (drsqwxkkcfqvooqzoyvm).
 * - Input password wajib interaktif via terminal TTY dengan masking tanpa rekaman/history.
 * - Non-TTY stream ditolak secara mutlak demi keamanan.
 * - TIDAK ADA operasi DELETE terhadap tabel rate_limits atau data akuntansi.
 */

import { fileURLToPath } from 'url';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { hashPassword, verifyPassword } from '../api/_lib/hash.ts';

// ---------------------------------------------------------------------------
// 1. VALIDASI URL SUPABASE PRESISI TINGGI (STRICT HTTPS & ZERO ANOMALY)
// ---------------------------------------------------------------------------
export const EXPECTED_STAGING_HOSTNAME = 'xaafjvmdjdlfqdrljjlr.supabase.co';
export const FORBIDDEN_PRODUCTION_HOSTNAME = 'drsqwxkkcfqvooqzoyvm.supabase.co';

export function validateSupabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('[URL TIDAK VALID] SUPABASE_URL wajib berupa string.');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(`[URL TIDAK VALID] Format URL tidak dapat di-parse: ${rawUrl}`);
  }

  // 1. Wajib protokol HTTPS
  if (parsed.protocol !== 'https:') {
    throw new Error(`[KEAMANAN DITOLAK] Protocol URL wajib HTTPS (diterima: "${parsed.protocol}")`);
  }

  // 2. Dilarang username / password dalam URL (userinfo injection)
  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error('[KEAMANAN DITOLAK] URL dilarang memuat kredensial username/password (userinfo).');
  }

  // 3. Dilarang port khusus (wajib port standar HTTPS / kosong)
  if (parsed.port !== '' && parsed.port !== '443') {
    throw new Error(`[KEAMANAN DITOLAK] URL dilarang menggunakan port non-standar (diterima port: "${parsed.port}").`);
  }

  // 4. Dilarang path tambahan (wajib root / atau kosong)
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(`[KEAMANAN DITOLAK] URL dilarang memiliki path tambahan (diterima path: "${parsed.pathname}").`);
  }

  // 5. Dilarang query parameters
  if (parsed.search !== '') {
    throw new Error(`[KEAMANAN DITOLAK] URL dilarang memiliki query parameters (diterima search: "${parsed.search}").`);
  }

  // 6. Dilarang fragment / hash
  if (parsed.hash !== '') {
    throw new Error(`[KEAMANAN DITOLAK] URL dilarang memiliki fragment/hash (diterima hash: "${parsed.hash}").`);
  }

  const normalizedHostname = parsed.hostname.toLowerCase();

  // 7. Larangan mutlak Production
  if (normalizedHostname === FORBIDDEN_PRODUCTION_HOSTNAME) {
    throw new Error('[CRITICAL BLOCKED] Akses ke Supabase Production (drsqwxkkcfqvooqzoyvm) dilarang keras!');
  }

  // 8. Wajib tepat Hostname Staging
  if (normalizedHostname !== EXPECTED_STAGING_HOSTNAME) {
    throw new Error(
      `[ISOLASI DITOLAK] Hostname target wajib tepat "${EXPECTED_STAGING_HOSTNAME}" (diterima: "${parsed.hostname}"). Akses ke host lain diblokir.`
    );
  }

  return `https://${EXPECTED_STAGING_HOSTNAME}`;
}

// ---------------------------------------------------------------------------
// 2. KREDENSIAL ENVIRONMENT TERKONTROL (ZERO HARDCODE, ZERO PRINT)
// ---------------------------------------------------------------------------
export function getStagingCredentials(overrideEnv = process.env) {
  const supabaseUrl = overrideEnv.SUPABASE_URL || `https://${EXPECTED_STAGING_HOSTNAME}`;
  const serviceKey = (overrideEnv.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  const validatedUrl = validateSupabaseUrl(supabaseUrl);
  if (!serviceKey) {
    throw new Error(
      '[KREDENSIAL DITOLAK] SUPABASE_SERVICE_ROLE_KEY wajib disediakan di environment lokal dan tidak boleh kosong.'
    );
  }

  return { supabaseUrl: validatedUrl, serviceKey };
}

// ---------------------------------------------------------------------------
// 3. INPUT PASSWORD INTERAKTIF MURNI STDIN (NON-TTY REJECTED, ZERO LOG)
// ---------------------------------------------------------------------------
export function promptHiddenPassword(query) {
  return new Promise((resolve, reject) => {
    // 1. Tolak mutlak input dari non-TTY (piping, file redirection, headless agent loop)
    if (!process.stdin.isTTY) {
      return reject(
        new Error('[KEAMANAN DITOLAK] Input password interaktif hanya diizinkan melalui terminal TTY interaktif.')
      );
    }

    process.stdout.write(query);
    let password = '';

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          teardown();
          process.stdout.write('\n');
          return resolve(password);
        } else if (char === '\u0003') { // Ctrl+C
          teardown();
          process.stdout.write('\n[DIBATALKAN OLEH PENGGUNA]\n');
          process.exit(130);
        } else if (char === '\u007f' || char === '\b') { // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (char >= ' ' && char <= '~') { // Karakter ASCII tercetak sah
          password += char;
          process.stdout.write('*');
        }
      }
    };

    function teardown() {
      process.stdin.removeListener('data', onData);
      try {
        process.stdin.setRawMode(false);
      } catch {}
      process.stdin.pause();
    }

    process.stdin.on('data', onData);
  });
}

// ---------------------------------------------------------------------------
// 4. DETEKSI EKSEKUSI CLI WINDOWS (MENDUKUNG PATH DENGAN SPASI)
// ---------------------------------------------------------------------------
export function isDirectCliExecution(metaUrl, argv1) {
  if (!argv1 || typeof argv1 !== 'string') return false;
  try {
    const currentFilePath = path.resolve(fileURLToPath(metaUrl));
    const executedFilePath = path.resolve(argv1);
    return currentFilePath.toLowerCase() === executedFilePath.toLowerCase();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 5. VALIDASI INTEGRITAS DATA TARGET USER (PRE-UPDATE GUARD)
// ---------------------------------------------------------------------------
export const TARGET_ADMIN_ID = 'usr-staging-admin-01';
export const TARGET_ADMIN_USERNAME = 'admin';
export const TARGET_ADMIN_ROLE = 'admin';

export function validateTargetAdminRecord(record) {
  if (!record || typeof record !== 'object') {
    throw new Error('[TARGET DITOLAK] Record admin tidak ditemukan atau kosong.');
  }

  if (record.id !== TARGET_ADMIN_ID) {
    throw new Error(
      `[TARGET DITOLAK] ID user target tidak cocok! (diharapkan: "${TARGET_ADMIN_ID}", aktual: "${record.id}")`
    );
  }

  if (record.username !== TARGET_ADMIN_USERNAME) {
    throw new Error(
      `[TARGET DITOLAK] Username target tidak cocok! (diharapkan: "${TARGET_ADMIN_USERNAME}", aktual: "${record.username}")`
    );
  }

  if (record.role !== TARGET_ADMIN_ROLE) {
    throw new Error(
      `[TARGET DITOLAK] Role target tidak cocok! (diharapkan: "${TARGET_ADMIN_ROLE}", aktual: "${record.role}")`
    );
  }

  // Wajib aktif sebelum update; jika tidak aktif, hentikan proses seketika
  if (record.status !== 'active') {
    throw new Error(
      `[TARGET DITOLAK] Akun target tidak aktif! (status saat ini: "${record.status}"). Eksekusi dihentikan demi keamanan.`
    );
  }

  if (typeof record.session_version !== 'number' || record.session_version < 1) {
    throw new Error(
      `[TARGET DITOLAK] session_version tidak valid: ${record.session_version}`
    );
  }

  return true;
}

// ---------------------------------------------------------------------------
// 6. PROSEDUR UTAMA RESET PASSWORD ADMIN STAGING
// ---------------------------------------------------------------------------
export async function executeAdminPasswordReset(options = {}) {
  console.log('===============================================================');
  console.log('   SPECTRA — PROSEDUR RESET PASSWORD ADMIN STAGING (ON-DEMAND)');
  console.log('===============================================================');

  // 1. Kredensial & Validasi Target URL
  const { supabaseUrl, serviceKey } = getStagingCredentials(options.env || process.env);
  console.log(`[TARGET] Supabase Staging: ${supabaseUrl}`);
  console.log(`[TARGET USER] Username: "${TARGET_ADMIN_USERNAME}" | ID: "${TARGET_ADMIN_ID}"`);

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 2. Pre-flight Check: Query Data Admin Saat Ini
  const { data: users, error: fetchErr } = await sb
    .from('system_users')
    .select('id, username, full_name, role, is_authority, status, session_version, failed_login_attempts, locked_until')
    .eq('username', TARGET_ADMIN_USERNAME)
    .limit(1);

  if (fetchErr) {
    throw new Error(`[DB QUERY ERROR] Gagal membaca tabel system_users: ${fetchErr.message}`);
  }

  const currentAdmin = users && users.length > 0 ? users[0] : null;
  validateTargetAdminRecord(currentAdmin);

  const currentSessionVersion = currentAdmin.session_version;

  console.log('\n[PRE-FLIGHT INFO]');
  console.log(`- ID Pengguna          : ${currentAdmin.id}`);
  console.log(`- Nama Lengkap         : ${currentAdmin.full_name}`);
  console.log(`- Role / Otoritas      : ${currentAdmin.role} (is_authority: ${Boolean(currentAdmin.is_authority)})`);
  console.log(`- Status Akun          : ${currentAdmin.status}`);
  console.log(`- Session Version Saat : ${currentSessionVersion}`);
  console.log(`- Failed Attempts      : ${currentAdmin.failed_login_attempts ?? 0}`);

  // 3. Minta Password Baru Secara Interaktif
  console.log('\n--- Masukkan Kredensial Baru (Masked) ---');
  const pass1 = await promptHiddenPassword('Masukkan password baru untuk "admin": ');
  if (!pass1 || pass1.length < 8) {
    throw new Error('[VALIDASI GAGAL] Password minimal harus 8 karakter demi standar keamanan SPECTRA.');
  }

  const pass2 = await promptHiddenPassword('Konfirmasi password baru: ');
  if (pass1 !== pass2) {
    throw new Error('[VALIDASI GAGAL] Konfirmasi password tidak cocok! Pembatalan dilakukan.');
  }

  // 4. Hashing Argon2id Menggunakan Engine api/_lib/hash.ts
  console.log('\n[HASHING] Mengenkripsi password baru menggunakan Argon2id...');
  const newHash = await hashPassword(pass1);

  // Wajibkan hasil berupa Argon2id murni (Tolak fallback scrypt)
  if (!newHash.startsWith('$argon2id$')) {
    throw new Error('[KEAMANAN HASH DITOLAK] Algoritma hash wajib Argon2id ($argon2id$). Fallback ditolak.');
  }

  // Verifikasi hash sebelum disimpan ke database
  const isSelfValid = await verifyPassword(newHash, pass1);
  if (!isSelfValid) {
    throw new Error('[FATAL] Verifikasi internal Argon2id gagal. Hash tidak cocok dengan plaintext.');
  }
  console.log('[HASHING] Argon2id hash berhasil diverifikasi secara mandiri.');

  // 5. Update Database Staging dengan Optimistic Concurrency Control & Filter Ketat
  const nextSessionVersion = currentSessionVersion + 1;
  const nowIso = new Date().toISOString();

  console.log(
    `[UPDATE] Memperbarui tabel system_users (session_version: ${currentSessionVersion} -> ${nextSessionVersion})...`
  );

  // Payload update: password_hash, password: null, session_version, password_changed_at, failed_login_attempts: 0, locked_until: null
  // DILARANG menyertakan status: 'active' pada payload UPDATE.
  const { data: updateRes, error: updateErr } = await sb
    .from('system_users')
    .update({
      password_hash: newHash,
      password: null, // Hapus plaintext password legacy
      session_version: nextSessionVersion,
      password_changed_at: nowIso,
      failed_login_attempts: 0,
      locked_until: null
    })
    .eq('id', TARGET_ADMIN_ID)
    .eq('username', TARGET_ADMIN_USERNAME)
    .eq('role', TARGET_ADMIN_ROLE)
    .eq('status', 'active')
    .eq('session_version', currentSessionVersion) // Concurrency guard: cegah update jika session_version berubah
    .select('id, username, role, session_version, status, password_changed_at');

  if (updateErr) {
    throw new Error(`[UPDATE ERROR] Gagal memperbarui password di Supabase: ${updateErr.message}`);
  }

  // Pastikan tepat satu baris diperbarui
  if (!updateRes || updateRes.length !== 1) {
    throw new Error(
      `[INTEGRITAS GAGAL] Tepat 1 baris wajib terupdate (aktual: ${updateRes?.length || 0}). Concurrency conflict terdeteksi.`
    );
  }

  const updatedRecord = updateRes[0];

  // Verifikasi hasil tanpa pernah mencetak password atau hash
  console.log('\n===============================================================');
  console.log('   RESET PASSWORD ADMIN STAGING BERHASIL (100% TERVERIFIKASI)');
  console.log('===============================================================');
  console.log(`- User ID             : ${updatedRecord.id}`);
  console.log(`- Username            : ${updatedRecord.username}`);
  console.log(`- Role                : ${updatedRecord.role}`);
  console.log(`- Session Version Baru: ${updatedRecord.session_version} (Sesi lama otomatis terinvalidasi)`);
  console.log(`- Status              : ${updatedRecord.status}`);
  console.log(`- Password Changed At : ${updatedRecord.password_changed_at}`);
  console.log('===============================================================\n');

  return {
    success: true,
    user: {
      id: updatedRecord.id,
      username: updatedRecord.username,
      role: updatedRecord.role,
      session_version: updatedRecord.session_version,
      status: updatedRecord.status,
      password_changed_at: updatedRecord.password_changed_at
    }
  };
}

// ---------------------------------------------------------------------------
// 7. ENTRYPOINT CLI (MENDUKUNG WINDOWS PATH DENGAN SPASI)
// ---------------------------------------------------------------------------
if (isDirectCliExecution(import.meta.url, process.argv[1])) {
  executeAdminPasswordReset().catch((err) => {
    console.error('\n[RESET GAGAL]', err.message);
    process.exit(1);
  });
}
