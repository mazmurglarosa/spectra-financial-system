import { authenticateFinancialRequest } from '../_lib/financialAuth.js';

/**
 * GET /api/financial/sync-pull
 * Menarik seluruh data pembukuan keuangan (Accounts, Transactions, Contacts, Settings)
 * Terproteksi penuh: hanya pengguna aktif yang terautentikasi dapat membaca data.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const auth = await authenticateFinancialRequest(req, res);
  if (!auth) return; // Response error sudah dikirim oleh middleware

  const { supabase } = auth;

  try {
    // 1. Ambil Akun (Chart of Accounts)
    const { data: rawAccounts, error: accErr } = await supabase
      .from('accounts')
      .select('*')
      .order('code', { ascending: true });

    if (accErr) throw new Error(`Accounts query failed: ${accErr.message}`);

    // 2. Ambil Transaksi (Urut tanggal)
    const { data: rawTx, error: txErr } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: true });

    if (txErr) throw new Error(`Transactions query failed: ${txErr.message}`);

    // 3. Ambil Kontak Rekanan
    const { data: rawContacts, error: conErr } = await supabase
      .from('contacts')
      .select('*')
      .order('code', { ascending: true });

    if (conErr) throw new Error(`Contacts query failed: ${conErr.message}`);

    // 4. Ambil Pengaturan Perusahaan
    const { data: rawSettings, error: setErr } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', 'primary')
      .maybeSingle();

    if (setErr) throw new Error(`Settings query failed: ${setErr.message}`);

    // Mapping ke format model frontend SPECTRA
    const accounts = (rawAccounts || []).map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category,
      normalBalance: r.normal_balance,
      reportType: r.report_type,
      initialDebit: Number(r.initial_debit) || 0,
      initialCredit: Number(r.initial_credit) || 0,
      currentDebit: Number(r.current_debit) || 0,
      currentCredit: Number(r.current_credit) || 0,
      balance: Number(r.balance) || 0,
      isSystem: Boolean(r.is_system),
      description: r.description || ''
    }));

    const transactions = (rawTx || []).map((r: any) => ({
      id: r.id,
      date: r.date,
      refNumber: r.ref_number,
      type: r.type,
      description: r.description,
      lines: Array.isArray(r.lines) ? r.lines : (typeof r.lines === 'string' ? JSON.parse(r.lines) : []),
      totalDebit: Number(r.total_debit) || 0,
      totalCredit: Number(r.total_credit) || 0,
      partner: r.partner || '-',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    const contacts = (rawContacts || []).map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      phone: r.phone || '',
      balance: Number(r.balance) || 0
    }));

    const settings = rawSettings ? {
      companyName: rawSettings.company_name,
      businessType: rawSettings.business_type,
      fiscalPeriod: rawSettings.fiscal_period,
      fiscalYear: rawSettings.fiscal_year,
      currency: rawSettings.currency || 'IDR',
      taxRatePercent: Number(rawSettings.tax_rate_percent) || 11,
      address: rawSettings.address || '',
      phone: rawSettings.phone || '',
      email: rawSettings.email || '',
      directorName: rawSettings.director_name || '',
      directorTitle: rawSettings.director_title || '',
      accountantName: rawSettings.accountant_name || '',
      accountantTitle: rawSettings.accountant_title || ''
    } : null;

    return res.status(200).json({
      success: true,
      data: {
        accounts,
        transactions,
        contacts,
        settings,
        pulledAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('[SyncPullError]', err?.message);
    return res.status(500).json({
      success: false,
      error: 'Gagal mengambil data pembukuan dari server.'
    });
  }
}
