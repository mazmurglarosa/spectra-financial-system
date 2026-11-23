import crypto from 'crypto';

export interface SessionPayload {
  sub: string;            // User ID
  username: string;       // Username
  role: 'admin' | 'user'; // Server-verified role
  isAuthority: boolean;   // Hak otoritas
  fullName: string;
  sessionVersion: number; // Untuk invalidasi instan saat role/password berubah
  iat: number;            // Epoch ms diterbitkan
  exp: number;            // Epoch ms kedaluwarsa (misal 24 jam)
}

const DEFAULT_SECRET = 'SPECTRA_DEV_INSECURE_FALLBACK_SECRET_CHANGE_IN_VERCEL_ENV_64CHARS_ABCDEF1234567890';

function getSecret(): string {
  const isPublicEnv = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
  const secret = process.env.SERVER_SESSION_SECRET;

  if (isPublicEnv) {
    if (!secret || secret === DEFAULT_SECRET || secret.length < 32) {
      throw new Error('[CRITICAL SECURITY] SERVER_SESSION_SECRET wajib diatur ke nilai acak aman minimal 32 karakter pada environment Vercel/Production.');
    }
    return secret;
  }

  return secret || DEFAULT_SECRET;
}

/**
 * Encode buffer to base64url tanpa padding
 */
function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Decode base64url ke string
 */
function unbase64url(input: string): string {
  let str = input.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Menerbitkan Token Sesi Bertanda Tangan Kriptografis (HMAC-SHA256)
 */
export function createSessionToken(payload: Omit<SessionPayload, 'iat' | 'exp'>, lifespanMs = 24 * 60 * 60 * 1000): string {
  const now = Date.now();
  const fullPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + lifespanMs
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(dataToSign);
  const signature = base64url(hmac.digest());

  return `${dataToSign}.${signature}`;
}

/**
 * Memverifikasi Token Sesi di Server secara Waktu Konstan (Timing-Safe)
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, receivedSig] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(dataToSign);
  const expectedSig = base64url(hmac.digest());

  // Komparasi timing-safe untuk mencegah timing attacks
  const bufReceived = Buffer.from(receivedSig);
  const bufExpected = Buffer.from(expectedSig);
  if (bufReceived.length !== bufExpected.length) return null;
  if (!crypto.timingSafeEqual(bufReceived, bufExpected)) return null;

  try {
    const payload: SessionPayload = JSON.parse(unbase64url(encodedPayload));
    if (Date.now() > payload.exp) {
      return null; // Token kedaluwarsa
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Parsing HTTP Cookie Header
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    if (name) {
      list[name] = decodeURIComponent((parts.slice(1).join('=') || '').trim());
    }
  });

  return list;
}

/**
 * Membuat header Set-Cookie HttpOnly, Secure, SameSite
 */
export function buildSessionCookie(token: string, maxAgeSeconds = 86400): string {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const secureFlag = isProd ? '; Secure' : '';
  return `spectra_session=${encodeURIComponent(token)}; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

/**
 * Membuat header Set-Cookie untuk Logout (Hapus Cookie)
 */
export function buildLogoutCookie(): string {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const secureFlag = isProd ? '; Secure' : '';
  return `spectra_session=; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=0`;
}

/**
 * Perlindungan CSRF: Token acak
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Validasi Double-Submit CSRF Token
 */
export function validateCsrf(req: any): boolean {
  // Hanya metode mutasi yang mewajibkan CSRF
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true;
  }

  const cookies = parseCookies(req.headers?.cookie);
  const cookieCsrf = cookies['spectra_csrf'];
  const headerCsrf = req.headers?.['x-csrf-token'] || req.body?.csrfToken;

  if (!cookieCsrf || !headerCsrf) return false;

  const bufCookie = Buffer.from(String(cookieCsrf));
  const bufHeader = Buffer.from(String(headerCsrf));
  if (bufCookie.length !== bufHeader.length) return false;
  return crypto.timingSafeEqual(bufCookie, bufHeader);
}

