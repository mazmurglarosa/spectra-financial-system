-- =========================================================================================
-- MIGRATION 011: ATOMIC SYSTEM RESET VIA POSTGRESQL RPC (SUPABASE FREE-TIER OPTIMIZED)
-- SPECTRA Financial System (SIKEU2)
--
-- DDL MURNI — HEMAT STORAGE & KUOTA SUPABASE FREE:
-- 1. TIDAK MEMBUAT tabel penyimpanan cadangan di Supabase (snapshot disimpan di Google Drive).
-- 2. Fungsi RPC reset_spectra_system: Eksekusi reset atomik PostgreSQL tertransaksi (All-or-Nothing).
--    Mengosongkan baris transaksi, menol-kan saldo awal 76 COA dan saldo rekanan secara atomik.
--    Mencatat jejak audit minimal ke tabel activity_logs yang sudah ada (hanya ID file Drive & metadata).
-- 3. Fungsi RPC restore_spectra_from_snapshot: Memulihkan transaksi, saldo COA, dan kontak
--    langsung dari muatan data snapshot JSON yang diverifikasi dari Google Drive.
-- 4. RPC Security Lockdown: Hak EXECUTE hanya diberikan kepada service_role (backend server).
-- =========================================================================================

-- 1. PROSEDUR RPC: reset_spectra_system (ATOMIK, TERKUNCI & TERVALIDASI KETAT)
DROP FUNCTION IF EXISTS public.reset_spectra_system(text, boolean, text, text, text, text);

CREATE OR REPLACE FUNCTION public.reset_spectra_system(
  p_confirm_code text,
  p_zero_accounts boolean DEFAULT true,
  p_actor_username text DEFAULT 'system_admin',
  p_actor_fullname text DEFAULT 'Administrator',
  p_actor_position text DEFAULT 'Otoritas Keuangan',
  p_backup_id text DEFAULT NULL,
  p_expected_tx_count integer DEFAULT NULL
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
BEGIN
  -- 1. Validasi konfirmasi keamanan wajib
  IF p_confirm_code IS NULL OR trim(p_confirm_code) <> 'RESET-SPECTRA' THEN
    RAISE EXCEPTION 'Konfirmasi keamanan tidak valid: wajib memasukkan kode "RESET-SPECTRA".';
  END IF;

  -- 2. Validasi identifier backup Google Drive terverifikasi (Format Kriptografis Wajib)
  IF p_backup_id IS NULL OR trim(p_backup_id) = '' THEN
    RAISE EXCEPTION 'ID berkas backup Google Drive terverifikasi wajib disertakan sebelum reset.';
  END IF;

  IF NOT (p_backup_id ~ '^drive:[a-zA-Z0-9_\-]+:sha256:[a-f0-9]{64}$') THEN
    RAISE EXCEPTION 'Format ID backup tidak valid: wajib mengikuti pola "drive:<fileId>:sha256:<checksum64>". Nilai: %', p_backup_id;
  END IF;

  -- 3. Kunci tabel transaksi, akun, dan rekanan secara eksklusif (Mencegah race condition)
  LOCK TABLE public.transactions IN EXCLUSIVE MODE;
  LOCK TABLE public.accounts IN EXCLUSIVE MODE;
  LOCK TABLE public.contacts IN EXCLUSIVE MODE;

  -- 4. Hitung jumlah transaksi aktif saat ini di database
  SELECT count(*) INTO v_tx_count FROM public.transactions;

  -- 5. Cegah perubahan data antara snapshot dan eksekusi reset (Consistency Guard)
  IF p_expected_tx_count IS NOT NULL AND v_tx_count <> p_expected_tx_count THEN
    RAISE EXCEPTION 'Deteksi perubahan data: Jumlah transaksi aktif saat ini (%) tidak cocok dengan snapshot cadangan (%). Reset dibatalkan demi keselamatan data.', v_tx_count, p_expected_tx_count;
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

  -- 9. Catat jejak audit resmi secara atomik ke activity_logs (HANYA metadata minimal, tanpa payload JSON besar)
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
    'Reset atomik berhasil: ' || v_tx_count || ' transaksi dihapus, ' || v_acc_count || ' akun saldo dinolkan, ' || v_con_count || ' kontak saldo dinolkan. Berkas Cadangan Google Drive: ' || p_backup_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'SUCCESS',
    'deleted_transactions_count', v_tx_count,
    'accounts_updated_count', v_acc_count,
    'contacts_updated_count', v_con_count,
    'audit_log_id', v_log_id,
    'drive_backup_id', p_backup_id,
    'executed_at', now()
  );
