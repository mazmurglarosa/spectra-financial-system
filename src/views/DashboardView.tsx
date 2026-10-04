import React from 'react';
import { 
  Wallet, 
  TrendingUp, 
  Building, 
  Layers, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  FileText, 
  PlusCircle, 
  ChevronRight 
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { 
  formatRupiah, 
  generateBalanceSheet, 
  generateIncomeStatement, 
  calculateAccountBalance 
} from '../utils/accountingCalculations';
import { ActiveTab } from '../components/layout/Sidebar';

interface DashboardViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  openNewTransactionModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab, openNewTransactionModal }) => {
  const { accounts, transactions, settings } = useAccounting();

  const balanceSheet = generateBalanceSheet(accounts, transactions);
  const incomeStatement = generateIncomeStatement(accounts, transactions);

  // Quick Account balances
  const kasAcc = accounts.find(a => a.code === '10001') || accounts[1];
  const piutangAcc = accounts.find(a => a.code === '10003');
  const utangAcc = accounts.find(a => a.code === '20001');

  const kasBalance = kasAcc ? calculateAccountBalance(kasAcc, transactions).endingBalance : 0;
  const piutangBalance = piutangAcc ? calculateAccountBalance(piutangAcc, transactions).endingBalance : 0;
  const utangBalance = utangAcc ? calculateAccountBalance(utangAcc, transactions).endingBalance : 0;

