-- =========================================================================================
-- MIGRATION 011: ATOMIC SYSTEM RESET, AUDIT, AND VERIFIED PRE-RESET SNAPSHOTS
-- SPECTRA Financial System (SIKEU2)
--
-- DDL MURNI (NON-DESTRUKTIF):
-- File ini HANYA membuat skema tabel system_backups, RLS policies, dan prosedur RPC.
-- DILARANG memuat perintah pembersihan data, DELETE, atau DROP pada tabel produksi.
--
-- 1. Tabel system_backups: Menyimpan snapshot data akuntansi terverifikasi sebelum operasi destruktif
--    dengan checksum SHA-256, batas retensi 90 hari, dan isolasi akses RLS ketat.
-- 2. Fungsi RPC reset_spectra_system: Eksekusi reset atomik tertransaksi (All-or-Nothing).
--    Wajib menerima snapshot ID yang valid, terverifikasi, dan konsisten dengan jumlah transaksi live.
--    Semua operasi penghapusan transaksi, penol-an saldo COA & kontak, serta pencatatan audit log
--    dieksekusi dalam satu unit transaksi PostgreSQL yang terkunci (LOCK TABLE) dan idempotent.
-- 3. Fungsi RPC restore_spectra_snapshot: Mekanisme pemulihan data dari snapshot terverifikasi
--    (memulihkan transaksi, saldo awal akun COA, dan saldo rekanan kontak) dengan verifikasi checksum SHA-256.
-- 4. RPC Security Hardening: Hak EXECUTE hanya diberikan kepada service_role (backend server).
-- =========================================================================================

-- 1. TABEL SNAPSHOT CADANGAN SISTEM
CREATE TABLE IF NOT EXISTS public.system_backups (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  backup_type text NOT NULL DEFAULT 'pre_reset_snapshot',
  sha256_checksum text NOT NULL,
  retention_until timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  transactions_count integer NOT NULL DEFAULT 0,
  accounts_count integer NOT NULL DEFAULT 0,
  contacts_count integer NOT NULL DEFAULT 0,
  snapshot_data jsonb NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  restored_at timestamptz
);

