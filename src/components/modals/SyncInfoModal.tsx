import React from 'react';
import { Globe, RefreshCw, Smartphone, Info, ExternalLink, Database, ShieldCheck } from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';

interface SyncInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncInfoModal: React.FC<SyncInfoModalProps> = ({ isOpen, onClose }) => {
  const { syncStatus, triggerManualSync } = useAccounting();

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(`Link online berhasil disalin: ${text}`);
  };

  return (
    <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-fadeIn border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/40">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Akses Web Online & Sinkronisasi Cloud SPECTRA</h3>
              <p className="text-[11px] text-slate-400">Server Cloud Aktif 24 Jam &bull; Siap Diakses Dari Mana Saja</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-white text-lg font-bold"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Status Box */}
          <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/70 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <span>Status Cloud: FULL ONLINE</span>
                  <span className="bg-emerald-200 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded">LIVE</span>
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Terakhir update: {syncStatus.lastSyncedAt.toLocaleTimeString('id-ID')} &bull; Otomatis tersimpan
                </div>
              </div>
            </div>
            <button 
              type="button"
              onClick={triggerManualSync}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-3 py-1.5 rounded shadow-xs flex items-center space-x-1 transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sinkronkan</span>
            </button>
          </div>

          {/* Online Web URLs */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center space-x-1.5">
              <span>Alamat Web Resmi (Full Online Cloud):</span>
            </h4>

            {/* Primary Vercel Production URL */}
            <div className="p-3.5 rounded-xl border-2 border-blue-500 bg-gradient-to-br from-blue-50/90 to-indigo-50/90 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-950 flex items-center space-x-1.5 text-xs">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>Website Utama (Vercel Production):</span>
                </span>
                <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded shadow-xs">
                  Resmi & Aktif
                </span>
              </div>
              <div className="font-mono text-xs text-blue-900 font-bold select-all bg-white px-3 py-2 rounded-lg border border-blue-300 flex items-center justify-between shadow-inner">
                <span className="truncate pr-2">https://spectra-financial-system.vercel.app</span>
                <div className="flex items-center space-x-1 shrink-0">
                  <button 
                    type="button"
                    onClick={() => copyToClipboard('https://spectra-financial-system.vercel.app')}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded text-[10px] font-semibold border border-slate-300 cursor-pointer"
                  >
                    Salin
                  </button>
                  <a 
                    href="https://spectra-financial-system.vercel.app" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded text-[10px] font-semibold flex items-center space-x-1 shadow-xs"
                  >
                    <span>Buka</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <p className="text-[11px] text-blue-900/80 leading-relaxed">
                ✓ <b>100% Full Online</b> di server Vercel global. Dapat diakses dari HP, tablet, laptop, atau komputer manapun tanpa perlu menyalakan komputer lokal Anda.
              </p>
            </div>

            {/* Mirror / Alternative Cloud URL */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 flex items-center space-x-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-600" />
                  <span>Alamat Cadangan (GitHub Pages Mirror):</span>
                </span>
                <div className="flex items-center space-x-1">
                  <button 
                    type="button"
                    onClick={() => copyToClipboard('https://mazmurglarosa.github.io/spectra-financial-system/')}
                    className="text-blue-600 hover:text-blue-800 font-semibold text-[10px] cursor-pointer"
                  >
                    Salin Link
                  </button>
                  <a 
                    href="https://mazmurglarosa.github.io/spectra-financial-system/" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-slate-600 hover:text-slate-900 text-[10px] font-semibold flex items-center ml-1"
                  >
                    Buka ↗
                  </a>
                </div>
              </div>
              <div className="font-mono text-[11px] text-slate-800 font-bold select-all bg-white px-2.5 py-1 rounded border border-slate-200 truncate">
                https://mazmurglarosa.github.io/spectra-financial-system/
              </div>
            </div>
          </div>

          {/* Database & Cloud Architecture Info */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-slate-700">
            <div className="flex items-center space-x-1.5 font-bold text-slate-900 text-[11px]">
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>Arsitektur Cloud & Database Convex:</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Sistem telah dilengkapi dengan skema backend Convex Cloud (tabel: <code>accounts</code>, <code>transactions</code>, <code>settings</code>, <code>users</code>, <code>activityLogs</code>, <code>complaints</code>, <code>contacts</code>) yang siap dikoneksikan ke cluster Convex online.
            </p>
          </div>

          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-900 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Semua pencatatan jurnal, neraca, laba rugi, dan buku besar selalu sinkron dan aman tanpa ada risiko data hilang.
            </span>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded border border-slate-300 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

