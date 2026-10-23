import React from 'react';
import { 
  LayoutDashboard, 
  Wallet, 
  ShoppingCart, 
  Package, 
  ListTree, 
  BookOpen, 
  Bookmark, 
  Scale, 
  Table, 
  TrendingUp, 
  PieChart, 
  RefreshCw, 
  DollarSign, 
  Gauge, 
  Settings, 
  ShieldAlert, 
  AlertTriangle, 
  AlertCircle, 
  Activity,
  Award,
  X,
  FileText,
  Zap
} from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';

export type ActiveTab = 
  | 'dashboard'
  | 'quick-report'
  | 'cashbank'
  | 'sales'
  | 'purchases'
  | 'coa'
  | 'journals'
  | 'ledger'
  | 'simple-reports'
  | 'trial-balance'
  | 'worksheet'
  | 'profit-loss'
  | 'balance-sheet'
  | 'capital-changes'
  | 'cash-flow'
  | 'ratios'
  | 'psak-report'
  | 'settings'
  | 'admin-panel'
  | 'authority-panel'
  | 'activity-logs';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  openNewTransactionModal: (preset?: any) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab: setParentActiveTab,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { currentUser } = useAccounting();

  const isAdmin = currentUser?.role === 'admin';
  const isAuthority = currentUser?.isAuthority || isAdmin;

  const setActiveTab = (tab: ActiveTab) => {
    setParentActiveTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside 
        id="sidebar" 
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 no-print select-none transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Scrollable Navigation Area */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          
          {/* Modul Akuntansi with Mobile Close Button */}
          <div className="px-2 pt-1 pb-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Modul Akuntansi</span>
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="md:hidden p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                title="Tutup Menu"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

        <div 
          onClick={() => setActiveTab('dashboard')}
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>Dashboard Utama</span>
        </div>

        <div 
          onClick={() => setActiveTab('quick-report')}
          className={`nav-item ${
            activeTab === 'quick-report' ||
            activeTab === 'cashbank' ||
            activeTab === 'sales' ||
            activeTab === 'purchases'
              ? 'active'
              : ''
          }`}
        >
          <Zap className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Quick Report</span>
        </div>

        {/* Buku Besar & Jurnal */}
        <div className="px-2 pt-3 pb-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Buku Besar & Jurnal
        </div>

        <div 
          onClick={() => setActiveTab('coa')}
          className={`nav-item ${activeTab === 'coa' ? 'active' : ''}`}
        >
          <ListTree className="w-4 h-4 shrink-0" />
          <span>Daftar Akun (COA)</span>
        </div>

        <div 
          onClick={() => setActiveTab('journals')}
          className={`nav-item ${activeTab === 'journals' ? 'active' : ''}`}
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          <span>Jurnal Umum & AJP</span>
        </div>

        <div 
          onClick={() => setActiveTab('ledger')}
          className={`nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
        >
          <Bookmark className="w-4 h-4 shrink-0" />
          <span>Buku Besar (Ledger)</span>
        </div>

        {/* Laporan Keuangan */}
        <div className="px-2 pt-3 pb-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Laporan Keuangan
        </div>

        <div 
          onClick={() => setActiveTab('psak-report')}
          className={`nav-item ${activeTab === 'psak-report' ? '!bg-indigo-600 !text-white shadow-md' : 'text-amber-300 hover:text-white hover:bg-slate-800'}`}
        >
          <Award className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-xs">Laporan Resmi (PSAK)</span>
          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            PUBLIK
          </span>
        </div>

        <div 
          onClick={() => setActiveTab('simple-reports')}
          className={`nav-item ${
            activeTab === 'simple-reports' ||
            activeTab === 'trial-balance' ||
            activeTab === 'worksheet' ||
            activeTab === 'profit-loss' ||
            activeTab === 'balance-sheet' ||
            activeTab === 'capital-changes' ||
            activeTab === 'cash-flow'
              ? 'active'
              : ''
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>Laporan Sederhana</span>
        </div>

        <div 
          onClick={() => setActiveTab('ratios')}
          className={`nav-item ${activeTab === 'ratios' ? 'active' : ''}`}
        >
          <Gauge className="w-4 h-4 shrink-0" />
          <span>Analisis Rasio & Status</span>
        </div>

        {/* Pengaturan */}
        <div className="px-2 pt-3 pb-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Pengaturan
        </div>

        <div 
          onClick={() => setActiveTab('settings')}
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Perusahaan & Data</span>
        </div>

        {/* Akses Khusus Otoritas & Administrator */}
        {isAuthority && (
          <div className="pt-2">
            <div className="px-2 pt-2 pb-1 text-[11px] font-bold text-amber-500 uppercase tracking-wider flex items-center justify-between">
              <span>Akses Khusus</span>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            </div>

            {isAdmin && (
              <div 
                onClick={() => setActiveTab('admin-panel')}
                className={`nav-item text-rose-300 hover:text-white hover:bg-rose-950/40 ${activeTab === 'admin-panel' ? '!bg-rose-700 !text-white' : ''}`}
              >
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-semibold">Administrator</span>
              </div>
            )}

            <div 
              onClick={() => setActiveTab('authority-panel')}
              className={`nav-item text-amber-300 hover:text-white hover:bg-amber-950/40 ${activeTab === 'authority-panel' ? '!bg-amber-700 !text-white' : ''}`}
            >
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Otoritas</span>
            </div>

            <div 
              onClick={() => setActiveTab('activity-logs')}
              className={`nav-item text-sky-300 hover:text-white hover:bg-sky-950/40 ${activeTab === 'activity-logs' ? '!bg-sky-700 !text-white' : ''}`}
            >
              <Activity className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Log Aktivitas</span>
            </div>
          </div>
        )}

      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span>Sistem Aktif - Offline Safe</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-1">SPECTRA v2.0 (Accurate Edition)</div>
      </div>
    </aside>
    </>
  );
};