-- RLS Lockdown untuk system_backups (Hanya service role / otoritas backend)
ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'system_backups' AND policyname = 'service_role_all_system_backups'
  ) THEN
    CREATE POLICY service_role_all_system_backups ON public.system_backups
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 2. PROSEDUR RPC: reset_spectra_system (ATOMIK & WAJIB SNAPSHOT TERVERIFIKASI)
CREATE OR REPLACE FUNCTION public.reset_spectra_system(
  p_confirm_code text,
  p_zero_accounts boolean DEFAULT true,
  p_actor_username text DEFAULT 'system_admin',
  p_actor_fullname text DEFAULT 'Administrator',
  p_actor_position text DEFAULT 'Otoritas Keuangan',
  p_backup_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx_count integer := 0;
  v_acc_count integer := 0;
  v_con_count integer := 0;
  v_log_id text;
  v_backup_verified boolean := false;
  v_backup_tx_count integer := 0;
BEGIN
  -- 1. Validasi konfirmasi keamanan wajib
  IF p_confirm_code IS NULL OR trim(p_confirm_code) <> 'RESET-SPECTRA' THEN
    RAISE EXCEPTION 'Konfirmasi keamanan tidak valid: wajib memasukkan kode "RESET-SPECTRA".';
  END IF;

  -- 2. Validasi snapshot cadangan: WAJIB diberikan, tidak boleh NULL atau kosong
  IF p_backup_id IS NULL OR trim(p_backup_id) = '' THEN
    RAISE EXCEPTION 'ID snapshot cadangan wajib diberikan sebelum reset dieksekusi.';
  END IF;

  -- 3. Kunci tabel transaksi, akun, dan rekanan secara eksklusif (Mencegah race condition)
  LOCK TABLE public.transactions IN EXCLUSIVE MODE;
  LOCK TABLE public.accounts IN EXCLUSIVE MODE;
  LOCK TABLE public.contacts IN EXCLUSIVE MODE;

  -- 4. Hitung jumlah transaksi aktif saat ini di database
  SELECT count(*) INTO v_tx_count FROM public.transactions;

  -- 5. Validasi snapshot di tabel system_backups: harus terverifikasi dan jumlah transaksi cocok
  SELECT is_verified, transactions_count INTO v_backup_verified, v_backup_tx_count
  FROM public.system_backups
  WHERE id = p_backup_id;

  IF v_backup_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'Snapshot cadangan % belum diverifikasi atau tidak ditemukan di tabel system_backups. Reset dibatalkan demi keselamatan data.', p_backup_id;
  END IF;

  IF v_backup_tx_count <> v_tx_count THEN
    RAISE EXCEPTION 'Inkonsistensi snapshot: Jumlah transaksi pada snapshot (%) tidak cocok dengan transaksi aktif di database (%). Reset dibatalkan demi keselamatan data.', v_backup_tx_count, v_tx_count;
  END IF;

  -- 6. Hapus SELURUH baris transaksi
  DELETE FROM public.transactions WHERE id IS NOT NULL;

  -- 7. Nol-kan saldo awal akun jika p_zero_accounts = true (76 COA tetap utuh)
  IF p_zero_accounts IS NOT FALSE THEN
    UPDATE public.accounts 
    SET debet_awal = 0, 
        kredit_awal = 0
    WHERE id IS NOT NULL;
    GET DIAGNOSTICS v_acc_count = ROW_COUNT;
  ELSE
    SELECT count(*) INTO v_acc_count FROM public.accounts;
  END IF;

  -- 8. Nol-kan saldo rekanan
  UPDATE public.contacts 
  SET balance = 0 
  WHERE id IS NOT NULL;
  GET DIAGNOSTICS v_con_count = ROW_COUNT;

  -- 9. Catat jejak audit resmi secara atomik ke activity_logs
  v_log_id := 'log-reset-' || floor(extract(epoch from now()) * 1000)::text || '-' || substr(md5(random()::text), 1, 8);
  INSERT INTO public.activity_logs (
    id,
    timestamp,
    username,
    full_name,
    position,
    action,
    detail
  ) VALUES (
    v_log_id,
    to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS') || ' WIB',
    p_actor_username,
    p_actor_fullname,
    p_actor_position,
    'RESET PEMBUKUAN TOTAL (RPC ATOMIK)',
    'Reset atomik PostgreSQL berhasil dieksekusi: ' || v_tx_count || ' transaksi dihapus, ' || v_acc_count || ' akun saldo dinolkan, ' || v_con_count || ' kontak saldo dinolkan. ID Snapshot Cadangan: ' || p_backup_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'SUCCESS',
    'deleted_transactions_count', v_tx_count,
    'accounts_updated_count', v_acc_count,
    'contacts_updated_count', v_con_count,
    'audit_log_id', v_log_id,
    'backup_id', p_backup_id,
    'executed_at', now()
  );
END;
$$;

-- 3. PROSEDUR RPC: restore_spectra_snapshot (PEMULIHAN LENGKAP & VERIFIKASI CHECKSUM)
CREATE OR REPLACE FUNCTION public.restore_spectra_snapshot(
  p_backup_id text,
  p_actor_username text DEFAULT 'system_admin',
  p_expected_checksum text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_backup record;
  v_tx jsonb;
  v_acc jsonb;
  v_con jsonb;
  v_tx_restored integer := 0;
  v_acc_restored integer := 0;
  v_con_restored integer := 0;
BEGIN
  -- 1. Validasi snapshot keberadaan
  SELECT * INTO v_backup 
  FROM public.system_backups 
  WHERE id = p_backup_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot dengan ID % tidak ditemukan.', p_backup_id;
  END IF;

  -- 2. Validasi status verifikasi snapshot
  IF v_backup.is_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'Snapshot % belum diverifikasi atau tidak valid. Pemulihan dibatalkan demi keselamatan data.', p_backup_id;
  END IF;

  -- 3. Validasi checksum jika diberikan
  IF p_expected_checksum IS NOT NULL AND trim(p_expected_checksum) <> '' THEN
    IF v_backup.sha256_checksum <> trim(p_expected_checksum) THEN
      RAISE EXCEPTION 'Inkonsistensi checksum snapshot: expected %, got %. Pemulihan dibatalkan demi integritas data.', p_expected_checksum, v_backup.sha256_checksum;
    END IF;
  END IF;

  -- 4. Kunci tabel untuk atomisitas pemulihan
  LOCK TABLE public.transactions IN EXCLUSIVE MODE;
  LOCK TABLE public.accounts IN EXCLUSIVE MODE;
  LOCK TABLE public.contacts IN EXCLUSIVE MODE;

  -- 5. Hapus transaksi saat ini sebelum restore
  DELETE FROM public.transactions WHERE id IS NOT NULL;

  -- 6. Restore transaksi dari snapshot_data->'transactions' (Mendukung snake_case dan camelCase)
  IF v_backup.snapshot_data ? 'transactions' AND jsonb_array_length(v_backup.snapshot_data->'transactions') > 0 THEN
    FOR v_tx IN SELECT * FROM jsonb_array_elements(v_backup.snapshot_data->'transactions')
    LOOP
      INSERT INTO public.transactions (
        id, date, ref_number, type, description, lines, total_debit, total_credit, partner, created_at, updated_at
      ) VALUES (
        v_tx->>'id',
        (v_tx->>'date')::date,
        COALESCE(v_tx->>'ref_number', v_tx->>'refNumber', '-'),
        COALESCE(v_tx->>'type', 'general'),
        COALESCE(v_tx->>'description', ''),
        COALESCE(v_tx->'lines', '[]'::jsonb),
        COALESCE((v_tx->>'total_debit')::numeric, (v_tx->>'totalDebit')::numeric, 0),
        COALESCE((v_tx->>'total_credit')::numeric, (v_tx->>'totalCredit')::numeric, 0),
        COALESCE(v_tx->>'partner', '-'),
        COALESCE((v_tx->>'created_at')::bigint, (v_tx->>'createdAt')::bigint, floor(extract(epoch from now()) * 1000)::bigint),
        COALESCE((v_tx->>'updated_at')::bigint, (v_tx->>'updatedAt')::bigint, floor(extract(epoch from now()) * 1000)::bigint)
      );
      v_tx_restored := v_tx_restored + 1;
    END LOOP;
  END IF;

  -- 7. Restore saldo awal akun dari snapshot_data->'accounts' (Mendukung snake_case dan camelCase)
  IF v_backup.snapshot_data ? 'accounts' THEN
    FOR v_acc IN SELECT * FROM jsonb_array_elements(v_backup.snapshot_data->'accounts')
    LOOP
      UPDATE public.accounts
      SET debet_awal = COALESCE((v_acc->>'debet_awal')::numeric, (v_acc->>'debetAwal')::numeric, 0),
          kredit_awal = COALESCE((v_acc->>'kredit_awal')::numeric, (v_acc->>'kreditAwal')::numeric, 0)
      WHERE id = v_acc->>'id' OR code = v_acc->>'code';
      v_acc_restored := v_acc_restored + 1;
    END LOOP;
  END IF;

  -- 8. Restore saldo rekanan kontak dari snapshot_data->'contacts'
  IF v_backup.snapshot_data ? 'contacts' AND jsonb_array_length(v_backup.snapshot_data->'contacts') > 0 THEN
    FOR v_con IN SELECT * FROM jsonb_array_elements(v_backup.snapshot_data->'contacts')
    LOOP
      UPDATE public.contacts
      SET balance = COALESCE((v_con->>'balance')::numeric, 0)
      WHERE id = v_con->>'id' OR code = v_con->>'code';
      v_con_restored := v_con_restored + 1;
    END LOOP;
  END IF;

  -- 9. Tandai backup telah dipulihkan
  UPDATE public.system_backups 
  SET restored_at = now() 
  WHERE id = p_backup_id;

  -- 10. Catat activity log resmi
  INSERT INTO public.activity_logs (
    id, timestamp, username, full_name, position, action, detail
  ) VALUES (
    'log-restore-' || floor(extract(epoch from now()) * 1000)::text,
    to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS') || ' WIB',
    p_actor_username,
    'Administrator',
    'Otoritas Keuangan',
    'PEMULIHAN SNAPSHOT SISTEM',
    'Snapshot ' || p_backup_id || ' berhasil dipulihkan: ' || v_tx_restored || ' transaksi, ' || v_acc_restored || ' akun, dan ' || v_con_restored || ' kontak direstorasi.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'backup_id', p_backup_id,
    'transactions_restored', v_tx_restored,
    'accounts_restored', v_acc_restored,
    'contacts_restored', v_con_restored,
    'restored_at', now()
  );
END;
$$;

-- 4. LEAST PRIVILEGE LOCKDOWN PADA FUNGSI RPC
REVOKE EXECUTE ON FUNCTION public.reset_spectra_system(text, boolean, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_spectra_system(text, boolean, text, text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.restore_spectra_snapshot(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_spectra_snapshot(text, text, text) TO service_role;
