import React from 'react';
import { Download, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { formatRupiah, generateWorksheet, exportTableToExcel } from '../utils/accountingCalculations';

export const WorksheetView: React.FC = () => {
  const { accounts, transactions, settings } = useAccounting();

  const worksheet = generateWorksheet(accounts, transactions);
  const { rows, totals, netIncome } = worksheet;

  const handleExport = () => {
    const data: any[][] = [
      [`NERACA LAJUR 10-KOLOM (WORKSHEET) - ${settings.companyName}`],
      [`Periode: ${settings.fiscalPeriod} (${settings.fiscalYear})`],
      [''],
      [
        'KODE', 
        'NAMA AKUN', 
        'NS DEBIT', 'NS KREDIT', 
        'PENYESUAIAN DEBIT', 'PENYESUAIAN KREDIT', 
        'NSD DEBIT', 'NSD KREDIT', 
        'LABA RUGI DEBIT', 'LABA RUGI KREDIT', 
        'NERACA DEBIT', 'NERACA KREDIT'
      ]
    ];

    rows.forEach(r => {
      data.push([
        r.code,
        r.name,
        r.nsDebit || '',
        r.nsCredit || '',
        r.adjDebit || '',
        r.adjCredit || '',
        r.nsdDebit || '',
        r.nsdCredit || '',
        r.lrDebit || '',
        r.lrCredit || '',
        r.nrcDebit || '',
        r.nrcCredit || ''
      ]);
    });

    data.push([
      '', 'JUMLAH TOTAL',
      totals.nsDebit, totals.nsCredit,
      totals.adjDebit, totals.adjCredit,
      totals.nsdDebit, totals.nsdCredit,
      totals.lrDebit, totals.lrCredit,
      totals.nrcDebit, totals.nrcCredit
    ]);

    data.push([
      '', 'LABA BERSIH PERIODE BERJALAN',
      '', '', '', '', '', '',
      netIncome >= 0 ? netIncome : '', netIncome < 0 ? Math.abs(netIncome) : '',
      netIncome < 0 ? Math.abs(netIncome) : '', netIncome >= 0 ? netIncome : ''
    ]);

    exportTableToExcel(data, `Neraca_Lajur_SPECTRA_${new Date().toISOString().split('T')[0]}`, 'Neraca Lajur');
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
            <FileSpreadsheet size={22} color="var(--primary)" />
            <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Neraca Lajur (10-Column Worksheet)</h3>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Kertas kerja akuntansi formal yang merangkum Neraca Saldo, Jurnal Penyesuaian, Saldo Disesuaikan, Laba Rugi, dan Neraca Akhir.
          </p>
        </div>

        <button onClick={handleExport} className="btn btn-outline" style={{ fontSize: '0.825rem' }}>
          <Download size={15} />
          Export Excel (.xlsx)
        </button>
      </div>

      {/* 10-Column Worksheet Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0, maxHeight: '72vh' }}>
          <table>
            <thead>
              {/* Main Super Header */}
              <tr>
                <th rowSpan={2} style={{ width: '8%', verticalAlign: 'middle' }}>Kode</th>
                <th rowSpan={2} style={{ width: '22%', verticalAlign: 'middle' }}>Nama Akun</th>
                <th colSpan={2} style={{ textAlign: 'center', borderLeft: '1px solid var(--border-medium)' }}>
                  Neraca Saldo
                </th>
                <th colSpan={2} style={{ textAlign: 'center', borderLeft: '1px solid var(--border-medium)' }}>
                  Penyesuaian
                </th>
                <th colSpan={2} style={{ textAlign: 'center', borderLeft: '1px solid var(--border-medium)' }}>
                  NS Disesuaikan
                </th>
                <th colSpan={2} style={{ textAlign: 'center', borderLeft: '1px solid var(--border-medium)' }}>
                  Laba / Rugi
                </th>
                <th colSpan={2} style={{ textAlign: 'center', borderLeft: '1px solid var(--border-medium)' }}>
                  Neraca
                </th>
              </tr>
              {/* Sub Header */}
              <tr>
                <th style={{ textAlign: 'right', fontSize: '0.7rem', borderLeft: '1px solid var(--border-medium)' }}>Debet</th>
                <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>Kredit</th>
                <th style={{ textAlign: 'right', fontSize: '0.7rem', borderLeft: '1px solid var(--border-medium)' }}>Debet</th>
                <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>Kredit</th>
                <th style={{ textAlign: 'right', fontSize: '0.7rem', borderLeft: '1px solid var(--border-medium)' }}>Debet</th>
                <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>Kredit</th>
                <th style={{ textAlign: 'right', fontSize: '0.7rem', borderLeft: '1px solid var(--border-medium)' }}>Debet</th>
                <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>Kredit</th>
                <th style={{ textAlign: 'right', fontSize: '0.7rem', borderLeft: '1px solid var(--border-medium)' }}>Debet</th>
                <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>Kredit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.code}>
                  <td className="mono" style={{ fontWeight: 700, fontSize: '0.8rem' }}>{r.code}</td>
                  <td style={{ fontSize: '0.825rem' }}>{r.name}</td>
                  {/* NS */}
                  <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)' }}>
                    {r.nsDebit > 0 ? formatRupiah(r.nsDebit, false) : '-'}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {r.nsCredit > 0 ? formatRupiah(r.nsCredit, false) : '-'}
                  </td>
                  {/* Penyesuaian */}
                  <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)' }}>
                    {r.adjDebit > 0 ? formatRupiah(r.adjDebit, false) : '-'}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {r.adjCredit > 0 ? formatRupiah(r.adjCredit, false) : '-'}
                  </td>
                  {/* NSD */}
                  <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)' }}>
                    {r.nsdDebit > 0 ? formatRupiah(r.nsdDebit, false) : '-'}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {r.nsdCredit > 0 ? formatRupiah(r.nsdCredit, false) : '-'}
                  </td>
                  {/* Laba Rugi */}
                  <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)', color: r.lrDebit > 0 ? '#fb7185' : 'inherit' }}>
                    {r.lrDebit > 0 ? formatRupiah(r.lrDebit, false) : '-'}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', color: r.lrCredit > 0 ? '#34d399' : 'inherit' }}>
                    {r.lrCredit > 0 ? formatRupiah(r.lrCredit, false) : '-'}
                  </td>
                  {/* Neraca */}
                  <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)' }}>
                    {r.nrcDebit > 0 ? formatRupiah(r.nrcDebit, false) : '-'}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {r.nrcCredit > 0 ? formatRupiah(r.nrcCredit, false) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals & Net Income Rows */}
            <tfoot>
              {/* Row 1: Subtotals */}
              <tr style={{ backgroundColor: 'var(--bg-surface)', fontWeight: 700 }}>
                <td colSpan={2} style={{ textAlign: 'right', padding: '12px' }}>
                  JUMLAH TOTAL:
                </td>
                <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-medium)' }}>
                  {formatRupiah(totals.nsDebit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {formatRupiah(totals.nsCredit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-medium)' }}>
                  {formatRupiah(totals.adjDebit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {formatRupiah(totals.adjCredit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-medium)' }}>
                  {formatRupiah(totals.nsdDebit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {formatRupiah(totals.nsdCredit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-medium)' }}>
                  {formatRupiah(totals.lrDebit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {formatRupiah(totals.lrCredit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-medium)' }}>
                  {formatRupiah(totals.nrcDebit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {formatRupiah(totals.nrcCredit, false)}
                </td>
              </tr>

              {/* Row 2: Net Income (Laba Bersih) Balancing */}
              <tr style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', fontWeight: 700 }}>
                <td colSpan={2} style={{ textAlign: 'right', padding: '12px', color: '#34d399' }}>
                  LABA BERSIH PERIODE BERJALAN:
                </td>
                <td style={{ borderLeft: '1px solid var(--border-medium)' }}>-</td>
                <td>-</td>
                <td style={{ borderLeft: '1px solid var(--border-medium)' }}>-</td>
                <td>-</td>
                <td style={{ borderLeft: '1px solid var(--border-medium)' }}>-</td>
                <td>-</td>
                {/* Laba Rugi Balancing */}
                <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-medium)', color: '#34d399' }}>
                  {netIncome >= 0 ? formatRupiah(netIncome, false) : '-'}
                </td>
                <td className="mono" style={{ textAlign: 'right', color: '#fb7185' }}>
                  {netIncome < 0 ? formatRupiah(Math.abs(netIncome), false) : '-'}
                </td>
                {/* Neraca Balancing */}
                <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-medium)', color: '#fb7185' }}>
                  {netIncome < 0 ? formatRupiah(Math.abs(netIncome), false) : '-'}
                </td>
                <td className="mono" style={{ textAlign: 'right', color: '#34d399' }}>
                  {netIncome >= 0 ? formatRupiah(netIncome, false) : '-'}
                </td>
              </tr>

              {/* Row 3: Balanced Final Totals */}
              <tr style={{ backgroundColor: 'var(--bg-main)', fontWeight: 800, fontSize: '0.9rem' }}>
                <td colSpan={2} style={{ textAlign: 'right', padding: '14px', color: '#fff' }}>
                  TOTAL KESEIMBANGAN AKHIR:
                </td>
                <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-medium)' }}>
                  {formatRupiah(totals.nsDebit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {formatRupiah(totals.nsCredit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-medium)' }}>
                  {formatRupiah(totals.adjDebit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {formatRupiah(totals.adjCredit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-medium)' }}>
                  {formatRupiah(totals.nsdDebit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {formatRupiah(totals.nsdCredit, false)}
                </td>
                <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-medium)', color: '#34d399' }}>
                  {formatRupiah(Math.max(totals.lrDebit, totals.lrCredit), false)}
                </td>
                <td className="mono" style={{ textAlign: 'right', color: '#34d399' }}>
                  {formatRupiah(Math.max(totals.lrDebit, totals.lrCredit), false)}
                </td>
                <td className="mono" style={{ textAlign: 'right', borderLeft: '1px solid var(--border-medium)', color: '#34d399' }}>
                  {formatRupiah(Math.max(totals.nrcDebit, totals.nrcCredit), false)}
                </td>
                <td className="mono" style={{ textAlign: 'right', color: '#34d399' }}>
                  {formatRupiah(Math.max(totals.nrcDebit, totals.nrcCredit), false)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
