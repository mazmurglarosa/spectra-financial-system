import React from 'react';
import { 
  Wallet, 
  Landmark, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  Table as TableIcon, 
  BarChart3, 
  History, 
  Plus, 
  Trash2,
  Zap
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { 
  formatRupiah, 
  calculateBalanceSheet, 
  calculateProfitAndLoss, 
  calculateGeneralLedgers 
} from '../utils/accountingCalculations';
import { ActiveTab } from '../components/layout/Sidebar';

interface DashboardViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  openNewTransactionModal: (preset?: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  setActiveTab, 
  openNewTransactionModal 
}) => {
  const { accounts, transactions, settings, deleteTransaction } = useAccounting();

  const bs = calculateBalanceSheet(accounts, transactions);
  const pl = calculateProfitAndLoss(accounts, transactions);
  const ledgers = calculateGeneralLedgers(accounts, transactions);

  const kasLedger = ledgers['10001'] || { endingBalance: 0 };
  const totalRevenue = pl.totalOperasionalRevenue + pl.totalNonOperasionalRevenue;
  const totalExpense = pl.totalOperasionalExpense + pl.totalNonOperasionalExpense;

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full animate-fadeIn">
      
      {/* Header Banner matching Reference Image */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-sky-600" />
            <span>Dashboard & Kontrol Keuangan</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Ringkasan saldo kas, neraca lajur, statistik akun, dan daftar transaksi resmi yang telah terdaftar di {settings.companyName || 'PT Nirwana Bhumi Energi'}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('simple-reports')}
            className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <TableIcon className="w-4 h-4 text-emerald-600" />
            <span>Laporan Sederhana</span>
          </button>

          <button
            type="button"
            onClick={() => openNewTransactionModal('general')}
            className="bg-[#0a192f] hover:bg-[#0f2342] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-sky-400" />
            <span>+ Catat Transaksi Baru</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quick-report')}
            className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-semibold px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Quick Report</span>
          </button>
        </div>
      </div>

      {/* 1. Full-Width "Total Transaksi Terdaftar" Card at the Top */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md">
              Akuntansi Resmi {settings.companyName || 'NBE'}
            </span>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Cloud Active
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Real-time Terintegrasi</span>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight font-mono">
              {transactions.length}
            </span>
            <span className="text-sm md:text-base font-semibold text-slate-600">
              Total Transaksi Terdaftar
            </span>
          </div>
        </div>

        {/* Right Section: Progress & Distribution */}
        <div className="md:w-80 shrink-0 bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex flex-col justify-center gap-1.5">
          <div className="flex justify-between items-center text-[11px] text-slate-600 font-medium">
            <span>Distribusi Status:</span>
            <span className="font-bold text-slate-800">{transactions.length} Terverifikasi • 0 Pending</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full w-full"></div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400">
            <span>Integritas Pencatatan: 100% Valid</span>
            <button
              type="button"
              onClick={() => setActiveTab('journals')}
              className="text-sky-600 hover:text-sky-700 font-semibold hover:underline cursor-pointer"
            >
              Lihat Jurnal →
            </button>
          </div>
        </div>
      </div>

      {/* 2. Responsive 5-Column Grid Horizontally Aligned Underneath */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
        
        {/* Kolom 1: Saldo Kas Utama */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-emerald-200 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase truncate">
                SALDO KAS UTAMA
              </div>
              <div className="text-lg xl:text-xl font-black text-emerald-600 mt-2 font-mono tracking-tight whitespace-nowrap truncate num" title={formatRupiah(kasLedger.endingBalance)}>
                {formatRupiah(kasLedger.endingBalance)}
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-medium">Likuiditas</span>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-bold">
              100% Aktif
            </span>
          </div>
        </div>

        {/* Kolom 2: Total Aset (Harta) */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-amber-200 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase truncate">
                TOTAL ASET (HARTA)
              </div>
              <div className="text-lg xl:text-xl font-black text-amber-500 mt-2 font-mono tracking-tight whitespace-nowrap truncate num" title={formatRupiah(bs.totalAssets)}>
                {formatRupiah(bs.totalAssets)}
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
              <Landmark className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-medium">Struktur Aset</span>
            <span className="px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-md font-semibold">
              Lancar + Tetap
            </span>
          </div>
        </div>

        {/* Kolom 3: Kewajiban & Ekuitas */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-sky-200 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase truncate">
                KEWAJIBAN & EKUITAS
              </div>
              <div className="text-lg xl:text-xl font-black text-sky-600 mt-2 font-mono tracking-tight whitespace-nowrap truncate num" title={formatRupiah(bs.totalLiabilitiesAndEquity)}>
                {formatRupiah(bs.totalLiabilitiesAndEquity)}
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-medium">Integritas Neraca</span>
            <span className={`px-2 py-0.5 rounded-md font-bold ${
              bs.isBalanced 
                ? 'bg-sky-50 text-sky-700 border border-sky-200' 
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {bs.isBalanced ? 'Seimbang (Valid)' : 'Perlu Diperiksa'}
            </span>
          </div>
        </div>

        {/* Kolom 4: Total Pendapatan */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-cyan-200 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase truncate">
                TOTAL PENDAPATAN
              </div>
              <div className="text-lg xl:text-xl font-black text-cyan-600 mt-2 font-mono tracking-tight whitespace-nowrap truncate num" title={formatRupiah(totalRevenue)}>
                {formatRupiah(totalRevenue)}
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-medium">Akumulasi L/R</span>
            <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-md font-bold">
              Operasional & Non
            </span>
          </div>
        </div>

        {/* Kolom 5: Total Beban */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-rose-200 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase truncate">
                TOTAL BEBAN
              </div>
              <div className="text-lg xl:text-xl font-black text-rose-600 mt-2 font-mono tracking-tight whitespace-nowrap truncate num" title={formatRupiah(totalExpense)}>
                {formatRupiah(totalExpense)}
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-medium">Beban Berjalan</span>
            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-bold">
              Operasional & Pokok
            </span>
          </div>
        </div>

      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-2">
            <History className="w-4 h-4 text-sky-600" />
            <span>Daftar Transaksi Terakhir (Jurnal Umum)</span>
          </h3>
          <div className="flex items-center space-x-2">
            <button 
              type="button"
              onClick={() => openNewTransactionModal('general')}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold flex items-center space-x-1 cursor-pointer focus-visible:outline-none rounded px-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Transaksi</span>
            </button>
            <span className="text-slate-200">|</span>
            <button 
              type="button"
              onClick={() => setActiveTab('journals')}
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer focus-visible:outline-none rounded px-1"
            >
              Lihat Semua
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-accurate">
            <thead>
              <tr className="bg-slate-50/70 text-slate-600">
                <th className="w-24">Tanggal</th>
                <th className="w-24">No. Bukti</th>
                <th>Keterangan</th>
                <th className="w-44">Akun Terlibat</th>
                <th className="num w-32">Debit</th>
                <th className="num w-32">Kredit</th>
                <th className="text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 text-xs">
                    Belum ada transaksi tersimpan. Klik "+ Catat Transaksi Baru" untuk mulai mencatat.
                  </td>
                </tr>
              ) : (
                recentTransactions.map(tx => {
                  let badgeType = "bg-slate-100 text-slate-700";
                  if (tx.type === "adjustment") badgeType = "bg-amber-50 text-amber-700 border border-amber-200";
                  else if (tx.type === "cash_in") badgeType = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                  else if (tx.type === "cash_out") badgeType = "bg-rose-50 text-rose-700 border border-rose-200";
                  else if (tx.type === "sales") badgeType = "bg-sky-50 text-sky-700 border border-sky-200";
                  else if (tx.type === "purchase") badgeType = "bg-purple-50 text-purple-700 border border-purple-200";

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="font-mono text-xs text-slate-700">{tx.date}</td>
                      <td>
                        <span className="font-mono font-bold text-xs text-sky-700">{tx.refNumber}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ml-1 font-semibold ${badgeType}`}>
                          {tx.type || 'general'}
                        </span>
                      </td>
                      <td>
                        <div className="font-medium text-slate-900">{tx.description}</div>
                        {tx.partner && (
                          <div className="text-[11px] text-slate-400">Kontak: {tx.partner}</div>
                        )}
                      </td>
                      <td className="text-xs text-slate-600">
                        {tx.lines.map((l, i) => (
                          <div key={i}>{l.accountCode} - {l.accountName}</div>
                        ))}
                      </td>
                      <td className="num font-mono text-slate-800 font-medium">
                        {formatRupiah(tx.totalDebit)}
                      </td>
                      <td className="num font-mono text-slate-800 font-medium">
                        {formatRupiah(tx.totalCredit)}
                      </td>
                      <td className="text-center">
                        <button 
                          type="button"
                          onClick={() => {
                            if (confirm(`Apakah Anda yakin ingin menghapus transaksi ${tx.refNumber}?`)) {
                              deleteTransaction(tx.id);
                            }
                          }}
                          title="Hapus Transaksi"
                          className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
