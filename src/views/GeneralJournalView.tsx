import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, Download, Calendar, CheckCircle, AlertCircle, Filter } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { Transaction } from '../types/accounting';
import { formatRupiah, exportTableToExcel } from '../utils/accountingCalculations';

interface GeneralJournalViewProps {
  openNewTransactionModal: () => void;
  onEditTransaction: (trx: Transaction) => void;
}

export const GeneralJournalView: React.FC<GeneralJournalViewProps> = ({ openNewTransactionModal, onEditTransaction }) => {
  const { transactions, deleteTransaction } = useAccounting();

  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(trx => {
      const matchSearch = trx.refNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          trx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (trx.partner && trx.partner.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          trx.lines.some(l => l.accountCode.includes(searchQuery) || l.accountName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchDate = (!startDate || trx.date >= startDate) && (!endDate || trx.date <= endDate);
      return matchSearch && matchDate;
    });
  }, [transactions, searchQuery, startDate, endDate]);

  const totalDebit = filteredTransactions.reduce((acc, t) => acc + t.totalDebit, 0);
  const totalCredit = filteredTransactions.reduce((acc, t) => acc + t.totalCredit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 1;

  const handleDelete = (trx: Transaction) => {
    if (confirm(`Hapus transaksi ${trx.refNumber}: "${trx.description}"? Tindakan ini akan mengupdate semua buku besar dan laporan.`)) {
      deleteTransaction(trx.id);
    }
  };

  const handleExport = () => {
    const data: any[][] = [
      ['TANGGAL', 'REF / NO. BUKTI', 'KETERANGAN', 'KODE AKUN', 'NAMA AKUN', 'DEBIT (RP)', 'KREDIT (RP)', 'PIHAK TERKAIT']
    ];

    filteredTransactions.forEach(trx => {
      trx.lines.forEach((line, idx) => {
        data.push([
          idx === 0 ? trx.date : '',
          idx === 0 ? trx.refNumber : '',
          idx === 0 ? trx.description : (line.memo || ''),
          line.accountCode,
          line.accountName,
          line.debit,
          line.credit,
          idx === 0 ? (trx.partner || '') : ''
        ]);
      });
    });

    data.push(['', '', 'TOTAL BALANCE (Ʃ)', '', '', totalDebit, totalCredit, '']);

    exportTableToExcel(data, `Jurnal_Umum_SPECTRA_${new Date().toISOString().split('T')[0]}`, 'Jurnal Umum');
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Filter and Action Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Cari bukti, akun, keterangan..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '38px' }}
            />
          </div>

          {/* Date range filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              style={{ width: '150px', fontSize: '0.8rem' }}
              title="Dari Tanggal"
            />
            <span style={{ color: 'var(--text-muted)' }}>-</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              style={{ width: '150px', fontSize: '0.8rem' }}
              title="Sampai Tanggal"
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="btn-ghost"
                style={{ fontSize: '0.75rem', padding: '6px' }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleExport} className="btn btn-outline" style={{ fontSize: '0.825rem' }}>
            <Download size={15} />
            Export Excel
          </button>
          <button onClick={openNewTransactionModal} className="btn btn-primary" style={{ fontSize: '0.825rem' }}>
            <Plus size={15} />
            Catat Jurnal Baru
          </button>
        </div>
      </div>

      {/* Journal Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '11%' }}>Tanggal</th>
                <th style={{ width: '10%' }}>No. Bukti</th>
                <th style={{ width: '28%' }}>Keterangan / Akun</th>
                <th style={{ width: '10%' }}>Kode Akun</th>
                <th style={{ width: '17%', textAlign: 'right' }}>Debit (Rp)</th>
                <th style={{ width: '17%', textAlign: 'right' }}>Kredit (Rp)</th>
                <th style={{ width: '7%', textAlign: 'center' }} className="no-print">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Tidak ada transaksi jurnal yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(trx => (
                  <React.Fragment key={trx.id}>
                    {/* Header Row for Transaction Voucher */}
                    <tr style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', borderTop: '2px solid var(--border-medium)' }}>
                      <td style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                        {trx.date}
                      </td>
                      <td>
                        <span className="badge badge-info mono" style={{ fontSize: '0.75rem' }}>
                          {trx.refNumber}
                        </span>
                      </td>
                      <td colSpan={2}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {trx.description}
                        </div>
                        {trx.partner && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            Pihak: {trx.partner}
                          </div>
                        )}
                      </td>
                      <td colSpan={2} style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Total: <strong className="mono" style={{ color: '#fff' }}>{formatRupiah(trx.totalDebit)}</strong>
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }} className="no-print">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button 
                            onClick={() => onEditTransaction(trx)}
                            className="btn-ghost"
                            style={{ padding: '6px', borderRadius: '4px' }}
                            title="Edit Jurnal"
                          >
                            <Edit2 size={14} color="var(--primary)" />
                          </button>
                          <button 
                            onClick={() => handleDelete(trx)}
                            className="btn-ghost"
                            style={{ padding: '6px', borderRadius: '4px' }}
                            title="Hapus Jurnal"
                          >
                            <Trash2 size={14} color="#f43f5e" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Detailed Account Lines */}
                    {trx.lines.map((line, idx) => (
                      <tr key={line.id || idx} style={{ borderBottom: idx === trx.lines.length - 1 ? '1px solid var(--border-medium)' : '1px solid var(--border-subtle)' }}>
                        <td></td>
                        <td></td>
                        <td style={{ paddingLeft: line.credit > 0 ? '36px' : '16px' }}>
                          <span style={{ color: line.credit > 0 ? 'var(--text-secondary)' : 'var(--text-main)', fontWeight: line.credit > 0 ? 400 : 500 }}>
                            {line.accountName}
                          </span>
                          {line.memo && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                              ({line.memo})
                            </span>
                          )}
                        </td>
                        <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {line.accountCode}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: line.debit > 0 ? 600 : 400 }}>
                          {line.debit > 0 ? formatRupiah(line.debit) : '-'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: line.credit > 0 ? 600 : 400 }}>
                          {line.credit > 0 ? formatRupiah(line.credit) : '-'}
                        </td>
                        <td className="no-print"></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
            {/* Total Balance Footer */}
            <tfoot>
              <tr style={{ backgroundColor: 'var(--bg-surface)', fontWeight: 700, fontSize: '0.9rem' }}>
                <td colSpan={4} style={{ textAlign: 'right', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    {isBalanced ? (
                      <CheckCircle size={18} color="#10b981" />
                    ) : (
                      <AlertCircle size={18} color="#f43f5e" />
                    )}
                    <span>TOTAL KESEIMBANGAN JURNAL (Ʃ Balance):</span>
                  </div>
                </td>
                <td className="mono" style={{ textAlign: 'right', color: '#34d399', padding: '16px' }}>
                  {formatRupiah(totalDebit)}
                </td>
                <td className="mono" style={{ textAlign: 'right', color: '#34d399', padding: '16px' }}>
                  {formatRupiah(totalCredit)}
                </td>
                <td className="no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
