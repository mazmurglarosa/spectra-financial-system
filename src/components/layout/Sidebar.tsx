import React from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  FileSpreadsheet, 
  FileText, 
  Layers, 
  Scale, 
  TrendingUp, 
  PieChart, 
  DollarSign, 
  Settings, 
  RefreshCw,
  SlidersHorizontal,
  Lock,
  Users
} from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';

export type ActiveTab = 
  | 'dashboard'
  | 'accounts'
  | 'journal'
  | 'ledger'
  | 'trial-balance'
  | 'worksheet'
  | 'income-statement'
  | 'balance-sheet'
  | 'capital-statement'
  | 'cash-flow'
  | 'subsidiary-ledger'
  | 'financial-ratios'
  | 'closing-journal'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  openNewTransactionModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, openNewTransactionModal }) => {
  const { settings, syncStatus, triggerManualSync } = useAccounting();

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; group?: string }[] = [
    { id: 'dashboard', label: 'Dashboard & Ringkasan', icon: <LayoutDashboard size={18} />, group: 'UTAMA' },
    
    { id: 'accounts', label: 'Bagan Akun (COA)', icon: <BookOpen size={18} />, group: 'BUKU & JURNAL' },
    { id: 'journal', label: 'Jurnal Umum (Trans)', icon: <FileText size={18} /> },
    { id: 'ledger', label: 'Buku Besar (Ledger)', icon: <Layers size={18} /> },
    { id: 'subsidiary-ledger', label: 'Buku Pembantu (PK)', icon: <Users size={18} /> },

    { id: 'trial-balance', label: 'Neraca Saldo (TB)', icon: <Scale size={18} />, group: 'KERTAS KERJA' },
    { id: 'worksheet', label: 'Neraca Lajur (10-Kolom)', icon: <FileSpreadsheet size={18} /> },

    { id: 'income-statement', label: 'Laba Rugi (P&L)', icon: <TrendingUp size={18} />, group: 'LAPORAN KEUANGAN' },
    { id: 'balance-sheet', label: 'Posisi Keuangan (Neraca)', icon: <PieChart size={18} /> },
    { id: 'capital-statement', label: 'Perubahan Modal', icon: <SlidersHorizontal size={18} /> },
    { id: 'cash-flow', label: 'Arus Kas (Cash Flow)', icon: <DollarSign size={18} /> },
    { id: 'financial-ratios', label: 'Analisis Rasio Keuangan', icon: <Scale size={18} /> },

    { id: 'closing-journal', label: 'Jurnal Penutup', icon: <Lock size={18} />, group: 'SISTEM & AKHIR' },
    { id: 'settings', label: 'Pengaturan & Cloud Sync', icon: <Settings size={18} /> },
  ];

  return (
    <aside style={{
      width: '280px',
      minWidth: '280px',
      backgroundColor: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: 'var(--shadow-card)'
    }} className="no-print">
      {/* Brand Header */}
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.15rem',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
          }}>
            S
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              SPECTRA
            </h1>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Financial System
            </span>
          </div>
        </div>

        {/* Company Badge */}
        <div style={{
          marginTop: '10px',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {settings.companyName}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {settings.fiscalPeriod} ({settings.fiscalYear})
            </div>
          </div>
          <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
            Accurate v2
          </span>
        </div>
      </div>

      {/* Quick Action Button */}
      <div style={{ padding: '14px 16px 8px 16px' }}>
        <button 
          onClick={openNewTransactionModal}
          className="btn btn-primary"
          style={{ width: '100%', padding: '10px', fontSize: '0.825rem' }}
        >
          <FileText size={16} />
          + Catat Jurnal Baru
        </button>
      </div>

      {/* Navigation Links */}
      <nav style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 12px'
      }}>
        {navItems.map((item, idx) => {
          const isActive = activeTab === item.id;
          return (
            <React.Fragment key={item.id}>
              {item.group && (
                <div style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.08em',
                  padding: idx === 0 ? '6px 12px 4px' : '16px 12px 4px',
                  textTransform: 'uppercase'
                }}>
                  {item.group}
                </div>
              )}
              <button
                onClick={() => setActiveTab(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                  boxShadow: isActive ? '0 4px 14px rgba(59, 130, 246, 0.35)' : 'none',
                  textAlign: 'left',
                  marginBottom: '2px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ color: isActive ? '#fff' : 'var(--primary)' }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Real-time Sync Status Footer */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 10px #10b981',
              display: 'inline-block'
            }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399' }}>
              {syncStatus.statusText}
            </span>
          </div>
          <button 
            onClick={triggerManualSync}
            title="Sinkronkan Sekarang"
            style={{
              background: 'none',
              color: 'var(--text-muted)',
              padding: '4px',
              borderRadius: '4px'
            }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          Terakhir: {syncStatus.lastSyncedAt.toLocaleTimeString('id-ID')} • Zero Data Loss
        </div>
      </div>
    </aside>
  );
};
