-- ====================================================================
-- SPECTRA FINANCIAL SYSTEM - STAGING BASELINE SCHEMA (POSTGRESQL)
-- FILE: 000_baseline_schema.sql
-- TUJUAN: Inisialisasi struktur tabel dasar akuntansi untuk database
--         Supabase Staging yang masih kosong sebelum migrasi keamanan.
-- ====================================================================

-- 1. Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Bagan Akun (Chart of Accounts)
CREATE TABLE IF NOT EXISTS public.accounts (
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

-- 3. Jurnal Transaksi
CREATE TABLE IF NOT EXISTS public.transactions (
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

-- 4. Kontak Rekanan (Customer & Vendor)
CREATE TABLE IF NOT EXISTS public.contacts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('customer', 'vendor')),
  phone TEXT,
  balance NUMERIC(18, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Profil Perusahaan & Pejabat
CREATE TABLE IF NOT EXISTS public.company_settings (
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

-- 6. Log Jejak Audit Aktivitas
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  username TEXT NOT NULL,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Pengguna Sistem (Struktur Awal Sebelum Security Migration)
CREATE TABLE IF NOT EXISTS public.system_users (
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

-- 8. Row Level Security untuk Tabel Akuntansi
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy Akses Akuntansi (Anon & Authenticated untuk Operasional Aplikasi)
DROP POLICY IF EXISTS "Allow public all on accounts" ON public.accounts;
CREATE POLICY "Allow public all on accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on transactions" ON public.transactions;
CREATE POLICY "Allow public all on transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on contacts" ON public.contacts;
CREATE POLICY "Allow public all on contacts" ON public.contacts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on company_settings" ON public.company_settings;
CREATE POLICY "Allow public all on company_settings" ON public.company_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on activity_logs" ON public.activity_logs;
CREATE POLICY "Allow public all on activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- Indeks Kinerja
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date);
CREATE INDEX IF NOT EXISTS idx_transactions_ref ON public.transactions (ref_number);
CREATE INDEX IF NOT EXISTS idx_accounts_code ON public.accounts (code);

-- Data Default Profil Perusahaan Staging jika belum ada
INSERT INTO public.company_settings (
  id, company_name, business_type, fiscal_period, fiscal_year, currency, tax_rate_percent,
  director_name, director_title, accountant_name, accountant_title
) VALUES (
  'primary', 'PT SPECTRA NUSANTARA ENERGI (STAGING)', 'Holding & Jasa Energi', 'Tahunan', 2026, 'IDR', 11.0,
  'Mazmur Gusti Agung L', 'Direktur Utama', 'Financial Controller', 'Direktur Keuangan'
) ON CONFLICT (id) DO NOTHING;
