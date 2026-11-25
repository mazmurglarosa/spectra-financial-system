-- ====================================================================
-- MIGRATION 001: PENAMBAHAN KOLOM KEAMANAN (NON-DESTRUCTIVE)
-- ====================================================================
-- Status: PREPARED ONLY (TIDAK BOLEH DIEKSEKUSI DI PRODUCTION TANPA PERSETUJUAN)
-- Tujuan: Menambahkan kolom penampung password hash Argon2id, versioning sesi,
--         proteksi brute force, dan timestamp rotasi password.
-- Keamanan: Aman dijalankan karena tidak mengubah data atau menghapus kolom existing.
-- ====================================================================

-- 1. Pastikan tabel system_users ada
CREATE TABLE IF NOT EXISTS system_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  is_authority BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
  registered_at TEXT NOT NULL
);

-- 2. Tambahkan kolom penampung hash kredensial dan kontrol sesi server
ALTER TABLE system_users 
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 3. Indeks untuk pencarian cepat username pada autentikasi serverless
CREATE INDEX IF NOT EXISTS idx_system_users_username_lower ON system_users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_system_users_status ON system_users (status);

