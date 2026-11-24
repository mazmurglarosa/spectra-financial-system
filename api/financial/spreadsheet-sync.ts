import { authenticateFinancialRequest } from '../_lib/financialAuth.js';
import { checkRateLimitCentralized, getClientIp } from '../_lib/rateLimit.js';
import crypto from 'crypto';

// Known Production Webhook Identifiers (Blacklist untuk lingkungan non-produksi)
const KNOWN_PRODUCTION_DEPLOYMENT_IDS = new Set([
  'AKfycbweEADkAMfpyBXO4j1dBqPTACdrjkR5Pke90h9YxNRGchvA25xP_6JKXHl8e5LPd6bT'
]);

export function detectServerEnvironment(req: any, supabaseUrl?: string): {
  isProduction: boolean;
  isStagingOrPreview: boolean;
  environmentName: 'production' | 'preview' | 'staging' | 'development' | 'test';
  reasons: string[];
} {
  const reasons: string[] = [];
  const vercelEnv = (process.env.VERCEL_ENV || '').toLowerCase().trim();
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').toLowerCase().trim();
  const activeDbUrl = (supabaseUrl || process.env.SUPABASE_URL || '').toLowerCase().trim();

  const isStagingDb = activeDbUrl.includes('xaafjvmdjdlfqdrljjlr');
  const isProdDb = activeDbUrl.includes('drsqwxkkcfqvooqzoyvm');

  const isVercelPreview = vercelEnv === 'preview';
  const isVercelProd = vercelEnv === 'production';
  const isPreviewHost = host.includes('-git-') || /^[a-z0-9-]+-[a-z0-9]{9,}-.+\.vercel\.app$/.test(host);
  const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('::1') || host === '';

  // Multi-Factor Check: Strict Production mewajibkan VERCEL_ENV=production, Database Production, dan domain non-preview
  const isStrictProduction = isVercelProd && isProdDb && !isStagingDb && !isPreviewHost && !isLocalHost;

  let environmentName: 'production' | 'preview' | 'staging' | 'development' | 'test' = 'preview';

  if (isStrictProduction) {
    environmentName = 'production';
    reasons.push('VERCEL_ENV=production, Production Database, non-preview host');
  } else if (isVercelPreview || isPreviewHost) {
    environmentName = 'preview';
    reasons.push('Vercel Preview environment / preview host');
  } else if (isStagingDb) {
    environmentName = 'staging';
    reasons.push('Supabase Staging (xaafjvmdjdlfqdrljjlr) terhubung');
  } else if (isLocalHost || nodeEnv === 'test') {
    environmentName = 'test';
    reasons.push('Localhost / Test runner environment');
  } else {
    environmentName = 'preview';
    reasons.push('Default secure fail-closed environment');
  }

  return {
    isProduction: isStrictProduction,
    isStagingOrPreview: !isStrictProduction,
    environmentName,
    reasons
  };
}

