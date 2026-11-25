import React from 'react';
import { 
  LayoutDashboard, 
  Scan, 
  Zap, 
  BookOpen, 
  Menu
} from 'lucide-react';
import { ActiveTab } from './Sidebar';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenMobileSidebar: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenMobileSidebar
}) => {
  const isQuickReportActive = 
    activeTab === 'quick-report' || 
    activeTab === 'cashbank' || 
    activeTab === 'sales' || 
    activeTab === 'purchases';

  const isJournalActive = 
    activeTab === 'journals' || 
    activeTab === 'ledger' || 
    activeTab === 'coa';

  return (
    <nav 
      aria-label="Navigasi Bawah Ponsel"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] no-print"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-5 h-14 max-w-lg mx-auto px-1 items-center">
        
        {/* 1. Dashboard */}
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors relative cursor-pointer active:scale-95 ${
            activeTab === 'dashboard' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
          title="Buka Dashboard"
        >
          <LayoutDashboard className={`w-5 h-5 ${activeTab === 'dashboard' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Beranda</span>
          {activeTab === 'dashboard' && (
            <span className="absolute top-1 w-1.5 h-1.5 bg-sky-600 rounded-full" />
          )}
        </button>

        {/* 2. Auto Record (Featured Button for Receipts) */}
        <button
          type="button"
          onClick={() => setActiveTab('auto-record')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors relative cursor-pointer active:scale-95 ${
            activeTab === 'auto-record' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
          title="Buka Auto Record (Scan Bukti)"
        >
          <div className={`p-1 rounded-lg ${activeTab === 'auto-record' ? 'bg-sky-50 text-sky-600' : ''}`}>
            <Scan className={`w-5 h-5 ${activeTab === 'auto-record' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Auto Record</span>
          {activeTab === 'auto-record' && (
            <span className="absolute top-1 w-1.5 h-1.5 bg-sky-600 rounded-full" />
          )}
        </button>

        {/* 3. Quick Report */}
        <button
          type="button"
          onClick={() => setActiveTab('quick-report')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors relative cursor-pointer active:scale-95 ${
            isQuickReportActive ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
          title="Buka Quick Report (Kas, Piutang, Hutang)"
        >
          <Zap className={`w-5 h-5 ${isQuickReportActive ? 'stroke-[2.5] text-amber-500' : 'stroke-2'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Quick Report</span>
          {isQuickReportActive && (
            <span className="absolute top-1 w-1.5 h-1.5 bg-amber-500 rounded-full" />
          )}
        </button>

        {/* 4. Jurnal Umum */}
        <button
          type="button"
          onClick={() => setActiveTab('journals')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors relative cursor-pointer active:scale-95 ${
            isJournalActive ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
          title="Buka Jurnal Umum & Transaksi"
        >
          <BookOpen className={`w-5 h-5 ${isJournalActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Jurnal</span>
          {isJournalActive && (
            <span className="absolute top-1 w-1.5 h-1.5 bg-sky-600 rounded-full" />
          )}
        </button>

        {/* 5. Menu Lengkap Drawer */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="flex flex-col items-center justify-center h-full min-h-[44px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer active:scale-95"
          title="Buka Semua Menu Sistem"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <Menu className="w-5 h-5 stroke-2" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Semua Menu</span>
        </button>

      </div>
    </nav>
  );
};

