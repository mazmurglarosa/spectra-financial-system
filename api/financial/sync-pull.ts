import { authenticateFinancialRequest } from '../_lib/financialAuth.js';
import {
  mapDbAccountToAccount,
  mapDbTransactionToTransaction,
  mapDbContactToContact,
  mapDbCompanySettingsToCompanySettings
} from '../_lib/accountingMapper.js';

/**
 * GET /api/financial/sync-pull
 * Menarik seluruh data pembukuan keuangan (Accounts, Transactions, Contacts, Settings)
 * Terproteksi penuh: hanya pengguna aktif yang terautentikasi dapat membaca data.
 * Memetakan seluruh data database secara semantik identik dengan model TypeScript SPECTRA.
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

    // Mapping terpusat ke format model frontend SPECTRA (src/types/accounting.ts)
    const accounts = (rawAccounts || []).map(mapDbAccountToAccount);
    const transactions = (rawTx || []).map(mapDbTransactionToTransaction);
    const contacts = (rawContacts || []).map(mapDbContactToContact);
    const settings = rawSettings ? mapDbCompanySettingsToCompanySettings(rawSettings) : null;

    return res.status(200).json({
      success: true,
      data: {
        accounts,
        transactions,
        contacts,
        settings
      }
    });
  } catch (err: any) {
    console.error('[SyncPullError]', err?.message);
    return res.status(500).json({
      success: false,
      error: 'Gagal menarik data pembukuan dari cloud server.'
    });
  }
}
