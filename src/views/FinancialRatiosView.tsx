import React from 'react';
import { Scale, CheckCircle, AlertTriangle, AlertCircle, Download } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { calculateFinancialRatios, exportTableToExcel } from '../utils/accountingCalculations';

export const FinancialRatiosView: React.FC = () => {
  const { accounts, transactions, settings } = useAccounting();

  const ratios = calculateFinancialRatios(accounts, transactions);

  const handleExport = () => {
    const data: any[][] = [
      [`ANALISIS RASIO KEUANGAN - ${settings.companyName}`],
      [`Periode: ${settings.fiscalPeriod} (${settings.fiscalYear})`],
      [''],
      ['NAMA RASIO', 'KATEGORI', 'NILAI', 'SATUAN', 'STANDAR / BENCHMARK', 'STATUS', 'FORMULA', 'PENJELASAN']
    ];

    ratios.forEach(r => {
      data.push([
        r.name,
        r.category,
        r.value,
        r.unit,
        r.benchmark,
        r.status,
        r.formula,
        r.description
      ]);
    });

    exportTableToExcel(data, `Analisis_Rasio_${new Date().toISOString().split('T')[0]}`, 'Rasio Keuangan');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Good':
        return <span className="badge badge-success"><CheckCircle size={12} /> Sehat / Optimal</span>;
      case 'Warning':
        return <span className="badge badge-warning"><AlertTriangle size={12} /> Waspada / Cukup</span>;
      case 'Danger':
        return <span className="badge badge-danger"><AlertCircle size={12} /> Perlu Perbaikan</span>;
      default:
        return <span className="badge badge-neutral">Netral</span>;
    }
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
            <Scale size={24} color="var(--primary)" />
            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Analisis Rasio Keuangan Perusahaan</h3>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Indikator kesehatan finansial komprehensif mengukur likuiditas, solvabilitas utang, dan profitabilitas ekuitas.
          </p>
        </div>

        <button onClick={handleExport} className="btn btn-outline" style={{ fontSize: '0.825rem' }}>
          <Download size={15} />
          Export Excel
        </button>
      </div>

      {/* Ratio Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {ratios.map((r, idx) => (
          <div key={idx} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                {r.category}
              </span>
              {getStatusBadge(r.status)}
            </div>

            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                {r.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span className="mono" style={{ fontSize: '2rem', fontWeight: 800, color: '#fff' }}>
                  {r.value}
                </span>
                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {r.unit}
                </span>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              fontSize: '0.78rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Benchmark:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.benchmark}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Formula:</span>
                <span className="mono" style={{ fontSize: '0.72rem', color: '#38bdf8' }}>{r.formula}</span>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {r.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
