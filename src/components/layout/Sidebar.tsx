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
  Activity 
} from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';

export type ActiveTab = 
  | 'dashboard'
  | 'cashbank'
  | 'sales'
  | 'purchases'
  | 'coa'
  | 'journals'
  | 'ledger'
  | 'trial-balance'
  | 'worksheet'
  | 'profit-loss'
  | 'balance-sheet'
  | 'capital-changes'
  | 'cash-flow'
  | 'ratios'
  | 'settings'
  | 'admin-panel'
  | 'authority-panel'
  | 'activity-logs';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  openNewTransactionModal: (preset?: any) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab 
}) => {
  const { currentUser } = useAccounting();

  const isAdmin = currentUser?.role === 'admin';
  const isAuthority = currentUser?.isAuthority || isAdmin;

  return (
    <aside 
      id="sidebar" 
      className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 h-screen sticky top-0 no-print select-none"
    >
      {/* Scrollable Navigation Area */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        
        {/* Modul Akuntansi */}
        <div className="px-2 pt-1 pb-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Modul Akuntansi
        </div>

        <div 
          onClick={() => setActiveTab('dashboard')}
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>Dashboard Utama</span>
        </div>

        <div 
          onClick={() => setActiveTab('cashbank')}
          className={`nav-item ${activeTab === 'cashbank' ? 'active' : ''}`}
        >
          <Wallet className="w-4 h-4 shrink-0" />
          <span>Kas & Bank</span>
        </div>

        <div 
          onClick={() => setActiveTab('sales')}
          className={`nav-item ${activeTab === 'sales' ? 'active' : ''}`}
        >
          <ShoppingCart className="w-4 h-4 shrink-0" />
          <span>Penjualan & Piutang</span>
        </div>

        <div 
          onClick={() => setActiveTab('purchases')}
          className={`nav-item ${activeTab === 'purchases' ? 'active' : ''}`}
        >
          <Package className="w-4 h-4 shrink-0" />
          <span>Pembelian & Hutang</span>
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
          onClick={() => setActiveTab('trial-balance')}
          className={`nav-item ${activeTab === 'trial-balance' ? 'active' : ''}`}
        >
          <Scale className="w-4 h-4 shrink-0" />
          <span>Neraca Saldo</span>
        </div>

        <div 
          onClick={() => setActiveTab('worksheet')}
          className={`nav-item ${activeTab === 'worksheet' ? 'active' : ''}`}
        >
          <Table className="w-4 h-4 shrink-0" />
          <span>Neraca Lajur 10 Kolom</span>
        </div>

        <div 
          onClick={() => setActiveTab('profit-loss')}
          className={`nav-item ${activeTab === 'profit-loss' ? 'active' : ''}`}
        >
          <TrendingUp className="w-4 h-4 shrink-0" />
          <span>Laporan Laba Rugi</span>
        </div>

        <div 
          onClick={() => setActiveTab('balance-sheet')}
          className={`nav-item ${activeTab === 'balance-sheet' ? 'active' : ''}`}
        >
          <PieChart className="w-4 h-4 shrink-0" />
          <span>Laporan Posisi Keuangan</span>
        </div>

        <div 
          onClick={() => setActiveTab('capital-changes')}
          className={`nav-item ${activeTab === 'capital-changes' ? 'active' : ''}`}
        >
          <RefreshCw className="w-4 h-4 shrink-0" />
          <span>Perubahan Modal</span>
        </div>

        <div 
          onClick={() => setActiveTab('cash-flow')}
          className={`nav-item ${activeTab === 'cash-flow' ? 'active' : ''}`}
        >
          <DollarSign className="w-4 h-4 shrink-0" />
          <span>Laporan Arus Kas</span>
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
  );
};
