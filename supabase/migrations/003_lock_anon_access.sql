-- ====================================================================
-- MIGRATION 003: PENUTUPAN TOTAL AKSES ANONIM PADA SYSTEM_USERS
-- ====================================================================
-- Status: PREPARED ONLY (TIDAK BOLEH DIEKSEKUSI DI PRODUCTION TANPA PERSETUJUAN)
-- Tujuan: Menghapus kebijakan publik permisif 'Allow public all on system_users'
--         dan mengunci akses tabel HANYA untuk backend Vercel (service_role).
-- Keamanan:
--   - Role 'anon' (browser publik) ditolak total (100% access denied).
--   - Role 'service_role' (serverless Vercel dengan secret key) memiliki hak penuh.
--   - Modul akuntansi (accounts, transactions, dll.) TIDAK disentuh.
-- ====================================================================

-- 1. Pastikan RLS aktif
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;

-- 2. Hapus seluruh policy lama yang memperbolehkan akses publik anon
DROP POLICY IF EXISTS "Allow public all on system_users" ON system_users;
DROP POLICY IF EXISTS "Allow public read on system_users" ON system_users;
DROP POLICY IF EXISTS "Allow public insert on system_users" ON system_users;

-- 3. Buat policy isolasi: Tolak semua permintaan dari role anonim
CREATE POLICY "Deny anon access on system_users" 
ON system_users 
FOR ALL 
TO anon 
USING (false) 
WITH CHECK (false);

-- 4. Cabut hak privilege DML tabel dari role anon & authenticated publik
REVOKE ALL ON system_users FROM anon;
REVOKE ALL ON system_users FROM authenticated;

-- 5. Berikan hak akses hanya untuk service_role internal
GRANT ALL ON system_users TO service_role;

