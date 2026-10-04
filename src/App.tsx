import React, { useState } from 'react';
import { AccountingProvider, useAccounting } from './context/AccountingContext';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { AuthGate } from './components/layout/AuthGate';

// Views
import { DashboardView } from './views/DashboardView';
import { CashBankView } from './views/CashBankView';
import { SalesView } from './views/SalesView';
import { PurchasesView } from './views/PurchasesView';
import { AccountsView } from './views/AccountsView';
import { GeneralJournalView } from './views/GeneralJournalView';
import { GeneralLedgerView } from './views/GeneralLedgerView';
import { TrialBalanceView } from './views/TrialBalanceView';
import { WorksheetView } from './views/WorksheetView';
import { IncomeStatementView } from './views/IncomeStatementView';
import { BalanceSheetView } from './views/BalanceSheetView';
import { CapitalStatementView } from './views/CapitalStatementView';
import { CashFlowView } from './views/CashFlowView';
import { FinancialRatiosView } from './views/FinancialRatiosView';
import { SettingsView } from './views/SettingsView';
import { AdminPanelView } from './views/AdminPanelView';
import { AuthorityPanelView } from './views/AuthorityPanelView';
import { ActivityLogsView } from './views/ActivityLogsView';

// Modals
import { TransactionModal } from './components/modals/TransactionModal';
import { Transaction, TransactionType, User } from './types/accounting';

const MainContent: React.FC = () => {
  const { currentUser } = useAccounting();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPresetType, setModalPresetType] = useState<TransactionType>('general');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // If no user is logged in, show AuthGate
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const session = sessionStorage.getItem('spectra_auth_session_v1') || localStorage.getItem('spectra_auth_session_v1');
      if (session && session !== 'null' && session !== 'undefined') {
        const parsed = JSON.parse(session);
        return Boolean(parsed && parsed.username);
      }
    } catch (e) {
      console.warn('Session parse error:', e);
    }
    return false;
  });

  const handleOpenNewTransaction = (preset: TransactionType = 'general') => {
    setEditingTransaction(null);
    setModalPresetType(preset || 'general');
    setIsModalOpen(true);
  };

  const handleEditTransaction = (trx: Transaction) => {
    setEditingTransaction(trx);
    setModalPresetType(trx.type || 'general');
    setIsModalOpen(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <AuthGate 
        onAuthenticated={(_user: User) => setIsAuthenticated(true)}
      />
    );
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView 
            setActiveTab={setActiveTab} 
            openNewTransactionModal={handleOpenNewTransaction} 
          />
        );
      case 'cashbank':
        return (
          <CashBankView 
            openNewTransactionModal={handleOpenNewTransaction} 
          />
        );
      case 'sales':
        return (
          <SalesView 
            openNewTransactionModal={handleOpenNewTransaction} 
          />
        );
      case 'purchases':
        return (
          <PurchasesView 
            openNewTransactionModal={handleOpenNewTransaction} 
          />
        );
      case 'coa':
        return <AccountsView />;
      case 'journals':
        return (
          <GeneralJournalView 
            openNewTransactionModal={handleOpenNewTransaction} 
            onEditTransaction={handleEditTransaction} 
          />
        );
      case 'ledger':
        return <GeneralLedgerView />;
      case 'trial-balance':
        return <TrialBalanceView />;
      case 'worksheet':
        return <WorksheetView />;
      case 'profit-loss':
        return <IncomeStatementView />;
      case 'balance-sheet':
        return <BalanceSheetView />;
      case 'capital-changes':
        return <CapitalStatementView />;
      case 'cash-flow':
        return <CashFlowView />;
      case 'ratios':
        return <FinancialRatiosView />;
      case 'settings':
        return <SettingsView />;
      case 'admin-panel':
        return <AdminPanelView />;
      case 'authority-panel':
        return <AuthorityPanelView />;
      case 'activity-logs':
        return <ActivityLogsView />;
      default:
        return (
          <DashboardView 
            setActiveTab={setActiveTab} 
            openNewTransactionModal={handleOpenNewTransaction} 
          />
        );
    }
  };

  return (
    <div className="flex w-full min-h-screen bg-slate-100 text-slate-900">
      {/* Accurate Dark Navigation Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        openNewTransactionModal={handleOpenNewTransaction} 
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Accurate Top Bar Header */}
        <Header 
          openNewTransactionModal={handleOpenNewTransaction}
          onLogout={handleLogout}
        />

        {/* Dynamic View Container */}
        <main id="main-content" className="flex-1 overflow-y-auto bg-slate-100">
          {renderActiveView()}
        </main>
      </div>

      {/* Accurate Multi-row Transaction Voucher Modal */}
      <TransactionModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transactionToEdit={editingTransaction}
        presetType={modalPresetType}
      />
    </div>
  );
};

export default function App() {
  return (
    <AccountingProvider>
      <MainContent />
    </AccountingProvider>
  );
}
