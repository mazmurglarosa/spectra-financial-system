/**
 * SPECTRA Google Drive Storage Bot
 * 
 * Bertugas mengalihkan dan menyimpan berkas berukuran besar (foto background login,
 * background booting, logo beresolusi tinggi, dokumen bukti) ke Google Drive secara aman
 * melalui Backend Gateway Proxy (/api/financial/drive-upload):
 * 
 * Keamanan Enterprise:
 * 1. ZERO HARDCODED SECRET / CREDENTIALS di sisi browser client.
 * 2. Seluruh request diproxy melalui endpoint Vercel Serverless terautentikasi (/api/financial/drive-upload).
 * 3. Menjamin database Supabase selalu ultra-ringan (hanya beberapa kilobyte metadata link).
 * 4. Isolasi ketat: Preview & Staging diblokir dari folder / webhook Google Drive Production.
 */

import { isExternalSyncDisabledOnPreview, getExternalSyncStatus } from './externalSyncGuard';

// FOLDER 1: WEB ASSETS & SYSTEM SETTINGS ONLY (data_web)
export const SPECTRA_WEB_DRIVE_FOLDER_ID = '1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn';
export const SPECTRA_WEB_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn?usp=sharing';

// FOLDER 2: DATA HASIL TRANSAKSI RESMI (AUTO RECORD TRANSACTIONS)
export const SPECTRA_TRANSACTIONS_DRIVE_FOLDER_ID = '1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9';
export const SPECTRA_TRANSACTIONS_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9?usp=sharing';

// Default alias untuk aset web (backward compatibility)
export const SPECTRA_DRIVE_FOLDER_ID = SPECTRA_WEB_DRIVE_FOLDER_ID;
export const SPECTRA_DRIVE_FOLDER_URL = SPECTRA_WEB_DRIVE_FOLDER_URL;

export interface DriveUploadResponse {
  success: boolean;
  fileId?: string;
  directUrl?: string;
  viewUrl?: string;
  fileName?: string;
  error?: string;
  message?: string;
  isMocked?: boolean;
}

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)spectra_csrf=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  return sessionStorage.getItem('spectra_csrf') || localStorage.getItem('spectra_csrf') || '';
}

/**
 * Cek apakah string merupakan data Base64 panjang (data:image/...)
 */
export function isBase64DataUri(str?: string): boolean {
  if (!str) return false;
  return str.startsWith('data:') && str.length > 500;
}

/**
 * Format link direct image Google Drive berkecepatan tinggi
 */
export function formatDriveDirectUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

/**
 * Unggah berkas berat (Base64 atau Blob) ke Google Drive secara aman via Backend Gateway Proxy
 */
export async function uploadHeavyFileToDrive(
  base64OrDataUri: string,
  fileName: string,
  mimeType = 'image/jpeg',
  options?: {
    documentCode?: string;
    title?: string;
    uploadedBy?: string;
    folderId?: string;
  }
): Promise<DriveUploadResponse> {
  // 1. FAIL-CLOSED ENVIRONMENT GUARD
  // Pada Vercel Preview, Staging DB, atau Localhost, isolasi Google Drive perusahaan asli
  if (isExternalSyncDisabledOnPreview()) {
    const status = getExternalSyncStatus();
    console.info(`[ISOLASI ${status.environmentName.toUpperCase()}] uploadHeavyFileToDrive dialihkan ke mock aman. Alasan: ${status.reason}`);
    const mockFileId = `mock_preview_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      fileId: mockFileId,
      directUrl: formatDriveDirectUrl(mockFileId),
      viewUrl: `https://drive.google.com/file/d/${mockFileId}/view`,
      fileName: fileName,
      message: `[Simulasi Preview - Data Perusahaan Aman] Pengunggahan ke Google Drive dialihkan ke mock pada lingkungan ${status.environmentName.toUpperCase()}.`,
      isMocked: true
    };
  }

  try {
    const cleanBase64 = base64OrDataUri.includes(',')
      ? base64OrDataUri.split(',')[1]
      : base64OrDataUri;

    const targetFolderId = options?.folderId || SPECTRA_DRIVE_FOLDER_ID;

    const payload = {
      folderId: targetFolderId,
      fileName: fileName,
      mimeType: mimeType,
      base64: cleanBase64,
      documentCode: options?.documentCode || 'SPECTRA-STORAGE',
      title: options?.title || fileName,
      uploadedBy: options?.uploadedBy || 'SPECTRA Auto-Bot'
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const csrf = getCsrfToken();
    const response = await fetch('/api/financial/drive-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      credentials: 'include',
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const result = await response.json().catch(() => null);

    if (response.ok && result && (result.success || result.status === 'success')) {
      const fileId = result.fileId;
      return {
        success: true,
        fileId: fileId,
        directUrl: result.directUrl || formatDriveDirectUrl(fileId),
        viewUrl: result.viewUrl || `https://drive.google.com/file/d/${fileId}/view`,
        fileName: result.fileName || fileName,
        message: result.message || 'Berkas berhasil dialihkan & tersimpan di Google Drive!',
        isMocked: result.isMocked || false
      };
    } else {
      return {
        success: false,
        error: result?.error || result?.message || `Gagal mengunggah berkas via server proxy (HTTP ${response.status}).`
      };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'Permintaan unggah ke Google Drive melampaui batas waktu (timeout 30 detik).'
      };
    }
    return {
      success: false,
      error: `Gagal menghubungi server proxy Google Drive: ${err?.message || err}`
    };
  }
}
