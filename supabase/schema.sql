-- ====================================================================
-- SPECTRA FINANCIAL SYSTEM - SUPABASE DATABASE SCHEMA (POSTGRESQL)
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Accounts (Bagan Akun / Chart of Accounts)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  category_name TEXT NOT NULL,
  pos TEXT NOT NULL CHECK (pos IN ('Nrc', 'Lr')),
  sn TEXT NOT NULL CHECK (sn IN ('Db', 'Kr')),
  debet_awal NUMERIC(18, 2) DEFAULT 0,
  kredit_awal NUMERIC(18, 2) DEFAULT 0,
  description TEXT,
  is_header BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Transactions (Jurnal Umum, Penyesuaian, Kas/Bank, Penjualan, Pembelian)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  ref_number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_debit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  partner TEXT DEFAULT '-',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 4. Contacts (Pelanggan / Customer & Pemasok / Vendor)
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('customer', 'vendor')),
  phone TEXT,
  balance NUMERIC(18, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Company Settings (Pengaturan Entitas & Pejabat Penandatangan)
CREATE TABLE IF NOT EXISTS company_settings (
  id TEXT PRIMARY KEY DEFAULT 'primary',
  company_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  fiscal_period TEXT NOT NULL,
  fiscal_year INT NOT NULL,
  currency TEXT DEFAULT 'IDR',
  tax_rate_percent NUMERIC(5, 2) DEFAULT 11.0,
  address TEXT,
  phone TEXT,
  email TEXT,
  director_name TEXT NOT NULL,
  director_title TEXT DEFAULT 'Direktur Utama',
  accountant_name TEXT NOT NULL,
  accountant_title TEXT DEFAULT 'Direktur Keuangan',
  preparer_name TEXT,
  preparer_title TEXT,
  approver_name TEXT,
  approver_title TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Activity Logs (Log Jejak Audit Aktivitas Pengguna)
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  username TEXT NOT NULL,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. System Users (Pengguna & Hak Otoritas)
CREATE TABLE IF NOT EXISTS system_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  is_authority BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
  registered_at TEXT NOT NULL
);

-- 8. Enable Row Level Security (RLS) & Public Policies for Demo/App Access
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access (using Supabase anon key)
CREATE POLICY "Allow public all on accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on contacts" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on company_settings" ON company_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on activity_logs" ON activity_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on system_users" ON system_users FOR ALL USING (true) WITH CHECK (true);

-- Indexes for high-speed queries
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
CREATE INDEX IF NOT EXISTS idx_transactions_ref ON transactions (ref_number);
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts (code);
