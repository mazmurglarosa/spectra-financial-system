-- ====================================================================
-- SPECTRA FINANCIAL SYSTEM - DUMMY CHART OF ACCOUNTS (CoA) SEED
-- FILE: 000_seed_default_accounts.sql
-- TUJUAN: Mengisi bagan akun standar akuntansi Indonesia (SAK)
--         untuk database STAGING yang bersih (Saldo Awal: 0).
-- PERINGATAN: Berisi data standar dummy aplikasi, BUKAN data Production!
-- ====================================================================

INSERT INTO public.accounts (id, code, name, category, category_name, pos, sn, debet_awal, kredit_awal, is_header) VALUES
('acc-10000', '10000', 'Harta Lancar', 'HARTA_LANCAR', 'Harta Lancar', 'Nrc', 'Db', 0, 0, true),
('acc-10001', '10001', 'Kas', 'HARTA_LANCAR', 'Harta Lancar', 'Nrc', 'Db', 0, 0, false),
('acc-10002', '10002', 'Persediaan Barang Dagang', 'HARTA_LANCAR', 'Harta Lancar', 'Nrc', 'Db', 0, 0, false),
('acc-10003', '10003', 'Piutang Usaha', 'HARTA_LANCAR', 'Harta Lancar', 'Nrc', 'Db', 0, 0, false),
('acc-10004', '10004', 'Piutang Pendapatan', 'HARTA_LANCAR', 'Harta Lancar', 'Nrc', 'Db', 0, 0, false),
('acc-10005', '10005', 'Wesel Tagih', 'HARTA_LANCAR', 'Harta Lancar', 'Nrc', 'Db', 0, 0, false),
('acc-10006', '10006', 'Perlengkapan Kantor', 'HARTA_LANCAR', 'Harta Lancar', 'Nrc', 'Db', 0, 0, false),
('acc-10007', '10007', 'Perlengkapan Toko', 'HARTA_LANCAR', 'Harta Lancar', 'Nrc', 'Db', 0, 0, false),
('acc-10008', '10008', 'Iklan Dibayar Dimuka', 'HARTA_LANCAR', 'Harta Lancar', 'Nrc', 'Db', 0, 0, false),
('acc-10009', '10009', 'Sewa Dibayar Dimuka', 'HARTA_LANCAR', 'Harta Lancar', 'Nrc', 'Db', 0, 0, false),
('acc-10010', '10010', 'Asuransi Dibayar Dimuka', 'HARTA_LANCAR', 'Harta Lancar', 'Nrc', 'Db', 0, 0, false),

('acc-11000', '11000', 'Harta Tetap', 'HARTA_TETAP', 'Harta Tetap', 'Nrc', 'Db', 0, 0, true),
('acc-11001', '11001', 'Peralatan Kantor', 'HARTA_TETAP', 'Harta Tetap', 'Nrc', 'Db', 0, 0, false),
('acc-11002', '11002', 'Akumulasi Penyusutan Peralatan Kantor', 'HARTA_TETAP', 'Harta Tetap', 'Nrc', 'Kr', 0, 0, false),
('acc-11003', '11003', 'Kendaraan', 'HARTA_TETAP', 'Harta Tetap', 'Nrc', 'Db', 0, 0, false),
('acc-11004', '11004', 'Akumulasi Penyusutan Peralatanan Kendaraan', 'HARTA_TETAP', 'Harta Tetap', 'Nrc', 'Kr', 0, 0, false),
('acc-11005', '11005', 'Gedung', 'HARTA_TETAP', 'Harta Tetap', 'Nrc', 'Db', 0, 0, false),
('acc-11006', '11006', 'Akumulasi Penyusutan Gedung', 'HARTA_TETAP', 'Harta Tetap', 'Nrc', 'Kr', 0, 0, false),
('acc-11007', '11007', 'Mesin', 'HARTA_TETAP', 'Harta Tetap', 'Nrc', 'Db', 0, 0, false),
('acc-11008', '11008', 'Akumulasi Penyusutan Mesin', 'HARTA_TETAP', 'Harta Tetap', 'Nrc', 'Kr', 0, 0, false),
('acc-11009', '11009', 'Peralatan Toko', 'HARTA_TETAP', 'Harta Tetap', 'Nrc', 'Db', 0, 0, false),
('acc-11010', '11010', 'Akumulasi Penyusutan Peralatan Toko', 'HARTA_TETAP', 'Harta Tetap', 'Nrc', 'Kr', 0, 0, false),
('acc-11011', '11011', 'Tanah', 'HARTA_TETAP', 'Harta Tetap', 'Nrc', 'Db', 0, 0, false),

('acc-20000', '20000', 'Utang / Kewajiban Lancar', 'UTANG_LANCAR', 'Utang Lancar', 'Nrc', 'Kr', 0, 0, true),
('acc-20001', '20001', 'Utang Usaha/Dagang', 'UTANG_LANCAR', 'Utang Lancar', 'Nrc', 'Kr', 0, 0, false),
('acc-20002', '20002', 'Utang Wesel', 'UTANG_LANCAR', 'Utang Lancar', 'Nrc', 'Kr', 0, 0, false),
('acc-20003', '20003', 'Utang Gaji', 'UTANG_LANCAR', 'Utang Lancar', 'Nrc', 'Kr', 0, 0, false),
('acc-20004', '20004', 'Utang Pajak Penghasilan', 'UTANG_LANCAR', 'Utang Lancar', 'Nrc', 'Kr', 0, 0, false),
('acc-20005', '20005', 'Utang Hipotek', 'UTANG_LANCAR', 'Utang Lancar', 'Nrc', 'Kr', 0, 0, false),
('acc-20006', '20006', 'Utang Obligasi', 'UTANG_LANCAR', 'Utang Lancar', 'Nrc', 'Kr', 0, 0, false),
('acc-20007', '20007', 'Pendapatan Diterima Dimuka', 'UTANG_LANCAR', 'Utang Lancar', 'Nrc', 'Kr', 0, 0, false),
('acc-20008', '20008', 'Utang Utilitas', 'UTANG_LANCAR', 'Utang Lancar', 'Nrc', 'Kr', 0, 0, false),

