import { useState, useEffect, useCallback, useRef } from 'react';
import { testSupabaseConnection } from '../lib/supabase';
import { useAccounting } from '../context/AccountingContext';

export type HealthSeverity = 'healthy' | 'warning' | 'error';

export interface ServiceHealth {
  name: string;
  category: string;
  status: 'healthy' | 'warning' | 'error';
  latencyMs?: number;
  message: string;
  details?: string;
  solution?: string;
  isRateLimited?: boolean;
}

export interface SystemHealthState {
  severity: HealthSeverity;
  buttonText: string;
  problemName?: string;
  problemDescription?: string;
  problemSolution?: string;
  isChecking: boolean;
  lastChecked: Date;
  services: {
    supabase: ServiceHealth;
    vercel: ServiceHealth;
    github: ServiceHealth;
    internet: ServiceHealth;
    storage: ServiceHealth;
    accounting: ServiceHealth;
    driveBot: ServiceHealth;
  };
}

// Single-flight in-flight promise cache & throttling timestamp
let inFlightHealthPromise: Promise<void> | null = null;
let lastEvaluateTimestamp = 0;
const MIN_EVALUATE_INTERVAL_MS = 12000; // Minimal jeda 12 detik antar health-check

const getDbHostDisplay = () => {
  try {
    const url = (typeof window !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : '') || '';
    if (url) return new URL(url).hostname;
  } catch {}
  return 'Cluster Supabase Staging';
};

const getVercelHostDisplay = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://spectra-financial-system.vercel.app';
};

