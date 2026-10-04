import React, { useState, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  Apple, 
  Monitor, 
  Download, 
  CheckCircle2, 
  ExternalLink, 
  Share2, 
  PlusSquare, 
  MoreVertical, 
  Sparkles 
} from 'lucide-react';

interface PwaGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt?: any;
}

export const PwaGuideModal: React.FC<PwaGuideModalProps> = ({ 
  isOpen, 
  onClose, 
  deferredPrompt 
}) => {
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop'>('android');
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        onClose();
      }
    } else {
      alert("Browser Anda belum memicu prompt instal otomatis. Silakan ikuti panduan langkah manual di tab bawah ini.");
    }
  };

  return (
    <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden animate-fadeIn border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#031525] via-[#052038] to-[#041a2e] text-white px-6 py-4 flex justify-between items-center border-b border-sky-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-sky-400 to-blue-600 flex items-center justify-center shadow-md shadow-sky-500/20">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-sky-400 bg-sky-950/60 border border-sky-400/30 uppercase mb-0.5">
                PROGRESSIVE WEB APP (PWA)
              </div>
              <h3 className="font-bold text-base text-white">Panduan Pasang Aplikasi SPECTRA</h3>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs text-slate-700">
          
          {/* Quick 1-Click Install Banner if browser supports it */}
          {deferredPrompt && !isInstalled && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 border border-sky-300 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-sky-950 text-sm flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span>Browser Anda Mendukung Pasang 1-Klik!</span>
                </div>
                <p className="text-[11px] text-sky-800 mt-0.5">
                  Klik tombol di samping untuk langsung menambahkan SPECTRA ke Homescreen atau Desktop.
                </p>
              </div>
              <button 
                type="button"
                onClick={handleInstallClick}
                className="bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] hover:from-[#0369a1] hover:to-[#0284c7] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-[0_0_15px_rgba(14,165,233,0.5)] flex items-center space-x-1.5 shrink-0 cursor-pointer transition transform hover:scale-105"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Pasang Sekarang</span>
              </button>
            </div>
          )}

          {isInstalled && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center space-x-3 text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">Aplikasi SPECTRA Sudah Terpasang!</span>
                <p className="text-[11px] text-emerald-700">
                  Anda sudah menjalankan SPECTRA dalam mode aplikasi mandiri (standalone fullscreen).
                </p>
              </div>
            </div>
          )}

          {/* OS Switcher Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('android')}
              className={`flex-1 py-2.5 px-3 text-center font-bold text-xs border-b-2 flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                activeTab === 'android'
                  ? 'border-sky-500 text-sky-600 bg-sky-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Android (Chrome)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ios')}
              className={`flex-1 py-2.5 px-3 text-center font-bold text-xs border-b-2 flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                activeTab === 'ios'
                  ? 'border-sky-500 text-sky-600 bg-sky-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Apple className="w-4 h-4" />
              <span>iPhone / iPad (iOS)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('desktop')}
              className={`flex-1 py-2.5 px-3 text-center font-bold text-xs border-b-2 flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                activeTab === 'desktop'
                  ? 'border-sky-500 text-sky-600 bg-sky-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>Desktop (PC / Laptop)</span>
            </button>
          </div>

          {/* Tab 1: Android */}
          {activeTab === 'android' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Buka di Google Chrome / Edge</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-6.5">
                  Akses <b>https://spectra-financial-system.vercel.app</b> di browser HP Android Anda.
                </p>

                <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Buka Menu Browser</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-6.5 flex items-center">
                  Ketuk ikon titik tiga vertikal (<MoreVertical className="w-3.5 h-3.5 mx-1 inline text-slate-700" />) di pojok kanan atas browser.
                </p>

                <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">3</span>
                  <span>Pilih "Instal Aplikasi" / "Tambahkan ke Layar Utama"</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-6.5">
                  Pilih menu <b>"Instal aplikasi"</b> atau <b>"Tambahkan ke Layar Utama" (Add to Home screen)</b>, lalu tekan <b>Instal</b>.
                </p>

                <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>
                  <span>Selesai</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-6.5">
                  Ikon aplikasi <b>SPECTRA</b> akan muncul di menu aplikasi/homescreen HP Anda dengan logo resmi NBE.
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: iPhone / iOS */}
          {activeTab === 'ios' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Buka Menggunakan Browser Safari</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-6.5">
                  Buka <b>https://spectra-financial-system.vercel.app</b> di browser <b>Safari bawaan iPhone/iPad</b>.
                </p>

                <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Tekan Tombol Bagikan (Share)</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-6.5 flex items-center">
                  Ketuk ikon <Share2 className="w-3.5 h-3.5 mx-1 inline text-blue-600" /> (ikon kotak dengan panah ke atas) di bilah navigasi bawah Safari.
                </p>

                <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">3</span>
                  <span>Pilih "Tambah ke Layar Utama"</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-6.5 flex items-center">
                  Gulir ke bawah dan ketuk <PlusSquare className="w-3.5 h-3.5 mx-1 inline text-slate-700" /> <b>"Tambah ke Layar Utama" (Add to Home Screen)</b>.
                </p>

                <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>
                  <span>Tekan "Tambah" di Kanan Atas</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-6.5">
                  Aplikasi SPECTRA langsung siap dibuka seperti aplikasi dari App Store tanpa address bar.
                </p>
              </div>
            </div>
          )}

          {/* Tab 3: Desktop */}
          {activeTab === 'desktop' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Buka di Chrome, Edge, atau Brave</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-6.5">
                  Gunakan browser Chromium modern di komputer PC / laptop Anda.
                </p>

                <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Klik Ikon Instal di Bilah URL</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-6.5">
                  Di sebelah kanan bilah URL (Address Bar), klik ikon <b>"Instal SPECTRA - Financial System"</b> (ikon monitor / tanda panah bawah).
                </p>

                <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">3</span>
                  <span>Konfirmasi Instal</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-6.5">
                  Klik tombol <b>"Instal"</b>. SPECTRA akan langsung memiliki jendela mandiri, shortcut di Desktop, dan Taskbar PC Anda.
                </p>
              </div>
            </div>
          )}

          {/* Benefits Info */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1 text-blue-900">
            <span className="font-bold text-[11px] flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Keunggulan Progressive Web App (PWA):</span>
            </span>
            <ul className="text-[11px] text-blue-800 list-disc list-inside space-y-0.5 pl-1">
              <li>Membuka layar penuh (fullscreen) tanpa bilah URL browser yang mengganggu.</li>
              <li>Akses secepat kilat dengan ikon aplikasi di Homescreen / Desktop.</li>
              <li>Data keuangan otomatis tersinkronisasi 24 jam real-time.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <a
            href="https://spectra-financial-system.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-sky-600 hover:text-sky-800 font-semibold flex items-center space-x-1"
          >
            <span>Buka Web Vercel</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg border border-slate-300 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
