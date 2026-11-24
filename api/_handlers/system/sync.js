export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const payload = req.body || {};
    return res.status(200).json({
      success: true,
      message: 'Sinkronisasi data cloud SPECTRA berhasil diproses!',
      syncedAt: new Date().toISOString(),
      itemsCount: {
        accounts: payload.accounts ? payload.accounts.length : 0,
        transactions: payload.transactions ? payload.transactions.length : 0
      }
    });
  }

  res.status(200).json({
    status: 'ok',
    endpoint: '/api/sync',
    description: 'POST JSON payload untuk sinkronisasi data antar device dan sistem eksternal'
  });
}
