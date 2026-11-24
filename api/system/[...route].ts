import systemStatusHandler from '../_handlers/system/status.js';
import systemDataHandler from '../_handlers/system/data.js';
import systemSyncHandler from '../_handlers/system/sync.js';
import { resolveSubpath } from '../_lib/routerHelper.js';

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

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  const subpath = resolveSubpath(req, '/api/system');
  const routeDef = SYSTEM_ROUTES[subpath];

  // 1. Path Allowlist Check
  if (!routeDef) {
    return res.status(404).json({
      success: false,
      error: `Endpoint system "${subpath}" tidak ditemukan.`
    });
  }

  // 2. HTTP Method Allowlist Check
  if (!routeDef.methods.includes(method)) {
    res.setHeader('Allow', routeDef.methods.join(', '));
    return res.status(405).json({
      success: false,
      error: `Metode ${method} tidak diizinkan untuk endpoint system "${subpath}".`
    });
  }

  // 3. Dispatch ke Modular Handler
  return routeDef.handler(req, res);
}
