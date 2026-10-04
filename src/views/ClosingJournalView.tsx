import React, { useMemo } from 'react';
import { Lock, CheckCircle, Download, FileText } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { 
  formatRupiah, 
  generateIncomeStatement, 
  calculateAccountBalance,
  exportTableToExcel 
} from '../utils/accountingCalculations';

export const ClosingJournalView: React.FC = () => {
  const { accounts, transactions, settings } = useAccounting();

  const is = generateIncomeStatement(accounts, transactions);

  // Generate closing entries lines
  const closingEntries = useMemo(() => {
    const entries: {
      type: string;
      description: string;
      lines: { code: string; name: string; debit: number; credit: number }[];
    }[] = [];

    // 1. Close Revenue accounts (Debit Revenue, Credit Ikhtisar L/R)
    const revLines: { code: string; name: string; debit: number; credit: number }[] = [];
    is.operasionalRevenue.forEach(r => {
      revLines.push({ code: r.code, name: r.name, debit: r.amount, credit: 0 });
    });
    is.nonOperasionalRevenue.forEach(r => {
      revLines.push({ code: r.code, name: r.name, debit: r.amount, credit: 0 });
    });
    const totalRev = is.totalOperasionalRevenue + is.totalNonOperasionalRevenue;
    if (totalRev > 0) {
      revLines.push({ code: '30002', name: 'Ikhtisar Laba Rugi', debit: 0, credit: totalRev });
      entries.push({
        type: 'Penutupan Akun Pendapatan',
        description: 'Menutup seluruh akun nominal pendapatan ke akun Ikhtisar Laba Rugi',
        lines: revLines
      });
    }

    // 2. Close Expense accounts (Debit Ikhtisar L/R, Credit Expenses)
    const expLines: { code: string; name: string; debit: number; credit: number }[] = [];
    const totalExp = is.totalOperasionalExpense + is.totalNonOperasionalExpense;
    if (totalExp > 0) {
      expLines.push({ code: '30002', name: 'Ikhtisar Laba Rugi', debit: totalExp, credit: 0 });
      is.operasionalExpense.forEach(e => {
        expLines.push({ code: e.code, name: e.name, debit: 0, credit: e.amount });
      });
      is.nonOperasionalExpense.forEach(e => {
        expLines.push({ code: e.code, name: e.name, debit: 0, credit: e.amount });
      });
      entries.push({
        type: 'Penutupan Akun Beban',
        description: 'Menutup seluruh akun nominal beban operasional dan non-operasional ke Ikhtisar Laba Rugi',
        lines: expLines
      });
    }

    // 3. Close Ikhtisar L/R to Modal
    const netIncome = is.labaBersih;
    if (netIncome !== 0) {
      entries.push({
        type: 'Penutupan Ikhtisar Laba Rugi ke Modal',
        description: 'Memindahkan saldo laba bersih berjalan ke akun Modal/Ekuitas',
        lines: [
          { code: '30002', name: 'Ikhtisar Laba Rugi', debit: netIncome > 0 ? netIncome : 0, credit: netIncome < 0 ? Math.abs(netIncome) : 0 },
          { code: '30000', name: 'Modal/Ekuitas', debit: netIncome < 0 ? Math.abs(netIncome) : 0, credit: netIncome > 0 ? netIncome : 0 }
        ]
      });
    }

    return entries;
  }, [is]);

  const handleExport = () => {
    const data: any[][] = [
      [`JURNAL PENUTUP (CLOSING JOURNAL) - ${settings.companyName}`],
      [`Periode: ${settings.fiscalPeriod} (${settings.fiscalYear})`],
      [''],
      ['KETERANGAN / TAHAP', 'KODE AKUN', 'NAMA AKUN', 'DEBIT (RP)', 'KREDIT (RP)']
    ];

    closingEntries.forEach(entry => {
      data.push([entry.type, '', '', '', '']);
      entry.lines.forEach(l => {
        data.push(['', l.code, l.name, l.debit || '', l.credit || '']);
      });
      data.push(['', '', '', '', '']);
    });

    exportTableToExcel(data, `Jurnal_Penutup_${new Date().toISOString().split('T')[0]}`, 'Jurnal Penutup');
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Lock size={22} color="var(--primary)" />
            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Jurnal Penutup (Closing Entries)</h3>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Pembuatan ayat jurnal penutup otomatis untuk me-nol-kan saldo akun nominal (Laba Rugi) dan memindahkan saldo laba bersih ke Modal.
          </p>
        </div>

        <button onClick={handleExport} className="btn btn-outline" style={{ fontSize: '0.825rem' }}>
          <Download size={15} />
          Export Excel
        </button>
      </div>

      {/* Entries List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {closingEntries.map((entry, idx) => (
          <div key={idx} className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{
              padding: '16px 20px',
              backgroundColor: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border-medium)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {idx + 1}. {entry.type}
                </span>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {entry.description}
                </div>
              </div>
              <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                Otomatis
              </span>
            </div>

            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '15%' }}>Kode Akun</th>
                    <th style={{ width: '45%' }}>Nama Akun Perkiraan</th>
                    <th style={{ width: '20%', textAlign: 'right' }}>Debit (Rp)</th>
                    <th style={{ width: '20%', textAlign: 'right' }}>Kredit (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.lines.map((l, lIdx) => (
                    <tr key={lIdx}>
                      <td className="mono" style={{ fontSize: '0.825rem' }}>{l.code}</td>
                      <td style={{ paddingLeft: l.credit > 0 ? '36px' : '16px', fontWeight: l.credit > 0 ? 400 : 600 }}>
                        {l.name}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: l.debit > 0 ? 700 : 400, color: l.debit > 0 ? '#38bdf8' : 'inherit' }}>
                        {l.debit > 0 ? formatRupiah(l.debit) : '-'}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: l.credit > 0 ? 700 : 400, color: l.credit > 0 ? '#fbbf24' : 'inherit' }}>
                        {l.credit > 0 ? formatRupiah(l.credit) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
