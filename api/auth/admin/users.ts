import { verifySessionToken, parseCookies } from '../../lib/auth';
import { getSupabaseServerClient } from '../../lib/supabaseServer';

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

  // 1. Ekstrak dan verifikasi token sesi server
  const cookies = parseCookies(req.headers?.cookie);
  const authHeader = req.headers?.authorization;
  const token = cookies['spectra_session'] || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (!token) {
    return res.status(401).json({ success: false, error: 'Autentikasi diperlukan. Sesi tidak ditemukan.' });
  }

  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Sesi tidak valid atau telah kedaluwarsa.' });
  }

  // 2. Otorisasi: Hanya Admin atau Authority yang memiliki hak membaca daftar pengguna
  if (session.role !== 'admin' && !session.isAuthority) {
    return res.status(403).json({ success: false, error: 'Akses ditolak. Endpoint ini hanya untuk Administrator/Otoritas Sistem.' });
  }

  try {
    const supabase = getSupabaseServerClient();

    // 3. Verifikasi ulang di DB bahwa pemanggil masih aktif & memegang hak admin
    const { data: adminCheck } = await supabase
      .from('system_users')
      .select('id, role, is_authority, status, session_version')
      .eq('id', session.sub)
      .limit(1);

    const caller = adminCheck && adminCheck.length > 0 ? adminCheck[0] : null;
    if (!caller || caller.status !== 'active' || (caller.role !== 'admin' && !caller.is_authority)) {
      return res.status(403).json({ success: false, error: 'Hak akses otoritas telah dicabut.' });
    }

    if (caller.session_version && caller.session_version > session.sessionVersion) {
      return res.status(401).json({ success: false, error: 'Sesi telah diinvalidasi.' });
    }

    // 4. Query daftar seluruh pengguna
    // PERINGATAN KEAMANAN: DILARANG menyertakan password atau password_hash dalam select!
    const { data: users, error: listError } = await supabase
      .from('system_users')
      .select('id, username, full_name, position, role, is_authority, status, registered_at, session_version')
      .order('registered_at', { ascending: false });

    if (listError) {
      throw listError;
    }

    const sanitizedUsers = (users || []).map(u => ({
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      position: u.position,
      role: u.role,
      isAuthority: u.is_authority ?? false,
      status: u.status,
      registeredAt: u.registered_at
    }));

    return res.status(200).json({
      success: true,
      users: sanitizedUsers
    });

  } catch (err: any) {
    console.error('[API Admin Users Error]:', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil daftar pengguna sistem.' });
  }
}

