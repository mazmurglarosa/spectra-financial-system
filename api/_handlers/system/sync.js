/**
 * /api/sync (Legacy Sync Endpoint)
 * AUDIT KEAMANAN: Dinonaktifkan dari menerima data mutasi tanpa autentikasi
 * demi mencegah konfirmasi sukses palsu (fake success).
 * Seluruh mutasi cloud wajib melalui /api/financial/sync-push dengan otentikasi sesi & CSRF token.
 */
export default function handler(req, res) {
  const method = req.method?.toUpperCase();

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (method === 'POST') {
    return res.status(410).json({
      success: false,
      deprecated: true,
      error: 'Endpoint legacy /api/sync telah dinonaktifkan demi perlindungan integritas akuntansi SPECTRA. Seluruh sinkronisasi data cloud wajib menggunakan endpoint resmi terautentikasi /api/financial/sync-push.',
      canonicalEndpoints: {
        push: '/api/financial/sync-push',
        pull: '/api/financial/sync-pull'
      }
    });
  }

  // GET: Informasi status dokumentasi
  return res.status(200).json({
    status: 'deprecated',
    endpoint: '/api/sync',
    message: 'Endpoint legacy ini hanya untuk informasi. Gunakan /api/financial/sync-pull dan /api/financial/sync-push untuk sinkronisasi data nyata.',
    canonicalEndpoints: {
      push: '/api/financial/sync-push',
      pull: '/api/financial/sync-pull'
    }
  });
}
