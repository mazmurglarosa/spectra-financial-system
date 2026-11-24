export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.status(200).json({
    status: 'ok',
    appName: 'SPECTRA - Financial System',
    version: '2.0.0-accurate',
    edition: 'Accurate Standard Cloud Edition',
    cloudProvider: 'Vercel Serverless Production',
    timestamp: new Date().toISOString(),
    endpoints: {
      status: '/api/status',
      data: '/api/data',
      accounts: '/api/accounts',
      transactions: '/api/transactions',
      sync: '/api/sync'
    }
  });
}
