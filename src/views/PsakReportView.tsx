import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  CheckCircle, 
  Layers, 
  Calendar, 
  Building2, 
  Globe, 
  FileSpreadsheet,
  Award,
  ChevronRight,
  TrendingUp,
  PieChart,
  RefreshCw,
  DollarSign
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { generatePsakReportData, exportFullPsakWorkbook, PsakLineItem } from '../utils/psakReportGenerator';
import { formatRupiah } from '../utils/accountingCalculations';

export type PsakSubTab = 'all' | 'balance-sheet' | 'income' | 'equity' | 'cash-flow';

export const PsakReportView: React.FC<{ initialSubTab?: PsakSubTab }> = ({ initialSubTab = 'all' }) => {
  const { accounts, transactions, settings } = useAccounting();
  const [activeSubTab, setActiveSubTab] = useState<PsakSubTab>(initialSubTab);
  const [bilingual, setBilingual] = useState<boolean>(true);

  // Generate automated PSAK data
  const data = generatePsakReportData(accounts, transactions, settings);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    exportFullPsakWorkbook(data);
  };

  const formatNumber = (val: number) => {
    if (val === 0) return '-';
    if (val < 0) {
      return `(${Math.abs(val).toLocaleString('id-ID')})`;
    }
    return val.toLocaleString('id-ID');
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
      
      {/* Top Banner & Action Controls (no-print) */}
      <div className="no-print flex flex-col gap-4">
        {/* Compliance / Info Badge */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-xl border border-indigo-800/40 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-lg text-amber-300 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Laporan Keuangan Standar Publik / PSAK Resmi</h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  Format Dokumen Contoh (IDX / OJK)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Disusun otomatis secara bilingual (Indonesia - Inggris) dengan nomor catatan atas laporan keuangan (CALK), komparasi tahun buku berjalan & sebelumnya, serta lembar tanda tangan otentik Direksi sesuai standar laporan keuangan publik.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
            <button
              onClick={handlePrint}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all active:scale-95"
              title="Unduh file PDF resmi atau cetak langsung"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Unduh PDF</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all active:scale-95"
              title="Unduh seluruh buku laporan keuangan dalam format Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Unduh Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Tab & Filter Selection Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveSubTab('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeSubTab === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Buku Lengkap (4 Laporan)</span>
            </button>

            <button
              onClick={() => setActiveSubTab('balance-sheet')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeSubTab === 'balance-sheet'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>Posisi Keuangan (Neraca)</span>
            </button>

            <button
              onClick={() => setActiveSubTab('income')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeSubTab === 'income'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Laba Rugi Komprehensif</span>
            </button>

            <button
              onClick={() => setActiveSubTab('equity')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeSubTab === 'equity'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Perubahan Ekuitas</span>
            </button>

            <button
              onClick={() => setActiveSubTab('cash-flow')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeSubTab === 'cash-flow'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Arus Kas (Cash Flow)</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={bilingual}
                onChange={(e) => setBilingual(e.target.checked)}
                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>Format Bilingual (ID / EN)</span>
            </label>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* PRINTABLE OFFICIAL FINANCIAL STATEMENTS (Mirrors the PDF 1-to-1) */}
      {/* ============================================================== */}
      <div className="psak-printable-container space-y-12">
        
        {/* 1. POSISI KEUANGAN (NERACA) */}
        {(activeSubTab === 'all' || activeSubTab === 'balance-sheet') && (
          <div className="psak-sheet bg-white p-8 sm:p-12 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0">
            {/* Running Header */}
            <div className="text-[10px] italic text-slate-500 text-right pb-3 border-b border-slate-200 mb-6">
              The original consolidated financial statements included herein are in Indonesian language.
            </div>

            {/* Formal Header */}
            <div className="text-center space-y-1 mb-8">
              <h2 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                PT {settings.companyName.toUpperCase()} TBK DAN ENTITAS ANAKNYA / AND ITS SUBSIDIARIES
              </h2>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                LAPORAN POSISI KEUANGAN KONSOLIDASIAN
              </h3>
              {bilingual && (
                <div className="text-sm font-semibold text-slate-600 italic">
                  CONSOLIDATED STATEMENT OF FINANCIAL POSITION
                </div>
              )}
              <div className="text-xs font-semibold text-slate-800 pt-1">
                Per {data.periodText} dan 31 Desember {data.priorYear}
              </div>
              {bilingual && (
                <div className="text-[11px] text-slate-500 italic">
                  As of {data.periodText} and December 31, {data.priorYear}
                </div>
              )}
              <div className="text-[10px] text-slate-500 pt-1">
                ({data.currencyText})
              </div>
            </div>

            {/* 5-Column Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-t-2 border-b-2 border-slate-900 font-bold text-slate-900">
                    <th className="py-2.5 text-left w-[42%] uppercase">Keterangan</th>
                    <th className="py-2.5 text-center w-[8%] uppercase">Catatan / Notes</th>
                    <th className="py-2.5 text-right w-[15%]">31 Des {data.currentYear}</th>
                    <th className="py-2.5 text-right w-[15%]">31 Des {data.priorYear}</th>
                    {bilingual && <th className="py-2.5 text-right w-[20%] uppercase italic text-slate-600">Line Item (EN)</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  
                  {/* ASET */}
                  <tr className="bg-slate-50/70 font-bold text-slate-900">
                    <td colSpan={bilingual ? 5 : 4} className="py-2 text-left uppercase tracking-wider text-[11px]">
                      ASET / ASSETS
                    </td>
                  </tr>

                  {/* ASET LANCAR */}
                  <tr className="font-bold text-slate-800">
                    <td colSpan={bilingual ? 5 : 4} className="py-1.5 pl-3 text-left">
                      ASET LANCAR / CURRENT ASSETS
                    </td>
                  </tr>
                  {data.balanceSheet.assetsCurrent.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-center font-mono text-[11px] text-slate-500">{item.note || '-'}</td>
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-300">
                    <td className="py-1.5 pl-6">Jumlah Aset Lancar</td>
                    <td className="py-1.5 text-center"></td>
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalAssetsCurrent.current)}</td>
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalAssetsCurrent.prior)}</td>
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700">Total Current Assets</td>}
                  </tr>

                  {/* ASET TIDAK LANCAR */}
                  <tr className="font-bold text-slate-800 pt-3">
                    <td colSpan={bilingual ? 5 : 4} className="py-2 pl-3 text-left">
                      ASET TIDAK LANCAR / NON-CURRENT ASSETS
                    </td>
                  </tr>
                  {data.balanceSheet.assetsNonCurrent.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-center font-mono text-[11px] text-slate-500">{item.note || '-'}</td>
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-300">
                    <td className="py-1.5 pl-6">Jumlah Aset Tidak Lancar</td>
                    <td className="py-1.5 text-center"></td>
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalAssetsNonCurrent.current)}</td>
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalAssetsNonCurrent.prior)}</td>
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700">Total Non-Current Assets</td>}
                  </tr>

                  {/* TOTAL ASET */}
                  <tr className="font-extrabold text-slate-900 bg-slate-100/60 border-t-2 border-b-2 border-slate-900">
                    <td className="py-2 pl-3 uppercase">JUMLAH ASET</td>
                    <td className="py-2 text-center"></td>
                    <td className="py-2 text-right font-mono double-underline">{formatNumber(data.balanceSheet.totalAssets.current)}</td>
                    <td className="py-2 text-right font-mono double-underline">{formatNumber(data.balanceSheet.totalAssets.prior)}</td>
                    {bilingual && <td className="py-2 text-right italic uppercase">TOTAL ASSETS</td>}
                  </tr>

                  {/* LIABILITAS */}
                  <tr className="bg-slate-50/70 font-bold text-slate-900">
                    <td colSpan={bilingual ? 5 : 4} className="py-2 text-left uppercase tracking-wider text-[11px]">
                      LIABILITAS DAN EKUITAS / LIABILITIES AND EQUITY
                    </td>
                  </tr>
                  <tr className="font-bold text-slate-800">
                    <td colSpan={bilingual ? 5 : 4} className="py-1.5 pl-3 text-left">
                      LIABILITAS JANGKA PENDEK / CURRENT LIABILITIES
                    </td>
                  </tr>
                  {data.balanceSheet.liabilitiesCurrent.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-center font-mono text-[11px] text-slate-500">{item.note || '-'}</td>
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-300">
                    <td className="py-1.5 pl-6">Jumlah Liabilitas Jangka Pendek</td>
                    <td className="py-1.5 text-center"></td>
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalLiabilitiesCurrent.current)}</td>
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalLiabilitiesCurrent.prior)}</td>
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700">Total Current Liabilities</td>}
                  </tr>

                  {/* LIABILITAS JANGKA PANJANG */}
                  <tr className="font-bold text-slate-800">
                    <td colSpan={bilingual ? 5 : 4} className="py-1.5 pl-3 text-left">
                      LIABILITAS JANGKA PANJANG / NON-CURRENT LIABILITIES
                    </td>
                  </tr>
                  {data.balanceSheet.liabilitiesNonCurrent.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-center font-mono text-[11px] text-slate-500">{item.note || '-'}</td>
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-300">
                    <td className="py-1.5 pl-6">Jumlah Liabilitas Jangka Panjang</td>
                    <td className="py-1.5 text-center"></td>
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalLiabilitiesNonCurrent.current)}</td>
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalLiabilitiesNonCurrent.prior)}</td>
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700">Total Non-Current Liabilities</td>}
                  </tr>

                  {/* JUMLAH LIABILITAS */}
                  <tr className="font-bold text-slate-900 bg-slate-50 border-t border-b border-slate-400">
                    <td className="py-1.5 pl-3 uppercase">JUMLAH LIABILITAS</td>
                    <td className="py-1.5 text-center"></td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.balanceSheet.totalLiabilities.current)}</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.balanceSheet.totalLiabilities.prior)}</td>
                    {bilingual && <td className="py-1.5 text-right italic uppercase">TOTAL LIABILITIES</td>}
                  </tr>

                  {/* EKUITAS */}
                  <tr className="font-bold text-slate-800">
                    <td colSpan={bilingual ? 5 : 4} className="py-1.5 pl-3 text-left">
                      EKUITAS / EQUITY
                    </td>
                  </tr>
                  {data.balanceSheet.equity.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-center font-mono text-[11px] text-slate-500">{item.note || '-'}</td>
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-300">
                    <td className="py-1.5 pl-6">JUMLAH EKUITAS</td>
                    <td className="py-1.5 text-center"></td>
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalEquity.current)}</td>
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalEquity.prior)}</td>
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700 uppercase">TOTAL EQUITY</td>}
                  </tr>

                  {/* TOTAL LIABILITAS & EKUITAS */}
                  <tr className="font-extrabold text-slate-900 bg-slate-100/60 border-t-2 border-b-2 border-slate-900">
                    <td className="py-2 pl-3 uppercase">JUMLAH LIABILITAS DAN EKUITAS</td>
                    <td className="py-2 text-center"></td>
                    <td className="py-2 text-right font-mono double-underline">{formatNumber(data.balanceSheet.totalLiabilitiesAndEquity.current)}</td>
                    <td className="py-2 text-right font-mono double-underline">{formatNumber(data.balanceSheet.totalLiabilitiesAndEquity.prior)}</td>
                    {bilingual && <td className="py-2 text-right italic uppercase">TOTAL LIABILITIES AND EQUITY</td>}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Official PDF Footnote */}
            <div className="mt-8 pt-4 border-t border-slate-200 text-[10px] text-slate-500 italic text-center space-y-0.5">
              <div>Catatan atas laporan keuangan konsolidasian terlampir merupakan bagian yang tidak terpisahkan dari laporan keuangan konsolidasian secara keseluruhan.</div>
              {bilingual && <div>The accompanying notes to the consolidated financial statements form an integral part of these consolidated financial statements taken as a whole.</div>}
            </div>

            {/* Signature Block */}
            <div className="mt-10 pt-6 border-t border-dashed border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="space-y-12">
                <div className="text-slate-600 font-medium">Disiapkan oleh / Prepared by:</div>
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 underline">{settings.preparerName || 'Mazmur Gusti Agung L'}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">{settings.preparerTitle || 'Direktur Keuangan'}</div>
                </div>
              </div>

              <div className="space-y-12">
                <div className="text-slate-600 font-medium">Disetujui oleh / Approved by:</div>
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 underline">{settings.approverName || 'Direktur Utama'}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">{settings.approverTitle || 'Direktur Utama'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. LABA RUGI KOMPREHENSIF */}
        {(activeSubTab === 'all' || activeSubTab === 'income') && (
          <div className="psak-sheet bg-white p-8 sm:p-12 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0 page-break">
            {/* Running Header */}
            <div className="text-[10px] italic text-slate-500 text-right pb-3 border-b border-slate-200 mb-6">
              The original consolidated financial statements included herein are in Indonesian language.
            </div>

            {/* Formal Header */}
            <div className="text-center space-y-1 mb-8">
              <h2 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                PT {settings.companyName.toUpperCase()} TBK DAN ENTITAS ANAKNYA / AND ITS SUBSIDIARIES
              </h2>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                LAPORAN LABA RUGI DAN PENGHASILAN KOMPREHENSIF LAIN KONSOLIDASIAN
              </h3>
              {bilingual && (
                <div className="text-sm font-semibold text-slate-600 italic">
                  CONSOLIDATED STATEMENT OF PROFIT OR LOSS AND OTHER COMPREHENSIVE INCOME
                </div>
              )}
              <div className="text-xs font-semibold text-slate-800 pt-1">
                Untuk Tahun yang Berakhir pada Tanggal {data.periodText} dan {data.priorYear}
              </div>
              {bilingual && (
                <div className="text-[11px] text-slate-500 italic">
                  For the Years Ended {data.periodText} and {data.priorYear}
                </div>
              )}
              <div className="text-[10px] text-slate-500 pt-1">
                ({data.currencyText})
              </div>
            </div>

            {/* Income Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-t-2 border-b-2 border-slate-900 font-bold text-slate-900">
                    <th className="py-2.5 text-left w-[42%] uppercase">Keterangan</th>
                    <th className="py-2.5 text-center w-[8%] uppercase">Catatan / Notes</th>
                    <th className="py-2.5 text-right w-[15%]">Tahun {data.currentYear}</th>
                    <th className="py-2.5 text-right w-[15%]">Tahun {data.priorYear}</th>
                    {bilingual && <th className="py-2.5 text-right w-[20%] uppercase italic text-slate-600">Line Item (EN)</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {data.incomeStatement.items.map((item) => {
                    const isTotal = item.isTotal;
                    const isSubtotal = item.isSubtotal;
                    const isBold = item.isBold;

                    return (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-slate-50/50 ${
                          isTotal 
                            ? 'bg-slate-100/70 font-extrabold text-slate-900 border-t-2 border-b-2 border-slate-900' 
                            : isSubtotal 
                            ? 'font-bold bg-slate-50 text-slate-900 border-t border-b border-slate-300' 
                            : isBold 
                            ? 'font-bold text-slate-900' 
                            : ''
                        }`}
                      >
                        <td className={`py-1.5 ${item.indent ? 'pl-6 text-slate-600' : 'pl-3'}`}>
                          {item.nameId}
                        </td>
                        <td className="py-1.5 text-center font-mono text-[11px] text-slate-500">
                          {item.note || '-'}
                        </td>
                        <td className={`py-1.5 text-right font-mono ${isTotal ? 'double-underline' : ''}`}>
                          {formatNumber(item.amountCurrent)}
                        </td>
                        <td className={`py-1.5 text-right font-mono text-slate-600 ${isTotal ? 'double-underline' : ''}`}>
                          {formatNumber(item.amountPrior)}
                        </td>
                        {bilingual && (
                          <td className={`py-1.5 text-right italic ${item.indent ? 'text-slate-400' : 'text-slate-600'}`}>
                            {item.nameEn}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Official PDF Footnote */}
            <div className="mt-8 pt-4 border-t border-slate-200 text-[10px] text-slate-500 italic text-center space-y-0.5">
              <div>Catatan atas laporan keuangan konsolidasian terlampir merupakan bagian yang tidak terpisahkan dari laporan keuangan konsolidasian secara keseluruhan.</div>
              {bilingual && <div>The accompanying notes to the consolidated financial statements form an integral part of these consolidated financial statements taken as a whole.</div>}
            </div>

            {/* Signature Block */}
            <div className="mt-10 pt-6 border-t border-dashed border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="space-y-12">
                <div className="text-slate-600 font-medium">Disiapkan oleh / Prepared by:</div>
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 underline">{settings.preparerName || 'Mazmur Gusti Agung L'}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">{settings.preparerTitle || 'Direktur Keuangan'}</div>
                </div>
              </div>

              <div className="space-y-12">
                <div className="text-slate-600 font-medium">Disetujui oleh / Approved by:</div>
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 underline">{settings.approverName || 'Direktur Utama'}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">{settings.approverTitle || 'Direktur Utama'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. PERUBAHAN EKUITAS */}
        {(activeSubTab === 'all' || activeSubTab === 'equity') && (
          <div className="psak-sheet bg-white p-8 sm:p-12 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0 page-break">
            {/* Running Header */}
            <div className="text-[10px] italic text-slate-500 text-right pb-3 border-b border-slate-200 mb-6">
              The original consolidated financial statements included herein are in Indonesian language.
            </div>

            {/* Formal Header */}
            <div className="text-center space-y-1 mb-8">
              <h2 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                PT {settings.companyName.toUpperCase()} TBK DAN ENTITAS ANAKNYA / AND ITS SUBSIDIARIES
              </h2>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                LAPORAN PERUBAHAN EKUITAS KONSOLIDASIAN
              </h3>
              {bilingual && (
                <div className="text-sm font-semibold text-slate-600 italic">
                  CONSOLIDATED STATEMENT OF CHANGES IN EQUITY
                </div>
              )}
              <div className="text-xs font-semibold text-slate-800 pt-1">
                Untuk Tahun yang Berakhir pada Tanggal {data.periodText}
              </div>
              <div className="text-[10px] text-slate-500 pt-1">
                ({data.currencyText})
              </div>
            </div>

            {/* Equity Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-t-2 border-b-2 border-slate-900 font-bold text-slate-900">
                    <th className="py-2.5 text-left w-[30%]">Keterangan / Description</th>
                    <th className="py-2.5 text-right w-[14%]">Modal Saham</th>
                    <th className="py-2.5 text-right w-[14%]">Tambahan Modal</th>
                    <th className="py-2.5 text-right w-[14%]">Cadangan Umum</th>
                    <th className="py-2.5 text-right w-[14%]">Saldo Laba</th>
                    <th className="py-2.5 text-right w-[14%]">Total Ekuitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {data.equityStatement.rows.map((row, idx) => {
                    const isLast = idx === data.equityStatement.rows.length - 1;
                    return (
                      <tr 
                        key={idx} 
                        className={`hover:bg-slate-50/50 ${
                          isLast ? 'bg-slate-100/70 font-extrabold text-slate-900 border-t-2 border-b-2 border-slate-900' : ''
                        }`}
                      >
                        <td className="py-2 pl-3">
                          <div className="font-semibold text-slate-800">{row.descriptionId}</div>
                          {bilingual && <div className="text-[10px] italic text-slate-500">{row.descriptionEn}</div>}
                        </td>
                        <td className={`py-2 text-right font-mono ${isLast ? 'double-underline' : ''}`}>{formatNumber(row.capitalStock)}</td>
                        <td className={`py-2 text-right font-mono ${isLast ? 'double-underline' : ''}`}>{formatNumber(row.additionalPaidIn)}</td>
                        <td className={`py-2 text-right font-mono ${isLast ? 'double-underline' : ''}`}>{formatNumber(row.generalReserve)}</td>
                        <td className={`py-2 text-right font-mono ${isLast ? 'double-underline' : ''}`}>{formatNumber(row.retainedEarnings)}</td>
                        <td className={`py-2 text-right font-mono font-bold ${isLast ? 'double-underline' : ''}`}>{formatNumber(row.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Official PDF Footnote */}
            <div className="mt-8 pt-4 border-t border-slate-200 text-[10px] text-slate-500 italic text-center space-y-0.5">
              <div>Catatan atas laporan keuangan konsolidasian terlampir merupakan bagian yang tidak terpisahkan dari laporan keuangan konsolidasian secara keseluruhan.</div>
              {bilingual && <div>The accompanying notes to the consolidated financial statements form an integral part of these consolidated financial statements taken as a whole.</div>}
            </div>

            {/* Signature Block */}
            <div className="mt-10 pt-6 border-t border-dashed border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="space-y-12">
                <div className="text-slate-600 font-medium">Disiapkan oleh / Prepared by:</div>
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 underline">{settings.preparerName || 'Mazmur Gusti Agung L'}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">{settings.preparerTitle || 'Direktur Keuangan'}</div>
                </div>
              </div>

              <div className="space-y-12">
                <div className="text-slate-600 font-medium">Disetujui oleh / Approved by:</div>
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 underline">{settings.approverName || 'Direktur Utama'}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">{settings.approverTitle || 'Direktur Utama'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. ARUS KAS (DIRECT METHOD) */}
        {(activeSubTab === 'all' || activeSubTab === 'cash-flow') && (
          <div className="psak-sheet bg-white p-8 sm:p-12 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0 page-break">
            {/* Running Header */}
            <div className="text-[10px] italic text-slate-500 text-right pb-3 border-b border-slate-200 mb-6">
              The original consolidated financial statements included herein are in Indonesian language.
            </div>

            {/* Formal Header */}
            <div className="text-center space-y-1 mb-8">
              <h2 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                PT {settings.companyName.toUpperCase()} TBK DAN ENTITAS ANAKNYA / AND ITS SUBSIDIARIES
              </h2>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                LAPORAN ARUS KAS KONSOLIDASIAN
              </h3>
              {bilingual && (
                <div className="text-sm font-semibold text-slate-600 italic">
                  CONSOLIDATED STATEMENT OF CASH FLOWS
                </div>
              )}
              <div className="text-xs font-semibold text-slate-800 pt-1">
                Untuk Tahun yang Berakhir pada Tanggal {data.periodText} dan {data.priorYear}
              </div>
              <div className="text-[10px] text-slate-500 pt-1">
                ({data.currencyText})
              </div>
            </div>

            {/* Cash Flow Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-t-2 border-b-2 border-slate-900 font-bold text-slate-900">
                    <th className="py-2.5 text-left w-[42%] uppercase">Keterangan</th>
                    <th className="py-2.5 text-center w-[8%] uppercase">Catatan / Notes</th>
                    <th className="py-2.5 text-right w-[15%]">Tahun {data.currentYear}</th>
                    <th className="py-2.5 text-right w-[15%]">Tahun {data.priorYear}</th>
                    {bilingual && <th className="py-2.5 text-right w-[20%] uppercase italic text-slate-600">Line Item (EN)</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  
                  {/* ARUS KAS OPERASI */}
                  <tr className="bg-slate-50/70 font-bold text-slate-900">
                    <td colSpan={bilingual ? 5 : 4} className="py-2 text-left uppercase tracking-wider text-[11px]">
                      ARUS KAS DARI AKTIVITAS OPERASI / CASH FLOWS FROM OPERATING ACTIVITIES
                    </td>
                  </tr>
                  {data.cashFlow.operating.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-center font-mono text-[11px] text-slate-500">-</td>
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-400 bg-slate-50">
                    <td className="py-1.5 pl-6">Kas Neto yang Diperoleh dari Aktivitas Operasi</td>
                    <td className="py-1.5 text-center"></td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.totalOperating.current)}</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.totalOperating.prior)}</td>
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700">Net Cash Provided by Operating Activities</td>}
                  </tr>

                  {/* ARUS KAS INVESTASI */}
                  <tr className="bg-slate-50/70 font-bold text-slate-900 pt-3">
                    <td colSpan={bilingual ? 5 : 4} className="py-2 text-left uppercase tracking-wider text-[11px]">
                      ARUS KAS DARI AKTIVITAS INVESTASI / CASH FLOWS FROM INVESTING ACTIVITIES
                    </td>
                  </tr>
                  {data.cashFlow.investing.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-center font-mono text-[11px] text-slate-500">-</td>
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-400 bg-slate-50">
                    <td className="py-1.5 pl-6">Kas Neto yang Digunakan untuk Aktivitas Investasi</td>
                    <td className="py-1.5 text-center"></td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.totalInvesting.current)}</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.totalInvesting.prior)}</td>
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700">Net Cash Used in Investing Activities</td>}
                  </tr>

                  {/* ARUS KAS PENDANAAN */}
                  <tr className="bg-slate-50/70 font-bold text-slate-900 pt-3">
                    <td colSpan={bilingual ? 5 : 4} className="py-2 text-left uppercase tracking-wider text-[11px]">
                      ARUS KAS DARI AKTIVITAS PENDANAAN / CASH FLOWS FROM FINANCING ACTIVITIES
                    </td>
                  </tr>
                  {data.cashFlow.financing.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-center font-mono text-[11px] text-slate-500">-</td>
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-400 bg-slate-50">
                    <td className="py-1.5 pl-6">Kas Neto yang Diperoleh untuk Aktivitas Pendanaan</td>
                    <td className="py-1.5 text-center"></td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.totalFinancing.current)}</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.totalFinancing.prior)}</td>
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700">Net Cash Provided by Financing Activities</td>}
                  </tr>

                  {/* RINGKASAN SALDO KAS */}
                  <tr className="font-extrabold text-slate-900 bg-slate-100/70 border-t-2 border-slate-900">
                    <td className="py-2 pl-3 uppercase">KENAIKAN (PENURUNAN) NETO KAS DAN SETARA KAS</td>
                    <td className="py-2 text-center"></td>
                    <td className="py-2 text-right font-mono">{formatNumber(data.cashFlow.netChange.current)}</td>
                    <td className="py-2 text-right font-mono">{formatNumber(data.cashFlow.netChange.prior)}</td>
                    {bilingual && <td className="py-2 text-right italic uppercase">NET INCREASE IN CASH AND CASH EQUIVALENTS</td>}
                  </tr>

                  <tr className="font-bold text-slate-800">
                    <td className="py-1.5 pl-3">KAS DAN SETARA KAS PADA AWAL TAHUN</td>
                    <td className="py-1.5 text-center"></td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.beginningCash.current)}</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.beginningCash.prior)}</td>
                    {bilingual && <td className="py-1.5 text-right italic">CASH AND CASH EQUIVALENTS AT BEGINNING OF YEAR</td>}
                  </tr>

                  <tr className="font-extrabold text-slate-900 bg-slate-100/80 border-t border-b-2 border-slate-900">
                    <td className="py-2 pl-3 uppercase">KAS DAN SETARA KAS PADA AKHIR TAHUN</td>
                    <td className="py-2 text-center"></td>
                    <td className="py-2 text-right font-mono double-underline">{formatNumber(data.cashFlow.endingCash.current)}</td>
                    <td className="py-2 text-right font-mono double-underline">{formatNumber(data.cashFlow.endingCash.prior)}</td>
                    {bilingual && <td className="py-2 text-right italic uppercase">CASH AND CASH EQUIVALENTS AT END OF YEAR</td>}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Official PDF Footnote */}
            <div className="mt-8 pt-4 border-t border-slate-200 text-[10px] text-slate-500 italic text-center space-y-0.5">
              <div>Catatan atas laporan keuangan konsolidasian terlampir merupakan bagian yang tidak terpisahkan dari laporan keuangan konsolidasian secara keseluruhan.</div>
              {bilingual && <div>The accompanying notes to the consolidated financial statements form an integral part of these consolidated financial statements taken as a whole.</div>}
            </div>

            {/* Signature Block */}
            <div className="mt-10 pt-6 border-t border-dashed border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="space-y-12">
                <div className="text-slate-600 font-medium">Disiapkan oleh / Prepared by:</div>
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 underline">{settings.preparerName || 'Mazmur Gusti Agung L'}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">{settings.preparerTitle || 'Direktur Keuangan'}</div>
                </div>
              </div>

              <div className="space-y-12">
                <div className="text-slate-600 font-medium">Disetujui oleh / Approved by:</div>
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 underline">{settings.approverName || 'Direktur Utama'}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">{settings.approverTitle || 'Direktur Utama'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
