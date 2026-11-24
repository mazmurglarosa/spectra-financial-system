/**
 * Generator SQL Bootstrap Superadmin Khusus Staging (Keamanan Tingkat Tinggi)
 * 
 * Fitur Keamanan:
 * 1. TIDAK menerima password melalui argumen command-line (mencegah terekspos di riwayat shell/task manager).
 * 2. Menerima input melalui prompt interaktif tersembunyi (stdin) atau env var `SUPERADMIN_INITIAL_PASSWORD`.
 * 3. TIDAK mencetak password mentah maupun hash ke terminal / stdout / log.
 * 4. Menuliskan file query SQL langsung ke file target lokal yang siap disalin ke SQL Editor Supabase.
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword } from '../api/lib/hash.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetSqlFile = path.resolve(__dirname, '../supabase/migrations/002_seed_bootstrap_superadmin_staging.sql');

async function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const stdin = process.openStdin();
    process.stdout.write(question);

    const onData = (char) => {
      char = char + '';
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.removeListener('data', onData);
          break;
        default:
          process.stdout.write('\x1B[2K\x1B[200D' + question + '*'.repeat(rl.line.length));
          break;
      }
    };

    process.stdin.on('data', onData);

    rl.question('', (value) => {
      rl.history = [];
      rl.close();
      console.log(); // newline
      resolve(value.trim());
    });
  });
}

async function main() {
  let password = process.env.SUPERADMIN_INITIAL_PASSWORD;

  if (!password) {
    if (process.stdin.isTTY) {
      password = await promptHidden('Masukkan Password Baru untuk Superadmin Staging: ');
    } else {
      console.error('[ERROR] Password tidak disediakan. Silakan jalankan di terminal interaktif atau gunakan variabel env SUPERADMIN_INITIAL_PASSWORD.');
      process.exit(1);
    }
  }

  if (!password || password.length < 8) {
    console.error('[ERROR] Password minimal harus 8 karakter alfanumerik yang kuat.');
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const nowIso = new Date().toISOString();

  const sqlContent = `-- ====================================================================
-- SEED BOOTSTRAP SUPERADMIN KHUSUS SUPABASE STAGING
-- Generated: ${nowIso}
-- CATATAN: File ini berisi hash kredensial staging Anda.
-- ====================================================================
INSERT INTO public.system_users (
  id,
  username,
  password_hash,
  full_name,
  position,
  role,
  is_authority,
  status,
  registered_at,
  session_version
) VALUES (
  'usr-staging-admin-01',
  'admin',
  '${hash}',
  'Administrator Staging',
  'Chief Technology & Financial Officer',
  'admin',
  TRUE,
  'active',
  '${nowIso}',
  1
)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = 'admin',
  is_authority = TRUE,
  status = 'active';
`;

  fs.writeFileSync(targetSqlFile, sqlContent, 'utf8');

  console.log('\n[BERHASIL] File migrasi bootstrap superadmin staging telah disimpan secara lokal di:');
  console.log(`  -> ${targetSqlFile}`);
  console.log('[KEAMANAN] Password dan password hash TIDAK DICETAK ke konsol terminal atau log.\n');
}

main().catch(err => {
  console.error('[ERROR Generator]:', err.message);
  process.exit(1);
});