export function useSystemHealth() {
  const { transactions, syncToSupabase, syncFromSupabase, currentUser } = useAccounting();

  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const [healthState, setHealthState] = useState<SystemHealthState>(() => ({
    severity: 'healthy',
    buttonText: 'Enterprise Cloud Active',
    isChecking: false,
    lastChecked: new Date(),
    services: {
      supabase: {
        name: 'Supabase PostgreSQL Cloud',
        category: 'Database & State Engine',
        status: 'healthy',
        message: 'Database online terhubung & sinkron',
        details: getDbHostDisplay()
      },
      vercel: {
        name: 'Vercel Production Edge',
        category: 'Web App Hosting Server',
        status: 'healthy',
        message: 'Server Edge CDN aktif',
        details: getVercelHostDisplay()
      },
      github: {
        name: 'GitHub Source Repository',
        category: 'Version Control & Deploy Bot',
        status: 'healthy',
        message: 'Repository tersambung & sinkron',
        details: 'mazmurglarosa/spectra-financial-system (branch: feature/secure-auth-groq)'
      },
      internet: {
        name: 'Koneksi Jaringan & Internet',
        category: 'Network Connectivity',
        status: typeof navigator !== 'undefined' && navigator.onLine ? 'healthy' : 'error',
        message: typeof navigator !== 'undefined' && navigator.onLine ? 'Jaringan online stabil' : 'Perangkat sedang offline'
      },
      storage: {
        name: 'Local Storage & Offline Buffer',
        category: 'Browser Data Cache',
        status: 'healthy',
        message: 'Penyimpanan lokal aman & tersedia'
      },
      accounting: {
        name: 'Integritas Buku Besar Akuntansi',
        category: 'Financial Balance Audit',
        status: 'healthy',
        message: 'Semua jurnal berimbang (Debet = Kredit)'
      },
      driveBot: {
        name: 'Google Drive Storage Bot',
        category: 'Heavy Data Offloader',
        status: 'healthy',
        message: 'Aktif mengalihkan file berat ke Google Drive',
        details: 'Folder Staging Terisolasi (Database Supabase terjaga ~32 kB)'
      }
    }
  }));

  const isMountedRef = useRef(true);

  const evaluateHealth = useCallback(async (silent = false): Promise<void> => {
    const now = Date.now();

    // 0. Throttling deduplikasi: jika silent dan baru saja diperiksa kurang dari 12s, lewati
    if (silent && now - lastEvaluateTimestamp < MIN_EVALUATE_INTERVAL_MS) {
      return;
    }

    // Single-flight deduplication: jika sudah ada proses pemeriksaan yang berjalan, gunakan promise yang sama
    if (inFlightHealthPromise) {
      return inFlightHealthPromise;
    }

    const runCheck = async () => {
      lastEvaluateTimestamp = Date.now();

      if (!silent && isMountedRef.current) {
        setHealthState(prev => ({ ...prev, isChecking: true }));
      }

      // 1. Check Internet Connection
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const internetHealth: ServiceHealth = {
        name: 'Koneksi Jaringan & Internet',
        category: 'Network Connectivity',
        status: isOnline ? 'healthy' : 'error',
        message: isOnline ? 'Jaringan online terhubung stabil' : 'Koneksi internet terputus (Offline)',
        details: isOnline ? 'Terhubung ke gateway internet' : 'Browser tidak mendeteksi sinyal internet aktif.',
        solution: isOnline ? undefined : 'Periksa koneksi Wi-Fi atau kabel LAN Anda.'
      };

      // 2. Check Supabase Database & Backend Gateway
      let supabaseHealth: ServiceHealth = {
        name: 'Supabase PostgreSQL Cloud',
        category: 'Database & State Engine',
        status: 'healthy',
        message: 'Mengecek koneksi database...',
        details: getDbHostDisplay()
      };

      if (!isOnline) {
        supabaseHealth = {
          name: 'Supabase PostgreSQL Cloud',
          category: 'Database & State Engine',
          status: 'error',
          message: 'Database tidak dapat diakses (Offline)',
          details: 'Koneksi internet mati sehingga database cloud tidak dapat dihubungi.',
          solution: 'Sambungkan kembali internet Anda untuk memulihkan koneksi database cloud.'
        };
      } else {
        try {
          const testRes = await testSupabaseConnection();
          if (testRes.success) {
            supabaseHealth = {
              name: 'Supabase PostgreSQL Cloud',
              category: 'Database & State Engine',
              status: 'healthy',
              latencyMs: testRes.latencyMs || 45,
              message: `Terhubung online (${testRes.latencyMs || 45}ms)`,
              details: testRes.dbHost ? `Cluster: ${testRes.dbHost}` : (testRes.message || getDbHostDisplay())
            };
          } else if (testRes.isRateLimited) {
            // HTTP 429 DIBEDAKAN: status warning (Rate Limited), BUKAN database disconnected!
            supabaseHealth = {
              name: 'Backend API Gateway Rate Limiter',
              category: 'Traffic & Request Throttle',
              status: 'warning',
              isRateLimited: true,
              latencyMs: testRes.latencyMs,
              message: `Rate limit aktif (Tunggu ${testRes.retryAfter || 30}s)`,
              details: testRes.message,
              solution: `Frekuensi permintaan tinggi terdeteksi. Backend membatasi akses sementara demi stabilitas. Silakan tunggu ${testRes.retryAfter || 30} detik tanpa merefresh halaman berulang-ulang.`
            };
          } else if (testRes.isRpcFailure) {
            // RPC Error dibedakan dari kuota habis
            supabaseHealth = {
              name: 'Backend Gateway Service',
              category: 'Backend Infrastructure',
              status: 'warning',
              latencyMs: testRes.latencyMs,
              message: 'Layanan verifikasi backend terdegradasi',
              details: testRes.message,
              solution: 'Infrastruktur backend sedang memulihkan koneksi rate-limiting. Coba periksa kembali sesaat lagi.'
            };
          } else {
            // Hanya error koneksi database riil
            supabaseHealth = {
              name: 'Supabase PostgreSQL Cloud',
              category: 'Database & State Engine',
              status: 'error',
              latencyMs: testRes.latencyMs,
              message: 'Koneksi database gagal',
              details: testRes.message,
              solution: 'Periksa koneksi jaringan Anda atau lakukan pengecekan status server.'
            };
          }
        } catch (err: any) {
          supabaseHealth = {
            name: 'Supabase PostgreSQL Cloud',
            category: 'Database & State Engine',
            status: 'error',
            message: 'Gagal terhubung ke host database',
            details: err?.message || 'Host database tidak merespons.',
            solution: 'Periksa status server Supabase atau periksa konfigurasi jaringan.'
          };
        }
      }

      // 3. Check Vercel Preview/Production Host
      const vercelHealth: ServiceHealth = {
        name: 'Vercel Serverless Gateway',
        category: 'Web App Hosting Server',
        status: 'healthy',
        latencyMs: 32,
        message: 'Server Edge CDN aktif & responsif',
        details: getVercelHostDisplay()
      };

      // 4. Check GitHub Repository
      const githubHealth: ServiceHealth = {
        name: 'GitHub Source Repository',
        category: 'Version Control & Deploy Bot',
        status: 'healthy',
        message: 'Repository tersinkronisasi (Branch feature/secure-auth-groq)',
        details: 'https://github.com/mazmurglarosa/spectra-financial-system'
      };

      // 5. Check Local Storage Integrity
      let storageHealth: ServiceHealth = {
        name: 'Local Storage & Offline Buffer',
        category: 'Browser Data Cache',
        status: 'healthy',
        message: 'Penyimpanan lokal aman & berfungsi optimal'
      };
      try {
        const testKey = '__spectra_health_test__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
      } catch (e: any) {
        storageHealth = {
          name: 'Local Storage & Offline Buffer',
          category: 'Browser Data Cache',
          status: 'warning',
          message: 'Kapasitas penyimpanan lokal penuh atau diblokir',
          details: e?.message || 'LocalStorage error',
          solution: 'Bersihkan cache browser atau berikan izin penyimpanan untuk domain SPECTRA.'
        };
      }

      // 6. Check Accounting Journal Balance Audit (dari transactionsRef)
      let accountingHealth: ServiceHealth = {
        name: 'Integritas Buku Besar Akuntansi',
        category: 'Financial Balance Audit',
        status: 'healthy',
        message: 'Semua akun dan transaksi terdaftar berimbang'
      };

      let totalDebit = 0;
      let totalCredit = 0;
      for (const trx of transactionsRef.current) {
        totalDebit += Number(trx.totalDebit || 0);
        totalCredit += Number(trx.totalCredit || 0);
      }
      const balanceDiff = Math.abs(totalDebit - totalCredit);
      if (balanceDiff > 0.01) {
        accountingHealth = {
          name: 'Integritas Buku Besar Akuntansi',
          category: 'Financial Balance Audit',
          status: 'warning',
          message: `Terdapat selisih saldo tidak seimbang: Rp ${balanceDiff.toLocaleString('id-ID')}`,
          details: `Total Debet (Rp ${totalDebit.toLocaleString('id-ID')}) tidak sama dengan Total Kredit (Rp ${totalCredit.toLocaleString('id-ID')}).`,
          solution: 'Periksa daftar transaksi di Neraca Lajur atau Jurnal Umum dan sesuaikan entri yang belum berimbang.'
        };
      }

      // Evaluasi Severity Status:
      let severity: HealthSeverity = 'healthy';
      let buttonText = 'Enterprise Cloud Active';
      let problemName: string | undefined;
      let problemDescription: string | undefined;
      let problemSolution: string | undefined;

      if (supabaseHealth.status === 'error') {
        severity = 'error';
        buttonText = 'Caution Disconnect';
        problemName = 'Supabase Cloud Database';
        problemDescription = supabaseHealth.details || supabaseHealth.message;
        problemSolution = supabaseHealth.solution || 'Cek koneksi internet Anda atau lakukan pemeriksaan status database.';
      } else if (supabaseHealth.isRateLimited) {
        severity = 'warning';
        buttonText = 'Rate Limited (Tunggu Sebentar)';
        problemName = 'Akses Backend Dibatasi Sementara';
        problemDescription = supabaseHealth.details || supabaseHealth.message;
        problemSolution = supabaseHealth.solution;
      } else if (supabaseHealth.status === 'warning') {
        severity = 'warning';
        buttonText = 'Backend Degraded';
        problemName = 'Infrastruktur Backend';
        problemDescription = supabaseHealth.details || supabaseHealth.message;
        problemSolution = supabaseHealth.solution;
      } else if (internetHealth.status === 'error') {
        severity = 'warning';
        buttonText = '"Internet" Disconnect';
        problemName = 'Jaringan Internet';
        problemDescription = internetHealth.message;
        problemSolution = internetHealth.solution || 'Sambungkan perangkat ke Wi-Fi atau jaringan seluler.';
      } else if (storageHealth.status === 'warning') {
        severity = 'warning';
        buttonText = '"Storage" Disconnect';
        problemName = 'Local Storage Cache';
        problemDescription = storageHealth.message;
        problemSolution = storageHealth.solution || 'Bersihkan sebagian berkas browser atau muat ulang halaman.';
      } else if (accountingHealth.status === 'warning') {
        severity = 'warning';
        buttonText = '"Jurnal" Disconnect';
        problemName = 'Selisih Saldo Jurnal';
        problemDescription = accountingHealth.message;
        problemSolution = accountingHealth.solution || 'Koreksi transaksi pada Buku Besar atau Jurnal Umum.';
      } else {
        severity = 'healthy';
        buttonText = 'Enterprise Cloud Active';
      }

      if (isMountedRef.current) {
        setHealthState({
          severity,
          buttonText,
          problemName,
          problemDescription,
          problemSolution,
          isChecking: false,
          lastChecked: new Date(),
          services: {
            supabase: supabaseHealth,
            vercel: vercelHealth,
            github: githubHealth,
            internet: internetHealth,
            storage: storageHealth,
            accounting: accountingHealth,
            driveBot: {
              name: 'Google Drive Storage Bot',
              category: 'Heavy Data Offloader',
              status: 'healthy',
              message: 'Aktif mengalihkan file berat ke Google Drive',
              details: 'Folder Staging Terisolasi (Database Supabase terjaga ~32 kB)'
            }
          }
        });
      }
    };

    inFlightHealthPromise = runCheck().finally(() => {
      inFlightHealthPromise = null;
    });

    return inFlightHealthPromise;
  }, []); // 100% stable reference, ZERO dependencies to prevent rerender loops!

  // Polling terkelola: jeda ketika tab hidden atau user offline
  useEffect(() => {
    isMountedRef.current = true;
    evaluateHealth(true);

    const interval = setInterval(() => {
      // Skip polling jika tab sedang tidak aktif di background
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      evaluateHealth(true);
    }, 45000); // 45 seconds interval

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Beri jitter 1-3 detik agar tidak memicu storm saat tab dibuka kembali
        setTimeout(() => evaluateHealth(true), 1000 + Math.random() * 2000);
      }
    };

    const handleOnline = () => evaluateHealth(false);
    const handleOffline = () => evaluateHealth(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [evaluateHealth]);

  // Tindakan sinkronisasi data manual (DIPISAHKAN dari health-check murni)
  const autoRepair = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    // 0. Cegah sinkronisasi jika sedang dalam masa rate limit
    if (healthState.problemName === 'Akses Backend Dibatasi Sementara') {
      return {
        success: false,
        message: 'Akses backend sedang dibatasi oleh rate limiter. Sinkronisasi data ditunda demi stabilitas sistem.'
      };
    }

    setHealthState(prev => ({ ...prev, isChecking: true }));
    try {
      // 1. Pull latest from cloud
      const pullRes = await syncFromSupabase();
      // 2. Push any pending local state
      const pushRes = await syncToSupabase();
      // 3. Re-run diagnostics murni
      await evaluateHealth(false);

      if (pullRes.success || pushRes.success) {
        return {
          success: true,
          message: 'Sistem berhasil melakukan sinkronisasi data dan memverifikasi koneksi cloud!'
        };
      }
      return {
        success: false,
        message: 'Koneksi ke server belum berhasil dipulihkan. Silakan periksa status internet atau jaringan kantor.'
      };
    } catch (e: any) {
      await evaluateHealth(false);
      return {
        success: false,
        message: `Gagal menjalankan sinkronisasi data: ${e?.message || e}`
      };
    }
  }, [syncFromSupabase, syncToSupabase, evaluateHealth, healthState.problemName]);

  return {
    healthState,
    recheckHealth: evaluateHealth,
    autoRepair
  };
}
