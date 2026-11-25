import { buildLogoutCookie } from "../../_lib/auth.js";

export default async function handler(req: any, res: any) {
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