('acc-21000', '21000', 'Utang Non Operasional', 'UTANG_JANGKA_PANJANG', 'Utang Jangka Panjang', 'Nrc', 'Kr', 0, 0, true),
('acc-21001', '21001', 'Utang Sewa', 'UTANG_JANGKA_PANJANG', 'Utang Jangka Panjang', 'Nrc', 'Kr', 0, 0, false),
('acc-21002', '21002', 'Utang Bank', 'UTANG_JANGKA_PANJANG', 'Utang Jangka Panjang', 'Nrc', 'Kr', 0, 0, false),
('acc-21003', '21003', 'Utang Bunga', 'UTANG_JANGKA_PANJANG', 'Utang Jangka Panjang', 'Nrc', 'Kr', 0, 0, false),

('acc-30000', '30000', 'Modal/Ekuitas', 'EKUITAS', 'Modal / Ekuitas', 'Nrc', 'Kr', 0, 0, false),
('acc-30001', '30001', 'Prive', 'EKUITAS', 'Modal / Ekuitas', 'Nrc', 'Db', 0, 0, false),
('acc-30002', '30002', 'Ikhtisar Laba Rugi', 'EKUITAS', 'Modal / Ekuitas', 'Nrc', 'Db', 0, 0, false),

('acc-40000', '40000', 'Pendapatan Operasional', 'PENDAPATAN_OPERASIONAL', 'Pendapatan Operasional', 'Lr', 'Kr', 0, 0, true),
('acc-40001', '40001', 'Pendapatan Jasa / Usaha', 'PENDAPATAN_OPERASIONAL', 'Pendapatan Operasional', 'Lr', 'Kr', 0, 0, false),
('acc-40002', '40002', 'Retur Penjualan', 'PENDAPATAN_OPERASIONAL', 'Pendapatan Operasional', 'Lr', 'Kr', 0, 0, false),
('acc-40003', '40003', 'Potongan Penjualan', 'PENDAPATAN_OPERASIONAL', 'Pendapatan Operasional', 'Lr', 'Kr', 0, 0, false),
('acc-40004', '40004', 'Pembelian', 'PENDAPATAN_OPERASIONAL', 'Pendapatan Operasional', 'Lr', 'Kr', 0, 0, false),
('acc-40005', '40005', 'Retur Pembelian', 'PENDAPATAN_OPERASIONAL', 'Pendapatan Operasional', 'Lr', 'Kr', 0, 0, false),
('acc-40006', '40006', 'Beban Angkut Pembelian', 'PENDAPATAN_OPERASIONAL', 'Pendapatan Operasional', 'Lr', 'Kr', 0, 0, false),

('acc-50000', '50000', 'Beban Operasional', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, true),
('acc-50001', '50001', 'Beban Gaji Karyawan', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),
('acc-50002', '50002', 'Beban Iklan', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),
('acc-50003', '50003', 'Beban Asuransi', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),
('acc-50004', '50004', 'Beban Sewa Kantor', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),
('acc-50005', '50005', 'Beban Perlengkapan Kantor', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),
('acc-50006', '50006', 'Beban Perlengkapan Toko', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),
('acc-50007', '50007', 'Beban Utilitas (Listrik, Air, Internet)', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),
('acc-50008', '50008', 'Beban Penyusutan Peralatan', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),
('acc-50009', '50009', 'Beban Penyusutan Kendaraan', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),
('acc-50010', '50010', 'Beban Penyusutan Gedung', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),
('acc-50011', '50011', 'Beban Penyusutan Mesin', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),
('acc-50012', '50012', 'Beban Konsumsi & Dapur', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),
('acc-50013', '50013', 'Beban Transportasi & Bensin', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),
('acc-50014', '50014', 'Beban Pemeliharaan & Operasional Kantor', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),
('acc-50015', '50015', 'Beban Administrasi Bank', 'BEBAN_OPERASIONAL', 'Beban Operasional', 'Lr', 'Db', 0, 0, false),

('acc-60000', '60000', 'Beban Non Operasional', 'BEBAN_NON_OPERASIONAL', 'Beban Lain-lain', 'Lr', 'Db', 0, 0, true),
('acc-60001', '60001', 'Beban Bunga Pinjaman', 'BEBAN_NON_OPERASIONAL', 'Beban Lain-lain', 'Lr', 'Db', 0, 0, false),
('acc-60002', '60002', 'Beban Pajak Penghasilan (PPh)', 'BEBAN_NON_OPERASIONAL', 'Beban Lain-lain', 'Lr', 'Db', 0, 0, false),
('acc-60003', '60003', 'Beban Rupa-rupa / Lainnya', 'BEBAN_NON_OPERASIONAL', 'Beban Lain-lain', 'Lr', 'Db', 0, 0, false)
ON CONFLICT (code) DO NOTHING;
