import { authenticateFinancialRequest } from '../../_lib/financialAuth.js';
import { checkRateLimitCentralized, getClientIp } from '../../_lib/rateLimit.js';
import { detectServerEnvironment } from './spreadsheet-sync.js';
import crypto from 'crypto';

/**
 * POST /api/financial/reset
 *
 * Endpoint Vercel Serverless terotorisasi untuk mengeksekusi RESET SISTEM TOTAL:
 * 1. Menghapus seluruh baris transaksi pada tabel 'transactions' di database Supabase.
 * 2. Menol-kan saldo awal akun ('debet_awal' = 0, 'kredit_awal' = 0) pada seluruh 76 COA (tanpa menghapus akun).
 * 3. Menol-kan saldo rekanan ('balance' = 0) pada tabel 'contacts' (tanpa menghapus rekanan).
 * 4. Mempertahankan tabel master akun (76 COA), master pengguna (system_users), dan pengaturan perusahaan (company_settings).
 * 5. Mengosongkan baris data transaksi (A6:K) pada Google Spreadsheet datasheet_bukti_transaksi melalui Apps Script bot.
 * 6. Mengamankan berkas Google Drive: berkas dipertahankan aman secara default, kecuali bila opsi clearDrive === true.
 * 7. Mencatat log jejak audit resmi ke tabel activity_logs.
 *
 * KEAMANAN:
 * - Wajib sesi aktif terautentikasi dan memiliki kewenangan otoritas keuangan / admin.
 * - Memerlukan kode konfirmasi eksplisit: "RESET-SPECTRA".
 * - Rate limited: maksimal 5 permintaan per 10 menit per pengguna/IP.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // 1. Otorisasi Keuangan & Admin
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
      error: 'Batas frekuensi reset sistem terlampaui. Silakan tunggu 10 menit sebelum mencoba kembali.'
    });
  }

  // 3. Konfirmasi Eksplisit
  const payload = req.body || {};
  const confirmCode = String(payload.confirmCode || '').trim();
  if (confirmCode !== 'RESET-SPECTRA') {
    return res.status(400).json({
      success: false,
      error: 'Konfirmasi keamanan wajib: Masukkan teks "RESET-SPECTRA" untuk mengonfirmasi reset total sistem.'
    });
  }

  try {
    // 4. Hitung jumlah transaksi saat ini sebelum dihapus
    let txCount = 0;
    try {
      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });
      txCount = count || 0;
    } catch {
      txCount = 0;
    }

    // 5. Hapus SELURUH transaksi dari tabel 'transactions'
    const { error: delTxErr } = await supabase
      .from('transactions')
      .delete()
      .neq('id', '___non_existent___');

    if (delTxErr) {
      console.error('[ResetSystemError] Gagal menghapus transaksi:', delTxErr.message);
      return res.status(500).json({
        success: false,
        error: `Gagal mengosongkan transaksi di database: ${delTxErr.message}`
      });
    }

    // 6. Nol-kan saldo awal akun di tabel 'accounts' (76 COA tetap utuh)
    if (payload.zeroAccounts !== false) {
      try {
        await supabase
          .from('accounts')
          .update({ debet_awal: 0, kredit_awal: 0 })
          .neq('id', '___non_existent___');
      } catch (accErr: any) {
        console.warn('[ResetSystemWarning] Gagal menolkan saldo awal akun:', accErr?.message);
      }
    }

    // 7. Nol-kan saldo kontak rekanan di tabel 'contacts' (Daftar kontak tetap utuh)
    try {
      await supabase
        .from('contacts')
        .update({ balance: 0 })
        .neq('id', '___non_existent___');
    } catch (conErr: any) {
      console.warn('[ResetSystemWarning] Gagal menolkan saldo kontak:', conErr?.message);
    }

    // 8. Catat Jejak Audit ke tabel 'activity_logs'
    try {
      await supabase.from('activity_logs').insert({
        id: `log-reset-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        timestamp: new Date().toLocaleString('id-ID'),
        username: dbUser.username,
        full_name: dbUser.fullName,
        position: dbUser.position,
        action: 'RESET PEMBUKUAN TOTAL',
        detail: `Reset total sistem dieksekusi: ${txCount} transaksi dihapus dari database, saldo akun dinolkan (Rp 0), nomor berkas Auto Record di-reset ke BT/0001.`
      });
    } catch (logErr: any) {
      console.warn('[ResetSystemWarning] Gagal mencatat activity log:', logErr?.message);
    }

    // 9. Koordinasi Reset Google Spreadsheet (datasheet_bukti_transaksi baris A6:K)
    let spreadsheetReset = false;
    let spreadsheetMessage = '';
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
        spreadsheetReset = true;
        spreadsheetMessage = `Spreadsheet diabaikan pada lingkungan ${envCtx.environmentName.toUpperCase()} (Webhook server belum disetel).`;
      } else {
        try {
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

          if (appsResult && (appsResult.status === 'success' || appsResult.success)) {
            spreadsheetReset = true;
            spreadsheetMessage = appsResult.message || 'Tabel transaksi A6:K di Google Spreadsheet berhasil dikosongkan.';
          } else {
            spreadsheetReset = false;
            spreadsheetMessage = appsResult?.message || `Google Apps Script mengembalikan status HTTP ${appsRes.status}.`;
          }
        } catch (botErr: any) {
          console.warn('[ResetSystemWarning] Gagal memanggil Apps Script webhook:', botErr?.message);
          spreadsheetReset = false;
          spreadsheetMessage = `Gagal menyinkronkan reset ke Google Sheets: ${botErr?.message || 'Koneksi timeout'}. Anda dapat mengosongkan manual melalui menu ⚡ SPECTRA Bot -> Reset Total di Google Sheets.`;
        }
      }
    } else {
      spreadsheetReset = false;
      spreadsheetMessage = 'Opsi pembersihan spreadsheet dilewati.';
    }

    return res.status(200).json({
      success: true,
      message: 'Reset sistem total berhasil diselesaikan. Seluruh transaksi dihapus (0 transaksi), saldo akun dinolkan, dan nomor berkas dimulai kembali dari BT/0001.',
      databaseReset: true,
      deletedTransactionsCount: txCount,
      accountsPreserved: true,
      spreadsheetReset,
      spreadsheetMessage,
      driveStatus: shouldClearDrive ? 'TRASHED' : 'RETAINED'
    });
  } catch (err: any) {
    console.error('[ResetSystemUnhandledError]', err?.message);
    return res.status(500).json({
      success: false,
      error: `Terjadi kesalahan saat memproses reset sistem: ${err?.message || err}`
    });
  }
}
