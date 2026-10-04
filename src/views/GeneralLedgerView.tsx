import React, { useState, useMemo } from 'react';
import { Download, Calendar, Layers, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { formatRupiah, generateAccountLedger, exportTableToExcel } from '../utils/accountingCalculations';

export const GeneralLedgerView: React.FC = () => {
  const { accounts, transactions } = useAccounting();

  const selectableAccounts = useMemo(() => {
    return accounts.filter(a => !a.isHeader);
  }, [accounts]);

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    selectableAccounts[0]?.id || ''
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === selectedAccountId) || selectableAccounts[0];
  }, [accounts, selectedAccountId, selectableAccounts]);

  const ledger = useMemo(() => {
    if (!selectedAccount) return null;
    return generateAccountLedger(selectedAccount, transactions, startDate, endDate);
  }, [selectedAccount, transactions, startDate, endDate]);

  const handleExport = () => {
    if (!ledger) return;

    const data: any[][] = [
      [`BUKU BESAR (GENERAL LEDGER) - ${ledger.account.code} ${ledger.account.name}`],
      [`Kategori: ${ledger.account.categoryName} | Saldo Normal: ${ledger.account.sn === 'Db' ? 'Debit' : 'Kredit'}`],
      [''],
      ['TANGGAL', 'NO. BUKTI', 'KETERANGAN', 'DEBET (RP)', 'KREDIT (RP)', 'SALDO BERJALAN (RP)']
    ];

    data.push(['-', '-', 'SALDO AWAL', '', '', ledger.startingBalance]);

    ledger.entries.forEach(e => {
      data.push([
        e.date,
        e.refNumber,
        e.description,
        e.debit,
        e.credit,
        e.balance
      ]);
    });

    data.push(['', '', 'TOTAL MUTASI & SALDO AKHIR', ledger.totalDebit, ledger.totalCredit, ledger.endingBalance]);

    exportTableToExcel(data, `Buku_Besar_${ledger.account.code}_${new Date().toISOString().split('T')[0]}`, 'Buku Besar');
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Account Selection and Filter Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Account Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '320px', maxWidth: '520px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Pilih Akun:
          </label>
          <select 
            value={selectedAccountId} 
            onChange={e => setSelectedAccountId(e.target.value)}
            style={{ fontWeight: 600, fontSize: '0.875rem' }}
          >
            {selectableAccounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.name} ({a.categoryName})
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter & Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
          </div>

          <button onClick={handleExport} className="btn btn-outline" style={{ fontSize: '0.825rem' }}>
            <Download size={15} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Account Summary Cards */}
      {ledger && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px' }}>
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              SALDO AWAL
            </div>
            <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {formatRupiah(ledger.startingBalance)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Posisi SN: {ledger.account.sn === 'Db' ? 'Debit' : 'Kredit'}
            </div>
          </div>

          <div className="card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              TOTAL MUTASI DEBET
            </div>
            <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>
              {formatRupiah(ledger.totalDebit)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Penambahan debit
            </div>
          </div>

          <div className="card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              TOTAL MUTASI KREDIT
            </div>
            <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fbbf24' }}>
              {formatRupiah(ledger.totalCredit)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Pengurangan / penambahan kredit
            </div>
          </div>

          <div className="card" style={{ padding: '18px', border: '1px solid var(--primary-glow)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              SALDO AKHIR (ENDING)
            </div>
            <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>
              {formatRupiah(ledger.endingBalance)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Saldo riil akun
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      {ledger && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Tanggal</th>
                  <th style={{ width: '12%' }}>No. Bukti / Ref</th>
                  <th style={{ width: '34%' }}>Keterangan Transaksi</th>
                  <th style={{ width: '14%', textAlign: 'right' }}>Debet (Rp)</th>
                  <th style={{ width: '14%', textAlign: 'right' }}>Kredit (Rp)</th>
                  <th style={{ width: '14%', textAlign: 'right' }}>Saldo Berjalan (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {/* Starting Balance Row */}
                <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <td style={{ color: 'var(--text-muted)' }}>-</td>
                  <td style={{ color: 'var(--text-muted)' }}>-</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                    SALDO AWAL AKUN
                  </td>
                  <td style={{ textAlign: 'right' }}>-</td>
                  <td style={{ textAlign: 'right' }}>-</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                    {formatRupiah(ledger.startingBalance)}
                  </td>
                </tr>

                {ledger.entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      Belum ada mutasi transaksi untuk akun ini pada periode yang dipilih.
                    </td>
                  </tr>
                ) : (
                  ledger.entries.map((entry, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: '0.825rem' }}>{entry.date}</td>
                      <td>
                        <span className="badge badge-info mono" style={{ fontSize: '0.72rem' }}>
                          {entry.refNumber}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.825rem' }}>
                        <div>{entry.description}</div>
                        {entry.memo && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {entry.memo}
                          </div>
                        )}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: entry.debit > 0 ? 600 : 400 }}>
                        {entry.debit > 0 ? formatRupiah(entry.debit) : '-'}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: entry.credit > 0 ? 600 : 400 }}>
                        {entry.credit > 0 ? formatRupiah(entry.credit) : '-'}
                      </td>
                      <td className="mono" style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: entry.balance < 0 ? '#fb7185' : 'var(--text-main)'
                      }}>
                        {formatRupiah(entry.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: 'var(--bg-surface)', fontWeight: 700 }}>
                  <td colSpan={3} style={{ textAlign: 'right', padding: '16px' }}>
                    TOTAL MUTASI & SALDO AKHIR:
                  </td>
                  <td className="mono" style={{ textAlign: 'right', color: '#38bdf8', padding: '16px' }}>
                    {formatRupiah(ledger.totalDebit)}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', color: '#fbbf24', padding: '16px' }}>
                    {formatRupiah(ledger.totalCredit)}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', color: '#34d399', padding: '16px', fontSize: '1rem' }}>
                    {formatRupiah(ledger.endingBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
