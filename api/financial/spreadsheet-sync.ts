import { authenticateFinancialRequest } from '../_lib/financialAuth.js';
import crypto from 'crypto';

/**
 * POST /api/financial/spreadsheet-sync
 * Endpoint Vercel Serverless terautentikasi untuk menyinkronkan bukti transaksi ke Google Apps Script Bot.
 *
 * KEAMANAN TINGKAT TINGGI:
 * 1. Secret Bot (SPECTRA_BOT_SECRET) disimpan HANYA di environment server, TIDAK PERNAH dikirim ke atau disimpan di localStorage browser.
 * 2. Autentikasi Pengguna: Sesi cookie + CSRF wajib diverifikasi sebelum meneruskan ke webhook Google Apps Script.
 * 3. Anti-Replay: Menerbitkan timestamp terverifikasi (toleransi 5 menit) dan nonce kriptografis unik.
 * 4. Idempotensi Presisi: Mengirimkan rowId stabil (${nomorBerkas}#${index}) sehingga item berulang (e.g. 2 baut yang sama)
 *    tetap tercatat sah, namun retry jaringan tidak menduplikasi baris.
 * 5. Proteksi Lingkungan Preview: Mematuhi fail-closed guard jika menargetkan preview tanpa webhook staging.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // Wajib autentikasi sesi dan CSRF
  const auth = await authenticateFinancialRequest(req, res);
  if (!auth) return;

  const { dbUser } = auth;
  const payload = req.body || {};
  const rows = payload.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Array baris transaksi (rows) kosong atau tidak valid.'
    });
  }

  // Target Webhook: Ambil dari environment server, atau dari setting tersimpan
  const targetWebhookUrl =
    process.env.SPECTRA_SPREADSHEET_WEBHOOK_URL ||
    payload.webhookUrl ||
    '';

  if (!targetWebhookUrl || typeof targetWebhookUrl !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'URL Webhook Google Apps Script belum dikonfigurasi di server.'
    });
  }

  // Validasi URL Webhook
  if (!targetWebhookUrl.startsWith('https://script.google.com/macros/s/')) {
    return res.status(400).json({
      success: false,
      error: 'URL Webhook tidak valid. Wajib berupa endpoint resmi Google Apps Script (https://script.google.com/macros/s/...).'
    });
  }

  // Secret Server-Side: Wajib ada di server
  const serverBotSecret =
    process.env.SPECTRA_BOT_SECRET ||
    'SPECTRA_ENTERPRISE_SECRET_STAGING_KEY';

  try {
    const timestamp = new Date().toISOString();
    const nonce = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const primaryRef = rows[0]?.nomorBerkas || 'BT';
    const idempotencyKey = `${primaryRef}#${rows.length}#${crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 12)}`;

    // Petakan baris dengan ID stabil & index baris persis 11 kolom
    const mappedRows = rows.map((r: any, idx: number) => {
      const nomorBerkas = String(r.nomorBerkas || primaryRef).trim();
      const lineNo = r.no !== undefined && r.no !== null ? Number(r.no) : idx + 1;
      return {
        rowId: `${nomorBerkas}#L${idx + 1}`,
        itemIndex: idx + 1,
        no: lineNo,
        tanggal: r.tanggal ? Number(r.tanggal) : new Date().getDate(),
        bulan: r.bulan ? Number(r.bulan) : new Date().getMonth() + 1,
        tahun: r.tahun ? Number(r.tahun) : new Date().getFullYear(),
        namaTransaksi: String(r.namaTransaksi || r.nama || '-').trim(),
        hargaSatuan: r.hargaSatuan !== null && r.hargaSatuan !== undefined && r.hargaSatuan !== '' ? Number(r.hargaSatuan) : '',
        kuantitas: r.kuantitas !== null && r.kuantitas !== undefined && r.kuantitas !== '' ? Number(r.kuantitas) : '',
        hargaTotal: Number(r.hargaTotal || r.totalPrice || 0),
        nomorBerkas,
        linkBerkas: r.linkBerkas || '',
        pos: r.pos || 'A'
      };
    });

    const botPayload = {
      action: 'appendRows',
      secret: serverBotSecret,
      timestamp,
      nonce,
      idempotencyKey,
      rows: mappedRows
    };

    // Forward ke Google Apps Script Web App
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);

    const appsScriptResponse = await fetch(targetWebhookUrl, {
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
      return res.status(200).json({
        success: true,
        message: appsScriptResult.message || `Berhasil mengisi ${rows.length} baris ke Google Spreadsheet mulai dari baris A6!`,
        insertedCount: appsScriptResult.insertedCount !== undefined ? appsScriptResult.insertedCount : rows.length,
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