  const recentTransactions = transactions.slice(0, 6);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', padding: '32px' }}>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div>
          <span className="badge badge-info" style={{ marginBottom: '8px' }}>
            SPECTRA Enterprise Core • Accurate Standard
          </span>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '6px' }}>
            Selamat Datang di {settings.companyName}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '650px' }}>
            Sistem akuntansi otomatis real-time aktif. Seluruh mutasi jurnal langsung terintegrasi otomatis ke Buku Besar, Neraca Saldo, Laba Rugi, dan Posisi Keuangan.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={openNewTransactionModal}
            className="btn btn-primary"
            style={{ padding: '12px 20px', fontSize: '0.9rem' }}
          >
            <PlusCircle size={18} />
            Catat Transaksi Jurnal
          </button>
        </div>
      </div>

      {/* Accounting Equation Health Check */}
      <div style={{
        padding: '16px 22px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: balanceSheet.isBalanced ? 'var(--success-bg)' : 'var(--danger-bg)',
        border: `1px solid ${balanceSheet.isBalanced ? 'var(--success-border)' : 'var(--danger-border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {balanceSheet.isBalanced ? (
            <ShieldCheck size={26} color="#10b981" />
          ) : (
            <AlertTriangle size={26} color="#f43f5e" />
          )}
          <div>
            <div style={{
              fontWeight: 700,
              fontSize: '0.95rem',
              color: balanceSheet.isBalanced ? '#34d399' : '#fb7185'
            }}>
              {balanceSheet.isBalanced 
                ? 'PERSAMAAN AKUNTANSI BALANCE (SEIMBANG)' 
                : 'PERHATIAN: PERSAMAAN AKUNTANSI TIDAK SEIMBANG'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Formula: ASET ({formatRupiah(balanceSheet.totalAset)}) = LIABILITAS ({formatRupiah(balanceSheet.totalKewajiban)}) + EKUITAS ({formatRupiah(balanceSheet.totalEkuitas)})
            </div>
          </div>
        </div>
        <span className={`badge ${balanceSheet.isBalanced ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
          {balanceSheet.isBalanced ? 'Status: 100% Valid' : `Selisih: ${formatRupiah(balanceSheet.discrepancy)}`}
        </span>
      </div>

      {/* 4 Primary Financial KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        {/* Total Aset */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              TOTAL ASET (AKTIVA)
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6'
            }}>
              <Building size={18} />
            </div>
          </div>
          <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {formatRupiah(balanceSheet.totalAset)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Lancar: {formatRupiah(balanceSheet.totalAsetLancar)}</span>
            <span>Tetap: {formatRupiah(balanceSheet.totalAsetTetap)}</span>
          </div>
        </div>

        {/* Total Liabilitas */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              TOTAL LIABILITAS (UTANG)
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(244, 63, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fb7185'
            }}>
              <Layers size={18} />
            </div>
          </div>
          <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fb7185' }}>
            {formatRupiah(balanceSheet.totalKewajiban)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Lancar: {formatRupiah(balanceSheet.totalUtangLancar)}</span>
            <span>Jk. Panjang: {formatRupiah(balanceSheet.totalUtangJangkaPanjang)}</span>
          </div>
        </div>

        {/* Total Ekuitas */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              TOTAL EKUITAS (MODAL)
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(168, 85, 247, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc'
            }}>
              <Wallet size={18} />
            </div>
          </div>
          <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#c084fc' }}>
            {formatRupiah(balanceSheet.totalEkuitas)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Modal Pemilik & Laba Ditahan
          </div>
        </div>

        {/* Laba Bersih */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              LABA BERSIH PERIODE INI
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: incomeStatement.labaBersih >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: incomeStatement.labaBersih >= 0 ? '#10b981' : '#f43f5e'
            }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mono" style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: incomeStatement.labaBersih >= 0 ? '#34d399' : '#fb7185'
          }}>
            {formatRupiah(incomeStatement.labaBersih)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Pendapatan: {formatRupiah(incomeStatement.totalOperasionalRevenue)}</span>
            <span>Beban: {formatRupiah(incomeStatement.totalOperasionalExpense)}</span>
          </div>
        </div>
      </div>

      {/* Quick Accounts Position */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 22px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981'
          }}>
            <Wallet size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Saldo Kas & Bank (10001)
            </div>
            <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {formatRupiah(kasBalance)}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 22px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(59, 130, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3b82f6'
          }}>
            <ArrowUpRight size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Piutang Usaha (10003)
            </div>
            <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {formatRupiah(piutangBalance)}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 22px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fbbf24'
          }}>
            <ArrowDownRight size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Utang Usaha/Dagang (20001)
            </div>
            <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {formatRupiah(utangBalance)}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions & Shortcuts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Recent Transactions Table */}
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Aktivitas Jurnal Transaksi Terakhir</h3>
            </div>
            <button 
              onClick={() => setActiveTab('journal')}
              className="btn-ghost"
              style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
            >
              Lihat Semua Jurnal <ChevronRight size={14} />
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>No. Bukti</th>
                  <th>Keterangan</th>
                  <th style={{ textAlign: 'right' }}>Total Nominal</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      Belum ada transaksi jurnal. Klik tombol "Catat Transaksi Jurnal" untuk memulai.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map(trx => (
                    <tr key={trx.id}>
                      <td style={{ fontSize: '0.825rem', whiteSpace: 'nowrap' }}>
                        {trx.date}
                      </td>
                      <td>
                        <span className="badge badge-info mono" style={{ fontSize: '0.72rem' }}>
                          {trx.refNumber}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.825rem' }}>
                        <div style={{ fontWeight: 600 }}>{trx.description}</div>
                        {trx.partner && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Pihak: {trx.partner}
                          </div>
                        )}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                        {formatRupiah(trx.totalDebit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shortcuts & Quick Modules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '14px' }}>Modul Laporan Cepat</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={() => setActiveTab('income-statement')}
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'space-between', padding: '10px 14px' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={16} color="#10b981" /> Laporan Laba Rugi
                </span>
                <ChevronRight size={14} />
              </button>

              <button 
                onClick={() => setActiveTab('balance-sheet')}
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'space-between', padding: '10px 14px' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building size={16} color="#3b82f6" /> Posisi Keuangan (Neraca)
                </span>
                <ChevronRight size={14} />
              </button>

              <button 
                onClick={() => setActiveTab('worksheet')}
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'space-between', padding: '10px 14px' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} color="#c084fc" /> Neraca Lajur 10-Kolom
                </span>
                <ChevronRight size={14} />
              </button>

              <button 
                onClick={() => setActiveTab('cash-flow')}
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'space-between', padding: '10px 14px' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wallet size={16} color="#f59e0b" /> Laporan Arus Kas
                </span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.6)' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              DATA BASE CONVEX & CLOUD SYNC
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '12px' }}>
              Data disimpan secara persistent dengan sinkronisasi instan real-time lintas tab & siap terhubung ke backend Convex Cloud.
            </p>
            <button 
              onClick={() => setActiveTab('settings')}
              className="btn btn-outline" 
              style={{ width: '100%', fontSize: '0.78rem', padding: '8px' }}
            >
              Lihat Konfigurasi Sinkronisasi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
