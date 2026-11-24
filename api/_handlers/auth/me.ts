import { verifySessionToken, parseCookies } from "../../_lib/auth.js";
import { getSupabaseServerClient } from "../../_lib/supabaseServer.js";

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Hanya GET yang didukung.' });
  }

  // 1. Ekstrak token dari Cookie HttpOnly atau Authorization Bearer
  const cookies = parseCookies(req.headers?.cookie);
  const authHeader = req.headers?.authorization;
  const token = cookies['spectra_session'] || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (!token) {
    return res.status(401).json({ authenticated: false, error: 'Sesi tidak ditemukan atau belum login.' });
  }

  // 2. Verifikasi HMAC-SHA256 Signature dan masa berlaku di server
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ authenticated: false, error: 'Sesi tidak valid atau telah kedaluwarsa.' });
  }

  try {
    const supabase = getSupabaseServerClient();
    
    // 3. Verifikasi apakah akun masih aktif dan session version belum di-revoke
    const { data: users, error } = await supabase
      .from('system_users')
      .select('id, username, full_name, position, role, is_authority, status, session_version')
      .eq('id', session.sub)
      .limit(1);

    const currentUser = users && users.length > 0 ? users[0] : null;

    if (!currentUser || currentUser.status !== 'active') {
      return res.status(401).json({ authenticated: false, error: 'Akun tidak aktif atau akses telah dicabut oleh otoritas.' });
    }

    if (currentUser.session_version && currentUser.session_version > session.sessionVersion) {
      return res.status(401).json({ authenticated: false, error: 'Sesi telah diinvalidasi karena pembaruan kredensial.' });
    }

    // 4. Return Data Profil Bersih
    return res.status(200).json({
      authenticated: true,
      user: {
        id: currentUser.id,
        username: currentUser.username,
        fullName: currentUser.full_name,
        position: currentUser.position,
        role: currentUser.role,
        isAuthority: currentUser.is_authority ?? false,
        status: currentUser.status
      }
    });

  } catch (err: any) {
    console.error('[API Auth Me Error]:', err);
    return res.status(500).json({ authenticated: false, error: 'Gagal memverifikasi status sesi server.' });
  }
}

