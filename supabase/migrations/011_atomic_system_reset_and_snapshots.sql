-- =========================================================================================
-- MIGRATION 011: ATOMIC SYSTEM RESET, AUDIT, AND VERIFIED PRE-RESET SNAPSHOTS
-- SPECTRA Financial System (SIKEU2)
--
-- 1. Tabel system_backups: Menyimpan snapshot data akuntansi terverifikasi sebelum operasi destruktif
--    dengan checksum SHA-256, batas retensi 90 hari, dan isolasi akses RLS ketat.
-- 2. Fungsi RPC reset_spectra_system: Eksekusi reset atomik tertransaksi (All-or-Nothing).
--    Semua operasi penghapusan transaksi, penol-an saldo COA & kontak, serta pencatatan audit log
--    dieksekusi dalam satu unit transaksi PostgreSQL yang terkunci (LOCK TABLE) dan idempotent.
-- 3. Fungsi RPC restore_spectra_snapshot: Mekanisme pemulihan data dari snapshot jika dibutuhkan.
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

-- 2. PROSEDUR RPC: reset_spectra_system (ATOMIK & TERTRANSAKSI)
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
  v_backup_exists boolean := false;
BEGIN
  -- 1. Validasi konfirmasi keamanan wajib
  IF p_confirm_code IS NULL OR trim(p_confirm_code) <> 'RESET-SPECTRA' THEN
    RAISE EXCEPTION 'Konfirmasi keamanan tidak valid: wajib memasukkan kode "RESET-SPECTRA".';
  END IF;

  -- 2. Validasi snapshot cadangan jika p_backup_id diberikan
  IF p_backup_id IS NOT NULL AND trim(p_backup_id) <> '' THEN
    SELECT is_verified INTO v_backup_exists 
    FROM public.system_backups 
    WHERE id = p_backup_id;

    IF v_backup_exists IS NOT TRUE THEN
      RAISE EXCEPTION 'Snapshot cadangan % belum diverifikasi atau tidak ditemukan. Reset dibatalkan demi keselamatan data.', p_backup_id;
    END IF;
  END IF;

  -- 3. Kunci tabel transaksi, akun, dan rekanan secara eksklusif (Mencegah race condition)
  LOCK TABLE public.transactions IN EXCLUSIVE MODE;
  LOCK TABLE public.accounts IN EXCLUSIVE MODE;
  LOCK TABLE public.contacts IN EXCLUSIVE MODE;

  -- 4. Hitung jumlah transaksi aktif sebelum dihapus
  SELECT count(*) INTO v_tx_count FROM public.transactions;

  -- 5. Hapus SELURUH baris transaksi
  DELETE FROM public.transactions WHERE id IS NOT NULL;

  -- 6. Nol-kan saldo awal akun jika p_zero_accounts = true (76 COA tetap utuh)
  IF p_zero_accounts IS NOT FALSE THEN
    UPDATE public.accounts 
    SET debet_awal = 0, 
        kredit_awal = 0
    WHERE id IS NOT NULL;
    GET DIAGNOSTICS v_acc_count = ROW_COUNT;
  ELSE
    SELECT count(*) INTO v_acc_count FROM public.accounts;
  END IF;

  -- 7. Nol-kan saldo rekanan
  UPDATE public.contacts 
  SET balance = 0 
  WHERE id IS NOT NULL;
  GET DIAGNOSTICS v_con_count = ROW_COUNT;

  -- 8. Catat jejak audit resmi secara atomik ke activity_logs
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
    'Reset atomik PostgreSQL berhasil dieksekusi: ' || v_tx_count || ' transaksi dihapus, ' || v_acc_count || ' akun saldo dinolkan, ' || v_con_count || ' kontak saldo dinolkan.' || 
    CASE WHEN p_backup_id IS NOT NULL THEN ' ID Snapshot Cadangan: ' || p_backup_id ELSE '' END
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

