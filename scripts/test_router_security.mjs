import assert from 'assert';
import http from 'http';
import authRouter from '../api/auth.ts';
import financialRouter from '../api/financial.ts';
import systemRouter from '../api/system.ts';

console.log('===============================================================');
console.log('   SPECTRA ROUTER SECURITY, CORS & REWRITE VERIFICATION');
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

  // 7. CORS Preflight dari Trusted Origin (localhost)
  const res7 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: { 'Origin': 'http://localhost:5173' }
  });
  assert.strictEqual(res7.status, 200, 'OPTIONS dari trusted origin wajib 200 OK');
  assert.strictEqual(res7.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.strictEqual(res7.headers.get('access-control-allow-credentials'), 'true');
  console.log('[PASS] Test 7: OPTIONS /api/auth/login (Trusted Origin) -> 200 OK & Proper Allow-Origin');

  // 8. CORS Preflight dari Untrusted Origin (harus ditolak 403)
  const res8 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: { 'Origin': 'https://malicious-attacker-site.com' }
  });
  assert.strictEqual(res8.status, 403, 'OPTIONS dari untrusted origin wajib ditolak 403');
  console.log('[PASS] Test 8: OPTIONS /api/auth/login (Untrusted Origin) -> 403 Forbidden');

  // 9. Vercel Rewrite query parameter route resolution (e.g. /api/auth?route=admin/users)
  const res9 = await testReq('/api/auth?route=admin/users', { method: 'GET' });
  // Tanpa sesi auth harus 401 Unauthorized (bukan 404)
  assert.strictEqual(res9.status, 401, '/api/auth?route=admin/users harus mencapai handler admin users dan ditolak 401');
  console.log('[PASS] Test 9: Vercel Rewrite /api/auth?route=admin/users -> 401 Unauthorized (Handler Reached)');

  // 10. Audit Legacy /api/sync — Cegah Fake Success
  const res10 = await testReq('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accounts: [], transactions: [] })
  });
  assert.strictEqual(res10.status, 410, 'POST /api/sync wajib 410 Gone demi mencegah sukses palsu');
  assert.strictEqual(res10.data.success, false);
  console.log('[PASS] Test 10: POST /api/sync -> 410 Gone (Fake Success Prevented)');

  console.log('\n===============================================================');
  console.log('   SEMUA TEST ROUTER SECURITY & CORS: 10/10 PASSED (100%)');
  console.log('===============================================================\n');
} catch (e) {
  console.error('[ROUTER SECURITY TEST FAILED]', e);
  process.exitCode = 1;
} finally {
  server.close();
}
