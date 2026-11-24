/**
 * Helper untuk normalisasi dan resolusi subpath router Vercel Serverless
 */
export function resolveSubpath(req: any, basePrefix: string): string {
  // 1. Cek req.query.route (diteruskan Vercel dynamic catch-all [...route])
  if (req.query?.route) {
    if (Array.isArray(req.query.route)) {
      return req.query.route.map((p: any) => String(p).trim()).filter(Boolean).join('/').toLowerCase();
    }
    if (typeof req.query.route === 'string') {
      return req.query.route.trim().toLowerCase();
    }
  }

  // 2. Cek req.url (Universal fallback untuk request HTTP langsung atau local test harness)
  const rawUrl = req.url || '';
  const pathname = rawUrl.split('?')[0];
  const normalizedBase = basePrefix.toLowerCase().replace(/\/+$/, '');
  const lowerPath = pathname.toLowerCase();

  if (lowerPath.startsWith(normalizedBase)) {
    return lowerPath.slice(normalizedBase.length).replace(/^\/+|\/+$/g, '');
  }

  return lowerPath.replace(/^\/+|\/+$/g, '');
}
