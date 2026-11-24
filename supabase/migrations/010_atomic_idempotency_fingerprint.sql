-- =========================================================================================
-- MIGRATION 010: DATABASE-LEVEL TRANSACTION IDEMPOTENCY & MATERIAL EQUALITY
-- Memastikan integritas transaksi akuntansi di tingkat engine PostgreSQL:
-- 1. Row-Level Locking (SELECT ... FOR UPDATE) untuk meniadakan race condition antar request.
-- 2. Perbandingan mendalam seluruh data material (tanggal, ref_number, description,
--    partner, total_debit, total_credit, dan rincian baris lines/rekening terurut kanonikal).
-- 3. Retry jaringan identik tidak memutasi baris existing (Idempotent Safe).
-- 4. Mutasi dengan isi material berbeda tanpa otorisasi update resmi (p_is_authorized_update)
--    langsung melempar eksepsi SQL yang me-rollback seluruh operasi database secara atomik.
-- 5. Menjamin baris transaksi lama TIDAK PERNAH terhapus atau tertimpa secara siluman.
-- =========================================================================================

-- Hapus overload lama 4-parameter agar PostgREST tidak mengalami ambiguitas signature
DROP FUNCTION IF EXISTS public.sync_push_atomic(jsonb, jsonb, jsonb, jsonb);

