/**
 * Script Pengujian Isolasi Kriptografis Token Staging vs Production
 * 
 * Membuktikan secara faktual:
 * 1. Token Staging berhak mengakses project 'xaafjvmdjldfqdrjljlr' (HTTP 200 OK).
 * 2. Token Staging DITOLAK TOTAL saat mencoba mengakses project Production 'drsqwxkkcfqvooqzoyvm' (HTTP 404 / 403).
 * 
 * Script ini membaca konfigurasi dari mcp_config.json dan TIDAK mencetak token ke konsol atau log.
 */

import fs from 'fs';

const configPath = 'C:\\Users\\Mazmur Gusti Agung L\\.gemini\\config\\mcp_config.json';
const STAGING_REF = 'xaafjvmdjdlfqdrljjlr';
const PROD_REF = 'drsqwxkkcfqvooqzoyvm';

async function main() {
  if (!fs.existsSync(configPath)) {
    console.error(`[ERROR] File konfigurasi tidak ditemukan di: ${configPath}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const stagingAuth = config.mcpServers?.['supabase-staging']?.headers?.Authorization;

  if (!stagingAuth) {
    console.error('[ERROR] Header Authorization pada "supabase-staging" belum dikonfigurasi.');
    process.exit(1);
  }

  console.log('\n===============================================================');
  console.log('   UJI ISOLASI SUPABASE STAGING TOKEN TERHADAP PRODUCTION      ');
  console.log('===============================================================\n');

  // UJI 1: Akses ke Staging
  console.log(`[TEST 1] Menguji akses token ke STAGING (${STAGING_REF})...`);
  try {
    const resStaging = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}`, {
      headers: { Authorization: stagingAuth }
    });
    console.log(`  -> HTTP Status Code : ${resStaging.status}`);
    if (resStaging.status === 200) {
      const data = await resStaging.json();
      console.log(`  -> Hasil             : \x1b[32mBERHASIL DIAUTENTIKASI\x1b[0m (Project: ${data.name})`);
    } else {
      console.log(`  -> Hasil             : \x1b[33mSTATUS ${resStaging.status}\x1b[0m`);
    }
  } catch (err) {
    console.log(`  -> Error request     : ${err.message}`);
  }

  console.log('');

  // UJI 2: Akses ke Production (Wajib DITOLAK!)
  console.log(`[TEST 2] Menguji akses token Staging ke PRODUCTION (${PROD_REF})...`);
  try {
    const resProd = await fetch(`https://api.supabase.com/v1/projects/${PROD_REF}`, {
      headers: { Authorization: stagingAuth }
    });
    console.log(`  -> HTTP Status Code : ${resProd.status}`);
    if (resProd.status === 404 || resProd.status === 403) {
      console.log(`  -> Hasil             : \x1b[32m100% TERISOLASI & DITOLAK OLEH SUPABASE\x1b[0m (Akses ke Production Ditolak)`);
    } else if (resProd.status === 200) {
      console.log(`  -> Hasil             : \x1b[31mBAHAYA: Token dapat membaca Production!\x1b[0m`);
    }
  } catch (err) {
    console.log(`  -> Error request     : ${err.message}`);
  }

  console.log('\n===============================================================');
  console.log('Catatan: Token rahasia tidak pernah ditampilkan atau dicatat ke log.');
  console.log('===============================================================\n');
}

main().catch(err => {
  console.error('[ERROR Main]:', err.message);
  process.exit(1);
});
