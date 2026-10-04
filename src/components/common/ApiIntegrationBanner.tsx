import React, { useState } from 'react';
import { Code2, Terminal, ExternalLink } from 'lucide-react';
import { ApiDocsModal } from '../modals/ApiDocsModal';

interface ApiIntegrationBannerProps {
  className?: string;
}

export const ApiIntegrationBanner: React.FC<ApiIntegrationBannerProps> = ({ className = '' }) => {
  const [isDocsOpen, setIsDocsOpen] = useState(false);

  return (
    <>
      <div 
        className={`w-full rounded-2xl bg-gradient-to-r from-[#021822] via-[#04242e] to-[#021b25] border border-teal-900/60 p-5 md:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 ${className}`}
      >
        {/* Left side: Icon + Texts */}
        <div className="flex items-start space-x-4">
          {/* Icon Box */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#10b981] to-[#059669] flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/25 mt-0.5">
            <Code2 className="w-6 h-6 text-white" />
          </div>

          {/* Texts */}
          <div>
            {/* Tag Badge */}
            <div className="inline-block px-3 py-0.5 rounded-full text-[11px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-400/30 uppercase tracking-wide mb-1.5">
              REST API &amp; CLOUD WEBHOOK (V1)
            </div>

            {/* Title */}
            <h2 className="text-white font-bold text-lg md:text-xl tracking-tight leading-snug">
              Integrasi REST API &amp; Sistem Eksternal
            </h2>

            {/* Description */}
            <p className="text-slate-300 text-xs md:text-sm leading-relaxed max-w-2xl mt-1.5">
              Hubungkan sistem POS Kasir, Toko Online, atau ERP Anda ke SPECTRA secara otomatis menggunakan REST API standar JSON terbuka.
            </p>
          </div>
        </div>

        {/* Right side: Action Button */}
        <div className="shrink-0 w-full md:w-auto flex justify-end">
          <button 
            type="button"
            onClick={() => setIsDocsOpen(true)}
            className="w-full md:w-auto bg-gradient-to-r from-[#059669] to-[#10b981] hover:from-[#047857] hover:to-[#059669] text-white font-bold text-xs md:text-sm px-6 py-3.5 rounded-xl shadow-[0_0_22px_rgba(16,185,129,0.5)] hover:shadow-[0_0_30px_rgba(16,185,129,0.75)] flex items-center justify-center space-x-2.5 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Terminal className="w-4 h-4 text-white" />
            <span>Dokumentasi &amp; Uji Coba API</span>
          </button>
        </div>
      </div>

      {/* API Documentation & Playground Modal */}
      <ApiDocsModal 
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />
    </>
  );
};
