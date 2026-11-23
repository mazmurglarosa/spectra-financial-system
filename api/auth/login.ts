import { verifyPassword, hashPassword } from "../_lib/hash.js";
import { createSessionToken, buildSessionCookie, generateCsrfToken } from "../_lib/auth.js";
import { checkRateLimitCentralized, getClientIp } from "../_lib/rateLimit.js";
import { getSupabaseServerClient, DbUserRecord } from "../_lib/supabaseServer.js";

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Hanya POST yang didukung.' });
  }

  // 1. Rate Limiting Brute Force Protection (Maks 5 percobaan gagal per 5 menit per IP/Username)
  const clientIp = getClientIp(req);
  const body = req.body || {};
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');

  const supabase = getSupabaseServerClient();
  const rateKey = `login_${clientIp}_${username}`;
  const rateCheck = await checkRateLimitCentralized(rateKey, 5, 5 * 60 * 1000, supabase);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Terlalu banyak percobaan login gagal. Demi keamanan, silakan coba lagi dalam beberapa menit.'
    });
  }

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username dan password wajib diisi.' });
  }

  try {
    const supabase = getSupabaseServerClient();
    
    // 2. Query user dari database server Supabase
    const { data: users, error: dbError } = await supabase
      .from('system_users')
      .select('*')
      .ilike('username', username)
      .limit(1);

    let userRecord: DbUserRecord | null = users && users.length > 0 ? users[0] : null;

    // 3. Fallback Bootstrap Superadmin jika database masih dalam tahap seeding
    if (!userRecord && (username === 'admin' || username === 'administrator')) {
      const serverBootstrapPass = process.env.SUPERADMIN_INITIAL_PASSWORD;
      if (serverBootstrapPass && password === serverBootstrapPass) {
        // Auto-seed akun superadmin pertama kali secara aman di server
        const hashedBoot = await hashPassword(serverBootstrapPass);
        const bootUser: DbUserRecord = {
          id: 'usr-admin-master',
          username: 'admin',
          password_hash: hashedBoot,
          full_name: 'Administrator Sistem',
          position: 'Administrator Sistem',
          role: 'admin',
          is_authority: true,
          status: 'active',
          registered_at: new Date().toISOString(),
          session_version: 1
        };

        await supabase.from('system_users').upsert(bootUser);
        userRecord = bootUser;
      }
    }

    if (!userRecord) {
      return res.status(401).json({ success: false, error: 'Username atau password tidak cocok.' });
    }

    // 4. Periksa status akun (Hanya 'active' yang boleh login)
    if (userRecord.status === 'pending') {
      return res.status(403).json({
        success: false,
        error: 'Akun Anda sedang dalam proses verifikasi dan peninjauan oleh Otoritas Sistem SPECTRA.'
      });
    }

    if (userRecord.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Akses akun ini telah dinonaktifkan oleh Administrator.'
      });
    }

    // 5. Verifikasi Password terhadap Hash Argon2id
    let isPasswordValid = false;
    if (userRecord.password_hash) {
      isPasswordValid = await verifyPassword(userRecord.password_hash, password);
    } else if (userRecord.password) {
      // Migrasi transparan: jika masih ada plaintext legacy di DB, verifikasi lalu auto-upgrade ke hash!
      if (userRecord.password === password) {
        isPasswordValid = true;
        const upgradedHash = await hashPassword(password);
        await supabase
          .from('system_users')
          .update({ password_hash: upgradedHash, password: null })
          .eq('id', userRecord.id);
      }
    }

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Username atau password tidak cocok.' });
    }

    // 6. Terbitkan Session Token HMAC-SHA256
    const sessionToken = createSessionToken({
      sub: userRecord.id,
      username: userRecord.username,
      role: userRecord.role,
      isAuthority: userRecord.is_authority ?? false,
      fullName: userRecord.full_name,
      sessionVersion: userRecord.session_version || 1
    });

    // 7. Terbitkan CSRF Token
    const csrfToken = generateCsrfToken();

    // 8. Set-Cookie HttpOnly, Secure, SameSite
    const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
    const secureFlag = isProd ? '; Secure' : '';
    const cookieHeader = [
      buildSessionCookie(sessionToken, 86400),
      `spectra_csrf=${csrfToken}; SameSite=Lax; Path=/${secureFlag}`
    ];
    res.setHeader('Set-Cookie', cookieHeader);

    // 9. Return Data Pengguna Bersih (DILARANG mengembalikan password atau hash!)
    return res.status(200).json({
      success: true,
      user: {
        id: userRecord.id,
        username: userRecord.username,
        fullName: userRecord.full_name,
        position: userRecord.position,
        role: userRecord.role,
        isAuthority: userRecord.is_authority ?? false,
        status: userRecord.status
      },
      csrfToken
    });

  } catch (err: any) {
    console.error('[API Auth Login Error]:', err);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem internal pada autentikasi server.' });
  }
}

