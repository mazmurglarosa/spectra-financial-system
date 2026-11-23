import { verifySessionToken, parseCookies, validateCsrf } from "../../_lib/auth.js";
import { getSupabaseServerClient } from "../../_lib/supabaseServer.js";

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

  // 2. Otorisasi Admin/Authority
  if (session.role !== 'admin' && !session.isAuthority) {
    return res.status(403).json({ success: false, error: 'Akses ditolak. Hanya Administrator yang dapat menyetujui atau mengubah status pengguna.' });
  }

  // 3. Perlindungan CSRF jika request menggunakan cookie sesi
  if (cookies['spectra_session'] && !validateCsrf(req)) {
    return res.status(403).json({ success: false, error: 'Validasi CSRF Token gagal.' });
  }

  const body = req.body || {};
  const targetUserId = String(body.userId || '').trim();
  const action = String(body.action || '').trim().toLowerCase();

  if (!targetUserId) {
    return res.status(400).json({ success: false, error: 'Parameter userId wajib disertakan.' });
  }

  if (!['approve', 'reject', 'suspend', 'activate'].includes(action)) {
    return res.status(400).json({ success: false, error: 'Aksi tidak valid. Pilihan: approve, reject, suspend, activate.' });
  }

  // Admin tidak boleh men-suspend dirinya sendiri
  if (targetUserId === session.sub && (action === 'suspend' || action === 'reject')) {
    return res.status(400).json({ success: false, error: 'Tidak diizinkan mengubah status akun sendiri ke non-aktif.' });
  }

  try {
    const supabase = getSupabaseServerClient();

    // Periksa target user
    const { data: targets, error: targetErr } = await supabase
      .from('system_users')
      .select('id, username, status, session_version')
      .eq('id', targetUserId)
      .limit(1);

    if (targetErr || !targets || targets.length === 0) {
      return res.status(404).json({ success: false, error: 'Pengguna yang dimaksud tidak ditemukan di sistem.' });
    }

    const targetUser = targets[0];
    let newStatus = targetUser.status;
    let message = '';
    const currentVersion = targetUser.session_version || 1;
    let nextVersion = currentVersion;

    if (action === 'approve' || action === 'activate') {
      newStatus = 'active';
      message = `Pengguna ${targetUser.username} berhasil diaktifkan.`;
    } else if (action === 'suspend') {
      newStatus = 'suspended';
      nextVersion = currentVersion + 1; // Cabut seluruh sesi aktif target user seketika
      message = `Pengguna ${targetUser.username} telah dinonaktifkan (suspended).`;
    } else if (action === 'reject') {
      // Hapus data pendaftaran jika ditolak
      await supabase.from('system_users').delete().eq('id', targetUserId);
      return res.status(200).json({
        success: true,
        message: `Pendaftaran pengguna ${targetUser.username} telah ditolak dan dihapus.`
      });
    }

    const { error: updateErr } = await supabase
      .from('system_users')
      .update({
        status: newStatus,
        session_version: nextVersion
      })
      .eq('id', targetUserId);

    if (updateErr) {
      throw updateErr;
    }

    return res.status(200).json({
      success: true,
      message,
      userId: targetUserId,
      newStatus
    });

  } catch (err: any) {
    console.error('[API Admin Approve Error]:', err);
    return res.status(500).json({ success: false, error: 'Gagal memperbarui status pengguna.' });
  }
}

