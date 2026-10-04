import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle, CheckCircle, Save } from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { Transaction, TransactionLine } from '../../types/accounting';
import { formatRupiah } from '../../utils/accountingCalculations';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionToEdit?: Transaction | null;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, transactionToEdit }) => {
  const { accounts, addTransaction, updateTransaction } = useAccounting();

  // Filter out header accounts
  const selectableAccounts = accounts.filter(a => !a.isHeader);

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [refNumber, setRefNumber] = useState<string>('JU-001');
  const [description, setDescription] = useState<string>('');
  const [partner, setPartner] = useState<string>('');
  const [lines, setLines] = useState<TransactionLine[]>([
    { id: '1', accountId: '', accountCode: '', accountName: '', debit: 0, credit: 0, memo: '' },
    { id: '2', accountId: '', accountCode: '', accountName: '', debit: 0, credit: 0, memo: '' }
  ]);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (transactionToEdit) {
      setDate(transactionToEdit.date);
      setRefNumber(transactionToEdit.refNumber);
      setDescription(transactionToEdit.description);
      setPartner(transactionToEdit.partner || '');
      setLines(transactionToEdit.lines.map(l => ({ ...l })));
    } else {
      // Default initial form
      const now = new Date();
      setDate('2021-12-15'); // matching default template period
      setRefNumber(`JU-${Math.floor(100 + Math.random() * 900)}`);
      setDescription('');
      setPartner('');
      setLines([
        { id: '1', accountId: selectableAccounts[0]?.id || '', accountCode: selectableAccounts[0]?.code || '', accountName: selectableAccounts[0]?.name || '', debit: 0, credit: 0, memo: '' },
        { id: '2', accountId: selectableAccounts[1]?.id || '', accountCode: selectableAccounts[1]?.code || '', accountName: selectableAccounts[1]?.name || '', debit: 0, credit: 0, memo: '' }
      ]);
    }
    setErrorMessage('');
  }, [transactionToEdit, isOpen]);

  if (!isOpen) return null;

  // Real-time calculations
  const totalDebit = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference === 0 && totalDebit > 0;

  const handleAccountChange = (index: number, accountId: string) => {
    const acc = selectableAccounts.find(a => a.id === accountId);
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
        [field]: num,
        // If entering debit, auto-clear credit, and vice-versa
        ...(field === 'debit' && num > 0 ? { credit: 0 } : {}),
        ...(field === 'credit' && num > 0 ? { debit: 0 } : {})
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

  const addLine = () => {
    setLines(prev => [
      ...prev,
      {
        id: `line_${Date.now()}_${Math.random()}`,
        accountId: selectableAccounts[0]?.id || '',
        accountCode: selectableAccounts[0]?.code || '',
        accountName: selectableAccounts[0]?.name || '',
        debit: 0,
        credit: 0,
        memo: ''
      }
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) {
      setErrorMessage('Setiap jurnal minimal harus memiliki 2 baris (Debit & Kredit).');
      return;
    }
    setLines(prev => prev.filter((_, i) => i !== index));
    setErrorMessage('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMessage('Keterangan transaksi wajib diisi.');
      return;
    }
    if (!isBalanced) {
      setErrorMessage(`Total Debit (${formatRupiah(totalDebit)}) dan Kredit (${formatRupiah(totalCredit)}) harus seimbang!`);
      return;
    }
    for (const line of lines) {
      if (!line.accountCode) {
        setErrorMessage('Pastikan semua baris telah memilih akun.');
        return;
      }
      if ((Number(line.debit) || 0) === 0 && (Number(line.credit) || 0) === 0) {
        setErrorMessage('Setiap baris akun harus memiliki nilai nominal Debit atau Kredit.');
        return;
      }
    }

    if (transactionToEdit) {
      updateTransaction(transactionToEdit.id, {
        date,
        refNumber,
        description,
        partner,
        lines,
        totalDebit,
        totalCredit
      });
    } else {
      addTransaction({
        date,
        refNumber,
        description,
        partner,
        lines,
        totalDebit,
        totalCredit
      });
    }

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '820px' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
              {transactionToEdit ? 'Edit Transaksi Jurnal' : 'Pencatatan Jurnal Umum Baru'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Catat bukti transaksi keuangan dengan prinsip pembukuan berpasangan (Double-Entry).
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px', borderRadius: '50%' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {errorMessage && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              color: '#fb7185',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px'
            }}>
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Meta Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Tanggal Transaksi *
              </label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                No. Referensi / Bukti *
              </label>
              <input 
                type="text" 
                placeholder="Contoh: BKK-001, BKM-001" 
                value={refNumber} 
                onChange={e => setRefNumber(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Pihak Terkait / Klien / Vendor
              </label>
              <input 
                type="text" 
                placeholder="Contoh: PT Pelanggan Utama" 
                value={partner} 
                onChange={e => setPartner(e.target.value)} 
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Keterangan Transaksi *
            </label>
            <input 
              type="text" 
              placeholder="Contoh: Pembayaran sewa gedung kantor bulan Desember" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              required 
            />
          </div>

          {/* Journal Lines Table */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Rincian Akun (Debit & Kredit)
              </span>
              <button 
                type="button" 
                onClick={addLine}
                className="btn btn-outline"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                <Plus size={14} />
                Tambah Baris
              </button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>Pilih Akun</th>
                    <th style={{ width: '22%' }}>Debit (Rp)</th>
                    <th style={{ width: '22%' }}>Kredit (Rp)</th>
                    <th style={{ width: '10%' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={line.id || idx}>
                      <td>
                        <select 
                          value={line.accountId} 
                          onChange={e => handleAccountChange(idx, e.target.value)}
                          required
                          style={{ fontSize: '0.825rem', padding: '8px 10px' }}
                        >
                          <option value="" disabled>-- Pilih Akun --</option>
                          {selectableAccounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name} ({acc.pos})
                            </option>
                          ))}
                        </select>
                        <input 
                          type="text" 
                          placeholder="Catatan baris (opsional)" 
                          value={line.memo || ''} 
                          onChange={e => handleMemoChange(idx, e.target.value)}
                          style={{ marginTop: '4px', fontSize: '0.75rem', padding: '4px 8px' }}
                        />
                      </td>
                      <td>
                        <input 
                          type="number" 
                          min="0"
                          step="any"
                          placeholder="0" 
                          value={line.debit || ''} 
                          onChange={e => handleAmountChange(idx, 'debit', e.target.value)}
                          style={{ fontWeight: 600, textAlign: 'right' }}
                        />
                      </td>
                      <td>
                        <input 
                          type="number" 
                          min="0"
                          step="any"
                          placeholder="0" 
                          value={line.credit || ''} 
                          onChange={e => handleAmountChange(idx, 'credit', e.target.value)}
                          style={{ fontWeight: 600, textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => removeLine(idx)}
                          className="btn-danger"
                          style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
                          title="Hapus Baris"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Balance Verification Bar */}
          <div style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: isBalanced ? 'var(--success-bg)' : 'var(--danger-bg)',
            border: `1px solid ${isBalanced ? 'var(--success-border)' : 'var(--danger-border)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isBalanced ? (
                <>
                  <CheckCircle size={18} color="#10b981" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>
                    JURNAL SEIMBANG (BALANCED)
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle size={18} color="#f43f5e" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fb7185' }}>
                    BELUM SEIMBANG (Selisih: {formatRupiah(difference)})
                  </span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
              <div>
                Total Debit: <span className="mono" style={{ color: '#fff' }}>{formatRupiah(totalDebit)}</span>
              </div>
              <div>
                Total Kredit: <span className="mono" style={{ color: '#fff' }}>{formatRupiah(totalCredit)}</span>
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Batal
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={!isBalanced}
              style={{ opacity: isBalanced ? 1 : 0.5, cursor: isBalanced ? 'pointer' : 'not-allowed' }}
            >
              <Save size={16} />
              {transactionToEdit ? 'Simpan Perubahan' : 'Posting ke Jurnal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
