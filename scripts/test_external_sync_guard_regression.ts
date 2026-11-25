/**
 * SPECTRA EXTERNAL SYNC GUARD REGRESSION TESTS
 *
 * Memverifikasi pemisahan lingkungan absolut antara:
 * 1. Production Resmi (Domain Sah + DB Production drsqwxkkcfqvooqzoyvm + Vercel Env 'production')
 * 2. Vercel Preview (Branch deployments *-git-* dan hash deployments)
 * 3. Staging Database (xaafjvmdjdlfqdrljjlr)
 * 4. Localhost / Local Development
 * 5. Ambiguous / Misconfigured / Attacker Environments (Fail-Closed)
 */

import assert from 'assert';
import {
  getExternalSyncStatus,
  isExternalSyncDisabledOnPreview,
  isProductionDomain,
  APPROVED_PRODUCTION_DOMAINS,
  PRODUCTION_SUPABASE_PROJECT,
  STAGING_SUPABASE_PROJECT
} from '../src/services/externalSyncGuard.ts';

console.log('======================================================================');
console.log('   SPECTRA — EXTERNAL SYNC GUARD & ENVIRONMENT ISOLATION REGRESSION   ');
console.log('======================================================================\n');

const PROD_CANONICAL_HOST = 'spectra-financial-system.vercel.app';
const PROD_CUSTOM_HOST = 'spectra.my.id';
const PROD_CORP_HOST = 'spectra.nirwanabhumi.co.id';
const PROD_DB_URL = `https://${PRODUCTION_SUPABASE_PROJECT}.supabase.co`;
const STAGING_DB_URL = `https://${STAGING_SUPABASE_PROJECT}.supabase.co`;
const FOREIGN_DB_URL = 'https://attacker-project-12345.supabase.co';

let passed = 0;
let total = 0;

function runTest(num: number, desc: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`[PASS] Test ${num}: ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`[FAIL] Test ${num}: ${desc} -> ${err.message}`);
    throw err;
  }
}

// -------------------------------------------------------------------------
// KELOMPOK 1: PRODUCTION RESMI TERVERIFIKASI
// -------------------------------------------------------------------------

runTest(1, 'Canonical Production Vercel Domain: Mock Mode WAJIB FALSE (Sync Aktif)', () => {
  const status = getExternalSyncStatus({
    hostname: PROD_CANONICAL_HOST,
    supabaseUrl: PROD_DB_URL,
    vercelEnv: 'production'
  });
  assert.strictEqual(status.isAllowed, true, 'isAllowed harus true di Production resmi');
  assert.strictEqual(status.isMockMode, false, 'isMockMode harus false di Production resmi');
  assert.strictEqual(status.environmentName, 'production');
  assert.strictEqual(isExternalSyncDisabledOnPreview({
    hostname: PROD_CANONICAL_HOST,
    supabaseUrl: PROD_DB_URL,
    vercelEnv: 'production'
  }), false, 'Banner isolasi PREVIEW dilarang muncul di Production');
});

runTest(2, 'Approved Custom Domain (spectra.my.id): Mock Mode WAJIB FALSE', () => {
  const status = getExternalSyncStatus({
    hostname: PROD_CUSTOM_HOST,
    supabaseUrl: PROD_DB_URL,
    vercelEnv: 'production'
  });
  assert.strictEqual(status.isAllowed, true);
  assert.strictEqual(status.isMockMode, false);
  assert.strictEqual(status.environmentName, 'production');
});

runTest(3, 'Approved Corporate Domain (spectra.nirwanabhumi.co.id): Mock Mode WAJIB FALSE', () => {
  const status = getExternalSyncStatus({
    hostname: PROD_CORP_HOST,
    supabaseUrl: PROD_DB_URL,
    vercelEnv: 'production'
  });
  assert.strictEqual(status.isAllowed, true);
  assert.strictEqual(status.isMockMode, false);
  assert.strictEqual(status.environmentName, 'production');
});

runTest(4, 'Case Insensitivity pada Domain dan URL Production', () => {
  const status = getExternalSyncStatus({
    hostname: 'SPECTRA-FINANCIAL-SYSTEM.VERCEL.APP',
    supabaseUrl: `HTTPS://${PRODUCTION_SUPABASE_PROJECT}.SUPABASE.CO`,
    vercelEnv: 'production'
  });
  assert.strictEqual(status.isAllowed, true);
  assert.strictEqual(status.isMockMode, false);
  assert.strictEqual(status.environmentName, 'production');
});

// -------------------------------------------------------------------------
// KELOMPOK 2: VERCEL PREVIEW & BRANCH DEPLOYMENTS (MOCK MODE WAJIB AKTIF)
// -------------------------------------------------------------------------

runTest(5, 'Vercel Preview Branch Deployment (*-git-*): Mock Mode WAJIB TRUE (PREVIEW)', () => {
  const branchHost = 'spectra-financial-system-git-feature-secure-auth-groq-mazmur.vercel.app';
  const status = getExternalSyncStatus({
    hostname: branchHost,
    supabaseUrl: PROD_DB_URL, // Meskipun tersambung prod DB, branch preview WAJIB diisolasi
    vercelEnv: 'preview'
  });
  assert.strictEqual(status.isAllowed, false);
  assert.strictEqual(status.isMockMode, true);
  assert.strictEqual(status.environmentName, 'preview');
  assert.strictEqual(isExternalSyncDisabledOnPreview({
    hostname: branchHost,
    supabaseUrl: PROD_DB_URL,
    vercelEnv: 'preview'
  }), true, 'Banner PREVIEW wajib aktif di branch deployment');
});

