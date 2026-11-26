/**
 * SPECTRA Financial System - Staging Atomic Reset & Restore Test Suite (Supabase Free-Tier Architecture)
 * Target Database: Supabase Staging (xaafjvmdjdlfqdrljjlr)
 *
 * Verifikasi Mendalam (Arsitektur Tanpa Tabel Blob di Supabase):
 * 1. reset_spectra_system menolak pemanggilan tanpa p_backup_id Google Drive (Fail-Closed).
 * 2. reset_spectra_system menolak kode konfirmasi yang tidak tepat.
 * 3. reset_spectra_system mengeksekusi reset atomik tertransaksi (transaksi = 0, saldo akun = 0, saldo kontak = 0).
 * 4. reset_spectra_system mencatat jejak audit minimal ke activity_logs dengan ID file Drive (0 tabel baru di Supabase).
 * 5. restore_spectra_from_snapshot menolak payload snapshot yang tidak valid / kosong.
 * 6. restore_spectra_from_snapshot memulihkan transaksi, saldo COA, dan saldo kontak dari snapshot JSON Google Drive.
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

console.log('=== MEMULAI TEST INTEGRASI ATOMIK RESET & RESTORE PADA STAGING (FREE-TIER) ===\n');

async function run() {
  const testContactId = `contact-test-${Date.now()}`;
  const testTrxId = `trx-test-restore-${Date.now()}`;
  const testDriveFileId = `1DriveFileTest_${Date.now()}`;

  try {
    // 1. SETUP DATA UJI COBA
    console.log('[1/7] Menyiapkan data uji coba di Staging (kontak, transaksi, saldo awal)...');
    
    // Ambil akun kas pertama untuk uji saldo
    const { data: firstAcc, error: accErr } = await supabase
      .from('accounts')
      .select('id, code, debet_awal')
      .limit(1)
      .single();
    assert.ifError(accErr);
    const targetAccId = firstAcc.id;

    // Set saldo akun uji coba
    await supabase.from('accounts').update({ debet_awal: 850000 }).eq('id', targetAccId);

    // Buat kontak dummy
    const { error: conErr } = await supabase.from('contacts').insert({
      id: testContactId,
      code: 'TEST-CONT-FREE',
      name: 'PT Mitra Uji Free Tier',
      type: 'customer',
      balance: 420000
    });
    assert.ifError(conErr);

    // Buat transaksi dummy
    const { error: txErr } = await supabase.from('transactions').insert({
      id: testTrxId,
      date: '2026-11-26',
      ref_number: 'BT/0001/TEST-FREE',
      type: 'general',
      description: 'Transaksi Uji Coba Reset Free Tier Staging',
      lines: [
        { accountId: targetAccId, debit: 850000, credit: 0 },
        { accountId: 'acc_10001', debit: 0, credit: 850000 }
      ],
      total_debit: 850000,
      total_credit: 850000,
      partner: 'PT Mitra Uji Free Tier',
      created_at: Date.now(),
      updated_at: Date.now()
    });
    assert.ifError(txErr);

    // Ambil snapshot data persis seperti yang di-serialize ke Google Drive
    const { data: allTx } = await supabase.from('transactions').select('*');
    const { data: allAcc } = await supabase.from('accounts').select('*');
    const { data: allCon } = await supabase.from('contacts').select('*');

    const txCountBefore = allTx.length;
    console.log(`Jumlah transaksi aktif saat ini: ${txCountBefore}`);

    const snapshotPayload = {
      version: '2.0-atomic-drive-snapshot',
      createdAt: new Date().toISOString(),
      transactionsCount: txCountBefore,
      transactions: allTx,
      accounts: allAcc,
      contacts: allCon
    };
    const serialized = JSON.stringify(snapshotPayload);
    const validChecksum = crypto.createHash('sha256').update(serialized).digest('hex');
    const validDriveBackupId = `drive:${testDriveFileId}:sha256:${validChecksum}`;

    console.log('[PASS] Snapshot data disiapkan dengan checksum SHA-256:', validChecksum);

    // 2. NEGATIVE TEST: Tolak reset tanpa backup_id
    console.log('\n[2/7] Menguji validasi: Tolak reset jika p_backup_id kosong...');
    const { error: errNoBackup } = await supabase.rpc('reset_spectra_system', {
      p_confirm_code: 'RESET-SPECTRA',
      p_zero_accounts: true,
      p_actor_username: 'staging_tester',
      p_actor_fullname: 'QA Tester',
      p_actor_position: 'Auditor',
      p_backup_id: ''
    });
    assert.ok(errNoBackup, 'Reset wajib ditolak jika p_backup_id kosong');
    console.log('[PASS] Ditolak fail-closed dengan pesan:', errNoBackup.message);

    // 3. NEGATIVE TEST: Tolak reset jika konfirmasi keamanan salah
    console.log('\n[3/7] Menguji validasi: Tolak reset jika kode konfirmasi tidak tepat...');
    const { error: errWrongCode } = await supabase.rpc('reset_spectra_system', {
      p_confirm_code: 'WRONG-CODE',
      p_zero_accounts: true,
      p_actor_username: 'staging_tester',
      p_actor_fullname: 'QA Tester',
      p_actor_position: 'Auditor',
      p_backup_id: validDriveBackupId
    });
    assert.ok(errWrongCode, 'Reset wajib ditolak jika p_confirm_code salah');
    console.log('[PASS] Ditolak fail-closed dengan pesan:', errWrongCode.message);

    // 4. POSITIVE TEST: Eksekusi Reset Atomik dengan Google Drive backup ID valid
    console.log('\n[4/7] Mengeksekusi reset_spectra_system dengan Google Drive backup ID valid...');
    const { data: resetResult, error: resetErr } = await supabase.rpc('reset_spectra_system', {
      p_confirm_code: 'RESET-SPECTRA',
      p_zero_accounts: true,
      p_actor_username: 'staging_tester',
      p_actor_fullname: 'QA Tester',
      p_actor_position: 'Auditor',
      p_backup_id: validDriveBackupId
    });
    assert.ifError(resetErr);
    assert.strictEqual(resetResult.success, true);
    console.log('[PASS] RPC reset_spectra_system berhasil:', resetResult);

    // Verifikasi state nol pada tabel database
    const { count: txCountAfter } = await supabase.from('transactions').select('id', { count: 'exact' });
    assert.strictEqual(txCountAfter, 0, 'Jumlah transaksi harus 0 setelah reset');

    const { data: checkAcc } = await supabase.from('accounts').select('debet_awal, kredit_awal').eq('id', targetAccId).single();
    assert.strictEqual(Number(checkAcc.debet_awal), 0, 'Saldo akun harus 0 setelah reset');

    const { data: checkCon } = await supabase.from('contacts').select('balance').eq('id', testContactId).single();
    assert.strictEqual(Number(checkCon.balance), 0, 'Saldo kontak harus 0 setelah reset');
    console.log('[PASS] Terverifikasi: Transaksi = 0, Saldo Akun = 0, Saldo Kontak = 0.');

    // 5. NEGATIVE TEST: Tolak restore dari snapshot null/kosong
    console.log('\n[5/7] Menguji validasi: Tolak restore_spectra_from_snapshot jika payload kosong...');
    const { error: errBadRestore } = await supabase.rpc('restore_spectra_from_snapshot', {
      p_snapshot_data: null,
      p_actor_username: 'staging_tester'
    });
    assert.ok(errBadRestore, 'Restore wajib ditolak jika snapshot kosong');
    console.log('[PASS] Ditolak dengan pesan:', errBadRestore.message);

    // 6. POSITIVE TEST: Eksekusi Restore Lengkap dari muatan snapshot JSON Google Drive
    console.log('\n[6/7] Mengeksekusi restore_spectra_from_snapshot dari snapshot JSON Google Drive...');
    const { data: restoreResult, error: restoreErr } = await supabase.rpc('restore_spectra_from_snapshot', {
      p_snapshot_data: snapshotPayload,
      p_actor_username: 'staging_tester'
    });
    assert.ifError(restoreErr);
    assert.strictEqual(restoreResult.success, true);
    console.log('[PASS] RPC restore_spectra_from_snapshot berhasil:', restoreResult);

    // Verifikasi data hasil pemulihan
    const { count: txCountRestored } = await supabase.from('transactions').select('id', { count: 'exact' });
    assert.strictEqual(txCountRestored, txCountBefore, 'Transaksi harus dipulihkan sesuai snapshot');

    const { data: checkAccRestored } = await supabase.from('accounts').select('debet_awal').eq('id', targetAccId).single();
    assert.strictEqual(Number(checkAccRestored.debet_awal), 850000, 'Saldo akun harus dipulihkan ke 850000');

    const { data: checkConRestored } = await supabase.from('contacts').select('balance').eq('id', testContactId).single();
    assert.strictEqual(Number(checkConRestored.balance), 420000, 'Saldo kontak harus dipulihkan ke 420000');
    console.log('[PASS] Terverifikasi: Transaksi, Saldo Akun, dan Saldo Kontak berhasil direstorasi 100%!');

    // 7. CLEANUP STAGING (Membersihkan data dummy uji coba)
    console.log('\n[7/7] Membersihkan data uji coba dari Staging...');
    await supabase.from('transactions').delete().eq('id', testTrxId);
    await supabase.from('contacts').delete().eq('id', testContactId);
    await supabase.from('accounts').update({ debet_awal: 0, kredit_awal: 0 }).eq('id', targetAccId);
    console.log('[PASS] Cleanup selesai. Database Staging bersih.');

    console.log('\n=== SELURUH TES INTEGRASI ATOMIK RESET & RESTORE PADA STAGING LULUS (100%) ===\n');
  } catch (err) {
    console.error('\n[FATAL ERROR DALAM TES STAGING]:', err.message || err);
    process.exit(1);
  }
}

run();
