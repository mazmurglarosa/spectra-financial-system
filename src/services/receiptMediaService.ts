/**
 * SPECTRA Receipt Media Service
 * Utilitas optimasi gambar struk dan konversi PDF ke gambar berbasis canvas (PDF.js)
 * 
 * Fitur:
 * 1. Optimasi & kompresi cerdas gambar (JPEG/PNG/WebP/kamera) agar di bawah batas Vercel 4.5MB tanpa mengurangi keterbacaan angka kecil.
 * 2. Ekstraksi halaman PDF menjadi gambar JPEG beresolusi tinggi menggunakan PDF.js.
 * 3. Batas aman multi-halaman (maksimal 5 halaman) dengan penanganan error terenkripsi/rusak tanpa crash.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Inisialisasi worker PDF.js dengan URL aset yang kompatibel dengan browser Vite dan runtime Node/SSR
if (typeof window !== 'undefined' && (pdfjsLib as any).GlobalWorkerOptions) {
  try {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // Fallback URL jika resolving lokal terhalang
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${(pdfjsLib as any).version || '4.0.379'}/build/pdf.worker.min.mjs`;
  }
}

export interface PdfConversionOptions {
  maxPages?: number;
  scale?: number;
  onProgress?: (current: number, total: number) => void;
}

export interface PdfConversionResult {
  success: boolean;
  pageImages: string[]; // Array of JPEG Data URIs
  totalPages: number;
  renderedPages: number;
  error?: string;
  warning?: string;
}

/**
 * Cek apakah string merupakan Data URI PDF
 */
export function isPdfDataUri(dataUri: string): boolean {
  if (!dataUri) return false;
  return dataUri.startsWith('data:application/pdf') || dataUri.startsWith('data:application/x-pdf');
}

/**
 * Cek apakah berkas merupakan PDF berdasarkan ekstensi atau MIME type
 */
export function isPdfFile(fileName: string, mimeType?: string): boolean {
  if (mimeType && (mimeType === 'application/pdf' || mimeType === 'application/x-pdf')) {
    return true;
  }
  return fileName.toLowerCase().endsWith('.pdf');
}

/**
 * Mengubah Data URI Base64 menjadi Uint8Array
 */
export function dataUriToUint8Array(dataUri: string): Uint8Array {
  const base64Index = dataUri.indexOf(';base64,');
  const base64 = base64Index !== -1 ? dataUri.substring(base64Index + 8) : dataUri;
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Optimasi dan kompresi gambar struk (JPEG/PNG/WebP)
 * - Membatasi dimensi maksimum (default 2048px)
 * - Mengompresi hanya jika ukuran melebihi ambang batas (1.5 MB)
 * - Menjaga ketajaman font/angka rupiah kecil
 */
export async function optimizeReceiptImage(
  dataUri: string,
  options: { maxDimension?: number; targetMaxBytes?: number; quality?: number } = {}
): Promise<string> {
  // Jika PDF, jangan sentuh
  if (isPdfDataUri(dataUri)) return dataUri;

  const maxDimension = options.maxDimension || 2048;
  const targetMaxBytes = options.targetMaxBytes || 2 * 1024 * 1024; // 2 MB target (sangat aman dari batas Vercel 4.5MB)
  const quality = options.quality || 0.88;

  // Periksa perkiraan ukuran data URI saat ini
  const approximateSize = (dataUri.length * 3) / 4;
  if (approximateSize <= targetMaxBytes && !dataUri.startsWith('data:image/bmp')) {
    // Ukuran sudah cukup kecil, tidak perlu di-recompress kecuali gambar sangat besar dimensinya
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Cek apakah dimensi perlu di-downscale dengan menjaga aspek rasio struk panjang (thermal tape)
      let needsResize = false;
      const aspectRatio = height / width;

      // Untuk struk belanja thermal yang sangat panjang (tinggi >> lebar), beri ruang vertikal hingga 4096px
      // agar teks kecil dan angka sen tidak buram
      let effectiveMaxDim = maxDimension;
      if (aspectRatio > 2.5 && height > 2048) {
        effectiveMaxDim = 4096;
      }

      if (width > maxDimension || height > effectiveMaxDim) {
        needsResize = true;
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * effectiveMaxDim) / height);
          height = effectiveMaxDim;
        }
      }

      // Jika ukuran sudah aman dan dimensi tidak melebihi batas, kembalikan asli
      if (!needsResize && approximateSize <= targetMaxBytes) {
        resolve(dataUri);
        return;
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { willReadFrequently: false });
        if (!ctx) {
          resolve(dataUri);
          return;
        }

        // Terapkan rendering berkualitas tinggi
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Ekspor ke JPEG dengan kualitas terkalibrasi (0.88 tajam untuk struk thermal / HTR)
        const optimizedDataUri = canvas.toDataURL('image/jpeg', quality);
        resolve(optimizedDataUri);
      } catch (e) {
        console.warn('Canvas optimization fallback to original:', e);
        resolve(dataUri);
      }
    };

    img.onerror = () => {
      resolve(dataUri);
    };

    img.src = dataUri;
  });
}

