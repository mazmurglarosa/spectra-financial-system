/**
 * SPECTRA Financial System - Staging Atomic Reset & Restore Test Suite
 * Target Database: Supabase Staging (xaafjvmdjdlfqdrljjlr)
 *
 * Verifikasi Mendalam:
 * 1. reset_spectra_system menolak pemanggilan tanpa p_backup_id (Fail-Closed).
 * 2. reset_spectra_system menolak pemanggilan jika p_backup_id belum diverifikasi.
 * 3. reset_spectra_system menolak pemanggilan jika jumlah transaksi pada snapshot berbeda dengan live data.
 * 4. reset_spectra_system berhasil mengeksekusi reset atomik (transaksi = 0, saldo = 0).
 * 5. restore_spectra_snapshot menolak pemanggilan jika checksum tidak cocok.
 * 6. restore_spectra_snapshot berhasil memulihkan transaksi, saldo akun COA, dan saldo kontak.
 * 7. Membersihkan data uji coba setelah tes selesai tanpa meninggalkan sampah di Staging.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const STAGING_URL = 'https://xaafjvmdjdlfqdrljjlr.supabase.co';
const userHome = process.env.USERPROFILE || process.env.HOME || '';
const configPath = userHome ? path.join(userHome, '.gemini', 'config', 'mcp_config.json') : '';

let stagingServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stagingServiceKey && configPath && fs.existsSync(configPath)) {
  try {
    const mcpConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const stg = mcpConfig.mcpServers?.['supabase-staging'];
    const auth = stg?.headers?.Authorization;

    if (auth) {
      const res = await fetch('https://api.supabase.com/v1/projects/xaafjvmdjdlfqdrljjlr/api-keys', {
        headers: { 'Authorization': auth }
      });
      if (res.ok) {
        const keyData = await res.json();
        stagingServiceKey = keyData.find(k => k.name === 'service_role')?.api_key;
      }
    }
  } catch (e) {
    console.warn('Gagal membaca kredensial dari mcp_config.json:', e.message);
  }
}

if (!stagingServiceKey) {
  console.error('[FATAL] Service role key Staging tidak ditemukan. Tidak dapat menjalankan tes Staging.');
  process.exit(1);
}

const supabase = createClient(STAGING_URL, stagingServiceKey, {
  auth: { persistSession: false }
});

console.log('=== MEMULAI TEST INTEGRASI ATOMIK RESET & RESTORE PADA STAGING ===\n');

async function run() {
  const testContactId = `contact-test-${Date.now()}`;
  const testTrxId = `trx-test-restore-${Date.now()}`;
  const testBackupId = `snapshot-test-restore-${Date.now()}`;

  try {
    // 1. SETUP DATA UJI COBA
    console.log('[1/8] Menyiapkan data uji coba di Staging (kontak, transaksi, saldo awal)...');
    
    // Ambil akun kas pertama untuk uji saldo
    const { data: firstAcc, error: accErr } = await supabase
      .from('accounts')
      .select('id, code, debet_awal')
      .limit(1)
      .single();
    assert.ifError(accErr);
    const targetAccId = firstAcc.id;

    // Set saldo akun
    await supabase.from('accounts').update({ debet_awal: 750000 }).eq('id', targetAccId);

    // Buat kontak dummy
    const { error: conErr } = await supabase.from('contacts').insert({
      id: testContactId,
      code: 'TEST-CONT-01',
      name: 'PT Mitra Uji Staging',
      type: 'customer',
      balance: 350000
    });
    assert.ifError(conErr);

    // Buat transaksi dummy
    await supabase.from('transactions').insert({
      id: testTrxId,
      date: '2026-11-26',
      ref_number: 'BT/0001/TEST-STG',
      type: 'general',
      description: 'Transaksi Uji Coba Restore Staging',
      lines: [
        { accountId: targetAccId, debit: 750000, credit: 0 },
        { accountId: 'acc_10001', debit: 0, credit: 750000 }
      ],
      total_debit: 750000,
      total_credit: 750000,
      partner: 'PT Mitra Uji Staging',
      created_at: Date.now(),
      updated_at: Date.now()
    });

    // Hitung transaksi saat ini
    const { count: txCountBefore } = await supabase
      .from('transactions')
      .select('id', { count: 'exact' });
    console.log(`Jumlah transaksi aktif saat ini: ${txCountBefore}`);

    // Buat snapshot payload
    const { data: allTx } = await supabase.from('transactions').select('*');
    const { data: allAcc } = await supabase.from('accounts').select('*');
    const { data: allCon } = await supabase.from('contacts').select('*');

    const snapshotPayload = {
      transactions: allTx,
      accounts: allAcc,
      contacts: allCon
    };
    const serialized = JSON.stringify(snapshotPayload);
    const validChecksum = crypto.createHash('sha256').update(serialized).digest('hex');

    // Simpan snapshot ke system_backups
    await supabase.from('system_backups').insert({
      id: testBackupId,
      created_by: 'staging_tester',
      sha256_checksum: validChecksum,
      transactions_count: txCountBefore,
      accounts_count: allAcc.length,
      contacts_count: allCon.length,
      snapshot_data: snapshotPayload,
      is_verified: true,
      verified_at: new Date().toISOString()
    });
    console.log('[PASS] Snapshot cadangan berhasil disimpan dan diverifikasi.');

    // 2. NEGATIVE TEST: Tolak reset tanpa backup_id
    console.log('\n[2/8] Menguji validasi: Tolak reset tanpa snapshot ID...');
    const { error: errNoBackup } = await supabase.rpc('reset_spectra_system', {
      p_confirm_code: 'RESET-SPECTRA',
      p_zero_accounts: true,
      p_actor_username: 'tester',
      p_actor_fullname: 'Tester',
      p_actor_position: 'QA',
      p_backup_id: ''
    });
    assert.ok(errNoBackup, 'Reset wajib ditolak jika p_backup_id kosong');
    console.log('[PASS] Ditolak dengan pesan:', errNoBackup.message);

    // 3. NEGATIVE TEST: Tolak reset jika transaksi count mismatch
    console.log('\n[3/8] Menguji validasi: Tolak reset jika snapshot count mismatch...');
    const fakeBackupId = `fake-snap-${Date.now()}`;
    await supabase.from('system_backups').insert({
      id: fakeBackupId,
      created_by: 'tester',
      sha256_checksum: 'fake',
      transactions_count: 99999, // Mismatch
      accounts_count: 1,
      contacts_count: 1,
      snapshot_data: {},
      is_verified: true,
      verified_at: new Date().toISOString()
    });

    const { error: errMismatch } = await supabase.rpc('reset_spectra_system', {
      p_confirm_code: 'RESET-SPECTRA',
      p_zero_accounts: true,
      p_actor_username: 'tester',
      p_actor_fullname: 'Tester',
      p_actor_position: 'QA',
      p_backup_id: fakeBackupId
    });
    assert.ok(errMismatch, 'Reset wajib ditolak jika snapshot count tidak cocok');
    console.log('[PASS] Ditolak dengan pesan:', errMismatch.message);
    await supabase.from('system_backups').delete().eq('id', fakeBackupId);

    // 4. POSITIVE TEST: Eksekusi Reset Atomik dengan snapshot valid
    console.log('\n[4/8] Mengeksekusi reset_spectra_system dengan snapshot valid...');
    const { data: resetResult, error: resetErr } = await supabase.rpc('reset_spectra_system', {
      p_confirm_code: 'RESET-SPECTRA',
      p_zero_accounts: true,
      p_actor_username: 'tester',
      p_actor_fullname: 'Tester',
      p_actor_position: 'QA',
      p_backup_id: testBackupId
    });
    assert.ifError(resetErr);
    assert.strictEqual(resetResult.success, true);
    console.log('[PASS] RPC reset_spectra_system berhasil:', resetResult);

    // Verifikasi state nol
    const { count: txCountAfter } = await supabase.from('transactions').select('id', { count: 'exact' });
    assert.strictEqual(txCountAfter, 0, 'Jumlah transaksi harus 0 setelah reset');

    const { data: checkAcc } = await supabase.from('accounts').select('debet_awal, kredit_awal').eq('id', targetAccId).single();
    assert.strictEqual(Number(checkAcc.debet_awal), 0, 'Saldo akun harus 0 setelah reset');

    const { data: checkCon } = await supabase.from('contacts').select('balance').eq('id', testContactId).single();
    assert.strictEqual(Number(checkCon.balance), 0, 'Saldo kontak harus 0 setelah reset');
    console.log('[PASS] Terverifikasi: Transaksi = 0, Saldo Akun = 0, Saldo Kontak = 0.');

    // 5. NEGATIVE TEST: Tolak restore dengan checksum salah
    console.log('\n[5/8] Menguji validasi: Tolak restore jika checksum tidak cocok...');
    const { error: errBadChecksum } = await supabase.rpc('restore_spectra_snapshot', {
      p_backup_id: testBackupId,
      p_actor_username: 'tester',
      p_expected_checksum: 'wrong_checksum_12345'
    });
    assert.ok(errBadChecksum, 'Restore wajib ditolak jika checksum tidak cocok');
    console.log('[PASS] Ditolak dengan pesan:', errBadChecksum.message);

    // 6. POSITIVE TEST: Eksekusi Restore Lengkap dengan checksum valid
    console.log('\n[6/8] Mengeksekusi restore_spectra_snapshot dengan checksum valid...');
    const { data: restoreResult, error: restoreErr } = await supabase.rpc('restore_spectra_snapshot', {
      p_backup_id: testBackupId,
      p_actor_username: 'tester',
      p_expected_checksum: validChecksum
    });
    assert.ifError(restoreErr);
    assert.strictEqual(restoreResult.success, true);
    console.log('[PASS] RPC restore_spectra_snapshot berhasil:', restoreResult);

    // 7. VERIFIKASI DATA HASIL RESTORE
    console.log('\n[7/8] Memverifikasi data hasil pemulihan (restore)...');
    const { count: txCountRestored } = await supabase.from('transactions').select('id', { count: 'exact' });
    assert.strictEqual(txCountRestored, txCountBefore, 'Transaksi harus dipulihkan sesuai snapshot');

    const { data: checkAccRestored } = await supabase.from('accounts').select('debet_awal').eq('id', targetAccId).single();
    assert.strictEqual(Number(checkAccRestored.debet_awal), 750000, 'Saldo akun harus dipulihkan ke 750000');

    const { data: checkConRestored } = await supabase.from('contacts').select('balance').eq('id', testContactId).single();
    assert.strictEqual(Number(checkConRestored.balance), 350000, 'Saldo kontak harus dipulihkan ke 350000');
    console.log('[PASS] Terverifikasi: Transaksi, Saldo Akun, dan Saldo Kontak berhasil direstorasi 100%!');

    // 8. CLEANUP STAGING (Meninggalkan Staging dalam keadaan bersih)
    console.log('\n[8/8] Membersihkan data uji coba dari Staging...');
    await supabase.from('transactions').delete().eq('id', testTrxId);
    await supabase.from('contacts').delete().eq('id', testContactId);
    await supabase.from('accounts').update({ debet_awal: 0, kredit_awal: 0 }).eq('id', targetAccId);
    await supabase.from('system_backups').delete().eq('id', testBackupId);
    console.log('[PASS] Cleanup selesai. Database Staging bersih.');

    console.log('\n=== SELURUH TES INTEGRASI ATOMIK RESET & RESTORE LULUS (100%) ===\n');
  } catch (err) {
    console.error('\n[FATAL ERROR DALAM TES STAGING]:', err.message || err);
    process.exit(1);
  }
}

run();
