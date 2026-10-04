import React from 'react';
import { Radio, RefreshCw, Monitor, Smartphone, Info, X } from 'lucide-react';
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
    alert(`Link berhasil disalin: ${text}`);
  };

  return (
    <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-fadeIn border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/40">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Sinkronisasi & Akses Web SPECTRA</h3>
              <p className="text-[11px] text-slate-400">Data antara Aplikasi Desktop & Browser Web Terhubung Real-Time</p>
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
          <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
              <div>
                <div className="font-bold text-slate-800">Sistem Terhubung & Aktif 24 Jam</div>
                <div className="text-[11px] text-slate-500">
                  {syncStatus.source} • {syncStatus.lastSyncedAt.toLocaleTimeString('id-ID')}
                </div>
              </div>
            </div>
            <button 
              type="button"
              onClick={triggerManualSync}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-3 py-1.5 rounded shadow-xs flex items-center space-x-1 transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sinkronkan Sekarang</span>
            </button>
          </div>

          {/* URL Cards */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
              Alamat Akses SPECTRA:
            </h4>

            {/* Local Host URL */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 flex items-center space-x-1.5">
                  <Monitor className="w-3.5 h-3.5 text-blue-600" />
                  <span>Akses Browser di Komputer Ini:</span>
                </span>
                <button 
                  type="button"
                  onClick={() => copyToClipboard('http://localhost:5173')}
                  className="text-blue-600 hover:text-blue-800 font-semibold text-[10px]"
                >
                  Salin Link
                </button>
              </div>
              <div className="font-mono text-[11px] text-blue-700 font-bold select-all bg-white px-2 py-1 rounded border border-slate-200">
                http://localhost:5173
              </div>
            </div>

            {/* Cloud & Network URLs */}
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 flex items-center space-x-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                  <span>Akses Online / Cloud (HP & Laptop):</span>
                </span>
                <button 
                  type="button"
                  onClick={() => copyToClipboard('https://mazmurglarosa.github.io/spectra-financial-system/')}
                  className="text-blue-600 hover:text-blue-800 font-semibold text-[10px]"
                >
                  Salin Link
                </button>
              </div>
              <div className="font-mono text-[11px] text-blue-800 font-bold select-all bg-white px-2 py-1 rounded border border-blue-200">
                https://mazmurglarosa.github.io/spectra-financial-system/
              </div>
              <p className="text-[10px] text-slate-500">
                Buka alamat di atas di browser HP atau perangkat lain untuk melihat data keuangan yang tersinkronisasi.
              </p>
            </div>
          </div>

          <div className="p-2.5 bg-slate-100 rounded-lg text-[11px] text-slate-600 flex items-start space-x-2">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <span>
              Setiap transaksi, jurnal, maupun akun yang Anda buat otomatis saling tersinkronisasi tanpa ada data yang hilang.
            </span>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded border border-slate-300 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
