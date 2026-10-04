import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Download, 
  Printer, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { Transaction, TransactionType } from '../types/accounting';
import { formatRupiah, exportTableToExcel } from '../utils/accountingCalculations';

interface GeneralJournalViewProps {
  openNewTransactionModal: (preset?: any) => void;
  onEditTransaction: (trx: Transaction) => void;
}

export const GeneralJournalView: React.FC<GeneralJournalViewProps> = ({ 
  openNewTransactionModal, 
  onEditTransaction 
}) => {
  const { transactions, deleteTransaction } = useAccounting();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(trx => {
      // Type filter
      if (selectedType !== 'all') {
        if (trx.type !== selectedType && !(selectedType === 'general' && !trx.type)) {
          return false;
        }
      }

      // Search match
      const q = searchQuery.toLowerCase();
      const matchSearch = 
        !q ||
        trx.refNumber.toLowerCase().includes(q) ||
        trx.description.toLowerCase().includes(q) ||
        (trx.partner && trx.partner.toLowerCase().includes(q)) ||
        trx.lines.some(l => l.accountCode.includes(q) || l.accountName.toLowerCase().includes(q));

      // Date match
      const matchDate = (!startDate || trx.date >= startDate) && (!endDate || trx.date <= endDate);

      return matchSearch && matchDate;
    });
  }, [transactions, selectedType, searchQuery, startDate, endDate]);

  const totalDebit = filteredTransactions.reduce((acc, t) => acc + t.totalDebit, 0);
  const totalCredit = filteredTransactions.reduce((acc, t) => acc + t.totalCredit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleDelete = (trx: Transaction) => {
    if (confirm(`Hapus transaksi ${trx.refNumber}: "${trx.description}"? Tindakan ini akan mengupdate semua buku besar dan laporan keuangan.`)) {
      deleteTransaction(trx.id);
    }
  };

  const handleExport = () => {
    const data: any[][] = [
      ['TANGGAL', 'REF / NO. BUKTI', 'TIPE', 'KETERANGAN', 'KODE AKUN', 'NAMA AKUN', 'DEBIT (RP)', 'KREDIT (RP)', 'PIHAK TERKAIT']
    ];

    filteredTransactions.forEach(trx => {
      trx.lines.forEach((line, idx) => {
        data.push([
          idx === 0 ? trx.date : '',
          idx === 0 ? trx.refNumber : '',
          idx === 0 ? (trx.type || 'general') : '',
          idx === 0 ? trx.description : (line.memo || ''),
          line.accountCode,
          line.accountName,
          line.debit,
          line.credit,
          idx === 0 ? (trx.partner || '') : ''
        ]);
      });
    });

    data.push(['', '', '', 'TOTAL BALANCE', '', '', totalDebit, totalCredit, '']);
    exportTableToExcel(data, `Jurnal_Umum_SPECTRA_${new Date().toISOString().split('T')[0]}`, 'Jurnal Umum');
  };

  return (
    <div className="p-5 space-y-4 animate-fadeIn pb-12">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl shadow-xs border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span>Jurnal Umum & Jurnal Penyesuaian (AJP)</span>
          </h2>
          <p className="text-xs text-slate-500">
            Daftar seluruh voucher transaksi keuangan dengan validasi keseimbangan debit-kredit otomatis.
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-2">
          <button 
            type="button"
            onClick={() => openNewTransactionModal('general')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded flex items-center space-x-1.5 shadow transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Jurnal Baru</span>
          </button>

          <button 
            type="button"
            onClick={handleExport}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded flex items-center space-x-1 border border-slate-300 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button 
            type="button"
            onClick={() => window.print()}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded flex items-center space-x-1 border border-slate-300 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white p-3.5 rounded-xl shadow-xs border border-slate-200 space-y-3">
        {/* Type Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2">Tipe:</span>
          {[
            { id: 'all', label: 'Semua Transaksi' },
            { id: 'general', label: 'Jurnal Umum (JU)' },
            { id: 'adjustment', label: 'Penyesuaian (AJP)' },
            { id: 'cash_in', label: 'Kas Masuk (KM)' },
            { id: 'cash_out', label: 'Kas Keluar (KK)' },
            { id: 'sales', label: 'Penjualan (FP)' },
            { id: 'purchase', label: 'Pembelian (FB)' },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedType(t.id)}
              className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                selectedType === t.id 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search & Dates */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari bukti, akun, keterangan, mitra..."
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input 
              type="date" 
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-700 bg-white"
            />
            <span className="text-slate-400">-</span>
            <input 
              type="date" 
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-700 bg-white"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="font-semibold text-slate-500">Total Transaksi:</span>
            <span className="font-bold text-slate-900 font-mono">{filteredTransactions.length}</span>
          </div>
        </div>
      </div>

      {/* Main Journal Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-accurate text-xs">
            <thead>
              <tr>
                <th className="w-24">Tanggal</th>
                <th className="w-24">No. Bukti</th>
                <th>Keterangan Transaksi</th>
                <th className="w-28">Kode Akun</th>
                <th className="w-48">Nama Akun Perkiraan</th>
                <th className="num w-32">Debit (Rp)</th>
                <th className="num w-32">Kredit (Rp)</th>
                <th className="text-center w-24 no-print">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-xs text-slate-400">
                    Tidak ada transaksi jurnal yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(trx => {
                  let badgeType = "bg-slate-100 text-slate-700";
                  if (trx.type === "adjustment") badgeType = "bg-amber-100 text-amber-800";
                  else if (trx.type === "cash_in") badgeType = "bg-emerald-100 text-emerald-800";
                  else if (trx.type === "cash_out") badgeType = "bg-rose-100 text-rose-800";
                  else if (trx.type === "sales") badgeType = "bg-blue-100 text-blue-800";
                  else if (trx.type === "purchase") badgeType = "bg-purple-100 text-purple-800";

                  return (
                    <React.Fragment key={trx.id}>
                      {trx.lines.map((line, lIdx) => (
                        <tr 
                          key={line.id || lIdx}
                          className={lIdx === 0 ? 'border-t border-slate-200' : ''}
                        >
                          {/* Tanggal (only on 1st line) */}
                          <td className="font-mono text-slate-700">
                            {lIdx === 0 ? trx.date : ''}
                          </td>

                          {/* No. Bukti & Type Badge (only on 1st line) */}
                          <td>
                            {lIdx === 0 && (
                              <div>
                                <span className="font-mono font-bold text-blue-600">{trx.refNumber}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded ml-1 font-semibold ${badgeType}`}>
                                  {trx.type || 'general'}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Keterangan & Partner (only on 1st line) */}
                          <td>
                            {lIdx === 0 ? (
                              <div>
                                <div className="font-medium text-slate-900">{trx.description}</div>
                                {trx.partner && (
                                  <div className="text-[11px] text-slate-400">Mitra: {trx.partner}</div>
                                )}
                              </div>
                            ) : (
                              line.memo ? <span className="text-[11px] text-slate-400 italic">└ {line.memo}</span> : ''
                            )}
                          </td>

                          {/* Kode Akun */}
                          <td className="font-mono font-bold text-slate-700">
                            {line.accountCode}
                          </td>

                          {/* Nama Akun */}
                          <td className={line.credit > 0 ? 'pl-6 text-slate-800' : 'font-medium text-slate-900'}>
                            {line.accountName}
                          </td>

                          {/* Debit */}
                          <td className="num font-mono">
                            {line.debit > 0 ? formatRupiah(line.debit) : '-'}
                          </td>

                          {/* Kredit */}
                          <td className="num font-mono">
                            {line.credit > 0 ? formatRupiah(line.credit) : '-'}
                          </td>

                          {/* Aksi (only on 1st line) */}
                          <td className="text-center no-print">
                            {lIdx === 0 && (
                              <div className="flex items-center justify-center space-x-1">
                                <button 
                                  type="button"
                                  onClick={() => onEditTransaction(trx)}
                                  title="Edit Transaksi"
                                  className="text-slate-500 hover:text-blue-600 p-1 rounded cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => handleDelete(trx)}
                                  title="Hapus Transaksi"
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            <tfoot className="total-row text-xs font-bold">
              <tr>
                <td colSpan={5} className="text-right uppercase p-2.5">
                  TOTAL KESEIMBANGAN JURNAL:
                </td>
                <td className="num font-mono p-2.5 text-slate-900">
                  {formatRupiah(totalDebit)}
                </td>
                <td className="num font-mono p-2.5 text-slate-900">
                  {formatRupiah(totalCredit)}
                </td>
                <td className="text-center p-2.5 no-print">
                  {isBalanced ? (
                    <span className="text-emerald-700 font-bold flex items-center justify-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Seimbang</span>
                    </span>
                  ) : (
                    <span className="text-rose-700 font-bold flex items-center justify-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Selisih</span>
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
