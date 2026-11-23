import { hashPassword } from '../lib/hash';
import { checkRateLimitCentralized, getClientIp } from '../lib/rateLimit';
import { getSupabaseServerClient } from '../lib/supabaseServer';

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

  // 1. Rate Limiting Registrasi (Maksimal 3 registrasi per 10 menit per IP)
  const clientIp = getClientIp(req);
  const supabase = getSupabaseServerClient();
  const rateKey = `register_${clientIp}`;
  const rateCheck = await checkRateLimitCentralized(rateKey, 3, 10 * 60 * 1000, supabase);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Terlalu banyak permintaan registrasi. Silakan tunggu beberapa menit.'
    });
  }

  const body = req.body || {};
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = String(body.fullName || '').trim();
  const position = String(body.position || '').trim();
  const specialCode = String(body.specialCode || '').trim();
  const avatarUrl = String(body.avatarUrl || '').trim();

  // 2. Validasi Input Ketat
  if (!username || username.length < 3) {
    return res.status(400).json({ success: false, error: 'Username minimal 3 karakter alfanumerik.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password minimal 6 karakter.' });
  }
  if (!fullName) {
    return res.status(400).json({ success: false, error: 'Nama Lengkap wajib diisi.' });
  }

  try {
    const supabase = getSupabaseServerClient();

    // 3. Cek apakah username sudah terdaftar
    const { data: existing } = await supabase
      .from('system_users')
      .select('id')
      .ilike('username', username)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, error: 'Username ini sudah terdaftar. Silakan pilih username lain.' });
    }

    // 4. Hash password menggunakan Argon2id di server
    const hashedPassword = await hashPassword(password);

    // 5. Simpan ke database dengan role default 'user' dan status 'pending'
    // Pengguna DILARANG menentukan sendiri role atau status 'active' melalui body request!
    const newUserRecord = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      username,
      password_hash: hashedPassword,
      full_name: fullName,
      position: position || 'Staf Operasional',
      role: 'user', // Server-enforced role
      is_authority: false,
      status: 'pending', // Server-enforced status pending
      registered_at: new Date().toISOString(),
      session_version: 1
    };

    const { error: insertErr } = await supabase.from('system_users').insert(newUserRecord);

    if (insertErr) {
      throw insertErr;
    }

    // Return respon aman tanpa data rahasia
    return res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil diajukan. Akun Anda saat ini berstatus pending menunggu persetujuan Otoritas Sistem.'
    });

  } catch (err: any) {
    console.error('[API Auth Register Error]:', err);
    return res.status(500).json({ success: false, error: 'Gagal memproses pendaftaran pengguna di server.' });
  }
}

