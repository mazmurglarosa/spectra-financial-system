import assert from 'assert';
import http from 'http';
import authRouter from '../api/auth.ts';
import financialRouter from '../api/financial.ts';
import systemRouter from '../api/system.ts';
import scanReceiptRouter from '../api/scan-receipt.ts';
import { isAllowedOrigin, lockCorsHeaders } from '../api/_lib/routerHelper.ts';

console.log('===============================================================');
console.log('   SPECTRA CENTRALIZED CORS & ROUTER SECURITY REGRESSION TEST');
console.log('===============================================================');

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = parsedUrl.pathname;

  let bodyStr = '';
  for await (const chunk of req) {
    bodyStr += chunk;
  }
  let body = {};
  if (bodyStr) {
    try { body = JSON.parse(bodyStr); } catch { body = bodyStr; }
  }

  req.query = Object.fromEntries(parsedUrl.searchParams.entries());
  req.body = body;

  const capturedHeaders = {};
  const origSetHeader = res.setHeader.bind(res);
  res.setHeader = (k, v) => {
    capturedHeaders[k.toLowerCase()] = v;
    return origSetHeader(k, v);
  };

  res.status = function(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return res;
  };

  try {
    if (pathname.startsWith('/api/auth')) {
      await authRouter(req, res);
    } else if (pathname.startsWith('/api/financial')) {
      await financialRouter(req, res);
    } else if (pathname.startsWith('/api/system') || pathname === '/api/status' || pathname === '/api/data' || pathname === '/api/sync') {
      await systemRouter(req, res);
    } else if (pathname === '/api/scan-receipt') {
      await scanReceiptRouter(req, res);
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
    }
  } catch (err) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  }
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const baseUrl = `http://127.0.0.1:${PORT}`;

