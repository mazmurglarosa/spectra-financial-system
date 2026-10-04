import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { Transaction, TransactionLine, TransactionType } from '../../types/accounting';
import { formatRupiah } from '../../utils/accountingCalculations';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionToEdit?: Transaction | null;
  presetType?: TransactionType;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ 
  isOpen, 
  onClose, 
  transactionToEdit,
  presetType = 'general'
}) => {
  const { accounts, addTransaction, updateTransaction, getNextRefNumber } = useAccounting();

  // Filter out header accounts
  const selectableAccounts = accounts.filter(a => !a.isHeader);

  const [txType, setTxType] = useState<TransactionType>(presetType);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [refNumber, setRefNumber] = useState<string>('');
  const [contact, setContact] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [lines, setLines] = useState<TransactionLine[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    if (transactionToEdit) {
      setTxType(transactionToEdit.type || 'general');
      setDate(transactionToEdit.date);
      setRefNumber(transactionToEdit.refNumber);
      setContact(transactionToEdit.partner || '');
      setDescription(transactionToEdit.description);
      setLines(transactionToEdit.lines.map(l => ({ ...l })));
    } else {
      const type = presetType || 'general';
      setTxType(type);
      setDate('2021-12-15'); // default fiscal period
      const generatedRef = getNextRefNumber(type);
      setRefNumber(generatedRef);
      setContact('');
      setDescription('');

      // Auto preset rows matching SIKEU
      if (type === 'cash_in') {
        const kas = selectableAccounts.find(a => a.code === '10001');
        const rev = selectableAccounts.find(a => a.code === '40001');
        setLines([
          { id: '1', accountId: kas?.id || '', accountCode: '10001', accountName: kas?.name || 'Kas', debit: 0, credit: 0, memo: 'Penerimaan Kas' },
          { id: '2', accountId: rev?.id || '', accountCode: '40001', accountName: rev?.name || 'Pendapatan Jasa / Penjualan', debit: 0, credit: 0, memo: 'Pendapatan' }
        ]);
        setDescription('Penerimaan kas pendapatan');
      } else if (type === 'cash_out') {
        const expense = selectableAccounts.find(a => a.code === '50006') || selectableAccounts.find(a => a.code.startsWith('5'));
        const kas = selectableAccounts.find(a => a.code === '10001');
        setLines([
          { id: '1', accountId: expense?.id || '', accountCode: expense?.code || '50006', accountName: expense?.name || 'Beban Operasional', debit: 0, credit: 0, memo: 'Beban / Pengeluaran' },
          { id: '2', accountId: kas?.id || '', accountCode: '10001', accountName: kas?.name || 'Kas', debit: 0, credit: 0, memo: 'Pembayaran Kas' }
        ]);
        setDescription('Pengeluaran kas operasional');
      } else if (type === 'sales') {
        const ar = selectableAccounts.find(a => a.code === '10003');
        const rev = selectableAccounts.find(a => a.code === '40001');
        setLines([
          { id: '1', accountId: ar?.id || '', accountCode: '10003', accountName: ar?.name || 'Piutang Usaha', debit: 0, credit: 0, memo: 'Piutang Penjualan' },
          { id: '2', accountId: rev?.id || '', accountCode: '40001', accountName: rev?.name || 'Pendapatan Jasa / Penjualan', debit: 0, credit: 0, memo: 'Penjualan Jasa' }
        ]);
        setDescription('Faktur Penjualan Barang / Jasa');
      } else if (type === 'purchase') {
        const purch = selectableAccounts.find(a => a.code === '40004');
        const ap = selectableAccounts.find(a => a.code === '20001');
        setLines([
          { id: '1', accountId: purch?.id || '', accountCode: '40004', accountName: purch?.name || 'Pembelian Barang Dagang', debit: 0, credit: 0, memo: 'Pembelian Barang' },
          { id: '2', accountId: ap?.id || '', accountCode: '20001', accountName: ap?.name || 'Utang Usaha/Dagang', debit: 0, credit: 0, memo: 'Utang Dagang' }
        ]);
        setDescription('Faktur Pembelian Barang Dagang');
      } else if (type === 'adjustment') {
        const expense = selectableAccounts.find(a => a.code.startsWith('5'));
        const asset = selectableAccounts.find(a => a.code.startsWith('1'));
        setLines([
          { id: '1', accountId: expense?.id || '', accountCode: expense?.code || '', accountName: expense?.name || '', debit: 0, credit: 0, memo: 'Beban Penyesuaian' },
          { id: '2', accountId: asset?.id || '', accountCode: asset?.code || '', accountName: asset?.name || '', debit: 0, credit: 0, memo: 'Penyesuaian Akun' }
        ]);
        setDescription('Penyesuaian akhir periode');
      } else {
        setLines([
          { id: '1', accountId: selectableAccounts[0]?.id || '', accountCode: selectableAccounts[0]?.code || '', accountName: selectableAccounts[0]?.name || '', debit: 0, credit: 0, memo: '' },
          { id: '2', accountId: selectableAccounts[1]?.id || '', accountCode: selectableAccounts[1]?.code || '', accountName: selectableAccounts[1]?.name || '', debit: 0, credit: 0, memo: '' }
        ]);
      }
    }
  }, [isOpen, transactionToEdit, presetType, getNextRefNumber]);

  if (!isOpen) return null;

  // Real-time calculations
  const totalDebit = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const isBalanced = diff < 0.01 && totalDebit > 0;

  const handleTypeChange = (newType: TransactionType) => {
    setTxType(newType);
    if (!transactionToEdit) {
      setRefNumber(getNextRefNumber(newType));
    }
  };

  const handleAccountChange = (index: number, accountCode: string) => {
    const acc = selectableAccounts.find(a => a.code === accountCode);
    if (!acc) return;
    setLines(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        accountId: acc.id,
        accountCode: acc.code,
        accountName: acc.name
      };
      return updated;
    });
  };

  const handleAmountChange = (index: number, field: 'debit' | 'credit', value: string) => {
    const num = parseFloat(value) || 0;
    setLines(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: num
      };
      return updated;
    });
  };

  const handleMemoChange = (index: number, memo: string) => {
    setLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], memo };
      return updated;
    });
  };

  const addRow = () => {
    setLines(prev => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        accountId: '',
        accountCode: '',
        accountName: '',
        debit: 0,
        credit: 0,
        memo: ''
      }
    ]);
  };

  const removeRow = (index: number) => {
    if (lines.length <= 2) {
      alert('Transaksi harus memiliki minimal 2 baris akun (debit dan kredit).');
      return;
    }
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isBalanced) {
      alert(`Transaksi tidak seimbang! Total Debit (${formatRupiah(totalDebit)}) harus sama dengan Total Kredit (${formatRupiah(totalCredit)}).`);
      return;
    }

    if (!description.trim()) {
      alert('Keterangan transaksi wajib diisi!');
      return;
    }

    // Check account selection
    const validLines = lines.filter(l => l.accountCode && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) {
      alert('Harap pilih minimal 2 baris akun dengan nominal debit dan kredit yang valid.');
      return;
    }

    if (transactionToEdit) {
      updateTransaction(transactionToEdit.id, {
        date,
        refNumber,
        type: txType,
        description: description.trim(),
        partner: contact.trim() || undefined,
        lines: validLines,
        totalDebit,
        totalCredit
      });
      alert(`Transaksi ${refNumber} berhasil diperbarui!`);
    } else {
      addTransaction({
        date,
        refNumber,
        type: txType,
        description: description.trim(),
        partner: contact.trim() || undefined,
        lines: validLines,
        totalDebit,
        totalCredit
      });
      alert(`Transaksi ${refNumber} berhasil disimpan!`);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-fadeIn border border-slate-200">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-1 bg-blue-500/20 text-blue-400 rounded">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide text-white">
                {transactionToEdit ? 'Edit Transaksi Jurnal (Accurate Voucher)' : 'Input Jurnal Transaksi (Accurate Voucher)'}
              </h3>
              <p className="text-[11px] text-slate-400">Pencatatan voucher berpasangan standar sistem akuntansi Accurate</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded hover:bg-slate-800"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <form id="form-journal" onSubmit={handleSubmit} className="space-y-4">
            
            {/* Top Metadata Fields Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipe Transaksi</label>
                <select 
                  value={txType} 
                  onChange={e => handleTypeChange(e.target.value as TransactionType)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 focus:ring-1 focus:ring-blue-500 focus:outline-none font-medium"
                >
                  <option value="general">Jurnal Umum (JU)</option>
                  <option value="adjustment">Jurnal Penyesuaian (AJP / AP)</option>
                  <option value="cash_in">Penerimaan Kas (KM)</option>
                  <option value="cash_out">Pengeluaran Kas (KK)</option>
                  <option value="sales">Faktur Penjualan (FP)</option>
                  <option value="purchase">Faktur Pembelian (FB)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">No. Bukti / Referensi</label>
                <input 
                  type="text" 
                  required 
                  value={refNumber}
                  onChange={e => setRefNumber(e.target.value)}
                  placeholder="JU-001" 
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tanggal Transaksi</label>
                <input 
                  type="date" 
                  required 
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pelanggan / Pemasok (Opsional)</label>
                <input 
                  type="text" 
                  value={contact}
                  onChange={e => setContact(e.target.value)}
                  placeholder="Toko / Rekanan / Customer..." 
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-900 bg-white"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block font-semibold text-slate-700 mb-1">Keterangan Transaksi</label>
                <input 
                  type="text" 
                  required 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Penjelasan rincian transaksi..." 
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-900 bg-white"
                />
              </div>
            </div>

            {/* Journal Items Table */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Rincian Baris Akun Debit & Kredit
                </h4>
                <button 
                  type="button" 
                  onClick={addRow} 
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tambah Baris Akun</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-md overflow-hidden shadow-xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-2 text-center w-10">No</th>
                      <th className="p-2 text-left">Pilih Akun</th>
                      <th className="p-2 text-right w-36">Debit (Rp)</th>
                      <th className="p-2 text-right w-36">Kredit (Rp)</th>
                      <th className="p-2 text-left">Memo Baris</th>
                      <th className="p-2 text-center w-12">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {lines.map((line, idx) => (
                      <tr key={line.id || idx}>
                        <td className="p-2 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-2">
                          <select 
                            value={line.accountCode} 
                            onChange={e => handleAccountChange(idx, e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-2 py-1 bg-white text-slate-900 focus:ring-1 focus:ring-blue-500 font-mono"
                          >
                            <option value="">-- Pilih Akun --</option>
                            {selectableAccounts.map(a => (
                              <option key={a.id} value={a.code}>
                                {a.code} - {a.name} ({a.sn})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            value={line.debit || ''}
                            onChange={e => handleAmountChange(idx, 'debit', e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-2 py-1 text-right font-mono text-slate-900 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            value={line.credit || ''}
                            onChange={e => handleAmountChange(idx, 'credit', e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-2 py-1 text-right font-mono text-slate-900 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            placeholder="Keterangan baris..."
                            value={line.memo || ''}
                            onChange={e => handleMemoChange(idx, e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-2 py-1 text-slate-900 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button 
                            type="button" 
                            onClick={() => removeRow(idx)}
                            title="Hapus Baris"
                            className="text-slate-400 hover:text-rose-600 p-1 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={2} className="p-2 text-right text-slate-700">TOTAL:</td>
                      <td className="p-2 text-right text-slate-900 num font-mono text-xs">
                        {formatRupiah(totalDebit)}
                      </td>
                      <td className="p-2 text-right text-slate-900 num font-mono text-xs">
                        {formatRupiah(totalCredit)}
                      </td>
                      <td colSpan={2} className={`p-2 text-left font-mono text-xs ${isBalanced ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}`}>
                        {isBalanced ? 'Seimbang (Rp 0)' : `Selisih: ${formatRupiah(diff)}`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Live Validation Alert Box */}
            {isBalanced ? (
              <div className="p-2.5 rounded text-xs flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Total Debit dan Kredit Seimbang (Balance). Siap disimpan ke jurnal.</span>
              </div>
            ) : (
              <div className="p-2.5 rounded text-xs flex items-center space-x-2 bg-rose-50 text-rose-800 border border-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Peringatan: Jurnal belum seimbang! Selisih {formatRupiah(diff)}. Debit dan kredit harus sama sebelum disimpan.</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <button 
                type="button" 
                onClick={onClose} 
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-300 transition"
              >
                Batal
              </button>
              <button 
                type="submit" 
                disabled={!isBalanced}
                className={`px-5 py-2 text-xs font-semibold text-white rounded shadow transition flex items-center space-x-1.5 ${
                  isBalanced 
                    ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' 
                    : 'bg-slate-400 opacity-50 cursor-not-allowed'
                }`}
              >
                <span>Simpan Transaksi</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
