import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  LogOut,
  Menu
} from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { calculateBalanceSheet, formatRupiah } from '../../utils/accountingCalculations';

interface HeaderProps {
  openNewTransactionModal: (preset?: any) => void;
  onLogout?: () => void;
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  openNewTransactionModal: _openNewTransactionModal, 
  onLogout,
  onToggleMobileSidebar
}) => {
  const { 
    settings, 
    accounts, 
    transactions, 
    currentUser, 
    logout 
  } = useAccounting();

  // Global balance verification matching SIKEU
  const balanceSheet = calculateBalanceSheet(accounts, transactions);
  const isBalanced = balanceSheet.isBalanced;
  const balanceDiff = balanceSheet.difference;

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
        className="bg-white text-slate-800 border-b border-slate-200/90 sticky top-0 z-30 shadow-xs no-print"
      >
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2">
          
          {/* Breadcrumb & Mobile Menu Trigger */}
          <div className="flex items-center space-x-2 min-w-0">
            {onToggleMobileSidebar && (
              <button
                type="button"
                onClick={onToggleMobileSidebar}
                className="md:hidden w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors border border-slate-200 active:scale-95 cursor-pointer shrink-0"
                title="Buka Navigasi Menu"
                aria-label="Toggle Navigation"
              >
                <Menu className="w-5 h-5 text-sky-600" />
              </button>
            )}
            
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight truncate max-w-[140px] sm:max-w-xs md:max-w-none">
                {settings.companyName || 'PT Nirwana Bhumi Energi'}
              </span>
              <span className="text-slate-300 font-light text-xs hidden sm:inline">/</span>
              <span className="text-xs font-medium text-slate-500 hidden sm:inline truncate">
                Dashboard &amp; Sistem Keuangan
              </span>
            </div>
          </div>

          {/* Action Bar & Indicators */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Balance Status Badge */}
            <div 
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all ${
                isBalanced 
                  ? 'bg-sky-50 text-sky-800 border border-sky-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {isBalanced ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span className="hidden sm:inline">Neraca Seimbang</span>
                  <span className="sm:hidden text-[11px]">Seimbang</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="hidden sm:inline">Selisih: {formatRupiah(balanceDiff)}</span>
                  <span className="sm:hidden text-[11px] font-mono">-{formatRupiah(balanceDiff)}</span>
                </>
              )}
            </div>

            {/* Print Button (Hidden on small mobile screens to keep header uncluttered) */}
            <button 
              type="button"
              onClick={handlePrint}
              title="Cetak Halaman Ini" 
              className="hidden sm:flex bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg items-center space-x-1 border border-slate-200 transition cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Cetak</span>
            </button>

            <div className="hidden sm:block h-5 w-px bg-slate-200 mx-0.5"></div>

            {/* User Profile Badge & Logout */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 pl-0.5 sm:pl-1">
              <div className="text-right hidden md:block">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {currentUser ? currentUser.fullName : 'Admin'}
                </div>
                <div className="text-[10px] text-sky-600 font-semibold leading-tight">
                  {currentUser?.position || (currentUser?.role === 'admin' ? 'Super Administrator' : 'Staf Akuntansi')}
                </div>
              </div>
              <button 
                type="button"
                onClick={handleLogoutClick}
                title="Keluar dari Akun" 
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs px-2.5 py-1.5 rounded-lg flex items-center space-x-1 border border-rose-200 transition cursor-pointer active:scale-95 min-h-[34px]"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs">Keluar</span>
              </button>
            </div>

          </div>
        </div>
      </header>
    </>
  );
};
