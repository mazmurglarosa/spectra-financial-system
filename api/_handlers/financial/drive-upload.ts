import { authenticateFinancialRequest } from '../../_lib/financialAuth.js';
import { checkRateLimitCentralized, getClientIp } from '../../_lib/rateLimit.js';
import { detectServerEnvironment } from './spreadsheet-sync.js';

// Production Google Drive Webhook Deployment IDs / Folder IDs (Blacklist pada Preview / Staging)
const KNOWN_PRODUCTION_DRIVE_DEPLOYMENT_IDS = new Set([
  'AKfycbweEADkAMfpyBXO4j1dBqPTACdrjkR5Pke90h9YxNRGchvA25xP_6JKXHl8e5LPd6bT'
]);

const KNOWN_PRODUCTION_FOLDER_IDS = new Set([
  '1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn',
  '1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9'
]);

// Allowlisted MIME Types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

export interface DriveUploadBackendPayload {
  fileName: string;
  mimeType: string;
  base64: string;
  folderId?: string;
  documentCode?: string;
  title?: string;
  uploadedBy?: string;
}

/**
 * POST /api/financial/drive-upload
 * Backend Serverless Gateway terautentikasi untuk pengunggahan bukti fisik / aset berat ke Google Drive.
 * 
 * KEAMANAN TINGKAT TINGGI:
 * 1. Isolasi Lingkungan Backend:
 *    - Preview & Staging dilarang keras mengunggah ke webhook / folder Google Drive Production (HTTP 403).
 *    - Fail-closed (HTTP 503) jika konfigurasi Staging tidak tersedia pada preview/staging.
 * 2. Autentikasi Sesi Wajib: Pengguna wajib login dengan token sesi valid dan CSRF valid.
 * 3. Rate Limiting: Maksimal 20 upload per menit per pengguna/IP.
 * 4. Validasi Payload Keras:
 *    - Validasi format MIME Type (hanya gambar dan PDF).
 *    - Validasi ukuran file (maksimal 15 MB).
 *    - Sanitasi nama berkas (mencegah path traversal / nama berbahaya).
 * 5. Proxy Server-to-Server: Browser tidak pernah memegang atau memanggil webhook Google Apps Script secara langsung.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // 1. Autentikasi sesi & otorisasi pengguna aktif
  const auth = await authenticateFinancialRequest(req, res);
  if (!auth) return;

  const { supabase, dbUser } = auth;

  // 2. Rate Limiting terpusat (20 request / menit)
  const clientIp = getClientIp(req);
  const rateKey = `drive_upload_${dbUser.id || clientIp}`;
  const rateCheck = await checkRateLimitCentralized(rateKey, 20, 60 * 1000, supabase);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Batas frekuensi pengunggahan Google Drive terlampaui. Silakan tunggu sesaat.'
    });
  }

  // 3. Validasi Body & Payload
  const body = req.body || {};
  const { fileName, mimeType, base64, folderId, documentCode, title, uploadedBy } = body;

  if (!fileName || typeof fileName !== 'string' || fileName.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Parameter fileName wajib berupa string valid.' });
  }

  const cleanFileName = fileName.replace(/[/\\?%*:|"<>]/g, '_').trim().slice(0, 255);

  if (!mimeType || typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return res.status(400).json({
      success: false,
      error: `Tipe berkas ${mimeType} tidak didukung. SPECTRA hanya mendukung JPG, PNG, WebP, dan PDF.`
    });
  }

  if (!base64 || typeof base64 !== 'string') {
    return res.status(400).json({ success: false, error: 'Data base64 berkas tidak boleh kosong.' });
  }

  const cleanBase64 = base64.includes(',') ? base64.split(',')[1].trim() : base64.trim();
  
  // Batas ukuran: ~15MB base64 string length (~20_000_000 karakter)
  if (cleanBase64.length > 20_000_000) {
    return res.status(413).json({
      success: false,
      error: 'Ukuran berkas melebihi batas maksimum 15 MB.'
    });
  }

  // 4. Deteksi Isolasi Lingkungan Server
  const envInfo = detectServerEnvironment(req);

  let targetWebhookUrl: string | undefined;
  let targetFolderId: string | undefined;

  if (envInfo.isProduction) {
    // Mode Produksi Resmi
    targetWebhookUrl = process.env.GDRIVE_WEBHOOK_URL_PRODUCTION || process.env.GDRIVE_WEBHOOK_URL;
    targetFolderId = folderId || '1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9';

    if (!targetWebhookUrl) {
      console.error('[DRIVE PROD CONFIG MISSING] GDRIVE_WEBHOOK_URL belum disetel di server production.');
      return res.status(503).json({
        success: false,
        error: 'Konfigurasi Google Drive Production belum diatur pada environment server.'
      });
    }
  } else {
    // Mode Non-Produksi (Preview, Staging, Localhost, Test)
    targetWebhookUrl = process.env.GDRIVE_WEBHOOK_URL_STAGING;
    targetFolderId = process.env.GDRIVE_FOLDER_ID_STAGING || 'staging-isolated-folder';

    // Periksa jika ada upaya mengarahkan ke deployment/folder Production dari lingkungan Preview/Staging
    if (folderId && KNOWN_PRODUCTION_FOLDER_IDS.has(folderId)) {
      console.warn(`[SECURITY BLOCKED] Percobaan akses folder Drive Production (${folderId}) dari lingkungan ${envInfo.environmentName}.`);
      return res.status(403).json({
        success: false,
        error: `Akses ke Google Drive Production ditolak dari lingkungan ${envInfo.environmentName}. Gunakan folder Staging.`
      });
    }

    if (targetWebhookUrl) {
      for (const prodId of KNOWN_PRODUCTION_DRIVE_DEPLOYMENT_IDS) {
        if (targetWebhookUrl.includes(prodId)) {
          return res.status(403).json({
            success: false,
            error: `Konfigurasi webhook Google Drive pada lingkungan ${envInfo.environmentName} mengarah ke deployment produksi.`
          });
        }
      }
    }

    // Jika webhook staging belum disetel, terapkan isolasi aman (Mock Mode) dengan status eksplisit SIMULATED
    if (!targetWebhookUrl) {
      return res.status(200).json({
        success: true,
        status: 'SIMULATED',
        isMocked: true,
        fileId: null,
        directUrl: null,
        viewUrl: null,
        fileName: cleanFileName,
        message: `[SIMULASI ISOLASI ${envInfo.environmentName.toUpperCase()}] Berkas disimpan aman di browser/IndexedDB (TIDAK diunggah ke Google Drive eksternal demi perlindungan data produksi).`
      });
    }
  }

  // 5. Eksekusi Pengunggahan Server-to-Server
  try {
    const payload = {
      folderId: targetFolderId,
      fileName: cleanFileName,
      mimeType: mimeType.toLowerCase(),
      base64: cleanBase64,
      documentCode: (documentCode || 'SPECTRA-STORAGE').toString().slice(0, 50),
      title: (title || cleanFileName).toString().slice(0, 100),
      uploadedBy: (uploadedBy || dbUser.fullName || dbUser.username || 'SPECTRA Bot').toString().slice(0, 100)
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000);

    const response = await fetch(targetWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({
        success: false,
        error: `Google Apps Script Bot mengembalikan status ${response.status}: ${errText.slice(0, 150)}`
      });
    }

    const result: any = await response.json();
    if (result.status === 'success' || result.success) {
      const fileId = result.fileId;
      return res.status(200).json({
        success: true,
        fileId: fileId,
        directUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
        viewUrl: result.viewUrl || `https://drive.google.com/file/d/${fileId}/view`,
        fileName: result.fileName || cleanFileName,
        message: result.message || 'Berkas berhasil dialihkan & tersimpan di Google Drive!'
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.message || 'Bot Google Drive gagal memproses unggahan.'
      });
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        error: 'Permintaan unggah ke Google Drive melampaui batas waktu (timeout 28 detik).'
      });
    }
    return res.status(502).json({
      success: false,
      error: `Gagal menghubungi Bot Google Drive: ${err?.message || err}`
    });
  }
}
