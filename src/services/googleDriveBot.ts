/**
 * SPECTRA Google Drive Storage Bot
 * 
 * Bertugas mengalihkan dan menyimpan berkas berukuran besar (foto background login,
 * background booting, logo beresolusi tinggi, dokumen bukti) langsung ke Google Drive:
 * https://drive.google.com/drive/folders/1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn?usp=sharing
 * 
 * Tujuan:
 * 1. Menjaga database Supabase selalu ultra-ringan (hanya beberapa kilobyte)
 * 2. Supabase hanya mencatat metadata teks (URL link) dan histori aktivitas
 * 3. Kapasitas database Supabase dijamin jauh di bawah ambang batas gratis (500 MB)
 */

export const SPECTRA_DRIVE_FOLDER_ID = '1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn';
export const SPECTRA_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn?usp=sharing';
export const GDRIVE_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbweEADkAMfpyBXO4j1dBqPTACdrjkR5Pke90h9YxNRGchvA25xP_6JKXHl8e5LPd6bT/exec';

export interface DriveUploadResponse {
  success: boolean;
  fileId?: string;
  directUrl?: string;
  viewUrl?: string;
  fileName?: string;
  error?: string;
  message?: string;
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
 * Unggah berkas berat (Base64 atau Blob) langsung ke folder Google Drive resmi via Bot
 */
export async function uploadHeavyFileToDrive(
  base64OrDataUri: string,
  fileName: string,
  mimeType = 'image/jpeg',
  options?: {
    documentCode?: string;
    title?: string;
    uploadedBy?: string;
  }
): Promise<DriveUploadResponse> {
  try {
    const cleanBase64 = base64OrDataUri.includes(',')
      ? base64OrDataUri.split(',')[1]
      : base64OrDataUri;

    const payload = {
      folderId: SPECTRA_DRIVE_FOLDER_ID,
      fileName: fileName,
      mimeType: mimeType,
      base64: cleanBase64,
      documentCode: options?.documentCode || 'SPECTRA-STORAGE',
      title: options?.title || fileName,
      uploadedBy: options?.uploadedBy || 'SPECTRA Auto-Bot'
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(GDRIVE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeoutId);

    const result = await response.json();
    if (result.status === 'success' || result.success) {
      const fileId = result.fileId;
      const directUrl = formatDriveDirectUrl(fileId);
      return {
        success: true,
        fileId: fileId,
        directUrl: directUrl,
        viewUrl: result.viewUrl || `https://drive.google.com/file/d/${fileId}/view`,
        fileName: result.fileName || fileName,
        message: result.message || 'Berkas berhasil dialihkan & tersimpan di Google Drive!'
      };
    } else {
      return {
        success: false,
        error: result.message || 'Bot Google Drive gagal memproses unggahan.'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: `Gagal menghubungkan ke Bot Google Drive: ${err?.message || err}`
    };
  }
}
