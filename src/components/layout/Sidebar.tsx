import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ListTree, 
  BookOpen, 
  Bookmark, 
  Gauge, 
  Settings, 
  ShieldAlert, 
  AlertTriangle, 
  AlertCircle, 
  Activity, 
  Award, 
  X, 
  FileText, 
  Zap, 
  ChevronRight, 
  LogOut,
  Scan
} from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { useSystemHealth } from '../../hooks/useSystemHealth';
import { SystemDiagnosticsModal } from '../modals/SystemDiagnosticsModal';

export type ActiveTab = 
  | 'dashboard'
  | 'quick-report'
  | 'cashbank'
  | 'sales'
  | 'purchases'
  | 'auto-record'
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
  | 'web-appearance'
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
  const { currentUser, logout } = useAccounting();
  const { healthState, recheckHealth, autoRepair } = useSystemHealth();
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const isAuthority = currentUser?.isAuthority || isAdmin;

  const setActiveTab = (tab: ActiveTab) => {
    setParentActiveTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const isQuickReportActive = 
    activeTab === 'quick-report' || 
    activeTab === 'cashbank' || 
    activeTab === 'sales' || 
    activeTab === 'purchases';

  const isSimpleReportsActive = 
    activeTab === 'simple-reports' ||
    ['trial-balance', 'worksheet', 'profit-loss', 'balance-sheet', 'capital-changes', 'cash-flow'].includes(activeTab);

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside 
        id="sidebar" 
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-white text-slate-700 flex flex-col shrink-0 border-r border-slate-200/90 shadow-xs no-print select-none transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header Matching Reference Image */}
        <div className="p-4 border-b border-slate-100 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            {/* Seamless Logo & Company Button - Returns to Dashboard */}
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2.5 text-left bg-transparent border-0 p-0 m-0 cursor-pointer select-none focus:outline-hidden"
              title="Kembali ke Dashboard"
            >
              <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center p-1 shrink-0">
                <img 
                  src="./assets/NBE.png" 
                  alt="NBE" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = './NBE.png';
                  }}
                />
              </div>
              <div>
                <div className="text-[11px] font-black tracking-tight text-slate-900 uppercase leading-none">
                  PT NIRWANA BHUMI
                </div>
                <div className="text-[11px] font-black tracking-tight text-slate-900 uppercase leading-none mt-0.5">
                  ENERGI
                </div>
                <div className="text-[9px] font-bold text-sky-600 tracking-wider uppercase mt-1">
                  Financial Control System
                </div>
              </div>
            </button>

            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="md:hidden p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Tutup Menu"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Realtime Connection Health Status Button */}
          <button
            type="button"
            onClick={() => setIsDiagnosticsModalOpen(true)}
            title={`Status Koneksi: ${healthState.buttonText}. Klik untuk membuka laporan diagnostik & solusi otomatis.`}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold w-fit mt-1 transition cursor-pointer shadow-xs active:scale-95 ${
              healthState.severity === 'error'
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300'
                : healthState.severity === 'warning'
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              healthState.severity === 'error'
                ? 'bg-rose-500 animate-ping'
                : healthState.severity === 'warning'
                ? 'bg-amber-500 animate-ping'
                : 'bg-emerald-500'
            }`}></span>
            <span>{healthState.buttonText}</span>
          </button>
        </div>

        {/* Scrollable Navigation Area */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          
          <div 
            onClick={() => setActiveTab('dashboard')}
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' ? 'text-white' : 'text-sky-600'}`} />
            <span className="font-medium text-xs">Dashboard</span>
            {activeTab === 'dashboard' && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/90" />}
          </div>

          <div 
            onClick={() => setActiveTab('quick-report')}
            className={`nav-item ${isQuickReportActive ? 'active' : ''}`}
          >
            <Zap className={`w-4 h-4 shrink-0 ${isQuickReportActive ? 'text-white' : 'text-amber-500'}`} />
            <span className="font-medium text-xs">Quick Report</span>
            {isQuickReportActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/90" />}
          </div>

          {/* Buku Besar & Jurnal */}
          <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Buku Besar & Jurnal
          </div>

          <div 
            onClick={() => setActiveTab('auto-record')}
            className={`nav-item ${activeTab === 'auto-record' ? 'active' : ''}`}
          >
            <Scan className={`w-4 h-4 shrink-0 ${activeTab === 'auto-record' ? 'text-white' : 'text-indigo-600'}`} />
            <span className="font-medium text-xs">Auto Record</span>
            <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${activeTab === 'auto-record' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}>
              AI OCR
            </span>
            {activeTab === 'auto-record' && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/90" />}
          </div>

          <div 
            onClick={() => setActiveTab('coa')}
            className={`nav-item ${activeTab === 'coa' ? 'active' : ''}`}
          >
            <ListTree className={`w-4 h-4 shrink-0 ${activeTab === 'coa' ? 'text-white' : 'text-sky-600'}`} />
            <span className="font-medium text-xs">Daftar Akun (COA)</span>
            {activeTab === 'coa' && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/90" />}
          </div>

          <div 
            onClick={() => setActiveTab('journals')}
            className={`nav-item ${activeTab === 'journals' ? 'active' : ''}`}
          >
            <BookOpen className={`w-4 h-4 shrink-0 ${activeTab === 'journals' ? 'text-white' : 'text-sky-600'}`} />
            <span className="font-medium text-xs">Jurnal Umum & AJP</span>
            {activeTab === 'journals' && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/90" />}
          </div>

          <div 
            onClick={() => setActiveTab('ledger')}
            className={`nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
          >
            <Bookmark className={`w-4 h-4 shrink-0 ${activeTab === 'ledger' ? 'text-white' : 'text-sky-600'}`} />
            <span className="font-medium text-xs">Buku Besar (Ledger)</span>
            {activeTab === 'ledger' && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/90" />}
          </div>

          {/* Laporan Keuangan */}
          <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Laporan Keuangan
          </div>

          <div 
            onClick={() => setActiveTab('simple-reports')}
            className={`nav-item ${isSimpleReportsActive ? 'active' : ''}`}
          >
            <FileText className={`w-4 h-4 shrink-0 ${isSimpleReportsActive ? 'text-white' : 'text-sky-600'}`} />
            <span className="font-medium text-xs">Laporan Sederhana</span>
            {isSimpleReportsActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/90" />}
          </div>

          <div 
            onClick={() => setActiveTab('psak-report')}
            className={`nav-item ${activeTab === 'psak-report' ? 'active' : ''}`}
          >
            <Award className={`w-4 h-4 shrink-0 ${activeTab === 'psak-report' ? 'text-white' : 'text-amber-500'}`} />
            <span className="font-medium text-xs">Laporan Resmi (PSAK)</span>
            <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${activeTab === 'psak-report' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
              PUBLIK
            </span>
          </div>

          <div 
            onClick={() => setActiveTab('ratios')}
            className={`nav-item ${activeTab === 'ratios' ? 'active' : ''}`}
          >
            <Gauge className={`w-4 h-4 shrink-0 ${activeTab === 'ratios' ? 'text-white' : 'text-sky-600'}`} />
            <span className="font-medium text-xs">Analisis Rasio & Status</span>
            {activeTab === 'ratios' && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/90" />}
          </div>

          {/* Akses Khusus Otoritas & Administrator */}
          <div className="pt-2">
            <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Akses Khusus</span>
              <ShieldAlert className="w-3.5 h-3.5 text-sky-600" />
            </div>

            <div 
              onClick={() => setActiveTab('admin-panel')}
              className={`nav-item ${activeTab === 'admin-panel' || activeTab === 'web-appearance' ? 'active' : ''}`}
            >
              <AlertTriangle className={`w-4 h-4 shrink-0 ${activeTab === 'admin-panel' || activeTab === 'web-appearance' ? 'text-white' : 'text-rose-500'}`} />
              <span className="font-medium text-xs">Administrator</span>
              <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${activeTab === 'admin-panel' || activeTab === 'web-appearance' ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                SUPER
              </span>
              {(activeTab === 'admin-panel' || activeTab === 'web-appearance') && <ChevronRight className="w-3.5 h-3.5 ml-1 text-white/90" />}
            </div>

            <div 
              onClick={() => setActiveTab('authority-panel')}
              className={`nav-item ${activeTab === 'authority-panel' ? 'active' : ''}`}
            >
              <AlertCircle className={`w-4 h-4 shrink-0 ${activeTab === 'authority-panel' ? 'text-white' : 'text-amber-500'}`} />
              <span className="font-medium text-xs">Otoritas</span>
              {activeTab === 'authority-panel' && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/90" />}
            </div>
          </div>

        </nav>

        {/* Footer Area with Activity, Settings, Logout */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/60 space-y-1">
          <div 
            onClick={() => setActiveTab('activity-logs')}
            className={`nav-item ${activeTab === 'activity-logs' ? 'active' : ''}`}
          >
            <Activity className={`w-4 h-4 shrink-0 ${activeTab === 'activity-logs' ? 'text-white' : 'text-slate-500'}`} />
            <span className="text-xs">Log Aktivitas</span>
            {activeTab === 'activity-logs' && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/90" />}
          </div>

          <div 
            onClick={() => setActiveTab('settings')}
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          >
            <Settings className={`w-4 h-4 shrink-0 ${activeTab === 'settings' ? 'text-white' : 'text-slate-500'}`} />
            <span className="text-xs">Pengaturan Akun</span>
            {activeTab === 'settings' && <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/90" />}
          </div>

          <div 
            onClick={() => {
              if (confirm("Apakah Anda yakin ingin keluar (logout) dari SPECTRA?")) {
                logout();
              }
            }}
            className="nav-item text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="font-semibold text-xs">Keluar</span>
          </div>
        </div>
      </aside>

      {/* System Diagnostics & Auto-Repair Modal */}
      <SystemDiagnosticsModal 
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
        healthState={healthState}
        onRecheck={recheckHealth}
        onAutoRepair={autoRepair}
      />
    </>
  );
};
