import statusHandler from '../_handlers/financial/status.js';
import accountsHandler from '../_handlers/financial/accounts.js';
import transactionsHandler from '../_handlers/financial/transactions.js';
import settingsHandler from '../_handlers/financial/settings.js';
import logsHandler from '../_handlers/financial/logs.js';
import syncPullHandler from '../_handlers/financial/sync-pull.js';
import syncPushHandler from '../_handlers/financial/sync-push.js';
import spreadsheetSyncHandler from '../_handlers/financial/spreadsheet-sync.js';
import driveUploadHandler from '../_handlers/financial/drive-upload.js';
import { resolveSubpath } from '../_lib/routerHelper.js';

interface RouteDefinition {
  methods: string[];
  handler: (req: any, res: any) => Promise<any> | any;
}

const FINANCIAL_ROUTES: Record<string, RouteDefinition> = {
  'status': { methods: ['GET', 'OPTIONS'], handler: statusHandler },
  'accounts': { methods: ['GET', 'POST', 'DELETE', 'OPTIONS'], handler: accountsHandler },
  'transactions': { methods: ['GET', 'POST', 'DELETE', 'OPTIONS'], handler: transactionsHandler },
  'settings': { methods: ['GET', 'POST', 'OPTIONS'], handler: settingsHandler },
  'logs': { methods: ['GET', 'POST', 'OPTIONS'], handler: logsHandler },
  'sync-pull': { methods: ['GET', 'POST', 'OPTIONS'], handler: syncPullHandler },
  'sync-push': { methods: ['POST', 'OPTIONS'], handler: syncPushHandler },
  'spreadsheet-sync': { methods: ['POST', 'OPTIONS'], handler: spreadsheetSyncHandler },
  'drive-upload': { methods: ['POST', 'OPTIONS'], handler: driveUploadHandler }
};

export default async function handler(req: any, res: any) {
  const method = req.method?.toUpperCase();

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-csrf-token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }

  const subpath = resolveSubpath(req, '/api/financial');
  const routeDef = FINANCIAL_ROUTES[subpath];

  // 1. Path Allowlist Check
  if (!routeDef) {
    return res.status(404).json({
      success: false,
      error: `Endpoint financial "${subpath}" tidak ditemukan.`
    });
  }

  // 2. HTTP Method Allowlist Check
  if (!routeDef.methods.includes(method)) {
    res.setHeader('Allow', routeDef.methods.join(', '));
    return res.status(405).json({
      success: false,
      error: `Metode ${method} tidak diizinkan untuk endpoint financial "${subpath}".`
    });
  }

  // 3. Dispatch ke Modular Handler
  return routeDef.handler(req, res);
}
