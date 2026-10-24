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
        <div className="px-4 py-2.5 flex items-center justify-between flex-wrap gap-2.5">
          
          {/* Breadcrumb matching Reference Image */}
          <div className="flex items-center space-x-2.5">
            {onToggleMobileSidebar && (
              <button
                type="button"
                onClick={onToggleMobileSidebar}
                className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus:outline-none transition-colors border border-slate-200"
                title="Buka Navigasi Menu"
                aria-label="Toggle Navigation"
              >
                <Menu className="w-5 h-5 text-sky-600" />
              </button>
            )}
            
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 tracking-tight">
                {settings.companyName || 'PT Nirwana Bhumi Energi'}
              </span>
              <span className="text-slate-300 font-light text-sm">/</span>
              <span className="text-xs font-medium text-slate-500">
                Dashboard & Sistem Keuangan
              </span>
            </div>
          </div>

          {/* Action Bar & Indicators Matching Reference Image */}
          <div className="flex items-center space-x-2 flex-wrap">
            {/* Balance Status Badge */}
            <div 
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all ${
                isBalanced 
                  ? 'bg-sky-50 text-sky-800 border border-sky-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {isBalanced ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                  <span>Neraca Seimbang</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Selisih: {formatRupiah(balanceDiff)}</span>
                </>
              )}
            </div>


            {/* Print Button */}
            <button 
              type="button"
              onClick={handlePrint}
              title="Cetak Halaman Ini" 
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg flex items-center space-x-1 border border-slate-200 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Cetak</span>
            </button>

            <div className="h-5 w-px bg-slate-200 mx-1"></div>

            {/* User Profile Badge & Logout */}
            <div className="flex items-center space-x-2 pl-1">
              <div className="text-right hidden sm:block">
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
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs px-2.5 py-1.5 rounded-lg flex items-center space-x-1 border border-rose-200 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>

          </div>
        </div>
      </header>
    </>
  );
};
