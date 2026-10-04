import React from 'react';
import { Package, PlusCircle, Printer } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { calculateGeneralLedgers, formatRupiah } from '../utils/accountingCalculations';
import { LedgerEntry } from '../types/accounting';

interface PurchasesViewProps {
  openNewTransactionModal: (preset?: 'purchase') => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({ openNewTransactionModal }) => {
  const { accounts, transactions } = useAccounting();

  const ledgers = calculateGeneralLedgers(accounts, transactions);
  const utangLedger = ledgers['20001'] || {
    startingBalance: 0,
    entries: [],
    endingBalance: 0
  };

  const hppAccount = accounts.find(a => a.code === '40004');
  const returBeliAccount = accounts.find(a => a.code === '40005');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-5 space-y-4 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-lg shadow-xs border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span>Modul Pembelian & Buku Pembantu Hutang (AP)</span>
          </h2>
          <p className="text-xs text-slate-500">Pencatatan pembelian barang dagang, retur pembelian, dan manajemen utang vendor.</p>
        </div>
        <div className="flex space-x-2">
          <button 
            type="button"
            onClick={() => openNewTransactionModal('purchase')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded flex items-center space-x-1.5 shadow transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Faktur Pembelian Baru</span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Pembelian</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 num font-mono">
            {formatRupiah(hppAccount?.debetAwal || 0)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Akun 40004 - Pembelian</div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Retur & Potongan Pembelian</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1 num font-mono">
            {formatRupiah(returBeliAccount?.kreditAwal || 0)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Akun 40005 - Retur Pembelian</div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Utang Usaha (Vendor)</div>
          <div className="text-2xl font-bold text-amber-600 mt-1 num font-mono">
            {formatRupiah(utangLedger.endingBalance)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Akun 20001 - Utang Usaha/Dagang</div>
        </div>
      </div>

      {/* AP Subsidiary Table */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-xs uppercase text-slate-700">
            Buku Pembantu Utang Usaha (Accounts Payable Ledger)
          </h3>
          <button 
            type="button"
            onClick={handlePrint}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center space-x-1 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Utang</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="table-accurate">
            <thead>
              <tr>
                <th className="w-24">Tanggal</th>
                <th className="w-24">No. Bukti</th>
                <th>Pemasok (Vendor)</th>
                <th>Keterangan Transaksi</th>
                <th className="num w-32">Pembayaran (Db)</th>
                <th className="num w-32">Pembelian (Kr)</th>
                <th className="num w-32">Saldo Utang</th>
              </tr>
            </thead>
            <tbody>
              {/* Initial Vendor Balance */}
              <tr>
                <td className="font-mono text-xs text-slate-400">-</td>
                <td className="font-mono text-xs text-slate-400 font-bold">SALDO AWAL</td>
                <td className="font-semibold text-slate-800">Toko ATK Sejahtera</td>
                <td className="text-slate-600">Saldo Awal Utang Usaha</td>
                <td className="num font-mono text-slate-400">-</td>
                <td className="num font-mono text-slate-800">
                  {formatRupiah(utangLedger.startingBalance)}
                </td>
                <td className="num font-mono font-bold text-amber-700">
                  {formatRupiah(utangLedger.startingBalance)}
                </td>
              </tr>

              {/* Entries */}
              {utangLedger.entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-xs text-slate-400">
                    Belum ada transaksi utang usaha periode ini.
                  </td>
                </tr>
              ) : (
                utangLedger.entries.map((e: LedgerEntry, idx: number) => (
                  <tr key={idx}>
                    <td className="font-mono text-xs text-slate-700">{e.date}</td>
                    <td className="font-mono font-bold text-blue-600 text-xs">{e.refNumber}</td>
                    <td className="font-semibold text-slate-800">Toko ATK Sejahtera</td>
                    <td className="text-slate-900">{e.description}</td>
                    <td className="num font-mono text-emerald-700">
                      {e.debit > 0 ? formatRupiah(e.debit) : '-'}
                    </td>
                    <td className="num font-mono text-rose-700">
                      {e.credit > 0 ? formatRupiah(e.credit) : '-'}
                    </td>
                    <td className="num font-mono font-bold text-slate-900">
                      {formatRupiah(e.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
