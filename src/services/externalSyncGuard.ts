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

export interface SyncGuardContext {
  hostname?: string;
  supabaseUrl?: string;
  vercelEnv?: string;
}

export const APPROVED_PRODUCTION_DOMAINS: readonly string[] = [
  'spectra-financial-system.vercel.app',
  'spectra.nirwanabhumi.co.id',
  'spectra.my.id',
  'www.spectra.my.id'
];

export const PRODUCTION_SUPABASE_PROJECT = 'drsqwxkkcfqvooqzoyvm';
export const STAGING_SUPABASE_PROJECT = 'xaafjvmdjdlfqdrljjlr';

/**
 * Cek apakah hostname merupakan domain Production resmi yang disetujui.
 */
export function isProductionDomain(hostname: string | undefined): boolean {
  if (!hostname) return false;
  const clean = hostname.trim().toLowerCase();
  return APPROVED_PRODUCTION_DOMAINS.includes(clean);
}

/**
 * Evaluasi status sinkronisasi eksternal.
 *
 * Aturan Ketat Produksi:
 * Production HANYA aktif jika ketiga syarat terpenuhi serentak:
 * 1. vercelEnv === 'production'
 * 2. isProductionDomain(hostname) === true
 * 3. viteSupabaseUrl mengandung project Production 'drsqwxkkcfqvooqzoyvm'
 *
 * Semua kondisi selain itu WAJIB FAIL-CLOSED (Mock Mode / Isolasi Pengujian).
 */
export function getExternalSyncStatus(override?: SyncGuardContext): ExternalSyncStatus {
  const isBrowser = typeof window !== 'undefined';

  if (!isBrowser && !override) {
    return {
      isAllowed: false,
      isMockMode: true,
      environmentName: 'local',
      reason: 'Server-side / non-browser runtime'
    };
  }

  const hostname = (
    override?.hostname !== undefined
      ? override.hostname
      : (isBrowser ? window.location.hostname : '')
  ).toLowerCase().trim();

  const viteSupabaseUrl = (
    override?.supabaseUrl !== undefined
      ? override.supabaseUrl
      : (((typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || '') as string)
  ).toLowerCase().trim();

  const vercelEnv = (
    override?.vercelEnv !== undefined
      ? override.vercelEnv
      : (
          typeof __VERCEL_ENV__ !== 'undefined' && __VERCEL_ENV__
            ? __VERCEL_ENV__
            : ((typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_VERCEL_ENV) || '')
        )
  ).trim();

  // 1. Deteksi Target Database Staging (Prioritas Tertinggi: jika DB adalah staging, PASTI bukan produksi)
  if (viteSupabaseUrl.includes(STAGING_SUPABASE_PROJECT)) {
    return {
      isAllowed: false,
      isMockMode: true,
      environmentName: 'staging',
      reason: `Terhubung ke database Staging (${STAGING_SUPABASE_PROJECT})`
    };
  }

  // 2. Deteksi Lingkungan Localhost / Dev
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]'
  ) {
    return {
      isAllowed: false,
      isMockMode: true,
      environmentName: 'local',
      reason: 'Berjalan pada Local Development (Localhost)'
    };
  }

  // 3. Deteksi Vercel Preview & Non-Canonical Deployments:
  // - Vercel build env eksplisit 'preview'
  // - Hostname mengandung git branch preview (*-git-*)
  // - Domain *.vercel.app selain domain canonical yang disetujui
  const isVercelDomain = hostname.endsWith('.vercel.app');
  const isExplicitPreviewEnv = vercelEnv === 'preview';
  const hasGitBranchPattern = hostname.includes('-git-');
  const isNonCanonicalVercelDeployment = isVercelDomain && !isProductionDomain(hostname);

  if (isExplicitPreviewEnv || hasGitBranchPattern || isNonCanonicalVercelDeployment) {
    return {
      isAllowed: false,
      isMockMode: true,
      environmentName: 'preview',
      reason: 'Berjalan pada Vercel Preview / Deployment Non-Canonical'
    };
  }

  // 4. Verifikasi Mutlak Produksi Resmi:
  // Wajib memenuhi ketiga syarat secara serentak (fail-closed)
  const isVercelProdEnv = vercelEnv === 'production';
  const isApprovedHost = isProductionDomain(hostname);
  const isProdDb = viteSupabaseUrl.includes(PRODUCTION_SUPABASE_PROJECT);

  if (isVercelProdEnv && isApprovedHost && isProdDb) {
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
    environmentName: 'preview',
    reason: 'Fail-closed: Lingkungan tidak memenuhi seluruh kriteria verifikasi Production resmi'
  };
}

/**
 * Cek cepat apakah sinkronisasi eksternal dinonaktifkan (Mock Mode)
 */
export function isExternalSyncDisabledOnPreview(override?: SyncGuardContext): boolean {
  const status = getExternalSyncStatus(override);
  return status.isMockMode;
}
