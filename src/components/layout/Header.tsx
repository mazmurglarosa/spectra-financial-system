import React from 'react';
import { Download, Printer, PlusCircle, Building2, Calendar, ShieldCheck } from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { ActiveTab } from './Sidebar';

interface HeaderProps {
  activeTab: ActiveTab;
  openNewTransactionModal: () => void;
  onExportExcel?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, openNewTransactionModal, onExportExcel }) => {
  const { settings, syncStatus } = useAccounting();

  const getPageInfo = (tab: ActiveTab) => {
    switch (tab) {
      case 'dashboard':
        return { title: 'Dashboard Keuangan', desc: 'Ringkasan posisi keuangan, likuiditas, laba rugi, dan aktivitas terkini.' };
      case 'accounts':
        return { title: 'Bagan Akun (Chart of Accounts)', desc: 'Daftar kode akun, klasifikasi posisi neraca/laba rugi, dan saldo awal.' };
      case 'journal':
        return { title: 'Jurnal Umum (General Journal)', desc: 'Pencatatan bukti transaksi debit dan kredit berpasangan dengan validasi seimbang.' };
      case 'ledger':
        return { title: 'Buku Besar (General Ledger)', desc: 'Rincian mutasi debit/kredit dan saldo berjalan per akun akuntansi.' };
      case 'subsidiary-ledger':
        return { title: 'Buku Pembantu Piutang & Hutang', desc: 'Pengawasan saldo piutang pelanggan dan kewajiban hutang pemasok.' };
      case 'trial-balance':
        return { title: 'Neraca Saldo (Trial Balance)', desc: 'Kompilasi saldo akhir seluruh akun dan pembuktian keseimbangan debit-kredit.' };
      case 'worksheet':
        return { title: 'Neraca Lajur (10-Column Worksheet)', desc: 'Kertas kerja komprehensif dari neraca saldo, penyesuaian, hingga laba rugi dan neraca.' };
      case 'income-statement':
        return { title: 'Laporan Laba Rugi (Profit & Loss)', desc: 'Perhitungan pendapatan operasional, beban usaha, dan laba bersih periode berjalan.' };
      case 'balance-sheet':
        return { title: 'Laporan Posisi Keuangan (Neraca)', desc: 'Penyajian aset, liabilitas, dan ekuitas perusahaan dengan persamaan akuntansi seimbang.' };
      case 'capital-statement':
        return { title: 'Laporan Perubahan Modal', desc: 'Pergerakan ekuitas pemilik dari modal awal, penambahan laba, dan penarikan prive.' };
      case 'cash-flow':
        return { title: 'Laporan Arus Kas (Cash Flow)', desc: 'Aliran kas bersih dari aktivitas operasi, investasi, dan pendanaan.' };
      case 'financial-ratios':
        return { title: 'Analisis Rasio Keuangan', desc: 'Evaluasi kesehatan finansial berdasarkan rasio likuiditas, solvabilitas, dan profitabilitas.' };
      case 'closing-journal':
        return { title: 'Jurnal Penutup & Neraca Akhir', desc: 'Penutupan akun nominal pendapatan dan beban ke ekuitas modal.' };
      case 'settings':
        return { title: 'Pengaturan Perusahaan & Sinkronisasi', desc: 'Konfigurasi profil entitas, cloud database Convex, dan cadangan data.' };
      default:
        return { title: 'SPECTRA Financial System', desc: 'Sistem Pencatatan dan Pelaporan Keuangan Otomatis' };
    }
  };

  const { title, desc } = getPageInfo(activeTab);

  const handlePrint = () => {
    window.print();
  };

  return (
    <header style={{
      padding: '20px 32px',
      borderBottom: '1px solid var(--border-subtle)',
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }} className="no-print">
      {/* Title & Description */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '1.35rem', margin: 0 }}>{title}</h2>
          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
            <ShieldCheck size={13} />
            Auto-Sync Aktif
          </span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
          {desc}
        </p>
      </div>

      {/* Meta info & Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Company & Period Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '6px 14px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.78rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', fontWeight: 600 }}>
            <Building2 size={14} color="var(--primary)" />
            {settings.companyName}
          </div>
          <div style={{ height: '14px', width: '1px', background: 'var(--border-medium)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <Calendar size={14} />
            {settings.fiscalPeriod}
          </div>
        </div>

        {/* Print Button */}
        <button 
          onClick={handlePrint}
          className="btn btn-outline"
          style={{ padding: '8px 14px', fontSize: '0.8rem' }}
          title="Cetak Laporan / Simpan PDF"
        >
          <Printer size={15} />
          Cetak
        </button>

        {/* Export Excel Button */}
        {onExportExcel && (
          <button 
            onClick={onExportExcel}
            className="btn btn-success"
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
            title="Unduh format Microsoft Excel (.xlsx)"
          >
            <Download size={15} />
            Export Excel
          </button>
        )}

        {/* Quick Add Journal Button */}
        <button 
          onClick={openNewTransactionModal}
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.8rem' }}
        >
          <PlusCircle size={15} />
          Input Jurnal
        </button>
      </div>
    </header>
  );
};
