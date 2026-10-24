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
  Zap,
  Award,
  ArrowUpRight,
  FileText
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { 
  formatRupiah, 
  calculateBalanceSheet, 
  calculateProfitAndLoss, 
  calculateGeneralLedgers,
  calculateFinancialRatios
} from '../utils/accountingCalculations';
import { ActiveTab } from '../components/layout/Sidebar';
import { FinancialTrendsChart } from '../components/dashboard/FinancialTrendsChart';

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

  const kasAccount = accounts.find(a => a.code === '10001') || 
                     accounts.find(a => !a.isHeader && a.category === 'HARTA_LANCAR' && a.name.toLowerCase().includes('kas'));
  const kasLedger = kasAccount ? (ledgers[kasAccount.code] || { endingBalance: 0 }) : (ledgers['10001'] || { endingBalance: 0 });
  const totalRevenue = pl.totalOperasionalRevenue + pl.totalNonOperasionalRevenue;
  const totalExpense = pl.totalOperasionalExpense + pl.totalNonOperasionalExpense;

  // Executive summary for Box 7: Analisis Rasio Keuangan Perusahaan
  const ratios = calculateFinancialRatios(accounts, transactions);
  const dangerCount = ratios.filter(r => r.status === 'Danger').length;
  const warningCount = ratios.filter(r => r.status === 'Warning').length;

  let ratioStatus = 'Kondisi Keuangan Sehat & Optimal';
  let ratioBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let ratioSummary = 'Likuiditas lancar sangat aman, struktur modal bebas risiko utang berlebih, dan kinerja operasional stabil.';

  if (dangerCount > 0) {
    ratioStatus = 'Perlu Penyesuaian Rasio';
    ratioBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    ratioSummary = 'Terdapat indikator rasio yang memerlukan perhatian manajemen untuk optimasi arus kas dan solvabilitas.';
  } else if (warningCount > 0) {
    ratioStatus = 'Kondisi Keuangan Cukup / Waspada';
    ratioBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
    ratioSummary = 'Struktur keuangan stabil dengan beberapa indikator yang perlu dimonitor secara berkala.';
  }

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
            className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-xs flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            title="Buka Laporan Sederhana"
          >
            <FileText className="w-4 h-4 text-sky-600" />
            <span>Laporan Sederhana</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('psak-report')}
            className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Award className="w-4 h-4 text-amber-500" />
            <span>Laporan Resmi</span>
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

      {/* Unified Executive Dashboard Section (Left: 7-Card Financial Metrics & Ratios Stack | Right: Dynamic Trends Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN: 7-Box Vertical Stack matching Reference Wireframe */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-2.5">
          
          {/* Box 1: Total Transaksi Terdaftar (Hero Box) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Total Transaksi Terdaftar
              </span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md border border-slate-200">
                Akuntansi Resmi
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight font-mono">
                  {transactions.length}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Transaksi
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('journals')}
                className="text-xs text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded px-1"
                title="Buka Jurnal Umum"
              >
                <span>Lihat Jurnal</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
              <span className="text-slate-500">Distribusi Status:</span>
              <span className="font-bold text-slate-800">{transactions.length} Terverifikasi • 0 Pending</span>
            </div>
          </div>

          {/* Box 2: Saldo Kas Utama */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveTab('cashbank')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveTab('cashbank');
              }
            }}
            className="bg-white hover:bg-emerald-50/20 p-3 rounded-xl border border-slate-200/90 hover:border-emerald-300 shadow-2xs transition-all cursor-pointer group flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            title="Buka Modul Kas & Bank"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-black text-emerald-600 group-hover:text-emerald-700 tracking-wider uppercase truncate">
                SALDO KAS UTAMA
              </div>
              <div className="text-base font-black text-emerald-700 font-mono tracking-tight whitespace-nowrap truncate num mt-0.5" title={formatRupiah(kasLedger.endingBalance)}>
                {formatRupiah(kasLedger.endingBalance)}
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                Likuiditas 100% Aktif • Kas Riil
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Wallet className="w-4 h-4" />
            </div>
          </div>

          {/* Box 3: Total Aset (Harta) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveTab('balance-sheet')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveTab('balance-sheet');
              }
            }}
            className="bg-white hover:bg-amber-50/20 p-3 rounded-xl border border-slate-200/90 hover:border-amber-300 shadow-2xs transition-all cursor-pointer group flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            title="Buka Laporan Neraca (Posisi Keuangan)"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-black text-amber-600 group-hover:text-amber-700 tracking-wider uppercase truncate">
                TOTAL ASET (HARTA)
              </div>
              <div className="text-base font-black text-amber-600 font-mono tracking-tight whitespace-nowrap truncate num mt-0.5" title={formatRupiah(bs.totalAssets)}>
                {formatRupiah(bs.totalAssets)}
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                Struktur Aset: Lancar + Tetap
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Landmark className="w-4 h-4" />
            </div>
          </div>

          {/* Box 4: Kewajiban & Ekuitas */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveTab('balance-sheet')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveTab('balance-sheet');
              }
            }}
            className="bg-white hover:bg-sky-50/20 p-3 rounded-xl border border-slate-200/90 hover:border-sky-300 shadow-2xs transition-all cursor-pointer group flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            title="Buka Laporan Neraca"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-black text-sky-600 group-hover:text-sky-700 tracking-wider uppercase truncate">
                KEWAJIBAN & EKUITAS
              </div>
              <div className="text-base font-black text-sky-600 font-mono tracking-tight whitespace-nowrap truncate num mt-0.5" title={formatRupiah(bs.totalLiabilitiesAndEquity)}>
                {formatRupiah(bs.totalLiabilitiesAndEquity)}
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                Integritas: {bs.isBalanced ? 'Neraca Seimbang (Valid)' : 'Perlu Diperiksa'}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          {/* Box 5: Total Pendapatan */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveTab('profit-loss')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveTab('profit-loss');
              }
            }}
            className="bg-white hover:bg-cyan-50/20 p-3 rounded-xl border border-slate-200/90 hover:border-cyan-300 shadow-2xs transition-all cursor-pointer group flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            title="Buka Laporan Laba Rugi"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-black text-cyan-600 group-hover:text-cyan-700 tracking-wider uppercase truncate">
                TOTAL PENDAPATAN
              </div>
              <div className="text-base font-black text-cyan-600 font-mono tracking-tight whitespace-nowrap truncate num mt-0.5" title={formatRupiah(totalRevenue)}>
                {formatRupiah(totalRevenue)}
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                Akumulasi L/R: Operasional & Non
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 border border-cyan-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          {/* Box 6: Total Beban */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveTab('profit-loss')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveTab('profit-loss');
              }
            }}
            className="bg-white hover:bg-rose-50/20 p-3 rounded-xl border border-slate-200/90 hover:border-rose-300 shadow-2xs transition-all cursor-pointer group flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            title="Buka Laporan Laba Rugi"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-black text-rose-600 group-hover:text-rose-700 tracking-wider uppercase truncate">
                TOTAL BEBAN
              </div>
              <div className="text-base font-black text-rose-600 font-mono tracking-tight whitespace-nowrap truncate num mt-0.5" title={formatRupiah(totalExpense)}>
                {formatRupiah(totalExpense)}
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                Beban Berjalan: Operasional & Pokok
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>

          {/* Box 7: KESIMPULAN DARI SLIDE BAR "ANALISIS RASIO KEUANGAN PERUSAHAAN" */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveTab('ratios')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveTab('ratios');
              }
            }}
            className="bg-white hover:bg-rose-50/30 p-3.5 rounded-xl border border-rose-200/80 shadow-2xs transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            title="Klik untuk membuka Analisis Rasio Keuangan Perusahaan"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-black text-rose-700 uppercase tracking-tight line-clamp-1">
                KESIMPULAN DARI SLIDE BAR &ldquo;ANALISIS RASIO KEUANGAN PERUSAHAAN&rdquo;
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${ratioBadgeClass}`}>
                {ratioStatus}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1.5 leading-snug">
              {ratioSummary}
            </p>
          </div>

        </div>

        {/* RIGHT COLUMN: Visual Multi-Line Financial Trends Chart (5 Pilar Dasar Keuangan) */}
        <div className="lg:col-span-7 xl:col-span-8">
          <FinancialTrendsChart 
            accounts={accounts} 
            transactions={transactions} 
            currentPeriodName={settings.fiscalPeriod || 'Oktober 2026'} 
          />
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
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold flex items-center space-x-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded px-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Transaksi</span>
            </button>
            <span className="text-slate-200">|</span>
            <button 
              type="button"
              onClick={() => setActiveTab('journals')}
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded px-1"
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
                    Belum ada transaksi tersimpan. Klik "Tambah Transaksi" atau buka Jurnal Umum untuk mulai mencatat.
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
                          <div className="text-[11px] text-slate-500">Kontak: {tx.partner}</div>
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
