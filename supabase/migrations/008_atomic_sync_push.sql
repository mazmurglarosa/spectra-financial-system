-- =========================================================================================
-- MIGRATION 008: ATOMIC SYNC PUSH TRANSACTION FUNCTION
-- Memastikan operasi sinkronisasi massal (accounts, transactions, contacts, settings)
-- berjalan secara atomik (All-or-Nothing). Kegagalan pada satu entitas akan membatalkan
-- seluruh perubahan dalam satu transaksi database tunggal.
-- =========================================================================================

CREATE OR REPLACE FUNCTION sync_push_atomic(
  p_accounts jsonb DEFAULT NULL,
  p_transactions jsonb DEFAULT NULL,
  p_contacts jsonb DEFAULT NULL,
  p_settings jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account_count integer := 0;
  v_transaction_count integer := 0;
  v_contact_count integer := 0;
  v_settings_updated boolean := false;
  elem jsonb;
BEGIN
  -- 1. Accounts Upsert
  IF p_accounts IS NOT NULL AND jsonb_typeof(p_accounts) = 'array' AND jsonb_array_length(p_accounts) > 0 THEN
    FOR elem IN SELECT * FROM jsonb_array_elements(p_accounts) LOOP
      IF elem->>'id' IS NULL OR elem->>'code' IS NULL THEN
        RAISE EXCEPTION 'Akun tidak valid: ID dan Code wajib diisi.';
      END IF;

      INSERT INTO accounts (
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

  -- 2. Transactions Upsert
  IF p_transactions IS NOT NULL AND jsonb_typeof(p_transactions) = 'array' AND jsonb_array_length(p_transactions) > 0 THEN
    FOR elem IN SELECT * FROM jsonb_array_elements(p_transactions) LOOP
      IF elem->>'id' IS NULL OR elem->>'ref_number' IS NULL THEN
        RAISE EXCEPTION 'Transaksi tidak valid: ID dan Ref Number wajib diisi.';
      END IF;

      INSERT INTO transactions (
        id, date, ref_number, type, description, lines,
        total_debit, total_credit, partner, created_at, updated_at
      )
      VALUES (
        elem->>'id',
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
      )
      ON CONFLICT (id) DO UPDATE SET
        date = EXCLUDED.date,
        ref_number = EXCLUDED.ref_number,
        type = EXCLUDED.type,
        description = EXCLUDED.description,
        lines = EXCLUDED.lines,
        total_debit = EXCLUDED.total_debit,
        total_credit = EXCLUDED.total_credit,
        partner = EXCLUDED.partner,
        updated_at = EXCLUDED.updated_at;

      v_transaction_count := v_transaction_count + 1;
    END LOOP;
  END IF;

  -- 3. Contacts Upsert
  IF p_contacts IS NOT NULL AND jsonb_typeof(p_contacts) = 'array' AND jsonb_array_length(p_contacts) > 0 THEN
    FOR elem IN SELECT * FROM jsonb_array_elements(p_contacts) LOOP
      IF elem->>'id' IS NULL OR elem->>'name' IS NULL THEN
        RAISE EXCEPTION 'Kontak tidak valid: ID dan Name wajib diisi.';
      END IF;

      INSERT INTO contacts (
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

    INSERT INTO company_settings (
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
    'settings_synced', v_settings_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sync_push_atomic TO service_role;
