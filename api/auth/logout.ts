import { buildLogoutCookie } from '../lib/auth';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Hanya POST yang didukung.' });
  }

  // Hapus cookie sesi HttpOnly
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const secureFlag = isProd ? '; Secure' : '';
  const clearHeaders = [
    buildLogoutCookie(),
    `spectra_csrf=; SameSite=Lax; Path=/${secureFlag}; Max-Age=0`
  ];

  res.setHeader('Set-Cookie', clearHeaders);

  return res.status(200).json({
    success: true,
    message: 'Sesi berhasil diakhiri secara aman.'
  });
}

