import { authenticateFinancialRequest } from '../_lib/financialAuth.js';
import { checkRateLimitCentralized, getClientIp } from '../_lib/rateLimit.js';
import crypto from 'crypto';

/**
 * POST /api/financial/spreadsheet-sync
 * Endpoint Vercel Serverless terautentikasi untuk menyinkronkan bukti transaksi ke Google Apps Script Bot.
 *
 * KEAMANAN TINGKAT TINGGI (ZERO-TRUST PROXY):
 * 1. Secret Bot (SPECTRA_BOT_SECRET) disimpan HANYA di environment server (tanpa fallback hardcode).
 * 2. URL Webhook (SPECTRA_SPREADSHEET_WEBHOOK_URL) dikonfigurasi HANYA dari server (Larang webhook arbitrer dari browser).
 * 3. Otorisasi Ketat: Wajib sesi aktif, validasi CSRF, dan pengguna wajib memiliki hak otorisasi keuangan / admin.
 * 4. Rate Limiting: Membatasi mutasi per pengguna/IP untuk mencegah spamming ke Google Workspace.
 * 5. Validasi Baris Presisi: Memeriksa struktur, batasan jumlah baris (maks 50), nominal finite/positif, nomor berkas, dan POS.
 * 6. Anti-Replay: Menerbitkan timestamp terverifikasi (toleransi 5 menit) dan nonce kriptografis unik.
 * 7. Audit Logging: Mencatat setiap sinkronisasi resmi ke tabel activity_logs.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // 1. Wajib autentikasi sesi, CSRF, dan otoritas keuangan (Staff biasa tanpa hak otorisasi DITOLAK)
  const auth = await authenticateFinancialRequest(req, res, {
    requireAuthority: true
  });
  if (!auth) return;

  const { supabase, dbUser } = auth;

  // 2. Rate Limiting (Maksimal 15 request per menit per pengguna)
  const clientIp = getClientIp(req);
  const rateKey = `sheet_sync_${dbUser.id || clientIp}`;
  const rateCheck = await checkRateLimitCentralized(rateKey, 15, 60 * 1000, supabase);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Batas frekuensi sinkronisasi spreadsheet terlampaui. Silakan tunggu beberapa saat.'
    });
  }

  const payload = req.body || {};
  const rows = payload.rows;

  // 3. Validasi Array Baris
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Array baris transaksi (rows) kosong atau tidak valid.'
    });
  }

  if (rows.length > 50) {
    return res.status(400).json({
      success: false,
      error: `Jumlah baris transaksi melebihi batas aman per batch (maksimal 50 baris, diterima: ${rows.length}).`
    });
  }

  // 4. Validasi Isi Setiap Baris (Fail-Closed)
  const sanitizedRows: any[] = [];
  const primaryRef = String(rows[0]?.nomorBerkas || 'BT').trim();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || typeof r !== 'object') {
      return res.status(400).json({
        success: false,
        error: `Baris transaksi #${i + 1} tidak valid atau bukan objek.`
      });
    }

    const nomorBerkas = String(r.nomorBerkas || primaryRef).trim();
    if (!nomorBerkas || nomorBerkas.length > 50) {
      return res.status(400).json({
        success: false,
        error: `Baris #${i + 1}: Nomor berkas tidak sah atau melebihi 50 karakter.`
      });
    }

    const namaTransaksi = String(r.namaTransaksi || r.nama || '').trim();
    if (!namaTransaksi || namaTransaksi.length > 200) {
      return res.status(400).json({
        success: false,
        error: `Baris #${i + 1}: Nama transaksi wajib diisi dan maksimal 200 karakter.`
      });
    }

    const hargaSatuan = r.hargaSatuan !== null && r.hargaSatuan !== undefined && r.hargaSatuan !== '' ? Number(r.hargaSatuan) : '';
    if (hargaSatuan !== '' && (!Number.isFinite(hargaSatuan) || isNaN(hargaSatuan) || hargaSatuan < 0)) {
      return res.status(400).json({
        success: false,
        error: `Baris #${i + 1}: Harga satuan tidak valid / negatif.`
      });
    }

    const kuantitas = r.kuantitas !== null && r.kuantitas !== undefined && r.kuantitas !== '' ? Number(r.kuantitas) : '';
    if (kuantitas !== '' && (!Number.isFinite(kuantitas) || isNaN(kuantitas) || kuantitas < 0)) {
      return res.status(400).json({
        success: false,
        error: `Baris #${i + 1}: Kuantitas tidak valid / negatif.`
      });
    }

    const hargaTotal = Number(r.hargaTotal || r.totalPrice || 0);
    if (!Number.isFinite(hargaTotal) || isNaN(hargaTotal) || hargaTotal < 0) {
      return res.status(400).json({
        success: false,
        error: `Baris #${i + 1}: Harga total tidak valid / negatif.`
      });
    }

    const pos = String(r.pos || 'A').trim();
    if (!pos || pos.length > 30) {
      return res.status(400).json({
        success: false,
        error: `Baris #${i + 1}: POS tidak valid.`
      });
    }

    const lineNo = r.no !== undefined && r.no !== null ? Number(r.no) : i + 1;
    sanitizedRows.push({
      rowId: `${nomorBerkas}#L${i + 1}`,
      itemIndex: i + 1,
      no: lineNo,
      tanggal: r.tanggal ? Number(r.tanggal) : new Date().getDate(),
      bulan: r.bulan ? Number(r.bulan) : new Date().getMonth() + 1,
      tahun: r.tahun ? Number(r.tahun) : new Date().getFullYear(),
      namaTransaksi,
      hargaSatuan,
      kuantitas,
      hargaTotal,
      nomorBerkas,
      linkBerkas: r.linkBerkas ? String(r.linkBerkas).trim() : '',
      pos
    });
  }

  // 5. Verifikasi URL Webhook Server-Side Saja (Larang input dari browser)
  const serverWebhookUrl = process.env.SPECTRA_SPREADSHEET_WEBHOOK_URL;
  if (!serverWebhookUrl || typeof serverWebhookUrl !== 'string' || !serverWebhookUrl.trim()) {
    return res.status(503).json({
      success: false,
      error: 'Sinkronisasi spreadsheet dinonaktifkan: URL Webhook server belum dikonfigurasi (Fail-Closed).'
    });
  }

  // Validasi format URL resmi Google Apps Script
  try {
    const urlObj = new URL(serverWebhookUrl.trim());
    if (urlObj.protocol !== 'https:') {
      return res.status(500).json({
        success: false,
        error: 'Konfigurasi Webhook server harus menggunakan protokol HTTPS aman.'
      });
    }
    if (urlObj.hostname !== 'script.google.com') {
      return res.status(500).json({
        success: false,
        error: 'Konfigurasi Webhook server harus mengarah ke host resmi script.google.com.'
      });
    }
    if (!urlObj.pathname.startsWith('/macros/s/')) {
      return res.status(500).json({
        success: false,
        error: 'Konfigurasi Webhook server harus mengarah ke endpoint web app /macros/s/.'
      });
    }
  } catch (urlErr) {
    return res.status(500).json({
      success: false,
      error: 'URL Webhook Google Apps Script di environment server tidak valid.'
    });
  }

  // 6. Secret Server-Side Saja (Tanpa Fallback Hardcode)
  const serverBotSecret = process.env.SPECTRA_BOT_SECRET;
  if (!serverBotSecret || typeof serverBotSecret !== 'string' || !serverBotSecret.trim()) {
    return res.status(503).json({
      success: false,
      error: 'Konfigurasi keamanan Google Apps Script backend belum lengkap (SPECTRA_BOT_SECRET tidak disetel di server).'
    });
  }

  try {
    const timestamp = new Date().toISOString();
    const nonce = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const idempotencyKey = `${primaryRef}#${sanitizedRows.length}#${crypto.createHash('sha256').update(JSON.stringify(sanitizedRows)).digest('hex').slice(0, 12)}`;

    const botPayload = {
      action: 'appendRows',
      secret: serverBotSecret,
      timestamp,
      nonce,
      idempotencyKey,
      rows: sanitizedRows
    };

    // Forward ke Google Apps Script Web App
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);

    const appsScriptResponse = await fetch(serverWebhookUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(botPayload),
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeoutId);

    const appsScriptResult: any = await appsScriptResponse.json().catch(() => null);

    if (appsScriptResult && (appsScriptResult.status === 'success' || appsScriptResult.success)) {
      // Catat Audit Log
      try {
        await supabase.from('activity_logs').insert({
          id: `log-sheet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toLocaleString('id-ID'),
          username: dbUser.username,
          full_name: dbUser.fullName,
          position: dbUser.position,
          action: 'Sinkronisasi Google Spreadsheet',
          detail: `Menyinkronkan ${sanitizedRows.length} baris untuk berkas ${primaryRef} (Tersimpan: ${appsScriptResult.insertedCount || sanitizedRows.length}, Diabaikan: ${appsScriptResult.skippedCount || 0})`
        });
      } catch (logErr) {
        console.warn('[SpreadsheetSync] Gagal mencatat activity log:', logErr);
      }

      return res.status(200).json({
        success: true,
        message: appsScriptResult.message || `Berhasil mengisi ${sanitizedRows.length} baris ke Google Spreadsheet mulai dari baris A6!`,
        insertedCount: appsScriptResult.insertedCount !== undefined ? appsScriptResult.insertedCount : sanitizedRows.length,
        skippedCount: appsScriptResult.skippedCount || 0,
        startRow: appsScriptResult.startRow,
        endRow: appsScriptResult.endRow
      });
    } else {
      return res.status(502).json({
        success: false,
        error: appsScriptResult?.message || `Google Apps Script mengembalikan respons gagal (HTTP ${appsScriptResponse.status}).`
      });
    }
  } catch (err: any) {
    console.error('[SpreadsheetSyncProxyError]', err?.message);
    return res.status(500).json({
      success: false,
      error: `Gagal meneruskan sinkronisasi ke Google Apps Script: ${err.message}`
    });
  }
}