END;
$$;

-- 2. PROSEDUR RPC: restore_spectra_from_snapshot (PEMULIHAN DARI MUATAN GOOGLE DRIVE)
CREATE OR REPLACE FUNCTION public.restore_spectra_from_snapshot(
  p_snapshot_data jsonb,
  p_actor_username text DEFAULT 'system_admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx jsonb;
  v_acc jsonb;
  v_con jsonb;
  v_tx_restored integer := 0;
  v_acc_restored integer := 0;
  v_con_restored integer := 0;
BEGIN
  IF p_snapshot_data IS NULL OR jsonb_typeof(p_snapshot_data) <> 'object' THEN
    RAISE EXCEPTION 'Data snapshot tidak valid atau kosong.';
  END IF;

  -- Kunci tabel untuk atomisitas pemulihan
  LOCK TABLE public.transactions IN EXCLUSIVE MODE;
  LOCK TABLE public.accounts IN EXCLUSIVE MODE;
  LOCK TABLE public.contacts IN EXCLUSIVE MODE;

  -- Hapus transaksi saat ini sebelum restore
  DELETE FROM public.transactions WHERE id IS NOT NULL;

  -- 1. Restore transaksi dari snapshot_data->'transactions' (Mendukung snake_case dan camelCase)
  IF p_snapshot_data ? 'transactions' AND jsonb_array_length(p_snapshot_data->'transactions') > 0 THEN
    FOR v_tx IN SELECT * FROM jsonb_array_elements(p_snapshot_data->'transactions')
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

  -- 2. Restore saldo awal akun dari snapshot_data->'accounts' (Mendukung snake_case dan camelCase)
  IF p_snapshot_data ? 'accounts' THEN
    FOR v_acc IN SELECT * FROM jsonb_array_elements(p_snapshot_data->'accounts')
    LOOP
      UPDATE public.accounts
      SET debet_awal = COALESCE((v_acc->>'debet_awal')::numeric, (v_acc->>'debetAwal')::numeric, 0),
          kredit_awal = COALESCE((v_acc->>'kredit_awal')::numeric, (v_acc->>'kreditAwal')::numeric, 0)
      WHERE id = v_acc->>'id' OR code = v_acc->>'code';
      v_acc_restored := v_acc_restored + 1;
    END LOOP;
  END IF;

  -- 3. Restore saldo rekanan kontak dari snapshot_data->'contacts'
  IF p_snapshot_data ? 'contacts' AND jsonb_array_length(p_snapshot_data->'contacts') > 0 THEN
    FOR v_con IN SELECT * FROM jsonb_array_elements(p_snapshot_data->'contacts')
    LOOP
      UPDATE public.contacts
      SET balance = COALESCE((v_con->>'balance')::numeric, 0)
      WHERE id = v_con->>'id' OR code = v_con->>'code';
      v_con_restored := v_con_restored + 1;
    END LOOP;
  END IF;

  -- 4. Catat activity log resmi
  INSERT INTO public.activity_logs (
    id, timestamp, username, full_name, position, action, detail
  ) VALUES (
    'log-restore-' || floor(extract(epoch from now()) * 1000)::text,
    to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS') || ' WIB',
    p_actor_username,
    'Administrator',
    'Otoritas Keuangan',
    'PEMULIHAN SNAPSHOT SISTEM (GOOGLE DRIVE)',
    'Pemulihan snapshot berhasil: ' || v_tx_restored || ' transaksi, ' || v_acc_restored || ' akun, dan ' || v_con_restored || ' kontak direstorasi dari berkas Google Drive.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'transactions_restored', v_tx_restored,
    'accounts_restored', v_acc_restored,
    'contacts_restored', v_con_restored,
    'restored_at', now()
  );
END;
$$;

-- 3. LEAST PRIVILEGE LOCKDOWN
REVOKE EXECUTE ON FUNCTION public.reset_spectra_system(text, boolean, text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_spectra_system(text, boolean, text, text, text, text, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.restore_spectra_from_snapshot(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_spectra_from_snapshot(jsonb, text) TO service_role;
