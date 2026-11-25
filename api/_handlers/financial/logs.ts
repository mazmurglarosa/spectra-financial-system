import { authenticateFinancialRequest } from '../../_lib/financialAuth.js';

/**
 * /api/financial/logs
 * Audit Trail & Activity Logs:
 * GET: Ambil riwayat log aktivitas (wajib admin atau otorisasi)
 * POST: Catat aktivitas pengguna
 */
export default async function handler(req: any, res: any) {
  const method = req.method?.toUpperCase();

  // 1. GET: Ambil Logs
  if (method === 'GET') {
    const auth = await authenticateFinancialRequest(req, res, { requireAuthority: true });
    if (!auth) return;

    const { supabase } = auth;
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('id', { ascending: false })
        .limit(200);

      if (error) throw new Error(error.message);
      return res.status(200).json({ success: true, logs: data || [] });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Gagal mengambil riwayat aktivitas.' });
    }
  }

  // 2. POST: Tambah Log
  if (method === 'POST') {
    const auth = await authenticateFinancialRequest(req, res);
    if (!auth) return;

    const { supabase, dbUser } = auth;
    const { action, detail } = req.body || {};

    if (!action) {
      return res.status(400).json({ success: false, error: 'Aksi log wajib diisi.' });
    }

    try {
      const row = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleString('id-ID'),
        username: dbUser.username,
        full_name: dbUser.fullName,
        position: dbUser.position,
        action: String(action),
        detail: String(detail || '')
      };

      const { error: insErr } = await supabase.from('activity_logs').insert(row);
      if (insErr) throw new Error(insErr.message);

      return res.status(200).json({ success: true, log: row });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Gagal mencatat log aktivitas.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
