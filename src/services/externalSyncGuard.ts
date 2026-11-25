/**
 * SPECTRA External Sync Guard (Environment-Aware & Fail-Closed)
 * 
 * Modul keamanan untuk mengisolasi pengiriman data ke layanan pihak ketiga
 * (Google Drive & Google Spreadsheet) saat aplikasi berjalan pada lingkungan
 * non-produksi (Vercel Preview, Staging, Localhost, atau Branch Testing).
 * 
 * Prinsip:
 * 1. Fail-Closed: Secara default, jika bukan domain produksi resmi atau terhubung ke
 *    database Staging (xaafjvmdjdlfqdrljjlr), sinkronisasi ke folder Drive dan
 *    Spreadsheet perusahaan WAJIB DITAHAN (Mock/Dry-Run Mode).
 * 2. Transparansi: Pengguna diinformasikan dengan jelas bahwa data transaksi pengujian
 *    tidak akan mengotori Google Drive atau Spreadsheet resmi perusahaan.
 * 3. Tidak merusak fungsi produksi: Pada domain produksi resmi dan database produksi,
 *    seluruh fungsi sinkronisasi berjalan normal seperti sediakala.
 */

// Global build-time constant didefinisikan melalui vite.config.ts
declare const __VERCEL_ENV__: string | undefined;

export interface ExternalSyncStatus {
  isAllowed: boolean;
  isMockMode: boolean;
  environmentName: 'production' | 'preview' | 'staging' | 'local';
  reason: string;
}

/**
 * Cek apakah lingkungan saat ini adalah Production resmi.
 * Menggunakan pemisahan lingkungan yang terpercaya:
 * 1. Target database Supabase (Staging `xaafjvmdjdlfqdrljjlr` vs Production `drsqwxkkcfqvooqzoyvm`)
 * 2. Vercel build environment (`VERCEL_ENV`: 'production' vs 'preview' vs 'development')
 * 3. Pola hostname (preview branch / deployment hash vs canonical domain)
 */
export function getExternalSyncStatus(): ExternalSyncStatus {
  if (typeof window === 'undefined') {
    return {
      isAllowed: false,
      isMockMode: true,
      environmentName: 'local',
      reason: 'Server-side / non-browser runtime'
    };
  }

  const hostname = (window.location.hostname || '').toLowerCase();
  const viteSupabaseUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || '').toLowerCase();
  const vercelEnv = typeof __VERCEL_ENV__ !== 'undefined' ? __VERCEL_ENV__ : ((import.meta as any).env?.VITE_VERCEL_ENV || '');

  // 1. Deteksi Target Database Staging (Prioritas Tertinggi: jika DB adalah staging, PASTI bukan produksi)
  if (viteSupabaseUrl.includes('xaafjvmdjdlfqdrljjlr')) {
    return {
      isAllowed: false,
      isMockMode: true,
      environmentName: 'staging',
      reason: 'Terhubung ke database Staging (xaafjvmdjdlfqdrljjlr)'
    };
  }

  // 2. Deteksi Lingkungan Localhost / Dev
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return {
      isAllowed: false,
      isMockMode: true,
      environmentName: 'local',
      reason: 'Berjalan pada Local Development (Localhost)'
    };
  }

  // 3. Deteksi Vercel Preview secara terpercaya:
  // - Vercel build env eksplisit 'preview'
  // - Atau hostname mengandung branch preview (*-git-*) atau deployment hash spesifik preview
  const isVercelPreview = 
    vercelEnv === 'preview' || 
    hostname.includes('-git-') || 
    /^[a-z0-9-]+-[a-z0-9]{9,}-.+\.vercel\.app$/.test(hostname);

  if (isVercelPreview) {
    return {
      isAllowed: false,
      isMockMode: true,
      environmentName: 'preview',
      reason: 'Berjalan pada Vercel Preview / Branch Deployment'
    };
  }

  // 4. Jika terhubung ke database Production (drsqwxkkcfqvooqzoyvm) atau Vercel Production
  if (viteSupabaseUrl.includes('drsqwxkkcfqvooqzoyvm') || vercelEnv === 'production') {
    return {
      isAllowed: true,
      isMockMode: false,
      environmentName: 'production',
      reason: 'Lingkungan Production Resmi Terverifikasi'
    };
  }

  // 5. Fail-Closed Fallback: jika status ambigu, tahan sinkronisasi eksternal
  return {
    isAllowed: false,
    isMockMode: true,
    environmentName: 'staging',
    reason: 'Fail-closed: Lingkungan tidak terverifikasi sebagai Production resmi'
  };
}

/**
 * Cek cepat apakah sinkronisasi eksternal dinonaktifkan (Mock Mode)
 */
export function isExternalSyncDisabledOnPreview(): boolean {
  const status = getExternalSyncStatus();
  return status.isMockMode;
}
