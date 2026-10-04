import React from 'react';
import { Download, CheckCircle, AlertTriangle, Scale } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { formatRupiah, generateTrialBalance, exportTableToExcel } from '../utils/accountingCalculations';

export const TrialBalanceView: React.FC = () => {
  const { accounts, transactions, settings } = useAccounting();

  const trialBalance = generateTrialBalance(accounts, transactions);

  const handleExport = () => {
    const data: any[][] = [
      [`NERACA SALDO (TRIAL BALANCE) - ${settings.companyName}`],
      [`Periode: ${settings.fiscalPeriod} (${settings.fiscalYear})`],
      [''],
      ['KODE AKUN', 'NAMA AKUN', 'KELOMPOK AKUN', 'DEBIT (RP)', 'KREDIT (RP)']
    ];

    trialBalance.items.forEach(item => {
      data.push([
        item.code,
        item.name,
        item.categoryName,
        item.debit,
        item.credit
      ]);
    });

    data.push(['', 'TOTAL KESEIMBANGAN', '', trialBalance.totalDebit, trialBalance.totalCredit]);

    exportTableToExcel(data, `Neraca_Saldo_${new Date().toISOString().split('T')[0]}`, 'Neraca Saldo');
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner with Balance status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        backgroundColor: trialBalance.isBalanced ? 'var(--success-bg)' : 'var(--danger-bg)',
        border: `1px solid ${trialBalance.isBalanced ? 'var(--success-border)' : 'var(--danger-border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {trialBalance.isBalanced ? (
            <CheckCircle size={32} color="#10b981" />
          ) : (
            <AlertTriangle size={32} color="#f43f5e" />
          )}
          <div>
            <h3 style={{
              fontSize: '1.15rem',
              color: trialBalance.isBalanced ? '#34d399' : '#fb7185',
              margin: 0
            }}>
              {trialBalance.isBalanced ? 'NERACA SALDO SEIMBANG (BALANCED)' : 'NERACA SALDO TIDAK SEIMBANG'}
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {trialBalance.isBalanced 
                ? 'Total Debit dan Total Kredit bernilai sama. Pembukuan siap disusun ke Neraca Lajur.' 
                : `Periksa kembali pencatatan jurnal umum Anda. Selisih: ${formatRupiah(Math.abs(trialBalance.totalDebit - trialBalance.totalCredit))}`}
            </p>
          </div>
        </div>

        <button onClick={handleExport} className="btn btn-outline" style={{ fontSize: '0.825rem' }}>
          <Download size={15} />
          Export Excel
        </button>
      </div>

      {/* Trial Balance Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '12%' }}>Kode Akun</th>
                <th style={{ width: '40%' }}>Nama Akun</th>
                <th style={{ width: '22%' }}>Kelompok</th>
                <th style={{ width: '13%', textAlign: 'right' }}>Debet (Rp)</th>
                <th style={{ width: '13%', textAlign: 'right' }}>Kredit (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Tidak ada saldo akun yang dapat ditampilkan.
                  </td>
                </tr>
              ) : (
                trialBalance.items.map(item => (
                  <tr key={item.code}>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {item.code}
                    </td>
                    <td>{item.name}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                        {item.categoryName}
                      </span>
                    </td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: item.debit > 0 ? 600 : 400 }}>
                      {item.debit > 0 ? formatRupiah(item.debit) : '-'}
                    </td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: item.credit > 0 ? 600 : 400 }}>
                      {item.credit > 0 ? formatRupiah(item.credit) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: 'var(--bg-surface)', fontWeight: 700, fontSize: '0.95rem' }}>
                <td colSpan={3} style={{ textAlign: 'right', padding: '16px' }}>
                  TOTAL KESEIMBANGAN (Ʃ Balance):
                </td>
                <td className="mono" style={{ textAlign: 'right', color: '#34d399', padding: '16px' }}>
                  {formatRupiah(trialBalance.totalDebit)}
                </td>
                <td className="mono" style={{ textAlign: 'right', color: '#34d399', padding: '16px' }}>
                  {formatRupiah(trialBalance.totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
