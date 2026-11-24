import loginHandler from '../_handlers/auth/login.js';
import logoutHandler from '../_handlers/auth/logout.js';
import meHandler from '../_handlers/auth/me.js';
import registerHandler from '../_handlers/auth/register.js';
import adminUsersHandler from '../_handlers/auth/admin/users.js';
import adminApproveHandler from '../_handlers/auth/admin/approve.js';
import adminResetPasswordHandler from '../_handlers/auth/admin/reset-password.js';
import { resolveSubpath } from '../_lib/routerHelper.js';

interface RouteDefinition {
  methods: string[];
  handler: (req: any, res: any) => Promise<any> | any;
}

const AUTH_ROUTES: Record<string, RouteDefinition> = {
  'login': { methods: ['POST', 'OPTIONS'], handler: loginHandler },
  'logout': { methods: ['POST', 'OPTIONS'], handler: logoutHandler },
  'me': { methods: ['GET', 'OPTIONS'], handler: meHandler },
  'register': { methods: ['POST', 'OPTIONS'], handler: registerHandler },
  'admin/users': { methods: ['GET', 'OPTIONS'], handler: adminUsersHandler },
  'admin/approve': { methods: ['POST', 'OPTIONS'], handler: adminApproveHandler },
  'admin/reset-password': { methods: ['POST', 'OPTIONS'], handler: adminResetPasswordHandler }
};

export default async function handler(req: any, res: any) {
  const method = req.method?.toUpperCase();

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-csrf-token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }

  const subpath = resolveSubpath(req, '/api/auth');
  const routeDef = AUTH_ROUTES[subpath];

  // 1. Path Allowlist Check
  if (!routeDef) {
    return res.status(404).json({
      success: false,
      error: `Endpoint auth "${subpath}" tidak ditemukan.`
    });
  }

  // 2. HTTP Method Allowlist Check
  if (!routeDef.methods.includes(method)) {
    res.setHeader('Allow', routeDef.methods.join(', '));
    return res.status(405).json({
      success: false,
      error: `Metode ${method} tidak diizinkan untuk endpoint auth "${subpath}".`
    });
  }

  // 3. Dispatch ke Modular Handler
  return routeDef.handler(req, res);
}