/**
 * Merender halaman-halaman PDF menjadi array gambar JPEG Data URI
 * Menggunakan PDF.js di browser
 */
export async function convertPdfToImages(
  pdfDataUri: string,
  options: PdfConversionOptions = {}
): Promise<PdfConversionResult> {
  const maxPages = options.maxPages || 10; // Batas maksimal aman 10 halaman
  const targetScale = options.scale || 1.8; // Skala 1.8 menghasilkan ~150-200 DPI (sangat tajam untuk OCR struk/faktur)

  try {
    const pdfData = dataUriToUint8Array(pdfDataUri);

    // Muat dokumen PDF dengan PDF.js
    const loadingTask = pdfjsLib.getDocument({
      data: pdfData,
      useSystemFonts: true,
      stopAtErrors: false
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    if (totalPages === 0) {
      return {
        success: false,
        pageImages: [],
        totalPages: 0,
        renderedPages: 0,
        error: 'Dokumen PDF kosong atau tidak memiliki halaman yang dapat dibaca.'
      };
    }

    // STRICT INTEGRITY GUARD:
    // Jika jumlah halaman melebihi batas aman, TOLAK seluruhnya dan JANGAN proses parsial!
    // Ini mencegah data transaksi, total, pajak, atau biaya hilang karena halaman terlewati.
    if (totalPages > maxPages) {
      return {
        success: false,
        pageImages: [],
        totalPages: totalPages,
        renderedPages: 0,
        error: `Dokumen PDF memiliki ${totalPages} halaman (melebihi batas maksimal aman ${maxPages} halaman). Demi integritas pembukuan dan mencegah data transaksi hilang karena pemrosesan parsial, sistem menolak pemrosesan. Silakan unggah berkas dengan maksimal ${maxPages} halaman.`
      };
    }

    const pagesToRender = totalPages;
    const pageImages: string[] = [];

    for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
      options.onProgress?.(pageNum, pagesToRender);

      const page = await pdfDoc.getPage(pageNum);
      const initialViewport = page.getViewport({ scale: targetScale });

      // Hitung skala adaptif jika halaman terlalu besar (> 2400px)
      let scale = targetScale;
      const maxSide = Math.max(initialViewport.width, initialViewport.height);
      if (maxSide > 2400) {
        scale = targetScale * (2400 / maxSide);
      }

      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error(`Gagal membuat konteks canvas 2D untuk halaman PDF ${pageNum}`);
      }

      // Background putih bersih untuk nota/faktur
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvas: canvas,
        canvasContext: ctx,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Ekspor ke JPEG dengan kualitas tajam
      const jpegDataUri = canvas.toDataURL('image/jpeg', 0.90);
      pageImages.push(jpegDataUri);
    }

    return {
      success: true,
      pageImages,
      totalPages,
      renderedPages: pageImages.length
    };
  } catch (err: any) {
    console.error('PDF.js conversion error:', err);

    let friendlyError = 'Gagal memproses dokumen PDF.';
    const errMsg = err?.message || String(err);

    if (err?.name === 'PasswordException' || errMsg.includes('password')) {
      friendlyError = 'Dokumen PDF terenkripsi atau dilindungi kata sandi. Harap gunakan PDF yang tidak terkunci.';
    } else if (errMsg.includes('Invalid PDF structure') || errMsg.includes('corrupted')) {
      friendlyError = 'Struktur dokumen PDF rusak atau tidak valid.';
    } else {
      friendlyError = `Gagal membaca dokumen PDF: ${errMsg}`;
    }

    return {
      success: false,
      pageImages: [],
      totalPages: 0,
      renderedPages: 0,
      error: friendlyError
    };
  }
}
