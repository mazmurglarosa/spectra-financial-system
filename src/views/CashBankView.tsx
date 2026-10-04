import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Printer, Wallet } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { calculateGeneralLedgers, formatRupiah } from '../utils/accountingCalculations';
import { LedgerEntry } from '../types/accounting';

interface CashBankViewProps {
  openNewTransactionModal: (preset?: 'cash_in' | 'cash_out') => void;
}

export const CashBankView: React.FC<CashBankViewProps> = ({ openNewTransactionModal }) => {
  const { accounts, transactions } = useAccounting();

  const ledgers = calculateGeneralLedgers(accounts, transactions);
  const kasLedger = ledgers['10001'] || {
    startingBalance: 0,
    entries: [],
    endingBalance: 0,
    totalDebit: 0,
    totalCredit: 0
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-5 space-y-4 animate-fadeIn">
      {/* Top Banner Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-lg shadow-xs border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-blue-600" />
            <span>Modul Kas & Bank (Accurate Cash/Bank)</span>
          </h2>
          <p className="text-xs text-slate-500">Pencatatan kas masuk, kas keluar, dan mutasi saldo kas riil.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            type="button"
            onClick={() => openNewTransactionModal('cash_in')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded flex items-center space-x-1.5 shadow transition cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ Penerimaan Kas (Kas Masuk)</span>
          </button>
          <button 
            type="button"
            onClick={() => openNewTransactionModal('cash_out')}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-2 rounded flex items-center space-x-1.5 shadow transition cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>+ Pengeluaran Kas (Kas Keluar)</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-xs border border-blue-200 bg-blue-50/20">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rekening: 10001 - Kas</div>
          <div className="text-2xl font-bold text-blue-700 mt-1 num font-mono">
            {formatRupiah(kasLedger.endingBalance)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Saldo Awal: {formatRupiah(kasLedger.startingBalance)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Mutasi Kas Masuk</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1 num font-mono">
            {formatRupiah(kasLedger.totalDebit)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Penerimaan periode berjalan</div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Mutasi Kas Keluar</div>
          <div className="text-2xl font-bold text-rose-600 mt-1 num font-mono">
            {formatRupiah(kasLedger.totalCredit)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Pengeluaran periode berjalan</div>
        </div>
      </div>

      {/* Rekening Koran Table */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-xs uppercase text-slate-700">
            Histori Transaksi Kas Utama (Akun 10001)
          </h3>
          <button 
            type="button"
            onClick={handlePrint}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center space-x-1 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Rekening Koran</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="table-accurate">
            <thead>
              <tr>
                <th className="w-24">Tanggal</th>
                <th className="w-24">No. Bukti</th>
                <th>Keterangan</th>
                <th className="w-32">Kontak / Penerima</th>
                <th className="num w-32">Kas Masuk (Db)</th>
                <th className="num w-32">Kas Keluar (Kr)</th>
                <th className="num w-32">Saldo Akhir</th>
              </tr>
            </thead>
            <tbody>
              {/* Row Saldo Awal */}
              <tr>
                <td className="font-mono text-xs text-slate-400">-</td>
                <td className="font-mono text-xs text-slate-400 font-bold">SALDO AWAL</td>
                <td className="font-semibold text-slate-700">Saldo Awal Buku Kas</td>
                <td>-</td>
                <td className="num font-mono">
                  {kasLedger.startingBalance > 0 ? formatRupiah(kasLedger.startingBalance) : '-'}
                </td>
                <td className="num font-mono">-</td>
                <td className="num font-mono font-bold text-slate-900">
                  {formatRupiah(kasLedger.startingBalance)}
                </td>
              </tr>

              {/* Entries */}
              {kasLedger.entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-xs text-slate-400">
                    Belum ada mutasi kas untuk periode ini.
                  </td>
                </tr>
              ) : (
                kasLedger.entries.map((e: LedgerEntry, idx: number) => (
                  <tr key={idx}>
                    <td className="font-mono text-xs text-slate-700">{e.date}</td>
                    <td className="font-mono font-bold text-blue-600 text-xs">{e.refNumber}</td>
                    <td className="text-slate-900">
                      {e.description}
                      {e.memo && <span className="text-xs text-slate-400 ml-1">({e.memo})</span>}
                    </td>
                    <td className="text-slate-600 text-xs">-</td>
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
