import assert from 'assert';
import http from 'http';
import authRouter from '../api/auth/[...route].ts';
import financialRouter from '../api/financial/[...route].ts';
import systemRouter from '../api/system/[...route].ts';

console.log('===============================================================');
console.log('   SPECTRA ROUTER SECURITY & ALLOWLIST VERIFICATION');
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
    if (pathname.startsWith('/api/auth/')) {
      await authRouter(req, res);
    } else if (pathname.startsWith('/api/financial/')) {
      await financialRouter(req, res);
    } else if (pathname.startsWith('/api/system/') || pathname === '/api/status' || pathname === '/api/data' || pathname === '/api/sync') {
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

  // 7. OPTIONS Preflight pada auth
  const res7 = await fetch(`${baseUrl}/api/auth/login`, { method: 'OPTIONS' });
  assert.strictEqual(res7.status, 200, 'OPTIONS preflight wajib 200 OK');
  console.log('[PASS] Test 7: OPTIONS /api/auth/login -> 200 OK (CORS Preflight)');

  // 8. OPTIONS Preflight pada financial
  const res8 = await fetch(`${baseUrl}/api/financial/transactions`, { method: 'OPTIONS' });
  assert.strictEqual(res8.status, 200, 'OPTIONS preflight wajib 200 OK');
  console.log('[PASS] Test 8: OPTIONS /api/financial/transactions -> 200 OK (CORS Preflight)');

  console.log('\n===============================================================');
  console.log('   SEMUA TEST ROUTER SECURITY & ALLOWLIST: 8/8 PASSED (100%)');
  console.log('===============================================================\n');
} catch (e) {
  console.error('[ROUTER SECURITY TEST FAILED]', e);
  process.exitCode = 1;
} finally {
  server.close();
}