-- 1. Perbarui fungsi sync_push_atomic dengan penguncian baris dan perbandingan material
CREATE OR REPLACE FUNCTION public.sync_push_atomic(
  p_accounts jsonb DEFAULT NULL,
  p_transactions jsonb DEFAULT NULL,
  p_contacts jsonb DEFAULT NULL,
  p_settings jsonb DEFAULT NULL,
  p_is_authorized_update boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account_count integer := 0;
  v_transaction_count integer := 0;
  v_contact_count integer := 0;
  v_settings_updated boolean := false;
  elem jsonb;
  v_tx_id text;
  v_existing public.transactions%ROWTYPE;
  v_lines_identical boolean;
  v_is_identical boolean;
BEGIN
  -- 1. Accounts Upsert
  IF p_accounts IS NOT NULL AND jsonb_typeof(p_accounts) = 'array' AND jsonb_array_length(p_accounts) > 0 THEN
    FOR elem IN SELECT * FROM jsonb_array_elements(p_accounts) LOOP
      IF elem->>'id' IS NULL OR elem->>'code' IS NULL THEN
        RAISE EXCEPTION 'Akun tidak valid: ID dan Code wajib diisi.';
      END IF;

      INSERT INTO public.accounts (
        id, code, name, category, category_name, pos, sn,
        debet_awal, kredit_awal, description, is_header, updated_at
      )
      VALUES (
        elem->>'id',
        elem->>'code',
        elem->>'name',
        elem->>'category',
        elem->>'category_name',
        elem->>'pos',
        elem->>'sn',
        COALESCE((elem->>'debet_awal')::numeric, 0),
        COALESCE((elem->>'kredit_awal')::numeric, 0),
        elem->>'description',
        COALESCE((elem->>'is_header')::boolean, false),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        category_name = EXCLUDED.category_name,
        pos = EXCLUDED.pos,
        sn = EXCLUDED.sn,
        debet_awal = EXCLUDED.debet_awal,
        kredit_awal = EXCLUDED.kredit_awal,
        description = EXCLUDED.description,
        is_header = EXCLUDED.is_header,
        updated_at = NOW();

      v_account_count := v_account_count + 1;
    END LOOP;
  END IF;

  -- 2. Transactions Atomic Upsert dengan Row Locking & Perbandingan Material
  IF p_transactions IS NOT NULL AND jsonb_typeof(p_transactions) = 'array' AND jsonb_array_length(p_transactions) > 0 THEN
    FOR elem IN SELECT * FROM jsonb_array_elements(p_transactions) LOOP
      v_tx_id := elem->>'id';
      IF v_tx_id IS NULL OR elem->>'ref_number' IS NULL THEN
        RAISE EXCEPTION 'Transaksi tidak valid: ID dan Ref Number wajib diisi.';
      END IF;

      -- Kunci baris transaksi jika sudah ada (mencegah race condition antar transaksi paralel)
      SELECT * INTO v_existing
      FROM public.transactions
      WHERE id = v_tx_id
      FOR UPDATE;

      IF v_existing.id IS NOT NULL THEN
        -- Periksa kesamaan baris jurnal (canonical lines equality: accountCode, debit, credit, memo terurut)
        SELECT (
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'accountCode', TRIM(COALESCE(l->>'accountCode', l->>'accountId', '')),
                'debit', ROUND((COALESCE(l->>'debit', '0'))::numeric, 2),
                'credit', ROUND((COALESCE(l->>'credit', '0'))::numeric, 2),
                'memo', TRIM(COALESCE(l->>'memo', ''))
              )
              ORDER BY 
                TRIM(COALESCE(l->>'accountCode', l->>'accountId', '')),
                ROUND((COALESCE(l->>'debit', '0'))::numeric, 2),
                ROUND((COALESCE(l->>'credit', '0'))::numeric, 2),
                TRIM(COALESCE(l->>'memo', ''))
            )
            FROM jsonb_array_elements(COALESCE(v_existing.lines, '[]'::jsonb)) AS l
          )
          IS NOT DISTINCT FROM
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'accountCode', TRIM(COALESCE(l->>'accountCode', l->>'accountId', '')),
                'debit', ROUND((COALESCE(l->>'debit', '0'))::numeric, 2),
                'credit', ROUND((COALESCE(l->>'credit', '0'))::numeric, 2),
                'memo', TRIM(COALESCE(l->>'memo', ''))
              )
              ORDER BY 
                TRIM(COALESCE(l->>'accountCode', l->>'accountId', '')),
                ROUND((COALESCE(l->>'debit', '0'))::numeric, 2),
                ROUND((COALESCE(l->>'credit', '0'))::numeric, 2),
                TRIM(COALESCE(l->>'memo', ''))
            )
            FROM jsonb_array_elements(COALESCE(elem->'lines', '[]'::jsonb)) AS l
          )
        ) INTO v_lines_identical;

        -- Periksa seluruh data material header & lines
        v_is_identical := (
          v_existing.date = (elem->>'date')::date AND
          v_existing.ref_number = (elem->>'ref_number')::text AND
          COALESCE(v_existing.type, 'general') = COALESCE(elem->>'type', 'general') AND
          COALESCE(v_existing.description, '') = COALESCE(elem->>'description', '') AND
          COALESCE(v_existing.partner, '-') = COALESCE(elem->>'partner', '-') AND
          (v_existing.total_debit)::numeric = (elem->>'total_debit')::numeric AND
          (v_existing.total_credit)::numeric = (elem->>'total_credit')::numeric AND
          COALESCE(v_lines_identical, true)
        );

        IF v_is_identical THEN
          -- Idempotent Safe Retry: Jangan modifikasi baris data lama demi menjaga integritas audit
          v_transaction_count := v_transaction_count + 1;
        ELSE
          -- Data berbeda: Wajib otorisasi pembaruan administratif resmi dari backend
          IF p_is_authorized_update THEN
            UPDATE public.transactions
            SET
              date = (elem->>'date')::date,
              ref_number = elem->>'ref_number',
              type = COALESCE(elem->>'type', 'general'),
              description = COALESCE(elem->>'description', ''),
              lines = elem->'lines',
              total_debit = (elem->>'total_debit')::numeric,
              total_credit = (elem->>'total_credit')::numeric,
              partner = COALESCE(elem->>'partner', '-'),
              updated_at = (elem->>'updated_at')::bigint
            WHERE id = v_tx_id;

            v_transaction_count := v_transaction_count + 1;
          ELSE
            RAISE EXCEPTION 'Konflik Idempotensi Database: Transaksi ID "%" (%) sudah ada dengan data material berbeda. Perubahan baris jurnal ditolak tanpa otorisasi update resmi.',
              v_tx_id, v_existing.ref_number
              USING ERRCODE = '23505';
          END IF;
        END IF;
      ELSE
        -- Transaksi baru: Insert normal
        INSERT INTO public.transactions (
          id, date, ref_number, type, description, lines,
          total_debit, total_credit, partner, created_at, updated_at
        )
        VALUES (
          v_tx_id,
          (elem->>'date')::date,
          elem->>'ref_number',
          COALESCE(elem->>'type', 'general'),
          COALESCE(elem->>'description', ''),
          elem->'lines',
          (elem->>'total_debit')::numeric,
          (elem->>'total_credit')::numeric,
          COALESCE(elem->>'partner', '-'),
          (elem->>'created_at')::bigint,
          (elem->>'updated_at')::bigint
        );

        v_transaction_count := v_transaction_count + 1;
      END IF;
    END LOOP;
  END IF;

  -- 3. Contacts Upsert
  IF p_contacts IS NOT NULL AND jsonb_typeof(p_contacts) = 'array' AND jsonb_array_length(p_contacts) > 0 THEN
    FOR elem IN SELECT * FROM jsonb_array_elements(p_contacts) LOOP
      IF elem->>'id' IS NULL OR elem->>'name' IS NULL THEN
        RAISE EXCEPTION 'Kontak tidak valid: ID dan Name wajib diisi.';
      END IF;

      INSERT INTO public.contacts (
        id, code, name, type, phone, balance, created_at
      )
      VALUES (
        elem->>'id',
        COALESCE(elem->>'code', elem->>'id'),
        elem->>'name',
        LOWER(elem->>'type'),
        elem->>'phone',
        COALESCE((elem->>'balance')::numeric, 0),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        phone = EXCLUDED.phone,
        balance = EXCLUDED.balance;

      v_contact_count := v_contact_count + 1;
    END LOOP;
  END IF;

  -- 4. Company Settings Upsert
  IF p_settings IS NOT NULL AND jsonb_typeof(p_settings) = 'object' AND p_settings != '{}'::jsonb THEN
    IF p_settings->>'company_name' IS NULL THEN
      RAISE EXCEPTION 'Company Settings tidak valid: company_name wajib diisi.';
    END IF;

    INSERT INTO public.company_settings (
      id, company_name, business_type, fiscal_period, fiscal_year,
      currency, tax_rate_percent, address, phone, email,
      director_name, director_title, accountant_name, accountant_title,
      preparer_name, preparer_title, approver_name, approver_title, updated_at
    )
    VALUES (
      COALESCE(p_settings->>'id', 'primary'),
      p_settings->>'company_name',
      COALESCE(p_settings->>'business_type', 'Jasa / Dagang'),
      COALESCE(p_settings->>'fiscal_period', 'Tahunan'),
      (p_settings->>'fiscal_year')::integer,
      COALESCE(p_settings->>'currency', 'IDR'),
      COALESCE((p_settings->>'tax_rate_percent')::numeric, 11),
      p_settings->>'address',
      p_settings->>'phone',
      p_settings->>'email',
      COALESCE(p_settings->>'director_name', '-'),
      p_settings->>'director_title',
      COALESCE(p_settings->>'accountant_name', '-'),
      p_settings->>'accountant_title',
      p_settings->>'preparer_name',
      p_settings->>'preparer_title',
      p_settings->>'approver_name',
      p_settings->>'approver_title',
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      business_type = EXCLUDED.business_type,
      fiscal_period = EXCLUDED.fiscal_period,
      fiscal_year = EXCLUDED.fiscal_year,
      currency = EXCLUDED.currency,
      tax_rate_percent = EXCLUDED.tax_rate_percent,
      address = EXCLUDED.address,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      director_name = EXCLUDED.director_name,
      director_title = EXCLUDED.director_title,
      accountant_name = EXCLUDED.accountant_name,
      accountant_title = EXCLUDED.accountant_title,
      preparer_name = EXCLUDED.preparer_name,
      preparer_title = EXCLUDED.preparer_title,
      approver_name = EXCLUDED.approver_name,
      approver_title = EXCLUDED.approver_title,
      updated_at = NOW();

    v_settings_updated := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_synced', v_account_count,
    'transactions_synced', v_transaction_count,
    'contacts_synced', v_contact_count,
    'settings_updated', v_settings_updated
  );
END;
$$;

-- 2. Fungsi Atomik untuk Posting Transaksi Tunggal (post_transaction_atomic)
CREATE OR REPLACE FUNCTION public.post_transaction_atomic(
  p_transaction jsonb,
  p_is_authorized_update boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res jsonb;
BEGIN
  IF p_transaction IS NULL OR jsonb_typeof(p_transaction) != 'object' THEN
    RAISE EXCEPTION 'Parameter p_transaction wajib berupa objek transaksi.';
  END IF;

  v_res := public.sync_push_atomic(
    p_accounts := NULL,
    p_transactions := jsonb_build_array(p_transaction),
    p_contacts := NULL,
    p_settings := NULL,
    p_is_authorized_update := p_is_authorized_update
  );

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', p_transaction->>'id',
    'ref_number', p_transaction->>'ref_number'
  );
END;
$$;

-- 3. KUNCI HAK AKSES RPC (Mencegah Akses Eksekusi oleh Publik dan Anon)
REVOKE ALL ON FUNCTION public.sync_push_atomic(jsonb, jsonb, jsonb, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_transaction_atomic(jsonb, boolean) FROM PUBLIC, anon, authenticated;

-- Berikan izin EXECUTE HANYA kepada service_role dan authenticator (PostgREST schema engine)
-- Anon dan authenticated tetap DIBLOKIR MUTLAK
GRANT EXECUTE ON FUNCTION public.sync_push_atomic(jsonb, jsonb, jsonb, jsonb, boolean) TO authenticator, service_role;
GRANT EXECUTE ON FUNCTION public.post_transaction_atomic(jsonb, boolean) TO authenticator, service_role;
NOTIFY pgrst, 'reload schema';