runTest(6, 'Vercel Non-Canonical Deployment Hash: Mock Mode WAJIB TRUE (PREVIEW)', () => {
  const hashHost = 'spectra-financial-system-6qprad6rh-mazmur.vercel.app';
  const status = getExternalSyncStatus({
    hostname: hashHost,
    supabaseUrl: PROD_DB_URL,
    vercelEnv: 'production' // Meskipun vercelEnv production, deployment hash bukan canonical domain
  });
  assert.strictEqual(status.isAllowed, false);
  assert.strictEqual(status.isMockMode, true);
  assert.strictEqual(status.environmentName, 'preview');
});

runTest(7, 'Peniru Domain Vercel Prefix Asing: Mock Mode WAJIB TRUE (PREVIEW)', () => {
  const attackerHost = 'spectra-financial-system-fake-attacker.vercel.app';
  const status = getExternalSyncStatus({
    hostname: attackerHost,
    supabaseUrl: PROD_DB_URL,
    vercelEnv: 'production'
  });
  assert.strictEqual(status.isAllowed, false);
  assert.strictEqual(status.isMockMode, true);
  assert.strictEqual(status.environmentName, 'preview');
});

// -------------------------------------------------------------------------
// KELOMPOK 3: STAGING & LOCALHOST (ISOLASI MUTLAK)
// -------------------------------------------------------------------------

runTest(8, 'Target Database Staging (xaafjvmdjdlfqdrljjlr): Mock Mode WAJIB TRUE (STAGING)', () => {
  // Bahkan jika dijalankan di hostname production sekalipun, jika DB staging -> WAJIB isolasi
  const status = getExternalSyncStatus({
    hostname: PROD_CANONICAL_HOST,
    supabaseUrl: STAGING_DB_URL,
    vercelEnv: 'production'
  });
  assert.strictEqual(status.isAllowed, false);
  assert.strictEqual(status.isMockMode, true);
  assert.strictEqual(status.environmentName, 'staging');
});

runTest(9, 'Localhost Development: Mock Mode WAJIB TRUE (LOCAL)', () => {
  const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
  for (const host of localHosts) {
    const status = getExternalSyncStatus({
      hostname: host,
      supabaseUrl: PROD_DB_URL,
      vercelEnv: 'production'
    });
    assert.strictEqual(status.isAllowed, false);
    assert.strictEqual(status.isMockMode, true);
    assert.strictEqual(status.environmentName, 'local');
  }
});

// -------------------------------------------------------------------------
// KELOMPOK 4: FAIL-CLOSED PADA KONFIGURASI AMBIGU / TIDAK LENGKAP
// -------------------------------------------------------------------------

runTest(10, 'Fail-Closed: Hostname Production tapi Vercel Env preview', () => {
  const status = getExternalSyncStatus({
    hostname: PROD_CANONICAL_HOST,
    supabaseUrl: PROD_DB_URL,
    vercelEnv: 'preview' // Konfigurasi kontradiktif
  });
  assert.strictEqual(status.isAllowed, false);
  assert.strictEqual(status.isMockMode, true);
});

runTest(11, 'Fail-Closed: Hostname Production tapi Vercel Env kosong / development', () => {
  const status = getExternalSyncStatus({
    hostname: PROD_CANONICAL_HOST,
    supabaseUrl: PROD_DB_URL,
    vercelEnv: ''
  });
  assert.strictEqual(status.isAllowed, false);
  assert.strictEqual(status.isMockMode, true);
});

runTest(12, 'Fail-Closed: Hostname Production tapi Database Asing / Bukan drsqwxkkcfqvooqzoyvm', () => {
  const status = getExternalSyncStatus({
    hostname: PROD_CANONICAL_HOST,
    supabaseUrl: FOREIGN_DB_URL,
    vercelEnv: 'production'
  });
  assert.strictEqual(status.isAllowed, false);
  assert.strictEqual(status.isMockMode, true);
});

runTest(13, 'Fail-Closed: Server-Side Runtime (No Window & No Override)', () => {
  const status = getExternalSyncStatus();
  assert.strictEqual(status.isAllowed, false);
  assert.strictEqual(status.isMockMode, true);
  assert.strictEqual(status.environmentName, 'local');
});

runTest(14, 'Validasi Helper isProductionDomain', () => {
  assert.strictEqual(isProductionDomain(PROD_CANONICAL_HOST), true);
  assert.strictEqual(isProductionDomain(PROD_CUSTOM_HOST), true);
  assert.strictEqual(isProductionDomain(PROD_CORP_HOST), true);
  assert.strictEqual(isProductionDomain('spectra-financial-system-6qprad6rh-mazmur.vercel.app'), false);
  assert.strictEqual(isProductionDomain('spectra-financial-system-git-feature.vercel.app'), false);
  assert.strictEqual(isProductionDomain('localhost'), false);
  assert.strictEqual(isProductionDomain(''), false);
  assert.strictEqual(isProductionDomain(undefined), false);
});

console.log('\n======================================================================');
console.log(`   HASIL REGRESSION TEST: ${passed}/${total} PASS (100%)`);
console.log('   ISOLASI LINGKUNGAN DAN LOGIKA PRODUKSI TERVERIFIKASI SEMPURNA');
console.log('======================================================================\n');
