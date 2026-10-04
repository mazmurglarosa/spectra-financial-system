import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  PlusCircle, 
  Download, 
  Printer, 
  LogOut,
  Radio
} from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { calculateBalanceSheet, formatRupiah } from '../../utils/accountingCalculations';
import { SyncInfoModal } from '../modals/SyncInfoModal';

interface HeaderProps {
  openNewTransactionModal: (preset?: any) => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  openNewTransactionModal, 
  onLogout 
}) => {
  const { 
    settings, 
    accounts, 
    transactions, 
    currentUser, 
    exportDatabaseJson, 
    logout 
  } = useAccounting();

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Global balance verification matching SIKEU
  const balanceSheet = calculateBalanceSheet(accounts, transactions);
  const isBalanced = balanceSheet.isBalanced;
  const balanceDiff = balanceSheet.difference;

  const handleBackup = () => {
    const jsonStr = exportDatabaseJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPECTRA_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogoutClick = () => {
    if (confirm("Apakah Anda yakin ingin keluar (logout) dari SPECTRA?")) {
      logout();
      if (onLogout) onLogout();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <header 
        id="top-nav" 
        className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md no-print"
      >
        <div className="px-4 py-2 flex items-center justify-between flex-wrap gap-2">
          
          {/* Brand Info */}
          <div className="flex items-center space-x-3.5">
            <div className="bg-white p-1 rounded-md shadow-xs border border-slate-700/50 flex items-center justify-center">
              <img 
                src="./assets/NBE.png" 
                alt="Logo NBE" 
                className="h-9 w-auto object-contain"
                onError={(e) => {
                  // Fallback if relative path fails
                  (e.target as HTMLImageElement).src = './NBE.png';
                }}
              />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight text-white flex items-center space-x-2">
                <span className="text-blue-400 font-black tracking-wider text-base">SPECTRA</span>
                <span className="text-xs text-slate-400 font-medium">| {settings.companyName}</span>
                <span className="text-[11px] bg-blue-950/80 text-blue-300 px-2 py-0.5 rounded font-mono border border-blue-800/60 shadow-xs">
                  Accurate Edition
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Sistem Pencatatan dan Evaluasi Keuangan Terpadu & Akurat &bull; Periode: <span className="font-semibold text-slate-200">{settings.fiscalPeriod}</span>
              </p>
            </div>
          </div>

          {/* Action Bar & Indicators */}
          <div className="flex items-center space-x-2.5 flex-wrap">
            
            {/* Balance Status Badge */}
            <div 
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-xs transition-all duration-300 ${
                isBalanced 
                  ? 'badge-balanced' 
                  : 'badge-unbalanced'
              }`}
            >
              {isBalanced ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>STATUS: BALANCE ✓</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-700" />
                  <span>STATUS: UNBALANCED (Selisih: {formatRupiah(balanceDiff)})</span>
                </>
              )}
            </div>

            {/* Sync Badge Button */}
            <button 
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              title="Klik untuk Informasi Koneksi & Akses Web HP/Laptop" 
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800 transition hover:bg-emerald-900/80 cursor-pointer shadow-xs"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Tersinkron (Web & App)</span>
            </button>

            {/* + Jurnal Baru Button */}
            <button 
              type="button"
              onClick={() => openNewTransactionModal('general')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded flex items-center space-x-1.5 shadow transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Jurnal Baru</span>
            </button>

            {/* Backup Button */}
            <button 
              type="button"
              onClick={handleBackup}
              title="Cadangkan Seluruh Data ke File JSON" 
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded flex items-center space-x-1 border border-slate-700 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup</span>
            </button>

            {/* Print Button */}
            <button 
              type="button"
              onClick={handlePrint}
              title="Cetak Halaman Ini" 
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded flex items-center space-x-1 border border-slate-700 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>

            <div className="h-5 w-px bg-slate-700 mx-1"></div>

            {/* User Profile Badge & Logout */}
            <div className="flex items-center space-x-2 pl-1">
              <div className="text-right">
                <div className="text-xs font-bold text-white leading-tight">
                  {currentUser ? currentUser.fullName : 'Admin'}
                </div>
                <div className="text-[10px] text-amber-400 font-semibold leading-tight">
                  {currentUser?.role === 'admin' ? `👑 ${currentUser.position}` : currentUser?.position || 'Administrator'}
                </div>
              </div>
              <button 
                type="button"
                onClick={handleLogoutClick}
                title="Keluar dari Akun" 
                className="bg-rose-950/60 hover:bg-rose-800 text-rose-200 hover:text-white text-xs px-2.5 py-1.5 rounded flex items-center space-x-1 border border-rose-800/80 transition shadow-xs cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Sync Modal */}
      <SyncInfoModal 
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
      />
    </>
  );
};
