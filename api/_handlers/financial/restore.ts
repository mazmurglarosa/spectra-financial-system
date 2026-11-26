import { authenticateFinancialRequest } from '../../_lib/financialAuth.js';
import { checkRateLimitCentralized, getClientIp } from '../../_lib/rateLimit.js';
import { detectServerEnvironment } from './spreadsheet-sync.js';
import crypto from 'crypto';

/**
 * POST /api/financial/restore
 *
 * Endpoint terotorisasi untuk memulihkan sistem SPECTRA dari snapshot Google Drive atau payload snapshot JSON:
 * 1. Otentikasi dan otorisasi ketat admin keuangan.
 * 2. Rate limiting terpusat (5 req / 10 menit).
 * 3. Wajib konfirmasi keamanan: "RESTORE-SPECTRA".
 * 4. Mendukung pengambilan file snapshot dari Google Drive via Apps Script bot (READ_BACKUP_JSON) atau snapshot langsung.
 * 5. Verifikasi integritas checksum SHA-256 (jika expectedChecksum disertakan).
 * 6. Eksekusi RPC atomik restore_spectra_from_snapshot di PostgreSQL (All-or-Nothing).
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, status: 'REJECTED', error: 'Method Not Allowed' });
  }

  // 1. Otorisasi Keuangan & Admin (Fail-Closed)
  const auth = await authenticateFinancialRequest(req, res, {
    requireAuthority: true
  });
  if (!auth) return;

  const { supabase, dbUser } = auth;

  // 2. Rate Limiting
  const clientIp = getClientIp(req);
  const rateKey = `restore_financial_${dbUser.id || clientIp}`;
  const rateCheck = await checkRateLimitCentralized(rateKey, 5, 10 * 60 * 1000, supabase);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      status: 'REJECTED',
      error: 'Batas frekuensi restorasi sistem terlampaui. Silakan tunggu 10 menit sebelum mencoba kembali.'
    });
  }

  // 3. Konfirmasi Keamanan Wajib
  const payload = req.body || {};
  const confirmCode = String(payload.confirmCode || '').trim();
  if (confirmCode !== 'RESTORE-SPECTRA') {
    return res.status(400).json({
      success: false,
      status: 'REJECTED',
      error: 'Konfirmasi keamanan wajib: Masukkan teks "RESTORE-SPECTRA" untuk mengonfirmasi pemulihan sistem dari cadangan.'
    });
  }

  try {
    let snapshotData = payload.snapshotData || null;
    const fileId = String(payload.fileId || '').trim();
    const expectedChecksum = String(payload.expectedChecksum || '').trim();

    // 4. Ambil dari Google Drive jika fileId disediakan
    if (fileId && !snapshotData) {
      const envCtx = detectServerEnvironment(req, (supabase as any)?.supabaseUrl);
      let targetWebhookUrl = '';
      let targetBotSecret = '';

      if (envCtx.isProduction) {
        targetWebhookUrl = (process.env.SPECTRA_SPREADSHEET_WEBHOOK_URL_PRODUCTION || process.env.SPECTRA_SPREADSHEET_WEBHOOK_URL || '').trim();
        targetBotSecret = (process.env.SPECTRA_BOT_SECRET_PRODUCTION || process.env.SPECTRA_BOT_SECRET || '').trim();
      } else {
        targetWebhookUrl = (process.env.SPECTRA_SPREADSHEET_WEBHOOK_URL_STAGING || process.env.SPECTRA_SPREADSHEET_WEBHOOK_URL || '').trim();
        targetBotSecret = (process.env.SPECTRA_BOT_SECRET_STAGING || process.env.SPECTRA_BOT_SECRET || '').trim();
      }

      if (!targetWebhookUrl || !targetBotSecret) {
        return res.status(500).json({
          success: false,
          status: 'FAILED',
          error: 'Webhook Google Apps Script belum disetel untuk membaca cadangan dari Google Drive.'
        });
      }

      const readCtrl = new AbortController();
      const readTimeout = setTimeout(() => readCtrl.abort(), 20000);
      const readRes = await fetch(targetWebhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'READ_BACKUP_JSON',
          secret: targetBotSecret,
          fileId: fileId,
          timestamp: new Date().toISOString()
        }),
        signal: readCtrl.signal,
        redirect: 'follow'
      });
      clearTimeout(readTimeout);

      const readResult: any = await readRes.json().catch(() => null);
      if (!readResult || (readResult.status !== 'success' && !readResult.success) || !readResult.content) {
        return res.status(500).json({
          success: false,
          status: 'FAILED',
          error: `Gagal membaca file backup dari Google Drive: ${readResult?.message || `HTTP ${readRes.status}`}`
        });
      }

      try {
        snapshotData = typeof readResult.content === 'string' ? JSON.parse(readResult.content) : readResult.content;
      } catch (pErr: any) {
        return res.status(500).json({
          success: false,
          status: 'FAILED',
          error: `Isi file backup dari Google Drive bukan JSON valid: ${pErr.message}`
        });
      }
    }

    if (!snapshotData || typeof snapshotData !== 'object') {
      return res.status(400).json({
        success: false,
        status: 'FAILED',
        error: 'Data snapshot tidak ditemukan atau tidak valid. Sediakan fileId Google Drive atau snapshotData JSON.'
      });
    }

    // 5. Verifikasi Integritas Checksum SHA-256 jika diminta
    const serialized = JSON.stringify(snapshotData);
    const computedChecksum = crypto.createHash('sha256').update(serialized).digest('hex');

    if (expectedChecksum && expectedChecksum !== computedChecksum) {
      return res.status(400).json({
        success: false,
        status: 'FAILED',
        error: `Integritas snapshot gagal: Checksum SHA-256 tidak cocok. Diharapkan: ${expectedChecksum}, Dihitung: ${computedChecksum}`
      });
    }

    // 6. Eksekusi RPC restore_spectra_from_snapshot secara Atomik
    const { data: rpcData, error: rpcErr } = await supabase.rpc('restore_spectra_from_snapshot', {
      p_snapshot_data: snapshotData,
      p_actor_username: dbUser.username
    });

    if (rpcErr) {
      console.error('[RestoreSystemRpcError]', rpcErr.message);
      return res.status(500).json({
        success: false,
        status: 'FAILED',
        error: `Gagal menjalankan pemulihan atomik database: ${rpcErr.message}`
      });
    }

    return res.status(200).json({
      success: true,
      status: 'SUCCESS',
      message: 'Pemulihan data sistem berhasil diselesaikan. Transaksi, saldo akun COA, dan saldo rekanan telah direstorasi.',
      details: rpcData,
      computedChecksum
    });
  } catch (err: any) {
    console.error('[RestoreSystemUnhandledError]', err?.message);
    return res.status(500).json({
      success: false,
      status: 'FAILED',
      error: `Terjadi kesalahan saat memulihkan sistem: ${err?.message || err}`
    });
  }
}
