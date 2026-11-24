import loginHandler from './_handlers/auth/login.js';
import logoutHandler from './_handlers/auth/logout.js';
import meHandler from './_handlers/auth/me.js';
import registerHandler from './_handlers/auth/register.js';
import adminUsersHandler from './_handlers/auth/admin/users.js';
import adminApproveHandler from './_handlers/auth/admin/approve.js';
import adminResetPasswordHandler from './_handlers/auth/admin/reset-password.js';
import { resolveSubpath, applyCorsHeaders, isAllowedOrigin } from './_lib/routerHelper.js';

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
  const subpath = resolveSubpath(req, '/api/auth');
  const routeDef = AUTH_ROUTES[subpath];

  // 1. Path Allowlist Check — Unknown Path wajib 404
  if (!routeDef) {
    return res.status(404).json({
      success: false,
      error: `Endpoint auth "${subpath}" tidak ditemukan.`
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
      error: `Metode ${method} tidak diizinkan untuk endpoint auth "${subpath}".`
    });
  }

  // 4. Dispatch ke Modular Handler
  return routeDef.handler(req, res);
}
