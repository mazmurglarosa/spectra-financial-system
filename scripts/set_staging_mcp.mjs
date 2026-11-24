/**
 * Script Konfigurasi MCP Supabase Staging Terpisah
 * 
 * Fungsi:
 * 1. Mempertahankan konfigurasi 'supabase' (Production) yang sudah ada tanpa perubahan.
 * 2. Menambahkan entri MCP baru 'supabase-staging' yang mengarah ke project 'xaafjvmdjldfqdrjljlr'.
 * 3. Menerima Personal Access Token secara tersembunyi (masked prompt) atau dari env var SUPABASE_STAGING_PAT.
 * 4. TIDAK mencetak token ke konsol atau log.
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';

const configPath = 'C:\\Users\\Mazmur Gusti Agung L\\.gemini\\config\\mcp_config.json';
const STAGING_PROJECT_ID = 'xaafjvmdjdlfqdrljjlr';

async function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const stdin = process.openStdin();
    process.stdout.write(question);

    const onData = (char) => {
      char = char + '';
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.removeListener('data', onData);
          break;
        default:
          process.stdout.write('\x1B[2K\x1B[200D' + question + '*'.repeat(rl.line.length));
          break;
      }
    };

    process.stdin.on('data', onData);

    rl.question('', (value) => {
      rl.history = [];
      rl.close();
      console.log();
      resolve(value.trim());
    });
  });
}

async function main() {
  if (!fs.existsSync(configPath)) {
    console.error(`[ERROR] File konfigurasi MCP tidak ditemukan di: ${configPath}`);
    process.exit(1);
  }

  let patToken = process.env.SUPABASE_STAGING_PAT;

  if (!patToken) {
    if (process.stdin.isTTY) {
      console.log('\n--- KONFIGURASI SUPABASE STAGING MCP ---');
      console.log('Buat Personal Access Token baru di: https://supabase.com/dashboard/account/tokens');
      patToken = await promptHidden('Masukkan Personal Access Token Supabase Staging: ');
    } else {
      console.error('[ERROR] Token tidak ditemukan. Set environment variable SUPABASE_STAGING_PAT.');
      process.exit(1);
    }
  }

  if (!patToken || !patToken.startsWith('sbp_')) {
    console.error('[ERROR] Format token tidak valid. Token Supabase harus diawali dengan "sbp_".');
    process.exit(1);
  }

  // Backup konfigurasi lama sebelum menulis
  const rawConfig = fs.readFileSync(configPath, 'utf8');
  fs.writeFileSync(`${configPath}.backup_pre_staging`, rawConfig, 'utf8');

  const config = JSON.parse(rawConfig);
  if (!config.mcpServers) config.mcpServers = {};

  // Pastikan Production tetap utuh
  if (!config.mcpServers.supabase) {
    console.warn('[PERINGATAN] Entri "supabase" production tidak ditemukan di config.');
  }

  // Tambahkan koneksi MCP Staging terpisah (fokus ke database & project tools, tanpa modul 'account' yang membutuhkan izin global)
  config.mcpServers['supabase-staging'] = {
    serverUrl: `https://mcp.supabase.com/mcp?project_ref=${STAGING_PROJECT_ID}&features=docs%2Cdatabase%2Cdebugging%2Cdevelopment`,
    headers: {
      Authorization: `Bearer ${patToken}`
    }
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

  console.log('\n[BERHASIL] MCP Supabase Staging telah dikonfigurasi:');
  console.log(`  -> Server Key   : "supabase-staging"`);
  console.log(`  -> Project ID   : ${STAGING_PROJECT_ID}`);
  console.log(`  -> Konfigurasi  : ${configPath}`);
  console.log(`  -> Production   : Tetap tersimpan utuh pada key "supabase" (drsqwxkkcfqvooqzoyvm)`);
  console.log('[KEAMANAN] Token tidak dicetak atau disimpan di Git/source code.\n');
}

main().catch(err => {
  console.error('[ERROR]:', err.message);
  process.exit(1);
});