/**
 * POST /api/financial/spreadsheet-sync
 * Endpoint Vercel Serverless terautentikasi untuk menyinkronkan bukti transaksi ke Google Apps Script Bot.
 *
 * KEAMANAN TINGKAT TINGGI (ZERO-TRUST PROXY & ISOLASI LINGKUNGAN):
 * 1. Isolasi Lingkungan Backend Eksplisit:
 *    - Preview & Staging hanya boleh mengakses Webhook Staging.
 *    - Penolakan mutlak jika konfigurasi Preview mengarah ke deployment Google Production (HTTP 403).
 *    - Fail-closed (HTTP 503) jika konfigurasi Staging tidak tersedia.
 * 2. Secret Bot disimpan HANYA di environment server (tanpa fallback hardcode).
 * 3. URL Webhook dikonfigurasi HANYA dari server (Larang webhook arbitrer dari browser).
 * 4. Otorisasi Ketat: Wajib sesi aktif, validasi CSRF, dan pengguna wajib memiliki hak otorisasi keuangan / admin.
 * 5. Rate Limiting: Membatasi mutasi per pengguna/IP untuk mencegah spamming ke Google Workspace.
 * 6. Validasi Baris Presisi: Memeriksa struktur, batasan jumlah baris (maks 50), nominal finite/positif, nomor berkas, dan POS.
 * 7. Anti-Replay: Menerbitkan timestamp terverifikasi (toleransi 5 menit) dan nonce kriptografis unik.
 * 8. Audit Logging: Mencatat setiap sinkronisasi resmi ke tabel activity_logs.
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

  // 5. Isolasi Lingkungan & Resolusi Webhook Server-Side
  const envCtx = detectServerEnvironment(req, (supabase as any)?.supabaseUrl);

  let targetWebhookUrl = '';
  let targetBotSecret = '';

  if (envCtx.isProduction) {
    targetWebhookUrl = (process.env.SPECTRA_SPREADSHEET_WEBHOOK_URL_PRODUCTION || process.env.SPECTRA_SPREADSHEET_WEBHOOK_URL || '').trim();
    targetBotSecret = (process.env.SPECTRA_BOT_SECRET_PRODUCTION || process.env.SPECTRA_BOT_SECRET || '').trim();

    if (!targetWebhookUrl || !targetBotSecret) {
      return res.status(503).json({
        success: false,
        error: 'Konfigurasi Google Workspace Production belum lengkap di server (SPECTRA_SPREADSHEET_WEBHOOK_URL_PRODUCTION / SPECTRA_BOT_SECRET_PRODUCTION belum disetel).'
      });
    }
  } else {
    // PREVIEW / STAGING / TEST: Wajib mengarah ke resource Staging
    targetWebhookUrl = (process.env.SPECTRA_SPREADSHEET_WEBHOOK_URL_STAGING || process.env.SPECTRA_SPREADSHEET_WEBHOOK_URL || '').trim();
    targetBotSecret = (process.env.SPECTRA_BOT_SECRET_STAGING || process.env.SPECTRA_BOT_SECRET || '').trim();

    if (!targetWebhookUrl || !targetBotSecret) {
      return res.status(503).json({
        success: false,
        error: `Sinkronisasi spreadsheet dinonaktifkan pada lingkungan ${envCtx.environmentName.toUpperCase()}: Webhook Google Workspace Staging belum dikonfigurasi (Fail-Closed demi melindungi data perusahaan).`
      });
    }

    // PROTEKSI MUTLAK: Tolak jika Preview/Staging mengarah ke URL Production
    const prodWebhookUrl = (process.env.SPECTRA_SPREADSHEET_WEBHOOK_URL_PRODUCTION || '').trim();
    if (prodWebhookUrl && targetWebhookUrl === prodWebhookUrl) {
      return res.status(403).json({
        success: false,
        error: `Isolasi Lingkungan Aktif: Lingkungan ${envCtx.environmentName.toUpperCase()} DITOLAK mengarah ke Webhook Google Apps Script Production demi mencegah data percobaan masuk ke spreadsheet resmi.`
      });
    }
  }

  // Validasi Format & Ekstraksi Deployment ID
  let deploymentId = '';
  try {
    const urlObj = new URL(targetWebhookUrl);
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
    const match = urlObj.pathname.match(/^\/macros\/s\/([a-zA-Z0-9_-]+)\/exec$/);
    if (!match || !match[1]) {
      return res.status(500).json({
        success: false,
        error: 'Format endpoint Google Apps Script harus berformat /macros/s/{deploymentId}/exec.'
      });
    }
    deploymentId = match[1];
  } catch (urlErr) {
    return res.status(500).json({
      success: false,
      error: 'URL Webhook Google Apps Script di environment server tidak valid.'
    });
  }

  // Jika di lingkungan non-produksi, pastikan deploymentId bukan ID deployment Production yang di-blacklist
  if (!envCtx.isProduction && KNOWN_PRODUCTION_DEPLOYMENT_IDS.has(deploymentId)) {
    return res.status(403).json({
      success: false,
      error: `Isolasi Lingkungan Aktif: Deployment ID "${deploymentId}" adalah resource Google Production. Pengiriman dari lingkungan ${envCtx.environmentName.toUpperCase()} diblokir ketat.`
    });
  }

  try {
    const timestamp = new Date().toISOString();
    const nonce = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const idempotencyKey = `${primaryRef}#${sanitizedRows.length}#${crypto.createHash('sha256').update(JSON.stringify(sanitizedRows)).digest('hex').slice(0, 12)}`;

    const botPayload = {
      action: 'appendRows',
      secret: targetBotSecret,
      timestamp,
      nonce,
      idempotencyKey,
      rows: sanitizedRows
    };

    // Forward ke Google Apps Script Web App
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);

    const appsScriptResponse = await fetch(targetWebhookUrl.trim(), {
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
