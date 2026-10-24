import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Wallet, 
  ShoppingCart, 
  Package, 
  Printer, 
  Calendar 
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { CashBankView } from './CashBankView';
import { SalesView } from './SalesView';
import { PurchasesView } from './PurchasesView';
import { formatPeriodDisplay } from '../utils/formatPeriod';

export type QuickReportSubTab = 'cashbank' | 'sales' | 'purchases';

interface QuickReportViewProps {
  initialTab?: QuickReportSubTab;
  onTabChange?: (tab: QuickReportSubTab) => void;
  openNewTransactionModal: (preset?: any) => void;
}

export const QuickReportView: React.FC<QuickReportViewProps> = ({
  initialTab = 'cashbank',
  onTabChange,
  openNewTransactionModal
}) => {
  const { settings } = useAccounting();
  const [activeSubTab, setActiveSubTab] = useState<QuickReportSubTab>(initialTab);

  useEffect(() => {
    if (initialTab && initialTab !== activeSubTab) {
      setActiveSubTab(initialTab);
    }
  }, [initialTab]);

  const handleSelectTab = (tab: QuickReportSubTab) => {
    setActiveSubTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const renderContent = () => {
    switch (activeSubTab) {
      case 'cashbank':
        return <CashBankView openNewTransactionModal={openNewTransactionModal} embedded={true} />;
      case 'sales':
        return <SalesView openNewTransactionModal={openNewTransactionModal} embedded={true} />;
      case 'purchases':
        return <PurchasesView openNewTransactionModal={openNewTransactionModal} embedded={true} />;
      default:
        return <CashBankView openNewTransactionModal={openNewTransactionModal} embedded={true} />;
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header Section (no-print) */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0284c7] shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900">Quick Report</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Ringkasan transaksi dan buku pembantu harian: Kas & Bank riil, Penjualan & Piutang Usaha (AR), serta Pembelian & Hutang Dagang (AP).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
          <button
            onClick={() => window.print()}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-[#0a192f] hover:bg-[#11243e] text-white rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Cetak laporan"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>Cetak Halaman</span>
          </button>
        </div>
      </div>

      {/* Tab Selection Bar (Matching Image Style) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-xs sticky top-4 z-20">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => handleSelectTab('cashbank')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'cashbank'
                ? 'bg-[#0284c7] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Kas & Bank</span>
          </button>

          <button
            onClick={() => handleSelectTab('sales')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'sales'
                ? 'bg-[#0284c7] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Penjualan & Piutang</span>
          </button>

          <button
            onClick={() => handleSelectTab('purchases')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'purchases'
                ? 'bg-[#0284c7] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Pembelian & Hutang</span>
          </button>
        </div>

        {/* Right side fiscal period indicator */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shrink-0">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Periode: <strong className="text-slate-700">{formatPeriodDisplay(settings.fiscalPeriod, settings.fiscalYear)}</strong></span>
        </div>
      </div>

      {/* Selected Sub-view Content */}
      <div className="w-full">
        {renderContent()}
      </div>
    </div>
  );
};
