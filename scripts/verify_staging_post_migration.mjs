/**
 * Verifikasi Pasca-Migrasi Supabase Staging
 */

import fs from 'fs';

const configPath = 'C:\\Users\\Mazmur Gusti Agung L\\.gemini\\config\\mcp_config.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const auth = config.mcpServers?.['supabase-staging']?.headers?.Authorization;
const endpoint = config.mcpServers?.['supabase-staging']?.serverUrl;

async function check() {
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
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
    })
  });

  const sessionId = initRes.headers.get('mcp-session-id');

  const callTool = async (name, args) => {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Mcp-Session-Id': sessionId
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } })
    });
    return (await r.json()).result?.content?.[0]?.text;
  };

  console.log('=== DAFTAR TABEL PADA STAGING ===');
  const tables = await callTool('list_tables', {});
  console.log(tables);

  console.log('\n=== STATUS RLS POLICY PADA SYSTEM_USERS ===');
  const policies = await callTool('execute_sql', {
    query: "SELECT policyname, roles, cmd, qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'system_users';"
  });
  console.log(policies);

  console.log('\n=== DATA SUPERADMIN STAGING (TANPA HASH/PASSWORD) ===');
  const admin = await callTool('execute_sql', {
    query: "SELECT id, username, full_name, position, role, is_authority, status, session_version FROM public.system_users;"
  });
  console.log(admin);

  console.log('\n=== STATUS RLS PADA SELURUH TABEL STAGING ===');
  const rlsStatus = await callTool('execute_sql', {
    query: "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';"
  });
  console.log(rlsStatus);
}

check().catch(console.error);
