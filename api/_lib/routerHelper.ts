/**
 * Helper terpusat untuk resolusi subpath router dan keamanan CORS Vercel Serverless
 * Menegakkan allowlist origin SPECTRA eksplisit, proteksi anti-tamper immutability,
 * dan pencegahan CSRF/mutation cross-origin.
 */

const ALLOWED_STATIC_ORIGINS = [
  'https://spectra-financial-system.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:8080',
  'http://[::1]:5173',
  'http://[::1]:3000'
];

/**
 * Daftar domain tepercaya untuk CORS terpusat SPECTRA.
 * HANYA mengizinkan localhost dan subdomain project SPECTRA resmi.
 * Menolak seluruh *.vercel.app milik project lain dan origin asing.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const clean = origin.trim().toLowerCase();
    const url = new URL(clean);
    const host = url.hostname;

    // 1. Static allowlist (Localhost & SPECTRA Production domain)
    if (ALLOWED_STATIC_ORIGINS.includes(clean)) {
      return true;
    }

    // 2. Localhost fallback hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
      return true;
    }

    // 3. Vercel Preview domain regex KHUSUS project SPECTRA
    // Pola: spectra-financial-system.vercel.app ATAU spectra-financial-system-*.vercel.app
    // MENOLAK seluruh *.vercel.app lainnya!
    if (/^https:\/\/spectra-financial-system(?:-[a-z0-9\-]+)*\.vercel\.app$/.test(clean)) {
      return true;
    }

    // 4. Custom domain dari environment server
    const envOrigins = [
      process.env.ALLOWED_ORIGINS,
      process.env.SPECTRA_ALLOWED_ORIGINS,
      process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
    ].filter(Boolean);

    for (const envVal of envOrigins) {
      if (!envVal) continue;
      const parts = envVal.split(',').map(s => s.trim().toLowerCase());
      for (const p of parts) {
        if (!p) continue;
        if (p === clean || p === host) return true;
        if (p.startsWith('http://') || p.startsWith('https://')) {
          try {
            if (new URL(p).hostname === host) return true;
          } catch {}
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Mengunci objek res.setHeader agar handler internal permisif
 * tidak dapat menimpa header Access-Control-* yang telah diatur terpusat oleh router.
 */
export function lockCorsHeaders(res: any) {
  if (!res || res.__corsLocked) return;
  res.__corsLocked = true;

  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = function(name: string, value: any) {
    const lowerName = String(name || '').toLowerCase();
    if (
      lowerName === 'access-control-allow-origin' ||
      lowerName === 'access-control-allow-credentials' ||
      lowerName === 'access-control-allow-methods' ||
      lowerName === 'access-control-allow-headers'
    ) {
      // Abaikan upaya penimpaan header CORS oleh internal handler
      return res;
    }
    return originalSetHeader(name, value);
  };
}

/**
 * Menerapkan header CORS aman berbasis allowlist ketat (Anti-Wildcard with Credentials)
 */
export function applyCorsHeaders(req: any, res: any, allowedMethods: string[] = ['GET', 'POST', 'OPTIONS']) {
  const origin = req.headers?.origin;

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-csrf-token, Cookie');

  // Proteksi Immutability: Cegah internal handler menimpa header CORS
  lockCorsHeaders(res);
}

/**
 * Memeriksa CORS, menangani OPTIONS preflight, dan menolak Origin mutasi yang tidak sah.
 * Mengembalikan `false` jika request sudah ditangani / ditolak (short-circuit).
 * Mengembalikan `true` jika request aman untuk dilanjutkan ke handler.
 */
export function handleCorsAndSecurity(req: any, res: any, allowedMethods: string[]): boolean {
  const method = req.method?.toUpperCase();
  const origin = req.headers?.origin;

  // 1. Tangani Preflight OPTIONS
  if (method === 'OPTIONS') {
    if (origin && !isAllowedOrigin(origin)) {
      res.status(403).json({
        success: false,
        error: 'Origin tidak diizinkan oleh kebijakan CORS SPECTRA.'
      });
      return false;
    }
    applyCorsHeaders(req, res, allowedMethods);
    res.status(200).end();
    return false;
  }

  // 2. Tolak request mutasi jika Origin asing terdeteksi
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  if (isMutation && origin && !isAllowedOrigin(origin)) {
    res.status(403).json({
      success: false,
      error: 'Akses mutasi ditolak: Origin tidak diizinkan oleh kebijakan keamanan SPECTRA.'
    });
    return false;
  }

  // 3. Terapkan header CORS terpusat untuk request yang valid
  applyCorsHeaders(req, res, allowedMethods);
  return true;
}

/**
 * Normalisasi dan resolusi subpath router
 * Mendukung Vercel rewrites: /api/auth/:path* -> /api/auth?route=:path*
 * Serta fallback universal dari req.url
 */
export function resolveSubpath(req: any, basePrefix: string): string {
  // 1. Resolusi dari req.query.route (diteruskan oleh Vercel rewrite)
  if (req.query?.route) {
    if (Array.isArray(req.query.route)) {
      return req.query.route.map((p: any) => String(p).trim()).filter(Boolean).join('/').toLowerCase();
    }
    if (typeof req.query.route === 'string') {
      return req.query.route.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
    }
  }

  // 2. Fallback universal dari req.url
  const rawUrl = req.url || '';
  const pathname = rawUrl.split('?')[0];
  const lowerPath = pathname.toLowerCase();

  // Pemetaan langsung legacy system aliases
  if (lowerPath === '/api/status') return 'status';
  if (lowerPath === '/api/data') return 'data';
  if (lowerPath === '/api/sync') return 'sync';

  const normalizedBase = basePrefix.toLowerCase().replace(/\/+$/, '');
  if (lowerPath.startsWith(normalizedBase)) {
    return lowerPath.slice(normalizedBase.length).replace(/^\/+|\/+$/g, '');
  }

  return lowerPath.replace(/^\/+|\/+$/g, '');
}
