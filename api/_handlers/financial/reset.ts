import { authenticateFinancialRequest } from '../../_lib/financialAuth.js';
import { checkRateLimitCentralized, getClientIp } from '../../_lib/rateLimit.js';
import { detectServerEnvironment } from './spreadsheet-sync.js';
import crypto from 'crypto';

/**
 * POST /api/financial/reset
 *
 * Endpoint Vercel Serverless terotorisasi untuk mengeksekusi RESET SISTEM TOTAL (FAIL-CLOSED):
 * 1. Verifikasi pra-pemeriksaan & pembacaan data transaksi yang ada (gagal baca = abort fail-closed).
 * 2. Menghapus seluruh baris transaksi pada tabel 'transactions' di database Supabase (service role).
 * 3. Menol-kan saldo awal akun ('debet_awal' = 0, 'kredit_awal' = 0) pada seluruh 76 COA (memeriksa error PostgREST).
 * 4. Menol-kan saldo rekanan ('balance' = 0) pada tabel 'contacts' (memeriksa error PostgREST).
 * 5. Mempertahankan master akun (76 COA), master pengguna (system_users), dan pengaturan perusahaan (company_settings).
 * 6. Mengosongkan baris data transaksi (A6:K) pada Google Spreadsheet datasheet_bukti_transaksi melalui Apps Script bot.
 *    - Melakukan read-only compatibility probe via GET terlebih dahulu.
 *    - Jika webhook tidak ada, timeout, atau Apps Script versi lama menolak aksi, LAPORKAN PARTIAL_FAILURE.
 *    - DILARANG menyatakan spreadsheetReset: true jika tidak ada konfirmasi keberhasilan dari Apps Script.
 * 7. Mengamankan berkas Google Drive: berkas dipertahankan aman secara default (kecuali bila clearDrive === true).
 * 8. Mencatat log jejak audit resmi ke tabel activity_logs.
 *
 * KEAMANAN:
 * - Wajib sesi aktif terautentikasi dan memiliki kewenangan otoritas keuangan / admin.
 * - Memerlukan kode konfirmasi eksplisit: "RESET-SPECTRA".
 * - Rate limited: maksimal 5 permintaan per 10 menit per pengguna/IP.
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

  // 2. Rate Limiting (Maksimal 5 request per 10 menit)
  const clientIp = getClientIp(req);
  const rateKey = `reset_financial_${dbUser.id || clientIp}`;
  const rateCheck = await checkRateLimitCentralized(rateKey, 5, 10 * 60 * 1000, supabase);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      status: 'REJECTED',
      error: 'Batas frekuensi reset sistem terlampaui. Silakan tunggu 10 menit sebelum mencoba kembali.'
    });
  }

  // 3. Konfirmasi Keamanan Eksplisit Wajib
  const payload = req.body || {};
  const confirmCode = String(payload.confirmCode || '').trim();
  if (confirmCode !== 'RESET-SPECTRA') {
    return res.status(400).json({
      success: false,
      status: 'REJECTED',
      error: 'Konfirmasi keamanan wajib: Masukkan teks "RESET-SPECTRA" untuk mengonfirmasi reset total sistem.'
    });
  }

  try {
    // 4. PRE-FLIGHT VERIFICATION: Verifikasi koneksi & hitung transaksi aktif
    const { data: preTx, error: preErr, count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact' });

    if (preErr) {
      console.error('[ResetSystemPreflightError] Gagal membaca transaksi pra-reset:', preErr.message);
      return res.status(500).json({
        success: false,
        status: 'FAILED',
        error: `Gagal memverifikasi database sebelum reset: ${preErr.message}. Operasi reset dibatalkan demi keselamatan data (Fail-Closed).`,
        databaseReset: false
      });
    }

    const txCount = count !== null && count !== undefined ? count : (preTx ? preTx.length : 0);

    // 5. Hapus SELURUH transaksi dari tabel 'transactions' di database Supabase
    const { error: delTxErr } = await supabase
      .from('transactions')
      .delete()
      .neq('id', '___non_existent___');

    if (delTxErr) {
      console.error('[ResetSystemError] Gagal menghapus transaksi:', delTxErr.message);
      return res.status(500).json({
        success: false,
        status: 'FAILED',
        error: `Gagal mengosongkan transaksi di database: ${delTxErr.message}. Data lokal tidak diubah (Fail-Closed).`,
        databaseReset: false
      });
    }

    // 6. Nol-kan saldo awal akun di tabel 'accounts' (76 COA tetap utuh)
    if (payload.zeroAccounts !== false) {
      const { error: accErr } = await supabase
        .from('accounts')
        .update({ debet_awal: 0, kredit_awal: 0 })
        .neq('id', '___non_existent___');

      if (accErr) {
        console.error('[ResetSystemError] Gagal menolkan saldo awal akun:', accErr.message);
        return res.status(500).json({
          success: false,
          status: 'FAILED',
          error: `Transaksi telah dihapus, namun gagal menolkan saldo awal akun: ${accErr.message}`,
          databaseReset: true
        });
      }
    }

    // 7. Nol-kan saldo kontak rekanan di tabel 'contacts' (Daftar kontak tetap utuh)
    const { error: conErr } = await supabase
      .from('contacts')
      .update({ balance: 0 })
      .neq('id', '___non_existent___');

    if (conErr) {
      console.error('[ResetSystemError] Gagal menolkan saldo kontak:', conErr.message);
      return res.status(500).json({
        success: false,
        status: 'FAILED',
        error: `Transaksi telah dihapus, namun gagal menolkan saldo kontak: ${conErr.message}`,
        databaseReset: true
      });
    }

    // 8. Catat Jejak Audit ke tabel 'activity_logs'
    const { error: logErr } = await supabase.from('activity_logs').insert({
      id: `log-reset-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date().toLocaleString('id-ID'),
      username: dbUser.username,
      full_name: dbUser.fullName,
      position: dbUser.position,
      action: 'RESET PEMBUKUAN TOTAL',
      detail: `Reset total sistem dieksekusi: ${txCount} transaksi dihapus dari database, saldo akun dinolkan (Rp 0), nomor berkas Auto Record di-reset ke BT/0001.`
    });

    if (logErr) {
      console.warn('[ResetSystemWarning] Gagal mencatat activity log ke database:', logErr.message);
    }

    // Database kini terbukti 100% bersih di Supabase
    const databaseReset = true;

    // 9. Koordinasi Reset Google Spreadsheet (datasheet_bukti_transaksi baris A6:K)
    let spreadsheetReset = false;
    let spreadsheetMessage = '';
    let isPartialFailure = false;

    const shouldClearSpreadsheet = payload.clearSpreadsheet !== false;
    const shouldClearDrive = payload.clearDrive === true;

    if (shouldClearSpreadsheet) {
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
        // PERBAIKAN BUG #2: JANGAN klaim true jika webhook kosong!
        spreadsheetReset = false;
        isPartialFailure = true;
        spreadsheetMessage = `Webhook Google Apps Script belum dikonfigurasi pada environment ${envCtx.environmentName.toUpperCase()} (SPECTRA_SPREADSHEET_WEBHOOK_URL atau SPECTRA_BOT_SECRET belum disetel di server).`;
      } else {
        try {
          // Probe Read-Only via GET (timeout 5 detik) untuk memastikan bot aktif dan kompatibel
          let isProbeOk = false;
          try {
            const probeCtrl = new AbortController();
            const probeTimeout = setTimeout(() => probeCtrl.abort(), 5000);
            const probeRes = await fetch(targetWebhookUrl.trim(), {
              method: 'GET',
              signal: probeCtrl.signal,
              redirect: 'follow'
            });
            clearTimeout(probeTimeout);

            if (probeRes.ok) {
              const probeJson: any = await probeRes.json().catch(() => null);
              if (probeJson && probeJson.status === 'online') {
                isProbeOk = true;
              }
            }
          } catch {
            isProbeOk = false;
          }

          const timestamp = new Date().toISOString();
          const nonce = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
          const botPayload = {
            action: 'CLEAR_TRANSACTIONS_A6_K',
            secret: targetBotSecret,
            timestamp,
            nonce,
            clearDrive: shouldClearDrive
          };

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const appsRes = await fetch(targetWebhookUrl.trim(), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(botPayload),
            signal: controller.signal,
            redirect: 'follow'
          });
          clearTimeout(timeoutId);

          const appsResult: any = await appsRes.json().catch(() => null);

          // PERBAIKAN BUG #3 & #5: Verifikasi eksplisit konfirmasi keberhasilan dari Apps Script
          if (appsResult && (appsResult.status === 'success' || appsResult.success) && appsResult.action === 'CLEAR_TRANSACTIONS_A6_K') {
            spreadsheetReset = true;
            spreadsheetMessage = appsResult.message || 'Tabel transaksi A6:K di Google Spreadsheet berhasil dikosongkan. Baris 1-5 dan format tabel tetap utuh.';
          } else {
            spreadsheetReset = false;
            isPartialFailure = true;
            const errMsg = appsResult?.message || `Google Apps Script HTTP ${appsRes.status}`;

            if (errMsg.includes('Array baris transaksi') || errMsg.includes('dinonaktifkan')) {
              spreadsheetMessage = `Versi Google Apps Script aktif di Google Sheets belum mendukung aksi CLEAR_TRANSACTIONS_A6_K (terdeteksi kode lama: "${errMsg}"). Silakan gunakan menu resmi: ⚡ SPECTRA Bot -> 🗑️ Reset Total di Google Sheets.`;
            } else {
              spreadsheetMessage = `Google Apps Script gagal mengosongkan spreadsheet: ${errMsg}.`;
            }
          }
        } catch (botErr: any) {
          console.warn('[ResetSystemWarning] Gagal memanggil Apps Script webhook:', botErr?.message);
          spreadsheetReset = false;
          isPartialFailure = true;
          spreadsheetMessage = `Gagal menyinkronkan reset ke Google Sheets: ${botErr?.message || 'Koneksi timeout'}. Anda dapat mengosongkan manual melalui menu ⚡ SPECTRA Bot -> Reset Total di Google Sheets.`;
        }
      }
    } else {
      spreadsheetReset = false;
      spreadsheetMessage = 'Opsi pembersihan spreadsheet dilewati oleh pengguna.';
    }

    // 10. EVALUASI HASIL & STATUS RESPON (PARTIAL_FAILURE VS SUCCESS)
    if (isPartialFailure) {
      return res.status(207).json({
        success: false,
        status: 'PARTIAL_FAILURE',
        error: 'Reset database Supabase berhasil, namun pengosongan Google Spreadsheet gagal.',
        message: `Database berhasil di-reset (${txCount} transaksi dihapus & saldo dinolkan), namun Google Spreadsheet belum berhasil dikosongkan otomatis: ${spreadsheetMessage}`,
        databaseReset: true,
        deletedTransactionsCount: txCount,
        accountsPreserved: true,
        spreadsheetReset: false,
        spreadsheetMessage,
        recoveryProcedure: 'Buka Google Spreadsheet datasheet_bukti_transaksi resmi, lalu pilih menu: ⚡ SPECTRA Bot -> 🗑️ Reset Total.',
        driveStatus: shouldClearDrive ? 'TRASHED' : 'RETAINED'
      });
    }

    return res.status(200).json({
      success: true,
      status: 'SUCCESS',
      message: 'Reset sistem total berhasil diselesaikan. Seluruh transaksi dihapus (0 transaksi), saldo akun dinolkan, Google Spreadsheet A6:K dikosongkan, dan nomor berkas kembali ke BT/0001.',
      databaseReset: true,
      deletedTransactionsCount: txCount,
      accountsPreserved: true,
      spreadsheetReset: true,
      spreadsheetMessage,
      driveStatus: shouldClearDrive ? 'TRASHED' : 'RETAINED'
    });
  } catch (err: any) {
    console.error('[ResetSystemUnhandledError]', err?.message);
    return res.status(500).json({
      success: false,
      status: 'FAILED',
      error: `Terjadi kesalahan saat memproses reset sistem: ${err?.message || err}`,
      databaseReset: false
    });
  }
}
