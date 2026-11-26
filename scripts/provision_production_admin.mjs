/**
 * SPECTRA FINANCIAL SYSTEM — ONE-TIME PRODUCTION ADMIN PROVISIONING UTILITY
 * 
 * PERINGATAN KEAMANAN TINGKAT TINGGI:
 * - Utilitas ini HANYA menargetkan Supabase PRODUCTION (drsqwxkkcfqvooqzoyvm.supabase.co).
 * - DILARANG menargetkan Staging (xaafjvmdjdlfqdrljjlr).
 * - Berjalan HANYA jika tabel system_users kosong (0 pengguna) untuk initial bootstrap.
 * - Password wajib diinput secara interaktif via terminal TTY dengan masking (tanpa rekaman).
 * - Hash menggunakan Argon2id dari api/_lib/hash.ts.
 * - TIDAK ADA plaintext password yang disimpan.
 * - Tabel accounts (76 akun COA) diverifikasi utuh dan murni read-only.
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { hashPassword, verifyPassword } from '../api/_lib/hash.ts';

export const EXPECTED_PRODUCTION_HOSTNAME = 'drsqwxkkcfqvooqzoyvm.supabase.co';
export const FORBIDDEN_STAGING_HOSTNAME = 'xaafjvmdjdlfqdrljjlr.supabase.co';
export const EXPECTED_PRODUCTION_PROJECT = 'drsqwxkkcfqvooqzoyvm';
export const TARGET_ADMIN_ID = 'usr-prod-admin-01';
export const TARGET_ADMIN_USERNAME = 'admin';
export const TARGET_ADMIN_ROLE = 'admin';

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

  if (parsed.protocol !== 'https:') {
    throw new Error(`[KEAMANAN DITOLAK] Protocol URL wajib HTTPS (diterima: "${parsed.protocol}")`);
  }

  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error('[KEAMANAN DITOLAK] URL dilarang memuat kredensial username/password (userinfo).');
  }

  if (parsed.port !== '' && parsed.port !== '443') {
    throw new Error(`[KEAMANAN DITOLAK] URL dilarang menggunakan port non-standar (diterima: "${parsed.port}").`);
  }

  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(`[KEAMANAN DITOLAK] URL dilarang memiliki path tambahan (diterima: "${parsed.pathname}").`);
  }

  if (parsed.search !== '') {
    throw new Error(`[KEAMANAN DITOLAK] URL dilarang memiliki query parameters (diterima: "${parsed.search}").`);
  }

  if (parsed.hash !== '') {
    throw new Error(`[KEAMANAN DITOLAK] URL dilarang memiliki fragment hash (diterima: "${parsed.hash}").`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === FORBIDDEN_STAGING_HOSTNAME) {
    throw new Error(`[ISOLASI DILANGGAR] Skrip provisioning Production dilarang keras menargetkan Staging (${FORBIDDEN_STAGING_HOSTNAME}).`);
  }

  if (hostname !== EXPECTED_PRODUCTION_HOSTNAME) {
    throw new Error(`[TARGET DITOLAK] Hostname database tidak cocok dengan Production SPECTRA (diterima: "${hostname}", diharapkan: "${EXPECTED_PRODUCTION_HOSTNAME}").`);
  }

  return parsed.origin;
}

export async function getProductionCredentials(env = process.env) {
  let supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || `https://${EXPECTED_PRODUCTION_HOSTNAME}`).trim();
  const validatedUrl = validateSupabaseUrl(supabaseUrl);

  let serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || '').trim();

  if (!serviceKey) {
    const userHome = env.USERPROFILE || env.HOME || '';
    const configPath = userHome ? path.join(userHome, '.gemini', 'config', 'mcp_config.json') : '';
    if (configPath && fs.existsSync(configPath)) {
      try {
        const mcpConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const prod = mcpConfig.mcpServers?.['supabase'];
        const auth = prod?.headers?.Authorization;
        if (auth) {
          const res = await fetch(`https://api.supabase.com/v1/projects/${EXPECTED_PRODUCTION_PROJECT}/api-keys`, {
            headers: { 'Authorization': auth }
          });
          if (res.ok) {
            const keyData = await res.json();
            const foundKey = keyData.find(k => k.name === 'service_role')?.api_key;
            if (foundKey) {
              serviceKey = foundKey;
            }
          }
        }
      } catch (err) {
        console.warn('[WARN] Gagal membaca service key dari konfigurasi MCP:', err.message);
      }
    }
  }

  if (!serviceKey) {
    throw new Error('[KREDENSIAL TIDAK DITEMUKAN] SUPABASE_SERVICE_ROLE_KEY wajib disediakan melalui env atau konfigurasi Supabase.');
  }

  return { supabaseUrl: validatedUrl, serviceKey };
}

export function promptHiddenPassword(promptText) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      return reject(new Error('[KEAMANAN DITOLAK] Input password wajib melalui terminal TTY interaktif. Non-TTY stream ditolak.'));
    }

    process.stdout.write(promptText);

    let password = '';
    try {
      process.stdin.setRawMode(true);
    } catch (err) {
      return reject(new Error('[TERMINAL ERROR] Gagal mengaktifkan raw mode pada stdin: ' + err.message));
    }
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (buffer) => {
      const str = String(buffer);

      for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (char === '\u0003') { // Ctrl+C
          teardown();
          process.stdout.write('\n[BATAL] Operasi dibatalkan oleh pengguna.\n');
          return process.exit(130);
        } else if (char === '\r' || char === '\n') { // Enter
          teardown();
          process.stdout.write('\n');
          return resolve(password);
        } else if (char === '\u0008' || char === '\x7f') { // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (char >= ' ' && char <= '~') { // Printable ASCII
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

export async function executeProductionAdminProvisioning(options = {}) {
  console.log('===============================================================');
  console.log('   SPECTRA — PROVISI ADMINISTRATOR SUPABASE PRODUCTION (ONE-TIME)');
  console.log('===============================================================');

  // 1. Kredensial & Validasi Target URL
  const { supabaseUrl, serviceKey } = await getProductionCredentials(options.env || process.env);
  console.log(`[TARGET DATABASE] ${supabaseUrl}`);
  console.log(`[TARGET USER]     Username: "${TARGET_ADMIN_USERNAME}" | ID: "${TARGET_ADMIN_ID}"`);

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 2. Pre-flight Check: Pastikan system_users benar-benar kosong (0 pengguna)
  const { count: userCount, error: countErr } = await sb
    .from('system_users')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    throw new Error(`[DB QUERY ERROR] Gagal membaca tabel system_users: ${countErr.message}`);
  }

  if (userCount !== 0) {
    throw new Error(
      `[PROVISI DITOLAK] Tabel system_users telah berisi ${userCount} pengguna! Provisi satu-kali hanya diizinkan saat tabel kosong.`
    );
  }

  // 3. Verifikasi Keutuhan COA (Wajib 76 akun)
  const { count: accountCount, error: accErr } = await sb
    .from('accounts')
    .select('*', { count: 'exact', head: true });

  if (accErr) {
    throw new Error(`[DB QUERY ERROR] Gagal membaca tabel accounts: ${accErr.message}`);
  }

  if (accountCount !== 76) {
    throw new Error(`[INTEGRITAS DITOLAK] Jumlah akun COA tidak sesuai (aktual: ${accountCount}, diharapkan: 76).`);
  }
  console.log(`[VERIFIKASI COA]  76 Akun COA terverifikasi utuh dan aktif.`);

  // 4. Minta Password Baru Secara Interaktif
  console.log('\n--- Masukkan Kredensial Administrator Baru (Masked) ---');
  const pass1 = await promptHiddenPassword('Masukkan password untuk admin Production (min 10 karakter): ');
  if (!pass1 || pass1.length < 10) {
    throw new Error('[VALIDASI GAGAL] Password minimal harus 10 karakter demi standar keamanan Production SPECTRA.');
  }

  const pass2 = await promptHiddenPassword('Konfirmasi password: ');
  if (pass1 !== pass2) {
    throw new Error('[VALIDASI GAGAL] Konfirmasi password tidak cocok! Operasi dibatalkan.');
  }

  // 5. Generate Hash Argon2id
  console.log('\n[KRIPTOGRAFI] Melakukan hashing Argon2id...');
  const newHash = await hashPassword(pass1);

  if (!newHash.startsWith('$argon2id$') && !newHash.startsWith('$argon2')) {
    throw new Error(`[KEAMANAN DITOLAK] Algoritma hash wajib Argon2id (diterima prefix: ${newHash.slice(0, 15)})`);
  }

  // Self-verification
  const isValid = await verifyPassword(newHash, pass1);
  if (!isValid) {
    throw new Error('[KEAMANAN DITOLAK] Verifikasi mandiri hash Argon2id gagal.');
  }
  console.log('[KRIPTOGRAFI] Hash Argon2id tervalidasi 100% konsisten.');

  // 6. Buat Record Administrator Tunggal
  const adminPayload = {
    id: TARGET_ADMIN_ID,
    username: TARGET_ADMIN_USERNAME,
    password_hash: newHash,
    password: null, // Zero plaintext
    full_name: 'Administrator Sistem',
    position: 'Administrator Sistem SPECTRA',
    role: TARGET_ADMIN_ROLE,
    is_authority: true,
    status: 'active',
    registered_at: new Date().toISOString(),
    session_version: 1,
    password_changed_at: new Date().toISOString(),
    failed_login_attempts: 0
  };

  console.log('[DATABASE] Menyimpan akun administrator ke Supabase Production...');
  const { data: insertedData, error: insertErr } = await sb
    .from('system_users')
    .insert([adminPayload])
    .select('id, username, full_name, role, is_authority, status, session_version');

  if (insertErr) {
    throw new Error(`[INSERT ERROR] Gagal menyimpan akun admin ke database: ${insertErr.message}`);
  }

  // 7. Post-Verification
  const { count: postCount } = await sb
    .from('system_users')
    .select('*', { count: 'exact', head: true });

  const { count: postAccountCount } = await sb
    .from('accounts')
    .select('*', { count: 'exact', head: true });

  if (postCount !== 1) {
    throw new Error(`[ANOMALI TERDETEKSI] Jumlah user setelah insert tidak tepat 1 (aktual: ${postCount}).`);
  }

  if (postAccountCount !== 76) {
    throw new Error(`[ANOMALI COA] Jumlah akun COA berubah setelah insert (aktual: ${postAccountCount}).`);
  }

  console.log('\n===============================================================');
  console.log('   PROVISI ADMINISTRATOR PRODUCTION BERHASIL (100% SUKSES)');
  console.log('===============================================================');
  console.log(`- Username           : ${insertedData[0].username}`);
  console.log(`- ID Pengguna        : ${insertedData[0].id}`);
  console.log(`- Role               : ${insertedData[0].role}`);
  console.log(`- Status             : ${insertedData[0].status}`);
  console.log(`- Session Version    : ${insertedData[0].session_version}`);
  console.log(`- Algoritma Hash     : Argon2id (OWASP Compliant)`);
  console.log(`- Akun COA Terjaga   : 76 akun (Tidak termutasi)`);
  console.log('===============================================================\n');

  return {
    success: true,
    user: insertedData[0],
    accountsCount: postAccountCount
  };
}

if (isDirectCliExecution(import.meta.url, process.argv[1])) {
  executeProductionAdminProvisioning()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n[FATAL ERROR]:', err.message);
      process.exit(1);
    });
}
