import React from 'react';
import { Download, DollarSign, Printer, ArrowUpRight, ArrowDownRight, FileSpreadsheet } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { formatRupiah, generateCashFlowStatement, exportTableToExcel } from '../utils/accountingCalculations';
import { generatePsakReportData, exportFullPsakWorkbook } from '../utils/psakReportGenerator';

export const CashFlowView: React.FC = () => {
  const { accounts, transactions, settings } = useAccounting();

  const cf = generateCashFlowStatement(accounts, transactions);

  const handleExport = () => {
    const data: any[][] = [
      [settings.companyName.toUpperCase()],
      ['LAPORAN ARUS KAS - METODE LANGSUNG (CASH FLOW STATEMENT)'],
      [`Periode: ${settings.fiscalPeriod} (${settings.fiscalYear})`],
      [''],
      ['KETERANGAN ARUS KAS', 'PENERIMAAN (+)', 'PENGELUARAN (-)', 'ARUS KAS BERSIH (RP)']
    ];

    data.push(['I. ARUS KAS DARI KEGIATAN OPERASI', '', '', '']);
    data.push(['Kas yang diterima dari pelanggan', cf.cashFromCustomers, '', '']);
    data.push(['Kas untuk pembelian perlengkapan & stok', '', cf.cashForSupplies, '']);
    data.push(['Kas untuk membayar biaya operasi & beban', '', cf.cashForOperations, '']);
    if (cf.cashForInterest > 0) data.push(['Kas untuk membayar beban bunga', '', cf.cashForInterest, '']);
    if (cf.cashForTax > 0) data.push(['Kas untuk membayar pajak', '', cf.cashForTax, '']);
    data.push(['Aliran Kas Bersih dari Kegiatan Operasi', '', '', cf.netOperatingCash]);

    data.push(['', '', '', '']);
    data.push(['II. ARUS KAS DARI KEGIATAN INVESTASI', '', '', '']);
    data.push(['Kas masuk dari penjualan investasi / aset', cf.cashFromInvestingSales, '', '']);
    data.push(['Kas keluar untuk pembelian aset tetap', '', cf.cashForAssetsPurchase, '']);
    data.push(['Aliran Kas Bersih untuk Kegiatan Investasi', '', '', cf.netInvestingCash]);

    data.push(['', '', '', '']);
    data.push(['III. ARUS KAS DARI KEGIATAN PEMBIAYAAN', '', '', '']);
    data.push(['Penerimaan setoran modal pemilik', cf.cashFromOwnerEquity, '', '']);
    data.push(['Kas untuk pelunasan utang / pinjaman', '', cf.cashForLoanRepayment, '']);
    data.push(['Kas untuk penarikan prive pemilik', '', cf.cashForPrive, '']);
    data.push(['Aliran Kas Bersih dari Kegiatan Pembiayaan', '', '', cf.netFinancingCash]);

    data.push(['', '', '', '']);
    data.push(['KENAIKAN / (PENURUNAN) BERSIH KAS', '', '', cf.netCashChange]);
    data.push(['SALDO KAS PADA AWAL PERIODE', '', '', cf.startingKas]);
    data.push(['SALDO KAS PADA AKHIR PERIODE', '', '', cf.endingKas]);

    exportTableToExcel(data, `Arus_Kas_${settings.companyName}_${new Date().toISOString().split('T')[0]}`, 'Arus Kas');
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '960px', margin: '0 auto', width: '100%' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }} className="no-print">
        <button onClick={() => window.print()} className="btn btn-outline" style={{ fontSize: '0.825rem' }}>
          <Printer size={15} /> Cetak
        </button>
        <button onClick={handleExport} className="btn btn-outline" style={{ fontSize: '0.825rem' }}>
          <Download size={15} /> Export Excel
        </button>
        <button 
          onClick={() => exportFullPsakWorkbook(generatePsakReportData(accounts, transactions, settings))} 
          className="btn btn-primary" 
          style={{ fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Unduh Seluruh Laporan Keuangan Format Standar Publik / PSAK Resmi (Contoh Laporan Keuangan)"
        >
          <FileSpreadsheet size={15} /> Unduh Format PSAK (.xlsx)
        </button>
      </div>

      {/* Formal Document Card */}
      <div className="card" style={{ padding: '40px' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border-medium)', paddingBottom: '20px', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '1.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-main)' }}>
            {settings.companyName}
          </h2>
          <h1 style={{ fontSize: '1.65rem', margin: '6px 0', color: 'var(--primary)' }}>
            LAPORAN ARUS KAS
          </h1>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Metode Langsung • Untuk Periode {settings.fiscalPeriod} ({settings.fiscalYear})
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 1. Aktivitas Operasi */}
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', marginBottom: '8px', textTransform: 'uppercase' }}>
              I. Arus Kas yang Berasal dari Kegiatan Operasi
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>Kas yang diterima dari pelanggan & piutang</span>
                <span className="mono" style={{ color: '#34d399' }}>{formatRupiah(cf.cashFromCustomers)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>Kas keluar untuk perlengkapan & stok</span>
                <span className="mono" style={{ color: '#fb7185' }}>({formatRupiah(cf.cashForSupplies)})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>Kas keluar untuk membayar biaya operasi</span>
                <span className="mono" style={{ color: '#fb7185' }}>({formatRupiah(cf.cashForOperations)})</span>
              </div>
              {cf.cashForInterest > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Kas keluar untuk biaya bunga</span>
                  <span className="mono" style={{ color: '#fb7185' }}>({formatRupiah(cf.cashForInterest)})</span>
                </div>
              )}
              {cf.cashForTax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Kas keluar untuk membayar pajak</span>
                  <span className="mono" style={{ color: '#fb7185' }}>({formatRupiah(cf.cashForTax)})</span>
                </div>
              )}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: '0.9rem',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '6px',
                marginTop: '4px'
              }}>
                <span>Arus Kas Bersih dari Kegiatan Operasi</span>
                <span className="mono" style={{ color: cf.netOperatingCash >= 0 ? '#34d399' : '#fb7185' }}>
                  {formatRupiah(cf.netOperatingCash)}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Aktivitas Investasi */}
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fbbf24', marginBottom: '8px', textTransform: 'uppercase' }}>
              II. Arus Kas yang Berasal dari Kegiatan Investasi
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>Kas masuk dari pelepasan / penjualan aset</span>
                <span className="mono">{formatRupiah(cf.cashFromInvestingSales)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>Kas keluar untuk pembelian aset tetap (peralatan, mesin, dll)</span>
                <span className="mono" style={{ color: '#fb7185' }}>({formatRupiah(cf.cashForAssetsPurchase)})</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: '0.9rem',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '6px',
                marginTop: '4px'
              }}>
                <span>Arus Kas Bersih dari Kegiatan Investasi</span>
                <span className="mono" style={{ color: cf.netInvestingCash >= 0 ? '#34d399' : '#fb7185' }}>
                  {formatRupiah(cf.netInvestingCash)}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Aktivitas Pendanaan */}
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#c084fc', marginBottom: '8px', textTransform: 'uppercase' }}>
              III. Arus Kas dari Kegiatan Pendanaan (Pembiayaan)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>Penerimaan setoran modal pemilik</span>
                <span className="mono" style={{ color: '#34d399' }}>{formatRupiah(cf.cashFromOwnerEquity)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>Kas untuk pelunasan utang jangka panjang</span>
                <span className="mono" style={{ color: '#fb7185' }}>({formatRupiah(cf.cashForLoanRepayment)})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>Kas untuk penarikan prive pemilik</span>
                <span className="mono" style={{ color: '#fb7185' }}>({formatRupiah(cf.cashForPrive)})</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: '0.9rem',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '6px',
                marginTop: '4px'
              }}>
                <span>Arus Kas Bersih dari Kegiatan Pendanaan</span>
                <span className="mono" style={{ color: cf.netFinancingCash >= 0 ? '#34d399' : '#fb7185' }}>
                  {formatRupiah(cf.netFinancingCash)}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Rekonsiliasi Saldo Kas */}
          <div style={{
            borderTop: '2px dashed var(--border-medium)',
            paddingTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 600 }}>
              <span>Kenaikan / (Penurunan) Bersih Kas Periode Ini</span>
              <span className="mono" style={{ color: cf.netCashChange >= 0 ? '#34d399' : '#fb7185' }}>
                {formatRupiah(cf.netCashChange)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 600 }}>
              <span>Saldo Kas pada Awal Periode</span>
              <span className="mono">{formatRupiah(cf.startingKas)}</span>
            </div>
            
            {/* Ending Kas Highlight Box */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              border: '2px solid rgba(59, 130, 246, 0.4)',
              borderRadius: 'var(--radius-md)',
              marginTop: '6px'
            }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                  SALDO KAS PADA AKHIR PERIODE
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Terekonsiliasi penuh dengan akun Kas & Bank
                </div>
              </div>
              <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>
                {formatRupiah(cf.endingKas)}
              </div>
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
            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{settings.accountantName || 'Mazmur Gusti Agung L'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{settings.accountantTitle || settings.preparerTitle || 'Direktur Keuangan'}</div>
          </div>
          <div style={{ textAlign: 'center', width: '200px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Disetujui Oleh:</div>
            <div style={{ height: '50px' }} />
            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{settings.directorName || 'Sudono Salim'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{settings.directorTitle || settings.approverTitle || 'Direktur Utama'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
