import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = 'C:\\Users\\Mazmur Gusti Agung L\\.gemini\\config\\mcp_config.json';
const EXPECTED_STAGING_REF = 'xaafjvmdjdlfqdrljjlr';
const FORBIDDEN_PROD_REF = 'drsqwxkkcfqvooqzoyvm';

if (!fs.existsSync(configPath)) {
  console.error('[FATAL] mcp_config.json tidak ditemukan.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const stgConfig = config.mcpServers?.['supabase-staging'];

if (!stgConfig) {
  console.error('[FATAL] Konfigurasi "supabase-staging" tidak ditemukan di mcp_config.json.');
  process.exit(1);
}

const authHeader = stgConfig.headers?.Authorization;
const endpoint = stgConfig.serverUrl;

if (!endpoint || !endpoint.includes(EXPECTED_STAGING_REF)) {
  console.error(`[FATAL] Endpoint staging tidak cocok dengan project ref target: ${EXPECTED_STAGING_REF}`);
  process.exit(1);
}

if (endpoint.includes(FORBIDDEN_PROD_REF)) {
  console.error('[FATAL] BAHAYA: Endpoint mengarah ke Production! Eksekusi dibatalkan.');
  process.exit(1);
}

let mcpSessionId = null;

async function initMcpSession() {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'spectra-rls-locker', version: '1.0' }
      }
    })
  });

  mcpSessionId = res.headers.get('mcp-session-id');
  if (!mcpSessionId) {
    throw new Error('Gagal mendapatkan Mcp-Session-Id dari endpoint Supabase MCP.');
  }
}

let rpcCounter = 2;

async function callMcpTool(name, args = {}) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Session-Id': mcpSessionId
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: rpcCounter++,
      method: 'tools/call',
      params: { name, arguments: args }
    })
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`MCP Error [${data.error.code}]: ${data.error.message}`);
  }

  const textContent = data.result?.content?.[0]?.text;
  if (!textContent) return null;

  try {
    return JSON.parse(textContent);
  } catch {
    return textContent;
  }
}

async function executeSql(query) {
  const result = await callMcpTool('execute_sql', { query });
  if (typeof result === 'string' && result.includes('error')) {
    throw new Error(result);
  }
  return result;
}

async function run() {
  console.log('[STEP 0] Inisialisasi koneksi MCP Staging...');
  await initMcpSession();

  const urlRes = await callMcpTool('get_project_url', {});
  const stagingUrl = urlRes?.url;
  console.log(`[VERIFY] URL Staging: ${stagingUrl}`);

  if (!stagingUrl || !stagingUrl.includes(EXPECTED_STAGING_REF)) {
    throw new Error(`Project ref tidak cocok dengan ${EXPECTED_STAGING_REF}`);
  }
  if (stagingUrl.includes(FORBIDDEN_PROD_REF)) {
    throw new Error('BAHAYA: Mengarah ke Production!');
  }

  console.log('[STEP 1] Menjalankan 007_lock_financial_rls_staging.sql...');
  const sql007 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/007_lock_financial_rls_staging.sql'), 'utf8');
  await executeSql(sql007);
  console.log('[SUCCESS] Migration 007 berhasil dieksekusi di Staging.');

  console.log('[STEP 2] Memverifikasi kebijakan RLS aktif di Staging...');
  const policies = await executeSql(`
    SELECT schemaname, tablename, policyname, roles, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);

  console.log('[POLICIES]:', JSON.stringify(policies, null, 2));
}

run().catch(err => {
  console.error('[ERROR]:', err.message);
  process.exit(1);
});
