import { authenticateFinancialRequest } from '../../_lib/financialAuth.js';

/**
 * GET /api/financial/status
 * Cek status konektivitas backend ke cluster database Supabase & ukur latency.
 * Memeriksa kesiapan tabel dan mengembalikan status terverifikasi.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const auth = await authenticateFinancialRequest(req, res);
  if (!auth) return;

  const { supabase, session } = auth;
  const startTime = performance.now();

  try {
    const { count, error } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true });

    const latencyMs = Math.round(performance.now() - startTime);

    if (error) {
      return res.status(500).json({
        success: false,
        error: `Koneksi database bermasalah: ${error.message}`,
        latencyMs
      });
    }

    // Ambil identifier host database secara dinamis tanpa membocorkan kredensial
    let dbHost = 'unknown';
    try {
      const dbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      if (dbUrl) {
        dbHost = new URL(dbUrl).hostname;
      }
    } catch {}

    return res.status(200).json({
      success: true,
      message: 'Koneksi Backend API Gateway ke Supabase aktif & stabil.',
      latencyMs,
      dbHost,
      tableCounts: {
        accounts: count || 0
      },
      authenticatedUser: {
        username: session.username,
        role: session.role
      },
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Pengecekan database gagal: ${err?.message || err}`
    });
  }
}