-- 3. PROSEDUR RPC: restore_spectra_snapshot (PEMULIHAN SNAPSHOT)
CREATE OR REPLACE FUNCTION public.restore_spectra_snapshot(
  p_backup_id text,
  p_actor_username text DEFAULT 'system_admin'
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
  v_tx_restored integer := 0;
  v_acc_restored integer := 0;
BEGIN
  SELECT * INTO v_backup 
  FROM public.system_backups 
  WHERE id = p_backup_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot dengan ID % tidak ditemukan.', p_backup_id;
  END IF;

  -- Kunci tabel untuk atomisitas pemulihan
  LOCK TABLE public.transactions IN EXCLUSIVE MODE;
  LOCK TABLE public.accounts IN EXCLUSIVE MODE;

  -- Hapus transaksi saat ini
  DELETE FROM public.transactions WHERE id IS NOT NULL;

  -- Restore transaksi dari snapshot_data->'transactions'
  IF v_backup.snapshot_data ? 'transactions' AND jsonb_array_length(v_backup.snapshot_data->'transactions') > 0 THEN
    FOR v_tx IN SELECT * FROM jsonb_array_elements(v_backup.snapshot_data->'transactions')
    LOOP
      INSERT INTO public.transactions (
        id, date, ref_number, type, description, lines, total_debit, total_credit, partner, created_at, updated_at
      ) VALUES (
        v_tx->>'id',
        (v_tx->>'date')::date,
        v_tx->>'refNumber',
        v_tx->>'type',
        v_tx->>'description',
        COALESCE(v_tx->'lines', '[]'::jsonb),
        COALESCE((v_tx->>'totalDebit')::numeric, 0),
        COALESCE((v_tx->>'totalCredit')::numeric, 0),
        v_tx->>'partner',
        COALESCE((v_tx->>'createdAt')::bigint, floor(extract(epoch from now()) * 1000)::bigint),
        COALESCE((v_tx->>'updatedAt')::bigint, floor(extract(epoch from now()) * 1000)::bigint)
      );
      v_tx_restored := v_tx_restored + 1;
    END LOOP;
  END IF;

  -- Restore saldo awal akun dari snapshot_data->'accounts'
  IF v_backup.snapshot_data ? 'accounts' THEN
    FOR v_acc IN SELECT * FROM jsonb_array_elements(v_backup.snapshot_data->'accounts')
    LOOP
      UPDATE public.accounts
      SET debet_awal = COALESCE((v_acc->>'debetAwal')::numeric, (v_acc->>'debet_awal')::numeric, 0),
          kredit_awal = COALESCE((v_acc->>'kreditAwal')::numeric, (v_acc->>'kredit_awal')::numeric, 0)
      WHERE id = v_acc->>'id' OR code = v_acc->>'code';
      v_acc_restored := v_acc_restored + 1;
    END LOOP;
  END IF;

  -- Tandai backup telah dipulihkan
  UPDATE public.system_backups 
  SET restored_at = now() 
  WHERE id = p_backup_id;

  -- Catat activity log
  INSERT INTO public.activity_logs (
    id, timestamp, username, full_name, position, action, detail
  ) VALUES (
    'log-restore-' || floor(extract(epoch from now()) * 1000)::text,
    to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS') || ' WIB',
    p_actor_username,
    'Administrator',
    'Otoritas Keuangan',
    'PEMULIHAN SNAPSHOT SISTEM',
    'Snapshot ' || p_backup_id || ' berhasil dipulihkan: ' || v_tx_restored || ' transaksi dan saldo akun direstorasi.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'backup_id', p_backup_id,
    'transactions_restored', v_tx_restored,
    'accounts_restored', v_acc_restored,
    'restored_at', now()
  );
END;
$$;

-- 4. LEAST PRIVILEGE LOCKDOWN PADA FUNGSI RPC
REVOKE EXECUTE ON FUNCTION public.reset_spectra_system(text, boolean, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_spectra_system(text, boolean, text, text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.restore_spectra_snapshot(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_spectra_snapshot(text, text) TO service_role;
