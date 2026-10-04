import React from 'react';
import { ShoppingCart, PlusCircle, Printer } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { calculateGeneralLedgers, calculateProfitAndLoss, formatRupiah } from '../utils/accountingCalculations';
import { LedgerEntry } from '../types/accounting';

interface SalesViewProps {
  openNewTransactionModal: (preset?: 'sales') => void;
}

export const SalesView: React.FC<SalesViewProps> = ({ openNewTransactionModal }) => {
  const { accounts, transactions, contacts } = useAccounting();

  const ledgers = calculateGeneralLedgers(accounts, transactions);
  const piutangLedger = ledgers['10003'] || {
    startingBalance: 0,
    entries: [],
    endingBalance: 0
  };

  const pl = calculateProfitAndLoss(accounts, transactions);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-5 space-y-4 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-lg shadow-xs border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <span>Modul Penjualan & Buku Pembantu Piutang (AR)</span>
          </h2>
          <p className="text-xs text-slate-500">Pencatatan pendapatan operasional, faktur pelanggan, dan pemantauan piutang.</p>
        </div>
        <div className="flex space-x-2">
          <button 
            type="button"
            onClick={() => openNewTransactionModal('sales')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded flex items-center space-x-1.5 shadow transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Faktur Penjualan Baru</span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Pendapatan Operasional</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1 num font-mono">
            {formatRupiah(pl.totalRevenues)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Akun 40000 s/d 40003</div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Piutang Usaha Belum Tertagih</div>
          <div className="text-2xl font-bold text-blue-600 mt-1 num font-mono">
            {formatRupiah(piutangLedger.endingBalance)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Akun 10003 - Piutang Usaha</div>
        </div>
      </div>

      {/* AR Subsidiary Table */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-xs uppercase text-slate-700">
            Buku Pembantu Piutang Usaha (Accounts Receivable Ledger)
          </h3>
          <button 
            type="button"
            onClick={handlePrint}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center space-x-1 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Piutang</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="table-accurate">
            <thead>
              <tr>
                <th className="w-24">Tanggal</th>
                <th className="w-24">No. Bukti</th>
                <th>Nama Pelanggan</th>
                <th>Keterangan Transaksi</th>
                <th className="num w-32">Penambahan (Db)</th>
                <th className="num w-32">Pelunasan (Kr)</th>
                <th className="num w-32">Saldo Piutang</th>
              </tr>
            </thead>
            <tbody>
              {/* Initial Customer Balance */}
              <tr>
                <td className="font-mono text-xs text-slate-400">-</td>
                <td className="font-mono text-xs text-slate-400 font-bold">SALDO AWAL</td>
                <td className="font-semibold text-slate-800">Andi Transport Service</td>
                <td className="text-slate-600">Saldo Awal Piutang Usaha</td>
                <td className="num font-mono text-slate-800">
                  {formatRupiah(piutangLedger.startingBalance)}
                </td>
                <td className="num font-mono text-slate-400">-</td>
                <td className="num font-mono font-bold text-blue-700">
                  {formatRupiah(piutangLedger.startingBalance)}
                </td>
              </tr>

              {/* Entries */}
              {piutangLedger.entries.map((e: LedgerEntry, idx: number) => (
                <tr key={idx}>
                  <td className="font-mono text-xs text-slate-700">{e.date}</td>
                  <td className="font-mono font-bold text-blue-600 text-xs">{e.refNumber}</td>
                  <td className="font-semibold text-slate-800">Andi Transport Service</td>
                  <td className="text-slate-900">{e.description}</td>
                  <td className="num font-mono text-blue-700">
                    {e.debit > 0 ? formatRupiah(e.debit) : '-'}
                  </td>
                  <td className="num font-mono text-emerald-700">
                    {e.credit > 0 ? formatRupiah(e.credit) : '-'}
                  </td>
                  <td className="num font-mono font-bold text-slate-900">
                    {formatRupiah(e.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
