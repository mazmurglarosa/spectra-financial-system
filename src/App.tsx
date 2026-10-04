import React, { useState } from 'react';
import { AccountingProvider, useAccounting } from './context/AccountingContext';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './views/DashboardView';
import { AccountsView } from './views/AccountsView';
import { GeneralJournalView } from './views/GeneralJournalView';
import { GeneralLedgerView } from './views/GeneralLedgerView';
import { TrialBalanceView } from './views/TrialBalanceView';
import { WorksheetView } from './views/WorksheetView';
import { IncomeStatementView } from './views/IncomeStatementView';
import { BalanceSheetView } from './views/BalanceSheetView';
import { CapitalStatementView } from './views/CapitalStatementView';
import { CashFlowView } from './views/CashFlowView';
import { SubsidiaryLedgerView } from './views/SubsidiaryLedgerView';
import { FinancialRatiosView } from './views/FinancialRatiosView';
import { ClosingJournalView } from './views/ClosingJournalView';
import { SettingsView } from './views/SettingsView';
import { TransactionModal } from './components/modals/TransactionModal';
import { Transaction } from './types/accounting';

const MainContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const handleOpenNewTransaction = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleEditTransaction = (trx: Transaction) => {
    setEditingTransaction(trx);
    setIsModalOpen(true);
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView 
            setActiveTab={setActiveTab} 
            openNewTransactionModal={handleOpenNewTransaction} 
          />
        );
      case 'accounts':
        return <AccountsView />;
      case 'journal':
        return (
          <GeneralJournalView 
            openNewTransactionModal={handleOpenNewTransaction} 
            onEditTransaction={handleEditTransaction} 
          />
        );
      case 'ledger':
        return <GeneralLedgerView />;
      case 'subsidiary-ledger':
        return <SubsidiaryLedgerView />;
      case 'trial-balance':
        return <TrialBalanceView />;
      case 'worksheet':
        return <WorksheetView />;
      case 'income-statement':
        return <IncomeStatementView />;
      case 'balance-sheet':
        return <BalanceSheetView />;
      case 'capital-statement':
        return <CapitalStatementView />;
      case 'cash-flow':
        return <CashFlowView />;
      case 'financial-ratios':
        return <FinancialRatiosView />;
      case 'closing-journal':
        return <ClosingJournalView />;
      case 'settings':
        return <SettingsView />;
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
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        openNewTransactionModal={handleOpenNewTransaction} 
      />

      {/* Main Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        <Header 
          activeTab={activeTab} 
          openNewTransactionModal={handleOpenNewTransaction} 
        />

        <main style={{ flex: 1, backgroundColor: 'var(--bg-main)' }}>
          {renderActiveView()}
        </main>
      </div>

      {/* Global Transaction Modal */}
      <TransactionModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transactionToEdit={editingTransaction}
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
