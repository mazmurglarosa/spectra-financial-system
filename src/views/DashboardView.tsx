import React from 'react';
import { 
  Wallet, 
  Landmark, 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Table as TableIcon, 
  BarChart3, 
  History, 
  Plus, 
  Trash2,
  Check
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
  const piutangLedger = ledgers['10003'] || { endingBalance: 0 };
  const utangLedger = ledgers['20001'] || { endingBalance: 0 };

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  // Maximum value for proportional chart bars
  const chartItems = [
    { label: 'Pendapatan', value: pl.totalRevenues, color: 'bg-emerald-500', barBg: '#10b981' },
    { label: 'HPP', value: pl.totalCOGS, color: 'bg-amber-500', barBg: '#f59e0b' },
    { label: 'Beban Operasional', value: pl.totalOperatingExpenses, color: 'bg-rose-500', barBg: '#ef4444' },
    { label: 'Laba Bersih', value: pl.netIncome, color: 'bg-blue-600', barBg: '#2563eb' },
    { label: 'Total Aset', value: bs.totalAssets, color: 'bg-indigo-600', barBg: '#4f46e5' },
    { label: 'Total Utang', value: bs.totalLiabilities, color: 'bg-slate-600', barBg: '#475569' }
  ];

  const maxVal = Math.max(...chartItems.map(i => Math.abs(i.value)), 1000000);

  return (
    <div className="p-5 space-y-5 animate-fadeIn">
      
      {/* Top 4 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Kas & Bank Card */}
        <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Saldo Kas Utama
            </div>
            <div className="text-xl font-bold text-slate-900 mt-1 num font-mono">
              {formatRupiah(kasLedger.endingBalance)}
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center">
              <Check className="w-3 h-3 mr-0.5" />
              <span>Likuid & Siap Digunakan</span>
            </div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Total Aset Card */}
        <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Aset (Harta)
            </div>
            <div className="text-xl font-bold text-slate-900 mt-1 num font-mono">
              {formatRupiah(bs.totalAssets)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Lancar + Tetap Bersih
            </div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
            <Landmark className="w-6 h-6" />
          </div>
        </div>

        {/* Total Kewajiban Card */}
        <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Kewajiban (Utang)
            </div>
            <div className="text-xl font-bold text-slate-900 mt-1 num font-mono">
              {formatRupiah(bs.totalLiabilities)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Kewajiban Lancar & Jk Panjang
            </div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        {/* Laba Bersih Card */}
        <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Laba / (Rugi) Bersih
            </div>
            <div className={`text-xl font-bold mt-1 num font-mono ${pl.isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatRupiah(pl.netIncome)}
            </div>
            <div className={`text-[11px] font-medium mt-0.5 ${pl.isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
              Status: {pl.isProfit ? 'SURPLUS (+)' : 'DEFISIT (-)'}
            </div>
          </div>
          <div className={`p-3 rounded-full ${pl.isProfit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {pl.isProfit ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
          </div>
        </div>
      </div>

      {/* Middle Section: Accounting Integrity & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Accounting Integrity Card */}
        <div className="bg-white p-5 rounded-lg shadow-xs border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Integritas Siklus Akuntansi</span>
              </h3>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                bs.isBalanced ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
              }`}>
                {bs.isBalanced ? 'Valid & Seimbang' : 'Perlu Diperiksa'}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-600">Persamaan Akuntansi:</span>
                <span className="font-semibold text-slate-800">Aset = Utang + Modal</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-600">Total Sisi Aset:</span>
                <span className="font-mono font-semibold text-slate-900">{formatRupiah(bs.totalAssets)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-600">Total Sisi Pasiva (Utang + Ekuitas):</span>
                <span className="font-mono font-semibold text-slate-900">{formatRupiah(bs.totalLiabilitiesAndEquity)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-600">Selisih Keseimbangan:</span>
                <span className={`font-mono font-bold ${bs.isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatRupiah(bs.diff)}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600">Total Piutang Usaha:</span>
                <span className="font-mono font-semibold text-blue-600">{formatRupiah(piutangLedger.endingBalance)}</span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2">
            <button 
              type="button"
              onClick={() => openNewTransactionModal('cash_in')}
              className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold py-2 px-3 rounded flex items-center justify-center space-x-1 border border-emerald-200 transition cursor-pointer"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Kas Masuk</span>
            </button>

            <button 
              type="button"
              onClick={() => openNewTransactionModal('cash_out')}
              className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold py-2 px-3 rounded flex items-center justify-center space-x-1 border border-rose-200 transition cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Kas Keluar</span>
            </button>

            <button 
              type="button"
              onClick={() => setActiveTab('worksheet')}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded flex items-center justify-center space-x-1 transition cursor-pointer"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Buka Neraca Lajur 10 Kolom</span>
            </button>
          </div>
        </div>

        {/* Financial Performance Visual Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-lg shadow-xs border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Grafik Ikhtisar Keuangan ({settings.fiscalPeriod})</span>
            </h3>
            <span className="text-xs text-slate-400">Dalam Rupiah</span>
          </div>

          {/* Visual Bars Comparison */}
          <div className="space-y-3.5 py-1">
            {chartItems.map((item, idx) => {
              const pct = Math.min(Math.max((Math.abs(item.value) / maxVal) * 100, 4), 100);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">{item.label}</span>
                    <span className="font-mono text-slate-900">{formatRupiah(item.value)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden border border-slate-200">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Siklus pembukuan terintegrasi otomatis</span>
            <span className="font-mono">PT BARU • Accurate Standard</span>
          </div>
        </div>

      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-500" />
            <span>Daftar Transaksi Terakhir (Jurnal Umum)</span>
          </h3>
          <div className="flex items-center space-x-2">
            <button 
              type="button"
              onClick={() => openNewTransactionModal('general')}
              className="text-xs text-blue-600 hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Transaksi</span>
            </button>
            <span className="text-slate-300">|</span>
            <button 
              type="button"
              onClick={() => setActiveTab('journals')}
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
            >
              Lihat Semua &rarr;
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-accurate">
            <thead>
              <tr>
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
                  <td colSpan={7} className="text-center py-6 text-slate-400 text-xs">
                    Belum ada transaksi. Klik "+ Tambah Transaksi" untuk mulai mencatat.
                  </td>
                </tr>
              ) : (
                recentTransactions.map(tx => {
                  let badgeType = "bg-slate-100 text-slate-700";
                  if (tx.type === "adjustment") badgeType = "bg-amber-100 text-amber-800";
                  else if (tx.type === "cash_in") badgeType = "bg-emerald-100 text-emerald-800";
                  else if (tx.type === "cash_out") badgeType = "bg-rose-100 text-rose-800";
                  else if (tx.type === "sales") badgeType = "bg-blue-100 text-blue-800";
                  else if (tx.type === "purchase") badgeType = "bg-purple-100 text-purple-800";

                  return (
                    <tr key={tx.id}>
                      <td className="font-mono text-xs text-slate-700">{tx.date}</td>
                      <td>
                        <span className="font-mono font-bold text-xs text-blue-600">{tx.refNumber}</span>
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
                          className="text-rose-500 hover:text-rose-700 p-1 rounded cursor-pointer"
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
