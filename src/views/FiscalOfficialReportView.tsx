import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  Printer,
  FileSpreadsheet,
  Globe,
  Layers,
  Scale,
  TrendingUp,
  PieChart,
  RefreshCw,
  DollarSign,
  SlidersHorizontal,
  ArrowUpRight,
  CheckCircle2
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import {
  generateFiscalPsakReportData,
  exportFullPsakWorkbook
} from '../utils/psakReportGenerator';
import { formatRupiah } from '../utils/accountingCalculations';
import { ActiveTab } from '../components/layout/Sidebar';

export type FiscalOfficialSubTab = 'all' | 'income' | 'balance-sheet' | 'equity' | 'cash-flow';

interface FiscalOfficialReportViewProps {
  setActiveTab?: (tab: ActiveTab) => void;
}

export const FiscalOfficialReportView: React.FC<FiscalOfficialReportViewProps> = ({ setActiveTab }) => {
  const { accounts, transactions, settings, fiscalSummary, fiscalTaxCalc } = useAccounting();
  const [activeSubTab, setActiveSubTab] = useState<FiscalOfficialSubTab>('all');
  const [bilingual, setBilingual] = useState<boolean>(true);
  const [showReconciliationTrace, setShowReconciliationTrace] = useState<boolean>(false);

  const preparerName = settings.accountantName || settings.preparerName || 'Mazmur Gusti Agung L';
  const preparerTitle = settings.accountantTitle || settings.preparerTitle || 'Direktur Keuangan';
  const approverName = settings.directorName || settings.approverName || 'Sudono Salim';
  const approverTitle = settings.directorTitle || settings.approverTitle || 'Direktur Utama';

  const data = useMemo(
    () =>
      generateFiscalPsakReportData(
        accounts,
        transactions,
        settings,
        fiscalSummary,
        fiscalTaxCalc
      ),
    [accounts, transactions, settings, fiscalSummary, fiscalTaxCalc]
  );

  const formatNumber = (val: number) => {
    if (val === 0) return '-';
    if (val < 0) return `(${Math.abs(val).toLocaleString('id-ID')})`;
    return val.toLocaleString('id-ID');
  };

  const meta = data.fiscalSummaryMeta;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
      {/* Top Banner & Action Controls (no-print) */}
      <div className="no-print flex flex-col gap-4">
        <div className="bg-white text-slate-800 p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-[#0284c7] shrink-0">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-900">
                  Laporan Keuangan Resmi Fiskal (Pasca Koreksi)
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  TERKOREKSI OTOMATIS 1771-I
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Menampilkan laporan keuangan format resmi yang telah disesuaikan seluruhnya dengan hasil{' '}
                <strong className="text-slate-800">Rekonsiliasi Koreksi Fiskal (FPO/FNE)</strong> dan estimasi beban{' '}
                <strong className="text-slate-800">PPh Badan ({meta?.regimeLabel})</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {setActiveTab && (
              <button
                type="button"
                onClick={() => setActiveTab('fiscal-reconciliation')}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                <span>Ubah Koreksi Fiskal</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[#0a192f] hover:bg-[#11243e] text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF Resmi</span>
            </button>
            <button
              type="button"
              onClick={() => exportFullPsakWorkbook(data)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Unduh Excel Fiskal (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Live Bridge Summary Strip (Komersial -> Koreksi -> Fiskal -> Laba Setelah Pajak) */}
        {meta && (
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-[11px] text-slate-500 block">Laba Komersial (SAK)</span>
                <span className="font-mono font-bold text-slate-800">{formatRupiah(meta.commercialNetProfit)}</span>
              </div>
              <span className="text-slate-400 font-bold">+</span>
              <div>
                <span className="text-[11px] text-rose-700 block">Koreksi Positif (FPO)</span>
                <span className="font-mono font-bold text-rose-700">{formatRupiah(meta.totalPositiveCorrection)}</span>
              </div>
              <span className="text-slate-400 font-bold">-</span>
              <div>
                <span className="text-[11px] text-emerald-700 block">Koreksi Negatif (FNE)</span>
                <span className="font-mono font-bold text-emerald-700">{formatRupiah(meta.totalNegativeCorrection)}</span>
              </div>
              <span className="text-slate-400 font-bold">=</span>
              <div>
                <span className="text-[11px] text-sky-700 font-semibold block">Penghasilan Neto Fiskal</span>
                <span className="font-mono font-black text-slate-900">{formatRupiah(meta.fiscalNetProfit)}</span>
              </div>
              <span className="text-slate-400 font-bold">→</span>
              <div>
                <span className="text-[11px] text-slate-500 block">Laba Bersih Fiskal (Setelah PPh Badan)</span>
                <span className="font-mono font-black text-emerald-700">{formatRupiah(meta.fiscalNetAfterTax)}</span>
              </div>
            </div>

            {setActiveTab && (
              <button
                type="button"
                onClick={() => setActiveTab('psak-report')}
                className="text-[11px] font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Lihat Versi Komersial (PSAK)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Tab & Display Options Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all' as FiscalOfficialSubTab, label: 'Semua Laporan (All)', icon: Layers },
              { id: 'income' as FiscalOfficialSubTab, label: 'Laba Rugi Fiskal', icon: TrendingUp },
              { id: 'balance-sheet' as FiscalOfficialSubTab, label: 'Posisi Keuangan Fiskal', icon: Scale },
              { id: 'equity' as FiscalOfficialSubTab, label: 'Perubahan Ekuitas Fiskal', icon: PieChart },
              { id: 'cash-flow' as FiscalOfficialSubTab, label: 'Arus Kas', icon: DollarSign }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    activeSubTab === tab.id
                      ? 'bg-[#0a192f] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 pr-1">
            <button
              type="button"
              onClick={() => setShowReconciliationTrace(!showReconciliationTrace)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                showReconciliationTrace
                  ? 'bg-sky-50 text-sky-700 border-sky-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Tampilkan kolom perbandingan Komersial → Koreksi (+/-) → Fiskal"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{showReconciliationTrace ? 'Sembunyikan Kolom Jejak Koreksi' : 'Tampilkan Kolom Komersial & Koreksi'}</span>
            </button>

            <button
              type="button"
              onClick={() => setBilingual(!bilingual)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                bilingual
                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Bilingual: {bilingual ? 'Aktif (ID/EN)' : 'ID Saja'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SHEET STATEMENTS CONTAINER */}
      <div className="space-y-8 print:space-y-0">
        {/* 1. LAPORAN LABA RUGI FISKAL (PASCA KOREKSI) — Tampil Utama */}
        {(activeSubTab === 'all' || activeSubTab === 'income') && (
          <div className="psak-sheet bg-white p-8 sm:p-12 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0">
            <div className="flex items-center justify-between text-[10px] italic text-slate-500 pb-3 border-b border-slate-200 mb-6">
              <span>BASIS FISKAL (SETELAH REKONSILIASI KORETAX L1 &amp; FORMULIR 1771-I)</span>
              <span>The original financial statements are prepared under Indonesian Tax Laws &amp; SAK reconciliation.</span>
            </div>

            <div className="text-center space-y-1 mb-8">
              <h2 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                {settings.companyName.toUpperCase()}
              </h2>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                LAPORAN LABA RUGI FISKAL RESMI (PASCA KOREKSI PERPAJAKAN)
              </h3>
              {bilingual && (
                <div className="text-sm font-semibold text-slate-600 italic">
                  OFFICIAL FISCAL STATEMENT OF PROFIT OR LOSS (POST-RECONCILIATION)
                </div>
              )}
              <div className="text-xs font-semibold text-slate-800 pt-1">
                Untuk Periode yang Berakhir pada {data.periodText}
              </div>
              <div className="text-[10px] text-slate-500 pt-1">({data.currencyText})</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-t-2 border-b-2 border-slate-900 font-bold text-slate-900">
                    <th className="py-2.5 text-left uppercase">Keterangan</th>
                    <th className="py-2.5 text-center uppercase w-20">Dasar</th>
                    {showReconciliationTrace && (
                      <>
                        <th className="py-2.5 text-right w-32 text-slate-600">Komersial (SAK)</th>
                        <th className="py-2.5 text-right w-28 text-rose-700">Koreksi (+)</th>
                        <th className="py-2.5 text-right w-28 text-emerald-700">Koreksi (-)</th>
                      </>
                    )}
                    <th className="py-2.5 text-right w-36">Fiskal {data.currentYear}</th>
                    {!showReconciliationTrace && (
                      <th className="py-2.5 text-right w-28 text-slate-600">Tahun {data.priorYear}</th>
                    )}
                    {bilingual && <th className="py-2.5 text-right w-48 uppercase italic text-slate-600">Line Item (EN)</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {data.incomeStatement.items.map(item => {
                    const isTotal = item.isTotal;
                    const isSubtotal = item.isSubtotal;
                    const isBold = item.isBold;

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50/50 ${
                          isTotal
                            ? 'bg-slate-100/80 font-extrabold text-slate-900 border-t-2 border-b-2 border-slate-900'
                            : isSubtotal
                            ? 'font-bold bg-slate-50 text-slate-900 border-t border-b border-slate-300'
                            : isBold
                            ? 'font-bold text-slate-900'
                            : ''
                        }`}
                      >
                        <td className={`py-1.5 ${item.indent ? 'pl-6 text-slate-700' : 'pl-3'}`}>
                          {item.nameId}
                        </td>
                        <td className="py-1.5 text-center font-mono text-[11px] text-slate-500">
                          {item.note || '-'}
                        </td>
                        {showReconciliationTrace && (
                          <>
                            <td className="py-1.5 text-right font-mono text-slate-600">
                              {item.commercialAmount !== undefined ? formatNumber(item.commercialAmount) : '-'}
                            </td>
                            <td className="py-1.5 text-right font-mono text-rose-700">
                              {item.positiveCorrection ? `+${formatNumber(item.positiveCorrection)}` : '-'}
                            </td>
                            <td className="py-1.5 text-right font-mono text-emerald-700">
                              {item.negativeCorrection ? `-${formatNumber(item.negativeCorrection)}` : '-'}
                            </td>
                          </>
                        )}
                        <td className={`py-1.5 text-right font-mono font-semibold ${isTotal ? 'double-underline' : ''}`}>
                          {formatNumber(item.amountCurrent)}
                        </td>
                        {!showReconciliationTrace && (
                          <td className={`py-1.5 text-right font-mono text-slate-600 ${isTotal ? 'double-underline' : ''}`}>
                            {formatNumber(item.amountPrior)}
                          </td>
                        )}
                        {bilingual && (
                          <td className={`py-1.5 text-right italic ${item.indent ? 'text-slate-500' : 'text-slate-600'}`}>
                            {item.nameEn}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <SignatureBlock
              preparerName={preparerName}
              preparerTitle={preparerTitle}
              approverName={approverName}
              approverTitle={approverTitle}
              bilingual={bilingual}
            />
          </div>
        )}

        {/* 2. LAPORAN POSISI KEUANGAN FISKAL (PASCA KOREKSI) */}
        {(activeSubTab === 'all' || activeSubTab === 'balance-sheet') && (
          <div className="psak-sheet bg-white p-8 sm:p-12 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0 page-break">
            <div className="flex items-center justify-between text-[10px] italic text-slate-500 pb-3 border-b border-slate-200 mb-6">
              <span>NERACA FISKAL TERKOREKSI (ASET TETAP FISKAL &amp; UTANG PAJAK BADAN)</span>
              <span>
                Status Keseimbangan:{' '}
                <strong className={data.balanceSheet.isBalanced ? 'text-emerald-700' : 'text-rose-700'}>
                  {data.balanceSheet.isBalanced ? 'SEIMBANG (BALANCED)' : 'TIDAK SEIMBANG'}
                </strong>
              </span>
            </div>

            <div className="text-center space-y-1 mb-8">
              <h2 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                {settings.companyName.toUpperCase()}
              </h2>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                LAPORAN POSISI KEUANGAN (NERACA) FISKAL RESMI
              </h3>
              {bilingual && (
                <div className="text-sm font-semibold text-slate-600 italic">
                  OFFICIAL FISCAL STATEMENT OF FINANCIAL POSITION
                </div>
              )}
              <div className="text-xs font-semibold text-slate-800 pt-1">Per {data.periodText}</div>
              <div className="text-[10px] text-slate-500 pt-1">({data.currencyText})</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-t-2 border-b-2 border-slate-900 font-bold text-slate-900">
                    <th className="py-2.5 text-left uppercase">Keterangan</th>
                    <th className="py-2.5 text-center uppercase w-20">Catatan</th>
                    {showReconciliationTrace && <th className="py-2.5 text-right w-32 text-slate-600">Komersial (SAK)</th>}
                    <th className="py-2.5 text-right w-36">Fiskal {data.currentYear}</th>
                    {!showReconciliationTrace && <th className="py-2.5 text-right w-28 text-slate-600">Tahun {data.priorYear}</th>}
                    {bilingual && <th className="py-2.5 text-right w-48 uppercase italic text-slate-600">Line Item (EN)</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  <tr className="bg-slate-50/70 font-bold text-slate-900">
                    <td colSpan={bilingual ? 5 : 4} className="py-2 text-left uppercase tracking-wider text-[11px]">
                      ASET / ASSETS
                    </td>
                  </tr>
                  <tr className="font-bold text-slate-800">
                    <td colSpan={bilingual ? 5 : 4} className="py-1.5 pl-3">ASET LANCAR / CURRENT ASSETS</td>
                  </tr>
                  {data.balanceSheet.assetsCurrent.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-center font-mono text-[11px] text-slate-500">{item.note || '-'}</td>
                      {showReconciliationTrace && (
                        <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.commercialAmount ?? item.amountCurrent)}</td>
                      )}
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      {!showReconciliationTrace && (
                        <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      )}
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-300">
                    <td className="py-1.5 pl-6">Jumlah Aset Lancar</td>
                    <td></td>
                    {showReconciliationTrace && <td></td>}
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalAssetsCurrent.current)}</td>
                    {!showReconciliationTrace && (
                      <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalAssetsCurrent.prior)}</td>
                    )}
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700">Total Current Assets</td>}
                  </tr>

                  <tr className="font-bold text-slate-800">
                    <td colSpan={bilingual ? 5 : 4} className="py-2 pl-3">ASET TIDAK LANCAR / NON-CURRENT ASSETS</td>
                  </tr>
                  {data.balanceSheet.assetsNonCurrent.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-center font-mono text-[11px] text-slate-500">{item.note || '-'}</td>
                      {showReconciliationTrace && (
                        <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.commercialAmount ?? item.amountCurrent)}</td>
                      )}
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      {!showReconciliationTrace && (
                        <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      )}
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-300">
                    <td className="py-1.5 pl-6">Jumlah Aset Tidak Lancar</td>
                    <td></td>
                    {showReconciliationTrace && <td></td>}
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalAssetsNonCurrent.current)}</td>
                    {!showReconciliationTrace && (
                      <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalAssetsNonCurrent.prior)}</td>
                    )}
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700">Total Non-Current Assets</td>}
                  </tr>

                  <tr className="font-extrabold text-slate-900 bg-slate-100/70 border-t-2 border-b-2 border-slate-900">
                    <td className="py-2 pl-3 uppercase">JUMLAH ASET FISKAL</td>
                    <td></td>
                    {showReconciliationTrace && <td></td>}
                    <td className="py-2 text-right font-mono double-underline">{formatNumber(data.balanceSheet.totalAssets.current)}</td>
                    {!showReconciliationTrace && (
                      <td className="py-2 text-right font-mono double-underline">{formatNumber(data.balanceSheet.totalAssets.prior)}</td>
                    )}
                    {bilingual && <td className="py-2 text-right italic uppercase">TOTAL FISCAL ASSETS</td>}
                  </tr>

                  {/* LIABILITAS & EKUITAS */}
                  <tr className="bg-slate-50/70 font-bold text-slate-900">
                    <td colSpan={bilingual ? 5 : 4} className="py-2 uppercase tracking-wider text-[11px]">
                      LIABILITAS DAN EKUITAS / LIABILITIES AND EQUITY
                    </td>
                  </tr>
                  <tr className="font-bold text-slate-800">
                    <td colSpan={bilingual ? 5 : 4} className="py-1.5 pl-3">LIABILITAS JANGKA PENDEK</td>
                  </tr>
                  {data.balanceSheet.liabilitiesCurrent.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-center font-mono text-[11px] text-slate-500">{item.note || '-'}</td>
                      {showReconciliationTrace && (
                        <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.commercialAmount ?? item.amountCurrent)}</td>
                      )}
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      {!showReconciliationTrace && (
                        <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      )}
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-300">
                    <td className="py-1.5 pl-6">Jumlah Liabilitas Jangka Pendek</td>
                    <td></td>
                    {showReconciliationTrace && <td></td>}
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalLiabilitiesCurrent.current)}</td>
                    {!showReconciliationTrace && (
                      <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalLiabilitiesCurrent.prior)}</td>
                    )}
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700">Total Current Liabilities</td>}
                  </tr>

                  <tr className="font-bold text-slate-800">
                    <td colSpan={bilingual ? 5 : 4} className="py-1.5 pl-3">LIABILITAS JANGKA PANJANG</td>
                  </tr>
                  {data.balanceSheet.liabilitiesNonCurrent.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-center font-mono text-[11px] text-slate-500">{item.note || '-'}</td>
                      {showReconciliationTrace && (
                        <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.commercialAmount ?? item.amountCurrent)}</td>
                      )}
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      {!showReconciliationTrace && (
                        <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      )}
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-300">
                    <td className="py-1.5 pl-6">Jumlah Liabilitas Jangka Panjang</td>
                    <td></td>
                    {showReconciliationTrace && <td></td>}
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalLiabilitiesNonCurrent.current)}</td>
                    {!showReconciliationTrace && (
                      <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalLiabilitiesNonCurrent.prior)}</td>
                    )}
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700">Total Non-Current Liabilities</td>}
                  </tr>

                  <tr className="font-bold text-slate-800">
                    <td colSpan={bilingual ? 5 : 4} className="py-1.5 pl-3">EKUITAS FISKAL / FISCAL EQUITY</td>
                  </tr>
                  {data.balanceSheet.equity.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-center font-mono text-[11px] text-slate-500">{item.note || '-'}</td>
                      {showReconciliationTrace && (
                        <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.commercialAmount ?? item.amountCurrent)}</td>
                      )}
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      {!showReconciliationTrace && (
                        <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      )}
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-300">
                    <td className="py-1.5 pl-6">JUMLAH EKUITAS FISKAL</td>
                    <td></td>
                    {showReconciliationTrace && <td></td>}
                    <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalEquity.current)}</td>
                    {!showReconciliationTrace && (
                      <td className="py-1.5 text-right font-mono border-t border-slate-900">{formatNumber(data.balanceSheet.totalEquity.prior)}</td>
                    )}
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700 uppercase">TOTAL FISCAL EQUITY</td>}
                  </tr>

                  <tr className="font-extrabold text-slate-900 bg-slate-100/70 border-t-2 border-b-2 border-slate-900">
                    <td className="py-2 pl-3 uppercase">JUMLAH LIABILITAS DAN EKUITAS FISKAL</td>
                    <td></td>
                    {showReconciliationTrace && <td></td>}
                    <td className="py-2 text-right font-mono double-underline">{formatNumber(data.balanceSheet.totalLiabilitiesAndEquity.current)}</td>
                    {!showReconciliationTrace && (
                      <td className="py-2 text-right font-mono double-underline">{formatNumber(data.balanceSheet.totalLiabilitiesAndEquity.prior)}</td>
                    )}
                    {bilingual && <td className="py-2 text-right italic uppercase">TOTAL LIABILITIES &amp; FISCAL EQUITY</td>}
                  </tr>
                </tbody>
              </table>
            </div>

            <SignatureBlock
              preparerName={preparerName}
              preparerTitle={preparerTitle}
              approverName={approverName}
              approverTitle={approverTitle}
              bilingual={bilingual}
            />
          </div>
        )}

        {/* 3. PERUBAHAN EKUITAS FISKAL */}
        {(activeSubTab === 'all' || activeSubTab === 'equity') && (
          <div className="psak-sheet bg-white p-8 sm:p-12 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0 page-break">
            <div className="text-center space-y-1 mb-8">
              <h2 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                {settings.companyName.toUpperCase()}
              </h2>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                LAPORAN PERUBAHAN EKUITAS FISKAL (PASCA KOREKSI)
              </h3>
              {bilingual && (
                <div className="text-sm font-semibold text-slate-600 italic">
                  FISCAL STATEMENT OF CHANGES IN EQUITY
                </div>
              )}
              <div className="text-xs font-semibold text-slate-800 pt-1">
                Untuk Periode yang Berakhir pada {data.periodText}
              </div>
              <div className="text-[10px] text-slate-500 pt-1">({data.currencyText})</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-t-2 border-b-2 border-slate-900 font-bold text-slate-900">
                    <th className="py-2.5 text-left w-[30%]">Keterangan / Description</th>
                    <th className="py-2.5 text-right w-[14%]">Modal Saham</th>
                    <th className="py-2.5 text-right w-[14%]">Tambahan Modal</th>
                    <th className="py-2.5 text-right w-[14%]">Cadangan Umum</th>
                    <th className="py-2.5 text-right w-[14%]">Saldo Laba Fiskal</th>
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

            <SignatureBlock
              preparerName={preparerName}
              preparerTitle={preparerTitle}
              approverName={approverName}
              approverTitle={approverTitle}
              bilingual={bilingual}
            />
          </div>
        )}

        {/* 4. ARUS KAS */}
        {(activeSubTab === 'all' || activeSubTab === 'cash-flow') && (
          <div className="psak-sheet bg-white p-8 sm:p-12 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0 page-break">
            <div className="text-center space-y-1 mb-8">
              <h2 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                {settings.companyName.toUpperCase()}
              </h2>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                LAPORAN ARUS KAS (REKONSILIASI KAS OPERASIONAL &amp; PAJAK)
              </h3>
              {bilingual && (
                <div className="text-sm font-semibold text-slate-600 italic">
                  CONSOLIDATED STATEMENT OF CASH FLOWS
                </div>
              )}
              <div className="text-xs font-semibold text-slate-800 pt-1">
                Untuk Periode yang Berakhir pada {data.periodText}
              </div>
              <div className="text-[10px] text-slate-500 pt-1">({data.currencyText})</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-t-2 border-b-2 border-slate-900 font-bold text-slate-900">
                    <th className="py-2.5 text-left w-[45%] uppercase">Keterangan</th>
                    <th className="py-2.5 text-right w-[17%]">Tahun {data.currentYear}</th>
                    <th className="py-2.5 text-right w-[15%] text-slate-600">Tahun {data.priorYear}</th>
                    {bilingual && <th className="py-2.5 text-right w-[23%] uppercase italic text-slate-600">Line Item (EN)</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  <tr className="bg-slate-50/70 font-bold text-slate-900">
                    <td colSpan={bilingual ? 4 : 3} className="py-2 uppercase text-[11px]">
                      ARUS KAS DARI AKTIVITAS OPERASI
                    </td>
                  </tr>
                  {data.cashFlow.operating.map(item => (
                    <tr key={item.id}>
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-400 bg-slate-50">
                    <td className="py-1.5 pl-6">Kas Neto dari Aktivitas Operasi</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.totalOperating.current)}</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.totalOperating.prior)}</td>
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700">Net Operating Cash</td>}
                  </tr>

                  <tr className="bg-slate-50/70 font-bold text-slate-900">
                    <td colSpan={bilingual ? 4 : 3} className="py-2 uppercase text-[11px]">
                      ARUS KAS DARI AKTIVITAS INVESTASI
                    </td>
                  </tr>
                  {data.cashFlow.investing.map(item => (
                    <tr key={item.id}>
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-400 bg-slate-50">
                    <td className="py-1.5 pl-6">Kas Neto dari Aktivitas Investasi</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.totalInvesting.current)}</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.totalInvesting.prior)}</td>
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700">Net Investing Cash</td>}
                  </tr>

                  <tr className="bg-slate-50/70 font-bold text-slate-900">
                    <td colSpan={bilingual ? 4 : 3} className="py-2 uppercase text-[11px]">
                      ARUS KAS DARI AKTIVITAS PENDANAAN
                    </td>
                  </tr>
                  {data.cashFlow.financing.map(item => (
                    <tr key={item.id}>
                      <td className="py-1 pl-6 text-slate-700">{item.nameId}</td>
                      <td className="py-1 text-right font-mono">{formatNumber(item.amountCurrent)}</td>
                      <td className="py-1 text-right font-mono text-slate-600">{formatNumber(item.amountPrior)}</td>
                      {bilingual && <td className="py-1 text-right italic text-slate-500">{item.nameEn}</td>}
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-slate-400 bg-slate-50">
                    <td className="py-1.5 pl-6">Kas Neto dari Aktivitas Pendanaan</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.totalFinancing.current)}</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.totalFinancing.prior)}</td>
                    {bilingual && <td className="py-1.5 text-right italic text-slate-700">Net Financing Cash</td>}
                  </tr>

                  <tr className="font-bold border-t-2 border-slate-900">
                    <td className="py-2 pl-3">Kenaikan / (Penurunan) Neto Kas</td>
                    <td className="py-2 text-right font-mono">{formatNumber(data.cashFlow.netChange.current)}</td>
                    <td className="py-2 text-right font-mono">{formatNumber(data.cashFlow.netChange.prior)}</td>
                    {bilingual && <td className="py-2 text-right italic">Net Change in Cash</td>}
                  </tr>
                  <tr>
                    <td className="py-1.5 pl-3 text-slate-700">Kas dan Setara Kas Awal Periode</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.beginningCash.current)}</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(data.cashFlow.beginningCash.prior)}</td>
                    {bilingual && <td className="py-1.5 text-right italic text-slate-500">Beginning Cash</td>}
                  </tr>
                  <tr className="font-extrabold text-slate-900 bg-slate-100/70 border-t-2 border-b-2 border-slate-900">
                    <td className="py-2 pl-3 uppercase">KAS DAN SETARA KAS AKHIR PERIODE</td>
                    <td className="py-2 text-right font-mono double-underline">{formatNumber(data.cashFlow.endingCash.current)}</td>
                    <td className="py-2 text-right font-mono double-underline">{formatNumber(data.cashFlow.endingCash.prior)}</td>
                    {bilingual && <td className="py-2 text-right italic uppercase">ENDING CASH AND EQUIVALENTS</td>}
                  </tr>
                </tbody>
              </table>
            </div>

            <SignatureBlock
              preparerName={preparerName}
              preparerTitle={preparerTitle}
              approverName={approverName}
              approverTitle={approverTitle}
              bilingual={bilingual}
            />
          </div>
        )}
      </div>

      {/* Compliance Footer */}
      <div className="no-print text-center py-2 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>Laporan Resmi Fiskal terhubung otomatis dengan Laba Rugi Sederhana, Laporan Resmi (PSAK), dan Kertas Kerja Koreksi Fiskal 1771-I.</span>
      </div>
    </div>
  );
};

const SignatureBlock: React.FC<{
  preparerName: string;
  preparerTitle: string;
  approverName: string;
  approverTitle: string;
  bilingual: boolean;
}> = ({ preparerName, preparerTitle, approverName, approverTitle, bilingual }) => (
  <>
    <div className="mt-8 pt-4 border-t border-slate-200 text-[10px] text-slate-500 italic text-center space-y-0.5">
      <div>Laporan keuangan fiskal ini disusun berdasarkan rekonsiliasi fiskal atas pembukuan komersial sesuai UU Perpajakan RI.</div>
      {bilingual && (
        <div>These fiscal financial statements are derived from commercial accounting reconciliation pursuant to Indonesian Tax Regulations.</div>
      )}
    </div>
    <div className="mt-10 pt-6 border-t border-dashed border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
      <div className="space-y-12">
        <div className="text-slate-600 font-medium">Disiapkan oleh / Prepared by:</div>
        <div className="space-y-1">
          <div className="font-bold text-slate-900 underline">{preparerName}</div>
          <div className="text-[11px] text-slate-500 font-semibold">{preparerTitle}</div>
        </div>
      </div>
      <div className="space-y-12">
        <div className="text-slate-600 font-medium">Disetujui oleh / Approved by:</div>
        <div className="space-y-1">
          <div className="font-bold text-slate-900 underline">{approverName}</div>
          <div className="text-[11px] text-slate-500 font-semibold">{approverTitle}</div>
        </div>
      </div>
    </div>
  </>
);
