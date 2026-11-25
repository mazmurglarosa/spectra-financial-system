-- ====================================================================
-- MIGRATION 004: PEMBERSIHAN KOLOM PASSWORD PLAINTEXT (FINAL STAGE)
-- ====================================================================
-- Status: PREPARED ONLY (TIDAK BOLEH DIEKSEKUSI DI PRODUCTION TANPA PERSETUJUAN)
-- Tujuan: Tahap akhir setelah seluruh akun terverifikasi memiliki password_hash.
--         Menghapus kolom 'password' plaintext agar database zero-plaintext.
-- Peringatan Keamanan:
--   - Jangan jalankan migrasi ini sebelum seluruh pengguna berhasil migrasi ke hash!
--   - Memastikan tidak ada pengguna yang terkunci akibat kolom dihapus prematur.
-- ====================================================================

-- 1. Verifikasi pra-syarat: pastikan tidak ada user aktif tanpa password_hash
-- (Jika ada, batalkan drop kolom untuk mencegah lockout)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM system_users WHERE password_hash IS NULL AND status = 'active') THEN
    RAISE NOTICE 'Peringatan: Masih terdapat pengguna aktif tanpa password_hash. Migrasi pembersihan kolom ditunda.';
  ELSE
    -- Hapus kolom plaintext password lama secara permanen
    ALTER TABLE system_users DROP COLUMN IF EXISTS password;
    RAISE NOTICE 'Kolom password plaintext berhasil dihapus dengan aman.';
  END IF;
END $$;

