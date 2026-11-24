-- =========================================================================
-- SPECTRA FINANCIAL SYSTEM - MIGRATION 007
-- LOCK FINANCIAL ROW LEVEL SECURITY (RLS) FOR STAGING
--
-- Tujuan:
-- Menghapus seluruh policy "Allow public all" yang mengizinkan anon membaca/
-- menulis langsung ke database.
-- Semua operasi data finansial (accounts, transactions, contacts,
-- company_settings, activity_logs) kini wajib melalui Backend API Gateway
-- Vercel Serverless (/api/financial/*) menggunakan role service_role.
-- =========================================================================

-- 1. Cabut seluruh policy publik yang permisif
DROP POLICY IF EXISTS "Allow public all on accounts" ON accounts;
DROP POLICY IF EXISTS "Allow public all on transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public all on contacts" ON contacts;
DROP POLICY IF EXISTS "Allow public all on company_settings" ON company_settings;
DROP POLICY IF EXISTS "Allow public all on activity_logs" ON activity_logs;

-- 2. Pastikan Row Level Security (RLS) aktif pada seluruh tabel finansial
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;

-- 3. Berikan akses penuh hanya untuk role internal service_role (Backend API Gateway)
DROP POLICY IF EXISTS "Service Role Full Accounts" ON accounts;
CREATE POLICY "Service Role Full Accounts" ON accounts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Transactions" ON transactions;
CREATE POLICY "Service Role Full Transactions" ON transactions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Contacts" ON contacts;
CREATE POLICY "Service Role Full Contacts" ON contacts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Settings" ON company_settings;
CREATE POLICY "Service Role Full Settings" ON company_settings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Logs" ON activity_logs;
CREATE POLICY "Service Role Full Logs" ON activity_logs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Kunci akses anon (publik dari frontend browser langsung)
DROP POLICY IF EXISTS "Deny anon accounts" ON accounts;
CREATE POLICY "Deny anon accounts" ON accounts
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny anon transactions" ON transactions;
CREATE POLICY "Deny anon transactions" ON transactions
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny anon contacts" ON contacts;
CREATE POLICY "Deny anon contacts" ON contacts
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny anon settings" ON company_settings;
CREATE POLICY "Deny anon settings" ON company_settings
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny anon logs" ON activity_logs;
CREATE POLICY "Deny anon logs" ON activity_logs
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- 5. Berikan hak akses tabel (GRANT) kepada role internal service_role
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Pastikan tabel baru otomatis mendapatkan grant untuk service_role
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;
