import { authenticateFinancialRequest } from '../../_lib/financialAuth.js';
import {
  mapDbCompanySettingsToCompanySettings,
  mapCompanySettingsToDb
} from '../../_lib/accountingMapper.js';

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
      return res.status(200).json({
        success: true,
        settings: data ? mapDbCompanySettingsToCompanySettings(data) : null
      });
    } catch (err: any) {
      console.error('[GetSettingsError]', err?.message);
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
      const dbRow = mapCompanySettingsToDb(s);

      const { error: setErr } = await supabase
        .from('company_settings')
        .upsert(dbRow, { onConflict: 'id' });

      if (setErr) throw new Error(setErr.message);

      // Audit Log
      await supabase.from('activity_logs').insert({
        id: `log-set-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleString('id-ID'),
        username: dbUser.username,
        full_name: dbUser.fullName,
        position: dbUser.position,
        action: 'Pengaturan Perusahaan',
        detail: `Memperbarui profil perusahaan: ${dbRow.company_name} (Tahun Buku ${dbRow.fiscal_year})`
      });

      return res.status(200).json({
        success: true,
        message: 'Pengaturan perusahaan berhasil disimpan.',
        settings: mapDbCompanySettingsToCompanySettings(dbRow)
      });
    } catch (err: any) {
      console.error('[PostSetError]', err?.message);
      return res.status(500).json({ success: false, error: `Gagal menyimpan pengaturan ke database: ${err.message}` });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
