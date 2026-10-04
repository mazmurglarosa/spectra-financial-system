import React, { useState, useMemo } from 'react';
import { Users, Download, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { formatRupiah, exportTableToExcel } from '../utils/accountingCalculations';

export const SubsidiaryLedgerView: React.FC = () => {
  const { transactions } = useAccounting();

  const [activeType, setActiveType] = useState<'PIUTANG' | 'UTANG'>('PIUTANG');
  const [searchPartner, setSearchPartner] = useState('');

  // Extract all distinct partners from transactions
  const partnerSummaries = useMemo(() => {
    const map = new Map<string, { partner: string; totalInflow: number; totalOutflow: number; balance: number; history: any[] }>();

    transactions.forEach(trx => {
      const partnerName = trx.partner?.trim() || 'Umum / Lain-lain';
      if (!map.has(partnerName)) {
        map.set(partnerName, { partner: partnerName, totalInflow: 0, totalOutflow: 0, balance: 0, history: [] });
      }

      const rec = map.get(partnerName)!;

      // For Piutang (Account 10003 or 10004): Debit increases receivables, Credit decreases
      // For Utang (Account 20001 or 20000): Credit increases payables, Debit decreases
      let relevantDebit = 0;
      let relevantCredit = 0;

      trx.lines.forEach(line => {
        if (activeType === 'PIUTANG' && (line.accountCode === '10003' || line.accountCode.startsWith('1000'))) {
          relevantDebit += line.debit;
          relevantCredit += line.credit;
        } else if (activeType === 'UTANG' && (line.accountCode === '20001' || line.accountCode.startsWith('2000'))) {
          relevantDebit += line.debit;
          relevantCredit += line.credit;
        }
      });

      if (relevantDebit > 0 || relevantCredit > 0 || trx.partner) {
        rec.totalInflow += relevantDebit;
        rec.totalOutflow += relevantCredit;
        rec.history.push({
          date: trx.date,
          refNumber: trx.refNumber,
          description: trx.description,
          debit: relevantDebit,
          credit: relevantCredit
        });
      }
    });

    const list = Array.from(map.values()).map(p => {
      const balance = activeType === 'PIUTANG' ? (p.totalInflow - p.totalOutflow) : (p.totalOutflow - p.totalInflow);
      return { ...p, balance };
    });

    return list.filter(p => p.partner.toLowerCase().includes(searchPartner.toLowerCase()));
  }, [transactions, activeType, searchPartner]);

  const handleExport = () => {
    const data: any[][] = [
      [`BUKU PEMBANTU ${activeType === 'PIUTANG' ? 'PIUTANG USAHA (AR)' : 'UTANG USAHA (AP)'}`],
      [''],
      ['NAMA MITRA / PIHAK', 'TOTAL MUTASI DEBET (RP)', 'TOTAL MUTASI KREDIT (RP)', 'SALDO AKHIR (RP)']
    ];

    partnerSummaries.forEach(p => {
      data.push([p.partner, p.totalInflow, p.totalOutflow, p.balance]);
    });

    exportTableToExcel(data, `Buku_Pembantu_${activeType}_${new Date().toISOString().split('T')[0]}`, `Buku Pembantu ${activeType}`);
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Filter and Switcher */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveType('PIUTANG')}
            className={`btn ${activeType === 'PIUTANG' ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '0.85rem' }}
          >
            <ArrowUpRight size={16} />
            Buku Pembantu Piutang (Klien)
          </button>
          <button
            onClick={() => setActiveType('UTANG')}
            className={`btn ${activeType === 'UTANG' ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '0.85rem' }}
          >
            <ArrowDownRight size={16} />
            Buku Pembantu Hutang (Pemasok)
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Cari nama pihak / klien..." 
              value={searchPartner} 
              onChange={e => setSearchPartner(e.target.value)}
              style={{ paddingLeft: '38px', fontSize: '0.825rem' }}
            />
          </div>
          <button onClick={handleExport} className="btn btn-outline" style={{ fontSize: '0.825rem' }}>
            <Download size={15} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Summary Cards of Partners */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {partnerSummaries.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            Belum ada catatan mutasi pihak terkait untuk kategori ini.
          </div>
        ) : (
          partnerSummaries.map((p, idx) => (
            <div key={idx} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {p.partner}
                </span>
                <span className={`badge ${p.balance > 0 ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: '0.72rem' }}>
                  {p.history.length} Transaksi
                </span>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                  Saldo {activeType === 'PIUTANG' ? 'Tagihan Piutang' : 'Kewajiban Hutang'}
                </div>
                <div className="mono" style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: p.balance > 0 ? '#fbbf24' : 'var(--text-secondary)'
                }}>
                  {formatRupiah(p.balance)}
                </div>
              </div>

              {/* Recent Entries */}
              <div style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Mutasi Terkini:
                </div>
                {p.history.slice(0, 3).map((h, hIdx) => (
                  <div key={hIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{h.date} • {h.refNumber}</span>
                    <span className="mono" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                      {h.debit > 0 ? formatRupiah(h.debit) : formatRupiah(h.credit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
