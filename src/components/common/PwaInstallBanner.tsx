import React, { useState, useEffect } from 'react';
import { Smartphone, Download } from 'lucide-react';
import { PwaGuideModal } from '../modals/PwaGuideModal';

interface PwaInstallBannerProps {
  className?: string;
}

export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({ className = '' }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleOpenGuide = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <div 
        className={`w-full rounded-2xl bg-gradient-to-r from-[#021324] via-[#041d33] to-[#03182b] border border-sky-900/50 p-5 md:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 ${className}`}
      >
        {/* Left side: Icon + Texts */}
        <div className="flex items-start space-x-4">
          {/* Smartphone Icon Box */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#0ea5e9] to-[#0284c7] flex items-center justify-center shrink-0 shadow-lg shadow-sky-500/25 mt-0.5">
            <Smartphone className="w-6 h-6 text-white" />
          </div>

          {/* Texts */}
          <div>
            {/* Tag Badge */}
            <div className="inline-block px-3 py-0.5 rounded-full text-[11px] font-bold text-sky-400 bg-sky-950/70 border border-sky-400/30 uppercase tracking-wide mb-1.5">
              PROGRESSIVE WEB APP (PWA)
            </div>

            {/* Title */}
            <h2 className="text-white font-bold text-lg md:text-xl tracking-tight leading-snug">
              Aplikasi Portal di HP &amp; Desktop
            </h2>

            {/* Description */}
            <p className="text-slate-300 text-xs md:text-sm leading-relaxed max-w-2xl mt-1.5">
              Pasang portal ini di Homescreen HP Anda (iPhone / Android) atau Desktop PC untuk akses instan fullscreen layaknya aplikasi native.
            </p>
          </div>
        </div>

        {/* Right side: Action Button */}
        <div className="shrink-0 w-full md:w-auto flex justify-end">
          <button 
            type="button"
            onClick={handleOpenGuide}
            className="w-full md:w-auto bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] hover:from-[#0369a1] hover:to-[#0284c7] text-white font-bold text-xs md:text-sm px-6 py-3.5 rounded-xl shadow-[0_0_22px_rgba(14,165,233,0.55)] hover:shadow-[0_0_30px_rgba(14,165,233,0.8)] flex items-center justify-center space-x-2.5 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Panduan &amp; Pasang Aplikasi</span>
          </button>
        </div>
      </div>

      {/* Guide Modal */}
      <PwaGuideModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        deferredPrompt={deferredPrompt}
      />
    </>
  );
};
