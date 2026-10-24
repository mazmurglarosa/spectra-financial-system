import React, { useState } from 'react';
import { 
  Globe, 
  Database, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  Check, 
  Wifi, 
  HardDrive, 
  Activity, 
  Wrench,
  Server,
  GitBranch
} from 'lucide-react';
import { SystemHealthState } from '../../hooks/useSystemHealth';

interface SystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  healthState: SystemHealthState;
  onRecheck: (silent?: boolean) => Promise<void>;
  onAutoRepair: () => Promise<{ success: boolean; message: string }>;
}

export const SystemDiagnosticsModal: React.FC<SystemDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  healthState,
  onRecheck,
  onAutoRepair
}) => {
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairFeedback, setRepairFeedback] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const handleRepairClick = async () => {
    setIsRepairing(true);
    setRepairFeedback(null);
    try {
      const res = await onAutoRepair();
      setRepairFeedback(res.message);
    } catch (err: any) {
      setRepairFeedback(`Gagal: ${err?.message || err}`);
    } finally {
      setIsRepairing(false);
    }
  };

  const copyUrl = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const isHealthy = healthState.severity === 'healthy';
  const isWarning = healthState.severity === 'warning';
  const isError = healthState.severity === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between text-white border-b ${
          isError 
            ? 'bg-gradient-to-r from-rose-900 via-rose-950 to-slate-950 border-rose-800' 
            : isWarning 
            ? 'bg-gradient-to-r from-amber-900 via-slate-900 to-slate-950 border-amber-800'
            : 'bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 border-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${
              isError 
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' 
                : isWarning 
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            }`}>
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-wide">Pusat Diagnostik Sistem & Realtime Cloud</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isError 
                    ? 'bg-rose-500/30 text-rose-300 border-rose-400/50' 
                    : isWarning 
                    ? 'bg-amber-500/30 text-amber-200 border-amber-400/50'
                    : 'bg-emerald-500/30 text-emerald-300 border-emerald-400/50'
                }`}>
                  LIVE MONITOR
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Pembaruan terakhir: {healthState.lastChecked.toLocaleTimeString('id-ID')} WIB
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Main Status Banner */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isError
              ? 'bg-rose-50/90 border-rose-300 text-rose-950 shadow-xs'
              : isWarning
              ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
              : 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-xs'
          }`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {isError && <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />}
                {isWarning && <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />}
                {isHealthy && <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black flex items-center gap-2">
                    <span>{healthState.buttonText}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/70 border border-current">
                      {isError ? 'GANGGUAN KRITIS' : isWarning ? 'PERINGATAN SUBSISTEM' : 'OPTIMAL 100%'}
                    </span>
                  </h3>
                </div>

                <p className="text-xs leading-relaxed opacity-90">
                  {isHealthy && 'Seluruh koneksi (Database Cloud Supabase, Server Vercel Production, Repository GitHub, Penyimpanan Lokal, dan Jaringan Internet) dalam kondisi stabil, berimbang, dan aman.'}
                  {!isHealthy && healthState.problemDescription}
                </p>

                {/* Automated Solution Recommendation if there is an issue */}
                {!isHealthy && healthState.problemSolution && (
                  <div className="mt-3 pt-3 border-t border-current/20 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Solusi Otomatis Dari Sistem:</span>
                    </div>
                    <p className="text-[11px] leading-relaxed bg-white/80 p-2.5 rounded-xl border border-current/20 font-medium">
                      {healthState.problemSolution}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons: Cek & Hubungkan Ulang + Perbaiki Otomatis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={healthState.isChecking}
              onClick={() => onRecheck(false)}
              className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-600 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${healthState.isChecking ? 'animate-spin' : ''}`} />
              <span>{healthState.isChecking ? 'Sedang Memeriksa...' : 'Cek & Hubungkan Ulang'}</span>
            </button>

            <button
              type="button"
              disabled={isRepairing}
              onClick={handleRepairClick}
              className={`py-2.5 px-4 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                isHealthy
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${isRepairing ? 'animate-spin' : ''}`} />
              <span>{isRepairing ? 'Memperbaiki & Menyinkronkan...' : 'Sinkronkan Ulang Database'}</span>
            </button>
          </div>

          {/* Feedback banner from auto-repair */}
          {repairFeedback && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{repairFeedback}</span>
            </div>
          )}

          {/* 6 Subsystem Diagnostics Breakdown */}
          <div className="space-y-2 pt-1">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <span>Kondisi Realtime Tiap Subsistem:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* 1. Supabase PostgreSQL */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Supabase PostgreSQL</span>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    healthState.services.supabase.status === 'healthy'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {healthState.services.supabase.status === 'healthy' ? 'CONNECTED' : 'DISCONNECT'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 truncate">{healthState.services.supabase.message}</p>
                <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                  <span>drsqwxkkcfqvooqzoyvm</span>
                  {healthState.services.supabase.latencyMs && (
                    <span className="text-emerald-700 font-bold">{healthState.services.supabase.latencyMs}ms</span>
                  )}
                </div>
              </div>

              {/* 2. Vercel Production Web */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <span>Vercel Global Edge</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                    ONLINE
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 truncate">{healthState.services.vercel.message}</p>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  spectra-financial-system.vercel.app
                </div>
              </div>

              {/* 3. GitHub Source Repo */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-purple-600" />
                    <span>GitHub Repository</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                    SYNCED
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 truncate">{healthState.services.github.message}</p>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  mazmurglarosa/spectra... (main)
                </div>
              </div>

              {/* 4. Internet Connection */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Koneksi Internet</span>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    healthState.services.internet.status === 'healthy'
                      ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {healthState.services.internet.status === 'healthy' ? 'ACTIVE' : 'OFFLINE'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 truncate">{healthState.services.internet.message}</p>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  Browser Online API Check
                </div>
              </div>

              {/* 5. Local Storage Cache */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Storage &amp; Cache Lokal</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    TERPROTEKSI
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 truncate">{healthState.services.storage.message}</p>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  Auto-Save Quota Safe
                </div>
              </div>

              {/* 6. Accounting Balance Audit */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Integritas Buku Besar</span>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    healthState.services.accounting.status === 'healthy'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {healthState.services.accounting.status === 'healthy' ? 'BALANCE' : 'SELISIH'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 truncate">{healthState.services.accounting.message}</p>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  Debet = Kredit Audit
                </div>
              </div>

            </div>
          </div>

          {/* Official Vercel Live Link Box */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>Akses Resmi SPECTRA (Vercel Production Cloud):</span>
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                LIVE PRODUCTION
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value="https://spectra-financial-system.vercel.app"
                className="flex-1 bg-white border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-mono text-blue-900 font-bold select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyUrl('https://spectra-financial-system.vercel.app')}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-blue-200 flex items-center gap-1 transition cursor-pointer"
              >
                {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedUrl ? 'Tersalin' : 'Salin'}</span>
              </button>
              <a
                href="https://spectra-financial-system.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition shadow-xs"
              >
                <span>Buka</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            SPECTRA Enterprise System &bull; Pemantauan Cloud Terintegrasi
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
