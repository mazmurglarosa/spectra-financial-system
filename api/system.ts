import systemStatusHandler from './_handlers/system/status.js';
import systemDataHandler from './_handlers/system/data.js';
import systemSyncHandler from './_handlers/system/sync.js';
import { resolveSubpath, applyCorsHeaders, isAllowedOrigin } from './_lib/routerHelper.js';

interface RouteDefinition {
  methods: string[];
  handler: (req: any, res: any) => Promise<any> | any;
}

const SYSTEM_ROUTES: Record<string, RouteDefinition> = {
  'status': { methods: ['GET', 'OPTIONS'], handler: systemStatusHandler },
  'data': { methods: ['GET', 'OPTIONS'], handler: systemDataHandler },
  'sync': { methods: ['GET', 'POST', 'OPTIONS'], handler: systemSyncHandler }
};

export default async function handler(req: any, res: any) {
  const method = req.method?.toUpperCase();
  const subpath = resolveSubpath(req, '/api/system');
  const routeDef = SYSTEM_ROUTES[subpath];

  // 1. Path Allowlist Check — Unknown Path wajib 404
  if (!routeDef) {
    return res.status(404).json({
      success: false,
      error: `Endpoint system "${subpath}" tidak ditemukan.`
    });
  }

  // 2. CORS Preflight & Headers berbasis Trusted Origin
  const origin = req.headers?.origin;
  if (method === 'OPTIONS') {
    if (origin && !isAllowedOrigin(origin)) {
      return res.status(403).json({
        success: false,
        error: 'Origin tidak diizinkan oleh kebijakan CORS.'
      });
    }
    applyCorsHeaders(req, res, routeDef.methods);
    return res.status(200).end();
  }

  applyCorsHeaders(req, res, routeDef.methods);

  // 3. HTTP Method Allowlist Check — Method tidak diizinkan wajib 405
  if (!routeDef.methods.includes(method)) {
    res.setHeader('Allow', routeDef.methods.join(', '));
    return res.status(405).json({
      success: false,
      error: `Metode ${method} tidak diizinkan untuk endpoint system "${subpath}".`
    });
  }

  // 4. Dispatch ke Modular Handler
  return routeDef.handler(req, res);
}
