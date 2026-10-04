import React from 'react';
import { Download, Building, Printer, CheckCircle, AlertCircle } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { formatRupiah, generateBalanceSheet, exportTableToExcel } from '../utils/accountingCalculations';

export const BalanceSheetView: React.FC = () => {
  const { accounts, transactions, settings } = useAccounting();

  const bs = generateBalanceSheet(accounts, transactions);

  const handleExport = () => {
    const data: any[][] = [
      [settings.companyName.toUpperCase()],
      ['LAPORAN POSISI KEUANGAN (NERACA / BALANCE SHEET)'],
      [`Per ${settings.fiscalPeriod} (${settings.fiscalYear})`],
      [''],
      ['KODE', 'ASET (AKTIVA)', 'NOMINAL (RP)', 'KODE', 'KEWAJIBAN & EKUITAS (PASIVA)', 'NOMINAL (RP)']
    ];

    data.push(['', 'ASET LANCAR', '', '', 'KEWAJIBAN LANCAR', '']);
    const maxRows = Math.max(
      bs.asetLancar.length + bs.asetTetap.length + 3,
      bs.utangLancar.length + bs.utangJangkaPanjang.length + bs.ekuitas.length + 3
    );

    // Let's create a clean tabular structure for Excel export
    const leftRows: [string, string, number | string][] = [];
    leftRows.push(['', '--- ASET LANCAR ---', '']);
    bs.asetLancar.forEach(a => leftRows.push([a.code, a.name, a.amount]));
    leftRows.push(['', 'TOTAL ASET LANCAR', bs.totalAsetLancar]);
    leftRows.push(['', '', '']);
    leftRows.push(['', '--- ASET TETAP ---', '']);
    bs.asetTetap.forEach(a => leftRows.push([a.code, a.name, a.amount]));
    leftRows.push(['', 'TOTAL ASET TETAP', bs.totalAsetTetap]);
    leftRows.push(['', 'TOTAL ASET (AKTIVA)', bs.totalAset]);

    const rightRows: [string, string, number | string][] = [];
    rightRows.push(['', '--- KEWAJIBAN LANCAR ---', '']);
    bs.utangLancar.forEach(u => rightRows.push([u.code, u.name, u.amount]));
    rightRows.push(['', 'TOTAL KEWAJIBAN LANCAR', bs.totalUtangLancar]);
    rightRows.push(['', '', '']);
    rightRows.push(['', '--- KEWAJIBAN JANGKA PANJANG ---', '']);
    bs.utangJangkaPanjang.forEach(u => rightRows.push([u.code, u.name, u.amount]));
    rightRows.push(['', 'TOTAL KEWAJIBAN JK. PANJANG', bs.totalUtangJangkaPanjang]);
    rightRows.push(['', 'TOTAL KEWAJIBAN', bs.totalKewajiban]);
    rightRows.push(['', '', '']);
    rightRows.push(['', '--- EKUITAS / MODAL ---', '']);
    bs.ekuitas.forEach(e => rightRows.push([e.code, e.name, e.amount]));
    rightRows.push(['', 'TOTAL EKUITAS', bs.totalEkuitas]);
    rightRows.push(['', 'TOTAL KEWAJIBAN & EKUITAS', bs.totalKewajibanDanEkuitas]);

    const maxLen = Math.max(leftRows.length, rightRows.length);
    for (let i = 0; i < maxLen; i++) {
      const l = leftRows[i] || ['', '', ''];
      const r = rightRows[i] || ['', '', ''];
      data.push([l[0], l[1], l[2], r[0], r[1], r[2]]);
    }

    exportTableToExcel(data, `Posisi_Keuangan_${settings.companyName}_${new Date().toISOString().split('T')[0]}`, 'Neraca');
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }} className="no-print">
        {/* Status Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: bs.isBalanced ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: `1px solid ${bs.isBalanced ? 'var(--success-border)' : 'var(--danger-border)'}`
        }}>
          {bs.isBalanced ? <CheckCircle size={16} color="#10b981" /> : <AlertCircle size={16} color="#f43f5e" />}
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: bs.isBalanced ? '#34d399' : '#fb7185' }}>
            {bs.isBalanced ? 'NERACA SEIMBANG (Aset = Kewajiban + Ekuitas)' : `SELISIH: ${formatRupiah(bs.discrepancy)}`}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => window.print()} className="btn btn-outline" style={{ fontSize: '0.825rem' }}>
            <Printer size={15} /> Cetak
          </button>
          <button onClick={handleExport} className="btn btn-success" style={{ fontSize: '0.825rem' }}>
            <Download size={15} /> Export Excel
          </button>
        </div>
      </div>

      {/* Formal Document Card */}
      <div className="card" style={{ padding: '40px' }}>
        {/* Document Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border-medium)', paddingBottom: '20px', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '1.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-main)' }}>
            {settings.companyName}
          </h2>
          <h1 style={{ fontSize: '1.65rem', margin: '6px 0', color: 'var(--primary)' }}>
            LAPORAN POSISI KEUANGAN (NERACA)
          </h1>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Per Tanggal {settings.fiscalPeriod} ({settings.fiscalYear})
          </div>
        </div>

        {/* Two-Column Grid for Aset and Kewajiban & Ekuitas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '36px' }}>
          {/* LEFT: ASET */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: 'var(--primary)',
              borderBottom: '2px solid var(--primary)',
              paddingBottom: '6px',
              textTransform: 'uppercase'
            }}>
              Aset (Aktiva)
            </div>

            {/* Aset Lancar */}
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                ASET LANCAR
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '8px' }}>
                {bs.asetLancar.map(item => (
                  <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>{item.name} ({item.code})</span>
                    <span className="mono">{formatRupiah(item.amount)}</span>
                  </div>
                ))}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '6px',
                  marginTop: '4px'
                }}>
                  <span>Total Aset Lancar</span>
                  <span className="mono" style={{ color: '#38bdf8' }}>{formatRupiah(bs.totalAsetLancar)}</span>
                </div>
              </div>
            </div>

            {/* Aset Tetap */}
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                ASET TETAP
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '8px' }}>
                {bs.asetTetap.map(item => (
                  <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>{item.name} ({item.code})</span>
                    <span className="mono">{formatRupiah(item.amount)}</span>
                  </div>
                ))}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '6px',
                  marginTop: '4px'
                }}>
                  <span>Total Aset Tetap</span>
                  <span className="mono" style={{ color: '#38bdf8' }}>{formatRupiah(bs.totalAsetTetap)}</span>
                </div>
              </div>
            </div>

            {/* Total Aset Box */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)',
              marginTop: 'auto'
            }}>
              <span style={{ fontSize: '1rem', fontWeight: 800 }}>TOTAL ASET</span>
              <span className="mono" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399' }}>
                {formatRupiah(bs.totalAset)}
              </span>
            </div>
          </div>

          {/* RIGHT: LIABILITAS & EKUITAS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: '#fb7185',
              borderBottom: '2px solid #fb7185',
              paddingBottom: '6px',
              textTransform: 'uppercase'
            }}>
              Kewajiban & Ekuitas (Pasiva)
            </div>

            {/* Kewajiban Lancar */}
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                KEWAJIBAN LANCAR (JANGKA PENDEK)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '8px' }}>
                {bs.utangLancar.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>- Nihil -</div>
                ) : (
                  bs.utangLancar.map(item => (
                    <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>{item.name} ({item.code})</span>
                      <span className="mono">{formatRupiah(item.amount)}</span>
                    </div>
                  ))
                )}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '6px',
                  marginTop: '4px'
                }}>
                  <span>Total Kewajiban Lancar</span>
                  <span className="mono" style={{ color: '#fb7185' }}>{formatRupiah(bs.totalUtangLancar)}</span>
                </div>
              </div>
            </div>

            {/* Kewajiban Jangka Panjang */}
            {bs.utangJangkaPanjang.length > 0 && (
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  KEWAJIBAN JANGKA PANJANG
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '8px' }}>
                  {bs.utangJangkaPanjang.map(item => (
                    <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>{item.name} ({item.code})</span>
                      <span className="mono">{formatRupiah(item.amount)}</span>
                    </div>
                  ))}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '6px',
                    marginTop: '4px'
                  }}>
                    <span>Total Kewajiban Jk. Panjang</span>
                    <span className="mono" style={{ color: '#fb7185' }}>{formatRupiah(bs.totalUtangJangkaPanjang)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Ekuitas / Modal */}
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                EKUITAS / MODAL
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '8px' }}>
                {bs.ekuitas.map(item => (
                  <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>{item.name}</span>
                    <span className="mono">{formatRupiah(item.amount)}</span>
                  </div>
                ))}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '6px',
                  marginTop: '4px'
                }}>
                  <span>Total Ekuitas</span>
                  <span className="mono" style={{ color: '#c084fc' }}>{formatRupiah(bs.totalEkuitas)}</span>
                </div>
              </div>
            </div>

            {/* Total Kewajiban & Ekuitas Box */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)',
              marginTop: 'auto'
            }}>
              <span style={{ fontSize: '1rem', fontWeight: 800 }}>TOTAL PASIVA</span>
              <span className="mono" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399' }}>
                {formatRupiah(bs.totalKewajibanDanEkuitas)}
              </span>
            </div>
          </div>
        </div>

        {/* Signature Footer */}
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
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bagian Keuangan</div>
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
