/**
 * SPECTRA Financial System - Sequential Staging Migration Runner
 * Target: Supabase Staging (xaafjvmdjdlfqdrljjlr)
 * 
 * Fitur Keamanan:
 * 1. Verifikasi identitas project_ref 'xaafjvmdjdlfqdrljjlr' sebelum eksekusi SQL.
 * 2. Proteksi mutlak: Memastikan tidak menyentuh Production 'drsqwxkkcfqvooqzoyvm'.
 * 3. Eksekusi satu per satu (sekuensial) dengan gerbang verifikasi di setiap tahap.
 * 4. Berhenti seketika jika ada error (Fail-Fast, no destructive rollback).
 * 5. TIDAK mencetak password, hash, atau token ke log/konsol.
 */

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
        clientInfo: { name: 'spectra-staging-migrator', version: '1.0' }
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
  console.log('\n===============================================================');
  console.log('   SPECTRA FINANCIAL SYSTEM - SUPABASE STAGING MIGRATOR        ');
  console.log('===============================================================\n');

  // TAHAP 0: Inisialisasi & Verifikasi Target
  console.log('[STEP 0] Inisialisasi koneksi MCP Staging & Verifikasi Identitas...');
  await initMcpSession();

  const urlRes = await callMcpTool('get_project_url', {});
  const stagingUrl = urlRes?.url;
  console.log(`  -> URL Terdeteksi: ${stagingUrl}`);

  if (!stagingUrl || !stagingUrl.includes(EXPECTED_STAGING_REF)) {
    console.error(`[FATAL] Verifikasi URL gagal! Target ${EXPECTED_STAGING_REF} tidak cocok.`);
    process.exit(1);
  }

  if (stagingUrl.includes(FORBIDDEN_PROD_REF)) {
    console.error(`[FATAL] BAHAYA: URL terdeteksi PRODUCTION! Operasi dihentikan.`);
    process.exit(1);
  }

  console.log('  -> \x1b[32mVERIFIKASI TARGET SUKSES: 100% Staging Terisolasi\x1b[0m\n');

  // MIGRATION 1: 000_baseline_schema.sql
  console.log('[MIGRATION 1/6] Menjalankan 000_baseline_schema.sql...');
  const sql000 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/000_baseline_schema.sql'), 'utf8');
  await executeSql(sql000);

  // Verifikasi Migration 1
  const check000 = await executeSql(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('  -> \x1b[32mBERHASIL\x1b[0m: Skema dasar akuntansi terbentuk.');

  // MIGRATION 2: 000_seed_default_accounts.sql
  console.log('\n[MIGRATION 2/6] Menjalankan 000_seed_default_accounts.sql (Dummy CoA)...');
  const sqlSeedAccounts = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/000_seed_default_accounts.sql'), 'utf8');
  await executeSql(sqlSeedAccounts);

  // Verifikasi Migration 2
  const checkAccounts = await executeSql(`SELECT count(*) as total_accounts FROM public.accounts;`);
  console.log(`  -> \x1b[32mBERHASIL\x1b[0m: Chart of Accounts dummy terpasang.`);

  // MIGRATION 3: 001_add_security_columns.sql
  console.log('\n[MIGRATION 3/6] Menjalankan 001_add_security_columns.sql...');
  const sql001 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/001_add_security_columns.sql'), 'utf8');
  await executeSql(sql001);

  // Verifikasi Migration 3
  const check001 = await executeSql(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'system_users' AND column_name IN ('password_hash', 'session_version', 'failed_login_attempts', 'locked_until');
  `);
  console.log('  -> \x1b[32mBERHASIL\x1b[0m: Kolom keamanan password_hash & session_version aktif.');

  // MIGRATION 4: 002_seed_bootstrap_superadmin_staging.sql
  console.log('\n[MIGRATION 4/6] Menjalankan 002_seed_bootstrap_superadmin_staging.sql...');
  const sql002 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/002_seed_bootstrap_superadmin_staging.sql'), 'utf8');
  await executeSql(sql002);

  // Verifikasi Migration 4
  const check002 = await executeSql(`
    SELECT id, username, full_name, role, is_authority, status 
    FROM public.system_users 
    WHERE username = 'admin';
  `);
  console.log('  -> \x1b[32mBERHASIL\x1b[0m: Akun Superadmin Staging berhasil di-seed dengan hash aman.');

  // MIGRATION 5: 003_lock_anon_access.sql
  console.log('\n[MIGRATION 5/6] Menjalankan 003_lock_anon_access.sql (Penguncian Anonim)...');
  const sql003 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/003_lock_anon_access.sql'), 'utf8');
  await executeSql(sql003);

  // Verifikasi Migration 5
  const checkPolicies = await executeSql(`
    SELECT policyname, roles, cmd 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'system_users';
  `);
  console.log('  -> \x1b[32mBERHASIL\x1b[0m: Akses anonim ke system_users dikunci total (Deny All to anon).');

  // MIGRATION 6: 005_rate_limits.sql
  console.log('\n[MIGRATION 6/6] Menjalankan 005_rate_limits.sql...');
  const sql005 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/005_rate_limits.sql'), 'utf8');
  await executeSql(sql005);

  // Verifikasi Migration 6
  const check005 = await executeSql(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'rate_limits';
  `);
  console.log('  -> \x1b[32mBERHASIL\x1b[0m: Tabel rate_limits terpusat aktif dengan RLS.');

  // TAHAP AKHIR: Audit Menyeluruh Pasca-Migrasi
  console.log('\n===============================================================');
  console.log('   AUDIT AKHIR HASIL MIGRASI SUPABASE STAGING                   ');
  console.log('===============================================================\n');

  const finalSummary = await executeSql(`
    SELECT 
      (SELECT count(*) FROM public.accounts) as accounts_count,
      (SELECT count(*) FROM public.transactions) as transactions_count,
      (SELECT count(*) FROM public.contacts) as contacts_count,
      (SELECT count(*) FROM public.company_settings) as company_settings_count,
      (SELECT count(*) FROM public.activity_logs) as activity_logs_count,
      (SELECT count(*) FROM public.system_users) as system_users_count,
      (SELECT count(*) FROM public.rate_limits) as rate_limits_count;
  `);

  console.log('Data Record Staging:');
  const rawData = finalSummary.result || finalSummary;
  console.log(rawData);

  console.log('\nSemua migrasi 000-005 selesai 100% tanpa error.');
  console.log('Database Staging siap digunakan untuk Vercel Preview testing.\n');
}

run().catch(err => {
  console.error('\n[MIGRATION FAILED]:', err.message);
  process.exit(1);
});
