import { SupabaseClient } from '@supabase/supabase-js';
import { verifySessionToken, parseCookies, validateCsrf, SessionPayload } from './auth.js';
import { getSupabaseServerClient } from './supabaseServer.js';
import { checkRateLimitCentralized, getClientIp } from './rateLimit.js';

export interface AuthenticatedRequestContext {
  session: SessionPayload;
  supabase: SupabaseClient;
  dbUser: {
    id: string;
    username: string;
    fullName: string;
    position: string;
    role: 'admin' | 'user';
    isAuthority: boolean;
  };
}

export interface AuthOptions {
  requireAuthority?: boolean;
  requireAdmin?: boolean;
  rateLimitLimit?: number;
  rateLimitWindowMs?: number;
  skipCsrf?: boolean;
}

/**
 * Middleware Autentikasi & Otorisasi Terpusat untuk Endpoint Keuangan SPECTRA
 * Menjamin:
 * 1. Preflight CORS aman.
 * 2. Rate limiting terpusat berbasis IP.
 * 3. Verifikasi signature & exp token sesi HttpOnly (HMAC-SHA256).
 * 4. Pengecekan status akun aktif & session_version di database secara real-time.
 * 5. Pengecekan otorisasi role & hak otoritas keuangan di server (mengabaikan input client).
 * 6. Validasi CSRF double-submit token pada metode mutasi (POST, PUT, DELETE).
 */
import { isAllowedOrigin, applyCorsHeaders } from './routerHelper.js';
export { isAllowedOrigin };

export async function authenticateFinancialRequest(
  req: any,
  res: any,
  options: AuthOptions = {}
): Promise<AuthenticatedRequestContext | null> {
  const origin = req.headers?.origin;
  const method = req.method?.toUpperCase();
  const isAllowed = isAllowedOrigin(origin);

  // 1. CORS Preflight & Header Security terpusat
  applyCorsHeaders(req, res, ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);

  if (method === 'OPTIONS') {
    if (origin && !isAllowed) {
      res.status(403).json({ success: false, error: 'Origin tidak diizinkan oleh kebijakan CORS SPECTRA.' });
      return null;
    }
    res.status(200).end();
    return null;
  }

  // Larang request mutasi dari Origin asing yang tidak terdaftar
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  if (isMutation && origin && !isAllowed) {
    res.status(403).json({
      success: false,
      error: 'Akses mutasi ditolak: Origin tidak diizinkan oleh kebijakan keamanan SPECTRA.'
    });
    return null;
  }

  const clientIp = getClientIp(req);
  let supabase: SupabaseClient;

  try {
    supabase = getSupabaseServerClient();
  } catch (err: any) {
    console.error('[FinancialAuth] Gagal inisialisasi Supabase Server Client:', err?.message);
    res.status(500).json({
      success: false,
      error: 'Konfigurasi database server tidak valid atau belum diatur.'
    });
    return null;
  }

  // 2. Ekstraksi Token Sesi dari Cookie atau Header Authorization
  const cookies = parseCookies(req.headers?.cookie);
  let token = cookies['spectra_session'];

  if (!token && req.headers?.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  const candidateSession = token ? verifySessionToken(token) : null;

  // 3. Centralized Rate Limiting (Dual-Tier Fair Share Partitioning)
  // Pengguna terautentikasi dipartisi per User ID: rate:fin:usr:<userId>
  // Request belum terautentikasi dipartisi per IP: rate:fin:ip:<clientIp>
  // Mencegah kolisi satu kantor/NAT memblokir seluruh staf akuntansi.
  const limit = options.rateLimitLimit || 120; // default 120 req / menit
  const windowMs = options.rateLimitWindowMs || 60 * 1000;
  const rateLimitKey = candidateSession
    ? `rate:fin:usr:${candidateSession.sub}`
    : `rate:fin:ip:${clientIp}`;

  const rateCheck = await checkRateLimitCentralized(rateLimitKey, limit, windowMs, supabase);
  if (!rateCheck.allowed) {
    const now = Date.now();
    const retryAfterSec = Math.max(1, Math.min(300, Math.ceil((rateCheck.resetAt - now) / 1000)));

    // Jika terjadi kegagalan infrastruktur / RPC rate limiter (Bukan kuota limit habis)
    if (rateCheck.isRpcFailure) {
      res.setHeader('Retry-After', '5');
      res.status(503).json({
        success: false,
        errorCode: 'RATE_LIMITER_UNAVAILABLE',
        error: 'Layanan verifikasi backend sedang mengalami gangguan sementara. Silakan coba sesaat lagi.'
      });
      return null;
    }

    // Kuota habis murni (Rate Limited)
    res.setHeader('Retry-After', String(retryAfterSec));
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateCheck.resetAt / 1000)));
    res.status(429).json({
      success: false,
      errorCode: 'RATE_LIMITED',
      retryAfter: retryAfterSec,
      error: 'Terlalu banyak permintaan akses keuangan. Silakan tunggu sesaat.'
    });
    return null;
  }

  // 4. Verifikasi Autentikasi
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Autentikasi ditolak: Sesi tidak ditemukan. Silakan login terlebih dahulu.'
    });
    return null;
  }

  const session = candidateSession;
  if (!session) {
    res.status(401).json({
      success: false,
      error: 'Autentikasi ditolak: Sesi kedaluwarsa atau token tidak valid.'
    });
    return null;
  }

  // 5. Validasi Status Akun & Session Version di Database
  const { data: dbUser, error: userErr } = await supabase
    .from('system_users')
    .select('id, username, full_name, position, role, is_authority, status, session_version')
    .eq('id', session.sub)
    .limit(1)
    .maybeSingle();

  if (userErr || !dbUser) {
    res.status(401).json({
      success: false,
      error: 'Autentikasi ditolak: Akun pengguna tidak ditemukan di database.'
    });
    return null;
  }

  if (dbUser.status !== 'active') {
    res.status(403).json({
      success: false,
      error: `Akses ditolak: Akun Anda sedang berstatus "${dbUser.status}". Hubungi administrator.`
    });
    return null;
  }

  if (typeof dbUser.session_version === 'number' && dbUser.session_version !== session.sessionVersion) {
    res.status(401).json({
      success: false,
      error: 'Autentikasi ditolak: Sesi telah dibatalkan karena perubahan kredensial atau peran. Silakan login kembali.'
    });
    return null;
  }

  // 6. Validasi Otorisasi Role & Permission Server-Side
  if (options.requireAdmin && dbUser.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Otorisasi ditolak: Tindakan ini memerlukan hak akses Administrator.'
    });
    return null;
  }

  if (options.requireAuthority && dbUser.role !== 'admin' && !dbUser.is_authority) {
    res.status(403).json({
      success: false,
      error: 'Otorisasi ditolak: Tindakan ini memerlukan hak Otoritas Keuangan.'
    });
    return null;
  }

  // 7. Validasi CSRF Token untuk Metode Mutasi (POST, PUT, DELETE)
  if (isMutation && !options.skipCsrf) {
    if (!validateCsrf(req)) {
      res.status(403).json({
        success: false,
        error: 'Validasi keamanan CSRF gagal. Permintaan mutasi ditolak demi perlindungan data.'
      });
      return null;
    }
  }

  return {
    session,
    supabase,
    dbUser: {
      id: dbUser.id,
      username: dbUser.username,
      fullName: dbUser.full_name,
      position: dbUser.position,
      role: dbUser.role,
      isAuthority: Boolean(dbUser.is_authority)
    }
  };
}