async function testReq(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

try {
  // 1. GET pada login (harus ditolak 405 Method Not Allowed)
  const res1 = await testReq('/api/auth/login', { method: 'GET' });
  assert.strictEqual(res1.status, 405, 'GET /api/auth/login wajib mengembalikan 405');
  console.log('[PASS] Test 1: GET /api/auth/login -> 405 Method Not Allowed');

  // 2. Unknown subpath pada auth (harus 404)
  const res2 = await testReq('/api/auth/ghost-path', { method: 'POST' });
  assert.strictEqual(res2.status, 404, 'Endpoint auth tak dikenal wajib mengembalikan 404');
  console.log('[PASS] Test 2: POST /api/auth/ghost-path -> 404 Not Found');

  // 3. PUT pada financial accounts (harus 405)
  const res3 = await testReq('/api/financial/accounts', { method: 'PUT' });
  assert.strictEqual(res3.status, 405, 'PUT /api/financial/accounts wajib mengembalikan 405');
  console.log('[PASS] Test 3: PUT /api/financial/accounts -> 405 Method Not Allowed');

  // 4. Unknown subpath pada financial (harus 404)
  const res4 = await testReq('/api/financial/nonexistent-service', { method: 'GET' });
  assert.strictEqual(res4.status, 404, 'Endpoint financial tak dikenal wajib mengembalikan 404');
  console.log('[PASS] Test 4: GET /api/financial/nonexistent-service -> 404 Not Found');

  // 5. POST pada system status (harus 405)
  const res5 = await testReq('/api/system/status', { method: 'POST' });
  assert.strictEqual(res5.status, 405, 'POST /api/system/status wajib mengembalikan 405');
  console.log('[PASS] Test 5: POST /api/system/status -> 405 Method Not Allowed');

  // 6. Unknown subpath pada system (harus 404)
  const res6 = await testReq('/api/system/unknown', { method: 'GET' });
  assert.strictEqual(res6.status, 404, 'Endpoint system tak dikenal wajib mengembalikan 404');
  console.log('[PASS] Test 6: GET /api/system/unknown -> 404 Not Found');

  // 7. CORS Preflight dari Trusted Origin SPECTRA Production
  const res7 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: { 'Origin': 'https://spectra-financial-system.vercel.app' }
  });
  assert.strictEqual(res7.status, 200, 'OPTIONS dari SPECTRA Production wajib 200 OK');
  assert.strictEqual(res7.headers.get('access-control-allow-origin'), 'https://spectra-financial-system.vercel.app');
  assert.strictEqual(res7.headers.get('access-control-allow-credentials'), 'true');
  console.log('[PASS] Test 7: Origin SPECTRA yang sah diizinkan (Production: spectra-financial-system.vercel.app)');

  // 8. CORS Preflight dari Origin SPECTRA Preview Resmi (Dikonfigurasi via VERCEL_URL Server)
  const previewOrigin = 'https://spectra-financial-system-5d2ld0sd6-mazmur.vercel.app';
  process.env.VERCEL_URL = 'spectra-financial-system-5d2ld0sd6-mazmur.vercel.app';
  const res8 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: { 'Origin': previewOrigin }
  });
  assert.strictEqual(res8.status, 200, 'OPTIONS dari SPECTRA Preview resmi wajib 200 OK');
  assert.strictEqual(res8.headers.get('access-control-allow-origin'), previewOrigin);
  assert.strictEqual(res8.headers.get('access-control-allow-credentials'), 'true');
  console.log('[PASS] Test 8: Preview SPECTRA resmi yang dikonfigurasi server (VERCEL_URL) diizinkan');

  // 8B. Anti-Spoofing: Domain yang sengaja meniru prefix SPECTRA (Prefix-Spoofing Attacker)
  const spoofingOrigin = 'https://spectra-financial-system-fake-attacker.vercel.app';
  const resSpoof = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: { 'Origin': spoofingOrigin }
  });
  assert.strictEqual(resSpoof.status, 403, 'OPTIONS dari domain yang meniru prefix SPECTRA wajib ditolak 403 Forbidden');
  assert.strictEqual(resSpoof.headers.get('access-control-allow-origin'), null);
  console.log('[PASS] Test 8B: Domain peniru prefix SPECTRA (spectra-financial-system-fake-attacker.vercel.app) DITOLAK (403)');

  // 8C. Anti-Spoofing Mutation: Request mutasi dari domain peniru prefix SPECTRA
  const resSpoofMutation = await testReq('/api/auth/login', {
    method: 'POST',
    headers: {
      'Origin': spoofingOrigin,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username: 'admin', password: 'password123' })
  });
  assert.strictEqual(resSpoofMutation.status, 403, 'POST mutasi dari domain peniru prefix SPECTRA wajib ditolak 403');
  assert.strictEqual(resSpoofMutation.data.success, false);
  console.log('[PASS] Test 8C: Request mutasi dari domain peniru prefix SPECTRA DITOLAK (403 Forbidden)');

  // 9. CORS Preflight dari Origin Aplikasi Lain di *.vercel.app (Wajib ditolak 403 Forbidden)
  const alienVercelOrigin = 'https://other-user-project.vercel.app';
  const res9 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: { 'Origin': alienVercelOrigin }
  });
  assert.strictEqual(res9.status, 403, 'OPTIONS dari origin *.vercel.app lain wajib ditolak 403 Forbidden');
  assert.strictEqual(res9.headers.get('access-control-allow-origin'), null);
  console.log('[PASS] Test 9: Origin aplikasi lain pada *.vercel.app ditolak (403 Forbidden)');

  // 10. CORS Preflight dari Origin Attacker (attacker.evil wajib ditolak 403)
  const res10 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: { 'Origin': 'https://attacker.evil' }
  });
  assert.strictEqual(res10.status, 403, 'OPTIONS dari attacker.evil wajib ditolak 403 Forbidden');
  assert.strictEqual(res10.headers.get('access-control-allow-origin'), null);
  console.log('[PASS] Test 10: Origin attacker.evil ditolak (403 Forbidden)');

  // 11. Mutation Request (POST) dari Origin Asing pada *.vercel.app (Wajib ditolak 403)
  const res11 = await testReq('/api/auth/login', {
    method: 'POST',
    headers: {
      'Origin': 'https://malicious-app.vercel.app',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username: 'admin', password: 'password123' })
  });
  assert.strictEqual(res11.status, 403, 'POST dari origin asing wajib ditolak 403');
  assert.strictEqual(res11.data.success, false);
  console.log('[PASS] Test 11: Request mutasi dari origin *.vercel.app asing ditolak (403 Forbidden)');

  // 12. Mutation Request (POST) dari Origin attacker.evil (Wajib ditolak 403)
  const res12 = await testReq('/api/financial/transactions', {
    method: 'POST',
    headers: {
      'Origin': 'https://attacker.evil',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ description: 'Transfer Ilegal' })
  });
  assert.strictEqual(res12.status, 403, 'POST transaksi dari attacker.evil wajib ditolak 403');
  console.log('[PASS] Test 12: Request mutasi transaksi dari attacker.evil ditolak (403 Forbidden)');

  // 13. Mutation Request dari Origin SPECTRA yang Sah (Diteruskan ke handler dan diproses sesuai otorisasi)
  const res13 = await testReq('/api/auth/login', {
    method: 'POST',
    headers: {
      'Origin': previewOrigin,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({}) // Body kosong memicu validasi 400 Bad Request di handler login
  });
  assert.strictEqual(res13.status, 400, 'POST dari origin SPECTRA yang sah berhasil mencapai handler (400 Bad Request)');
  assert.strictEqual(res13.headers.get('access-control-allow-origin'), previewOrigin);
  console.log('[PASS] Test 13: Request mutasi dari preview SPECTRA sah mencapai handler (bukan ditolak CORS)');

  // 14. Immutability Test: Handler internal permisif tidak dapat menimpa CORS Router
  const dummyRes = {
    headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
  };
  dummyRes.setHeader('Access-Control-Allow-Origin', 'https://spectra-financial-system.vercel.app');
  lockCorsHeaders(dummyRes);
  // Simulasikan handler nakal mencoba menimpa dengan '*'
  dummyRes.setHeader('Access-Control-Allow-Origin', '*');
  dummyRes.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, TRACE');
  assert.strictEqual(dummyRes.headers['access-control-allow-origin'], 'https://spectra-financial-system.vercel.app');
  console.log('[PASS] Test 14: Header CORS router terkunci (Handler internal tidak dapat menimpa CORS)');

  // 15. Vercel Rewrite query parameter route resolution (e.g. /api/auth?route=admin/users)
  const res15 = await testReq('/api/auth?route=admin/users', { method: 'GET' });
  assert.strictEqual(res15.status, 401, '/api/auth?route=admin/users harus mencapai handler admin users dan ditolak 401');
  console.log('[PASS] Test 15: Vercel Rewrite /api/auth?route=admin/users -> 401 Unauthorized (Handler Reached)');

  // 16. Audit Legacy /api/sync — Cegah Fake Success
  const res16 = await testReq('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accounts: [], transactions: [] })
  });
  assert.strictEqual(res16.status, 410, 'POST /api/sync wajib 410 Gone demi mencegah sukses palsu');
  assert.strictEqual(res16.data.success, false);
  console.log('[PASS] Test 16: POST /api/sync -> 410 Gone (Fake Success Prevented)');

  console.log('\n===============================================================');
  console.log('   SEMUA TEST ROUTER SECURITY & CORS: 18/18 PASSED (100%)');
  console.log('===============================================================\n');
} catch (e) {
  console.error('[ROUTER SECURITY TEST FAILED]', e);
  process.exitCode = 1;
} finally {
  server.close();
}
