import { authenticateFinancialRequest } from '../_lib/financialAuth.js';

/**
 * /api/financial/settings
 * Pengaturan Perusahaan & Profil Finansial:
 * GET: Ambil pengaturan perusahaan
 * POST: Simpan / perbarui pengaturan (wajib role admin)
 */
export default async function handler(req: any, res: any) {
  const method = req.method?.toUpperCase();

  // 1. GET: Ambil Settings
  if (method === 'GET') {
    const auth = await authenticateFinancialRequest(req, res);
    if (!auth) return;

    const { supabase } = auth;
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', 'primary')
        .maybeSingle();

      if (error) throw new Error(error.message);
      return res.status(200).json({ success: true, settings: data || null });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Gagal mengambil pengaturan perusahaan.' });
    }
  }

  // 2. POST: Simpan / Update Settings
  if (method === 'POST') {
    const auth = await authenticateFinancialRequest(req, res, { requireAdmin: true });
    if (!auth) return;

    const { supabase, dbUser } = auth;
    const s = req.body;

    if (!s || typeof s !== 'object') {
      return res.status(400).json({ success: false, error: 'Payload pengaturan tidak valid.' });
    }

    try {
      const row = {
        id: 'primary',
        company_name: String(s.companyName || s.company_name || ''),
        business_type: String(s.businessType || s.business_type || ''),
        fiscal_period: String(s.fiscalPeriod || s.fiscal_period || ''),
        fiscal_year: String(s.fiscalYear || s.fiscal_year || ''),
        currency: String(s.currency || 'IDR'),
        tax_rate_percent: Number(s.taxRatePercent || s.tax_rate_percent) || 11,
        address: String(s.address || ''),
        phone: String(s.phone || ''),
        email: String(s.email || ''),
        director_name: String(s.directorName || s.director_name || ''),
        director_title: String(s.directorTitle || s.director_title || 'Direktur Utama'),
        accountant_name: String(s.accountantName || s.accountant_name || ''),
        accountant_title: String(s.accountantTitle || s.accountant_title || 'Direktur Keuangan'),
        updated_at: new Date().toISOString()
      };

      const { error: setErr } = await supabase.from('company_settings').upsert(row, { onConflict: 'id' });
      if (setErr) throw new Error(setErr.message);

      // Audit Log
      await supabase.from('activity_logs').insert({
        id: `log-set-${Date.now()}`,
        timestamp: new Date().toLocaleString('id-ID'),
        username: dbUser.username,
        full_name: dbUser.fullName,
        position: dbUser.position,
        action: 'Pengaturan Perusahaan',
        detail: `Memperbarui profil perusahaan: ${row.company_name} (Tahun Buku ${row.fiscal_year})`
      });

      return res.status(200).json({ success: true, message: 'Pengaturan perusahaan berhasil disimpan.', settings: row });
    } catch (err: any) {
      console.error('[PostSetError]', err?.message);
      return res.status(500).json({ success: false, error: 'Gagal menyimpan pengaturan ke database.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
