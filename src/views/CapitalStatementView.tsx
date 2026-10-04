import React from 'react';
import { Download, SlidersHorizontal, Printer } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { 
  formatRupiah, 
  generateIncomeStatement, 
  calculateAccountBalance, 
  exportTableToExcel 
} from '../utils/accountingCalculations';

export const CapitalStatementView: React.FC = () => {
  const { accounts, transactions, settings } = useAccounting();

  const is = generateIncomeStatement(accounts, transactions);
  const netIncome = is.labaBersih;

  // Account 30000 (Modal)
  const modalAcc = accounts.find(a => a.code === '30000');
  const modalAwal = modalAcc ? (modalAcc.kreditAwal - modalAcc.debetAwal) : 0;

  // Account 30001 (Prive)
  const priveAcc = accounts.find(a => a.code === '30001');
  const priveEnding = priveAcc ? calculateAccountBalance(priveAcc, transactions).endingBalance : 0;

  const perubahanBersih = netIncome - priveEnding;
  const modalAkhir = modalAwal + perubahanBersih;

  const handleExport = () => {
    const data: any[][] = [
      [settings.companyName.toUpperCase()],
      ['LAPORAN PERUBAHAN EKUITAS / MODAL (STATEMENT OF CHANGES IN EQUITY)'],
      [`Periode: ${settings.fiscalPeriod} (${settings.fiscalYear})`],
      [''],
      ['KETERANGAN', 'NOMINAL (RP)', 'JUMLAH (RP)'],
      ['Modal Awal Pemilik', '', modalAwal],
      ['Ditambah: Laba Bersih Periode Berjalan', netIncome, ''],
      ['Dikurangi: Penarikan Modal / Prive', priveEnding, ''],
      ['Kenaikan / (Penurunan) Bersih Modal', '', perubahanBersih],
      ['Modal Akhir Per Periode', '', modalAkhir]
    ];

    exportTableToExcel(data, `Perubahan_Modal_${settings.companyName}_${new Date().toISOString().split('T')[0]}`, 'Perubahan Modal');
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }} className="no-print">
        <button onClick={() => window.print()} className="btn btn-outline" style={{ fontSize: '0.825rem' }}>
          <Printer size={15} /> Cetak
        </button>
        <button onClick={handleExport} className="btn btn-success" style={{ fontSize: '0.825rem' }}>
          <Download size={15} /> Export Excel
        </button>
      </div>

      {/* Formal Document Card */}
      <div className="card" style={{ padding: '40px' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border-medium)', paddingBottom: '20px', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '1.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-main)' }}>
            {settings.companyName}
          </h2>
          <h1 style={{ fontSize: '1.65rem', margin: '6px 0', color: 'var(--primary)' }}>
            LAPORAN PERUBAHAN MODAL
          </h1>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Untuk Periode yang Berakhir pada {settings.fiscalPeriod} ({settings.fiscalYear})
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Modal Awal */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 600 }}>
            <span>Modal Awal Pemilik</span>
            <span className="mono" style={{ fontSize: '1.1rem' }}>{formatRupiah(modalAwal)}</span>
          </div>

          <div style={{
            borderLeft: '3px solid var(--primary)',
            paddingLeft: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            padding: '14px 16px',
            borderRadius: 'var(--radius-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span>Ditambah: Laba Bersih Periode Berjalan</span>
              <span className="mono" style={{ color: '#34d399' }}>{formatRupiah(netIncome)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span>Dikurangi: Penarikan Prive Pemilik</span>
              <span className="mono" style={{ color: '#fb7185' }}>({formatRupiah(priveEnding)})</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.9rem',
              fontWeight: 700,
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '8px'
            }}>
              <span>Kenaikan / (Penurunan) Bersih Modal</span>
              <span className="mono" style={{ color: perubahanBersih >= 0 ? '#34d399' : '#fb7185' }}>
                {formatRupiah(perubahanBersih)}
              </span>
            </div>
          </div>

          {/* Modal Akhir Box */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 24px',
            backgroundColor: 'rgba(168, 85, 247, 0.12)',
            border: '2px solid rgba(168, 85, 247, 0.4)',
            borderRadius: 'var(--radius-lg)',
            marginTop: '12px'
          }}>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                MODAL AKHIR PER {settings.fiscalPeriod.toUpperCase()}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Nilai ekuitas akhir yang tercantum pada Neraca
              </div>
            </div>
            <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#c084fc' }}>
              {formatRupiah(modalAkhir)}
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
