import React from 'react';
import { Download, TrendingUp, Printer } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { formatRupiah, generateIncomeStatement, exportTableToExcel } from '../utils/accountingCalculations';

export const IncomeStatementView: React.FC = () => {
  const { accounts, transactions, settings } = useAccounting();

  const is = generateIncomeStatement(accounts, transactions);

  const handleExport = () => {
    const data: any[][] = [
      [settings.companyName.toUpperCase()],
      ['LAPORAN LABA RUGI (PROFIT AND LOSS STATEMENT)'],
      [`Periode: ${settings.fiscalPeriod} (${settings.fiscalYear})`],
      [''],
      ['KODE', 'KETERANGAN AKUN', 'NOMINAL (RP)', 'SUBTOTAL (RP)']
    ];

    data.push(['', 'PENDAPATAN OPERASIONAL', '', '']);
    is.operasionalRevenue.forEach(r => {
      data.push([r.code, r.name, r.amount, '']);
    });
    data.push(['', 'TOTAL PENDAPATAN OPERASIONAL', '', is.totalOperasionalRevenue]);

    data.push(['', '', '', '']);
    data.push(['', 'BEBAN OPERASIONAL / USAHA', '', '']);
    is.operasionalExpense.forEach(e => {
      data.push([e.code, e.name, e.amount, '']);
    });
    data.push(['', 'TOTAL BEBAN OPERASIONAL', '', is.totalOperasionalExpense]);

    data.push(['', '', '', '']);
    data.push(['', 'LABA (RUGI) OPERASIONAL', '', is.labaOperasi]);

    if (is.nonOperasionalRevenue.length > 0 || is.nonOperasionalExpense.length > 0) {
      data.push(['', '', '', '']);
      data.push(['', 'PENDAPATAN & BEBAN NON-OPERASIONAL', '', '']);
      is.nonOperasionalRevenue.forEach(r => data.push([r.code, r.name, r.amount, '']));
      is.nonOperasionalExpense.forEach(e => data.push([e.code, e.name, e.amount, '']));
      data.push(['', 'TOTAL LUAR USAHA BERSIH', '', is.totalLuarUsaha]);
    }

    data.push(['', '', '', '']);
    data.push(['', 'LABA (RUGI) BERSIH PERIODE BERJALAN', '', is.labaBersih]);

    exportTableToExcel(data, `Laba_Rugi_${settings.companyName}_${new Date().toISOString().split('T')[0]}`, 'Laba Rugi');
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }} className="no-print">
        <button onClick={() => window.print()} className="btn btn-outline" style={{ fontSize: '0.825rem' }}>
          <Printer size={15} /> Cetak
        </button>
        <button onClick={handleExport} className="btn btn-success" style={{ fontSize: '0.825rem' }}>
          <Download size={15} /> Export Excel
        </button>
      </div>

      {/* Formal Financial Statement Document Card */}
      <div className="card" style={{ padding: '40px' }}>
        {/* Document Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border-medium)', paddingBottom: '20px', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '1.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-main)' }}>
            {settings.companyName}
          </h2>
          <h1 style={{ fontSize: '1.65rem', margin: '6px 0', color: 'var(--primary)' }}>
            LAPORAN LABA RUGI
          </h1>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Untuk Periode yang Berakhir pada {settings.fiscalPeriod} ({settings.fiscalYear})
          </div>
        </div>

        {/* Statement Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 1. Pendapatan Operasional */}
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pendapatan Operasional
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '12px' }}>
              {is.operasionalRevenue.length === 0 ? (
                <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>- Tidak ada catatan pendapatan operasional -</div>
              ) : (
                is.operasionalRevenue.map(item => (
                  <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span>{item.name} ({item.code})</span>
                    <span className="mono">{formatRupiah(item.amount)}</span>
                  </div>
                ))
              )}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: '0.9rem',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '8px',
                marginTop: '4px',
                color: 'var(--text-main)'
              }}>
                <span>Total Pendapatan Operasional</span>
                <span className="mono" style={{ color: '#34d399' }}>{formatRupiah(is.totalOperasionalRevenue)}</span>
              </div>
            </div>
          </div>

          {/* 2. Beban Operasional */}
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fb7185', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Beban Operasional / Usaha
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '12px' }}>
              {is.operasionalExpense.length === 0 ? (
                <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>- Tidak ada catatan beban operasional -</div>
              ) : (
                is.operasionalExpense.map(item => (
                  <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span>{item.name} ({item.code})</span>
                    <span className="mono">{formatRupiah(item.amount)}</span>
                  </div>
                ))
              )}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: '0.9rem',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '8px',
                marginTop: '4px',
                color: 'var(--text-main)'
              }}>
                <span>Total Beban Operasional</span>
                <span className="mono" style={{ color: '#fb7185' }}>{formatRupiah(is.totalOperasionalExpense)}</span>
              </div>
            </div>
          </div>

          {/* 3. Laba Operasional Subtotal */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: '0.95rem'
          }}>
            <span>LABA (RUGI) OPERASIONAL</span>
            <span className="mono" style={{ color: is.labaOperasi >= 0 ? '#34d399' : '#fb7185' }}>
              {formatRupiah(is.labaOperasi)}
            </span>
          </div>

          {/* 4. Non-Operasional */}
          {(is.nonOperasionalRevenue.length > 0 || is.nonOperasionalExpense.length > 0) && (
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase' }}>
                Pendapatan & Beban Non-Operasional
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '12px' }}>
                {is.nonOperasionalRevenue.map(item => (
                  <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span>{item.name}</span>
                    <span className="mono" style={{ color: '#34d399' }}>{formatRupiah(item.amount)}</span>
                  </div>
                ))}
                {is.nonOperasionalExpense.map(item => (
                  <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span>{item.name}</span>
                    <span className="mono" style={{ color: '#fb7185' }}>({formatRupiah(item.amount)})</span>
                  </div>
                ))}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '8px',
                  marginTop: '4px'
                }}>
                  <span>Total Luar Usaha Bersih</span>
                  <span className="mono">{formatRupiah(is.totalLuarUsaha)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 5. Final Net Income */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 24px',
            backgroundColor: is.labaBersih >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            border: `2px solid ${is.labaBersih >= 0 ? '#10b981' : '#f43f5e'}`,
            borderRadius: 'var(--radius-lg)',
            marginTop: '8px'
          }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                {is.labaBersih >= 0 ? 'LABA BERSIH PERIODE BERJALAN' : 'RUGI BERSIH PERIODE BERJALAN'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Ditransfer otomatis ke Neraca (Ekuitas) & Laporan Perubahan Modal
              </div>
            </div>
            <div className="mono" style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: is.labaBersih >= 0 ? '#34d399' : '#fb7185'
            }}>
              {formatRupiah(is.labaBersih)}
            </div>
          </div>
        </div>

        {/* Signature Footer for Print */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '60px',
          paddingTop: '20px',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          <div style={{ textAlign: 'center', width: '200px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Disiapkan Oleh:</div>
            <div style={{ height: '50px' }} />
            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{settings.accountantName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Direktur Keuangan</div>
          </div>
          <div style={{ textAlign: 'center', width: '200px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Disetujui Oleh:</div>
            <div style={{ height: '50px' }} />
            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{settings.directorName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Direktur Utama</div>
          </div>
        </div>
      </div>
    </div>
  );
};
