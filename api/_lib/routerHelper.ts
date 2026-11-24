/**
 * Helper terpusat untuk resolusi subpath router dan keamanan CORS Vercel Serverless
 */

/**
 * Daftar domain tepercaya untuk CORS
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();

    // 1. Localhost development
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return true;
    }

    // 2. Vercel deployment domains (Preview & Production)
    if (host.endsWith('.vercel.app')) {
      if (host.includes('spectra') || host.startsWith('spectra-financial-system')) {
        return true;
      }
      // Izinkan domain vercel preview internal
      return true;
    }

    // 3. Custom domain produksi dari environment
    if (process.env.ALLOWED_ORIGINS) {
      const allowedList = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim().toLowerCase());
      if (allowedList.includes(origin.toLowerCase()) || allowedList.includes(host)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
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
