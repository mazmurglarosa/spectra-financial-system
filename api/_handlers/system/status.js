export default function handler(req, res) {
  let dbHost = null;
  try {
    const u = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (u) dbHost = new URL(u).hostname;
  } catch {}

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
    },
    envDiagnostics: {
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      supabaseHost: dbHost,
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
      hasAnonKey: Boolean(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
      hasSessionSecret: Boolean(process.env.SERVER_SESSION_SECRET),
      hasGroqApiKey: Boolean(process.env.GROQ_API_KEY),
      vercelEnv: process.env.VERCEL_ENV || 'unknown'
    }
  });
}
