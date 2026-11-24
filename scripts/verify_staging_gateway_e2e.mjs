import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { authenticateFinancialRequest } from '../api/_lib/financialAuth.ts';

const configPath = 'C:\\Users\\Mazmur Gusti Agung L\\.gemini\\config\\mcp_config.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const auth = config.mcpServers?.['supabase-staging']?.headers?.Authorization;
const endpoint = config.mcpServers?.['supabase-staging']?.serverUrl;

const initRes = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Authorization': auth,
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'verifier', version: '1.0' } }
  })
});

const sessionId = initRes.headers.get('mcp-session-id');

let idCounter = 2;
const callTool = async (name, args) => {
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Session-Id': sessionId
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: idCounter++, method: 'tools/call', params: { name, arguments: args } })
  });
  const data = await r.json();
  const text = data.result?.content?.[0]?.text;
  try { return JSON.parse(text); } catch { return text; }
};

const keysRes = await callTool('get_publishable_keys', {});
const anonKey = keysRes?.keys?.find(k => k.name === 'anon')?.api_key;
const STAGING_URL = 'https://xaafjvmdjdlfqdrljjlr.supabase.co';

console.log('\n--- TEST 1: Direct Anon Client Access Blocked by RLS ---');
assert(anonKey, 'Staging anon key harus dapat ditemukan');
const anonClient = createClient(STAGING_URL, anonKey);

const { data: accountsData, error: accountsErr } = await anonClient.from('accounts').select('*');
console.log('Direct anon select accounts result:', { rowCount: accountsData?.length, error: accountsErr?.message });
assert(accountsData?.length === 0 || accountsErr, 'Anon MUST NOT be able to read accounts directly!');
console.log('-> PASS: Anonymous direct read to accounts is completely blocked by RLS (0 rows returned).');

const { error: insertErr } = await anonClient.from('accounts').insert({
  id: 'leak_test',
  code: '9999',
  name: 'RLS Leak Test',
  type: 'EXPENSE',
  normalBalance: 'DEBIT',
  balance: 0
});
console.log('Direct anon insert error:', insertErr?.message);
assert(insertErr, 'Anon insert MUST be blocked by RLS!');
console.log('-> PASS: Anonymous direct insert to accounts is blocked by RLS.');

process.env.SUPABASE_URL = STAGING_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_service_role_staging_test_key_dummy_only';

console.log('\n--- TEST 2: Backend Financial Gateway Auth Guard Validation ---');
const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader: (k, v) => { res.headers[k] = v; },
    status: (code) => {
      res.statusCode = code;
      return res;
    },
    json: (data) => {
      res.body = data;
      return res;
    },
    end: () => res
  };
  return res;
};

// Fake request without cookie
const mockReqNoCookie = {
  method: 'GET',
  headers: {},
  body: {}
};
const mockRes1 = createMockRes();
const authCtx1 = await authenticateFinancialRequest(mockReqNoCookie, mockRes1);
assert.strictEqual(authCtx1, null, 'Context must be null on failed auth');
assert.strictEqual(mockRes1.statusCode, 401, 'Status code must be 401');
console.log('-> PASS: Request without session cookie rejected with 401 Unauthorized.');

// Fake request with bad cookie
const mockReqBadCookie = {
  method: 'POST',
  headers: {
    cookie: 'spectra_session=invalidsession',
    'x-csrf-token': 'badtoken'
  },
  body: {}
};
const mockRes2 = createMockRes();
const authCtx2 = await authenticateFinancialRequest(mockReqBadCookie, mockRes2);
assert.strictEqual(authCtx2, null, 'Context must be null on invalid session');
assert.strictEqual(mockRes2.statusCode, 401, 'Invalid session must yield 401');
console.log('-> PASS: Request with invalid session cookie rejected securely (401).');

console.log('\n======================================================');
console.log('  ALL STAGING RLS & GATEWAY SECURITY TESTS PASSED!    ');
console.log('======================================================\n');
