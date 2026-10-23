import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Printer, 
  Calendar, 
  Scale, 
  Table, 
  TrendingUp, 
  PieChart, 
  RefreshCw, 
  DollarSign 
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { TrialBalanceView } from './TrialBalanceView';
import { WorksheetView } from './WorksheetView';
import { IncomeStatementView } from './IncomeStatementView';
import { BalanceSheetView } from './BalanceSheetView';
import { CapitalStatementView } from './CapitalStatementView';
import { CashFlowView } from './CashFlowView';

export type SimpleReportSubTab = 
  | 'trial-balance'
  | 'worksheet'
  | 'profit-loss'
  | 'balance-sheet'
  | 'capital-changes'
  | 'cash-flow';

interface SimpleReportsViewProps {
  initialTab?: SimpleReportSubTab;
  onTabChange?: (tab: SimpleReportSubTab) => void;
}

export const SimpleReportsView: React.FC<SimpleReportsViewProps> = ({
  initialTab = 'trial-balance',
  onTabChange
}) => {
  const { settings } = useAccounting();
  const [activeSubTab, setActiveSubTab] = useState<SimpleReportSubTab>(initialTab);

  useEffect(() => {
    if (initialTab && initialTab !== activeSubTab) {
      setActiveSubTab(initialTab);
    }
  }, [initialTab]);

  const handleSelectTab = (tab: SimpleReportSubTab) => {
    setActiveSubTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const renderSelectedReport = () => {
    switch (activeSubTab) {
      case 'trial-balance':
        return <TrialBalanceView embedded={true} />;
      case 'worksheet':
        return <WorksheetView embedded={true} />;
      case 'profit-loss':
        return <IncomeStatementView embedded={true} />;
      case 'balance-sheet':
        return <BalanceSheetView embedded={true} />;
      case 'capital-changes':
        return <CapitalStatementView embedded={true} />;
      case 'cash-flow':
        return <CashFlowView embedded={true} />;
      default:
        return <TrialBalanceView embedded={true} />;
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header Card (no-print) */}
      <div className="no-print relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 md:p-6 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">Laporan Sederhana</h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full">
                Internal & Operasional
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Pusat laporan keuangan operasional lengkap: Neraca Saldo, Neraca Lajur 10 Kolom, Laba Rugi, Posisi Keuangan, Perubahan Modal, dan Arus Kas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
          <button
            onClick={() => window.print()}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700 shadow-sm transition-all active:scale-95 cursor-pointer"
            title="Cetak laporan"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* Tab Selection Bar (Style from Image 2) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm sticky top-4 z-20">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => handleSelectTab('trial-balance')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'trial-balance'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Neraca Saldo</span>
          </button>

          <button
            onClick={() => handleSelectTab('worksheet')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'worksheet'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Neraca Lajur 10 Kolom</span>
          </button>

          <button
            onClick={() => handleSelectTab('profit-loss')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'profit-loss'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Laporan Laba Rugi</span>
          </button>

          <button
            onClick={() => handleSelectTab('balance-sheet')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'balance-sheet'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Laporan Posisi Keuangan</span>
          </button>

          <button
            onClick={() => handleSelectTab('capital-changes')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'capital-changes'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Perubahan Modal</span>
          </button>

          <button
            onClick={() => handleSelectTab('cash-flow')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'cash-flow'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Laporan Arus Kas</span>
          </button>
        </div>

        {/* Right side fiscal period indicator */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shrink-0">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Periode: <strong className="text-slate-700">{settings.fiscalPeriod} ({settings.fiscalYear})</strong></span>
        </div>
      </div>

      {/* Selected Report Content */}
      <div className="w-full">
        {renderSelectedReport()}
      </div>
    </div>
  );
};
