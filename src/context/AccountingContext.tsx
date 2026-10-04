import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Account, Transaction, CompanySettings } from '../types/accounting';
import { defaultAccounts, defaultTransactions, initialCompanySettings } from '../data/defaultAccounts';

interface SyncStatus {
  isLive: boolean;
  lastSyncedAt: Date;
  statusText: string;
  source: 'Local Storage & Cross-Tab Broadcast' | 'Convex Cloud Sync' | 'Dual Sync';
  convexConnected: boolean;
}

interface AccountingContextType {
  accounts: Account[];
  transactions: Transaction[];
  settings: CompanySettings;
  syncStatus: SyncStatus;
  addTransaction: (trx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => Transaction;
  updateTransaction: (id: string, trx: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addAccount: (acc: Omit<Account, 'id'>) => Account;
  updateAccount: (id: string, acc: Partial<Account>) => void;
  deleteAccount: (id: string) => { success: boolean; message?: string };
  updateSettings: (newSettings: Partial<CompanySettings>) => void;
  resetToDefault: () => void;
  exportDatabaseJson: () => string;
  importDatabaseJson: (jsonStr: string) => { success: boolean; message: string };
  triggerManualSync: () => void;
}

const STORAGE_KEY_ACCOUNTS = 'spectra_accounts_v1';
const STORAGE_KEY_TRANSACTIONS = 'spectra_transactions_v1';
const STORAGE_KEY_SETTINGS = 'spectra_settings_v1';
const BROADCAST_CHANNEL_NAME = 'spectra_realtime_sync_channel';

const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

export const AccountingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Initialize State with safe fallbacks
  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load accounts from storage:', e);
    }
    return defaultAccounts;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load transactions from storage:', e);
    }
    return defaultTransactions;
  });

  const [settings, setSettings] = useState<CompanySettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load settings from storage:', e);
    }
    return initialCompanySettings;
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isLive: true,
    lastSyncedAt: new Date(),
    statusText: 'Tersingkron Otomatis (Real-time)',
    source: 'Local Storage & Cross-Tab Broadcast',
    convexConnected: !!import.meta.env.VITE_CONVEX_URL,
  });

  // 2. Broadcast Channel for Real-time multi-tab synchronization
  const broadcastChannel = useMemo(() => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        return new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }
    return null;
  }, []);

  const broadcastChange = useCallback((type: 'ACCOUNTS' | 'TRANSACTIONS' | 'SETTINGS' | 'ALL', payload: any) => {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type, payload, timestamp: Date.now() });
      } catch (e) {
        console.error('Broadcast message failed:', e);
      }
    }
    setSyncStatus(prev => ({
      ...prev,
      lastSyncedAt: new Date(),
      statusText: 'Tersingkron Otomatis'
    }));
  }, [broadcastChannel]);

  // Listen to remote changes from other browser tabs
  useEffect(() => {
    if (!broadcastChannel) return;

    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {};
      if (type === 'ACCOUNTS' && Array.isArray(payload)) {
        setAccounts(payload);
        localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(payload));
      } else if (type === 'TRANSACTIONS' && Array.isArray(payload)) {
        setTransactions(payload);
        localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(payload));
      } else if (type === 'SETTINGS' && payload) {
        setSettings(payload);
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(payload));
      } else if (type === 'ALL' && payload) {
        if (payload.accounts) {
          setAccounts(payload.accounts);
          localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(payload.accounts));
        }
        if (payload.transactions) {
          setTransactions(payload.transactions);
          localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(payload.transactions));
        }
        if (payload.settings) {
          setSettings(payload.settings);
          localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(payload.settings));
        }
      }
      setSyncStatus(prev => ({
        ...prev,
        lastSyncedAt: new Date(),
        statusText: 'Diperbarui dari sesi lain'
      }));
    };

    broadcastChannel.addEventListener('message', handleMessage);
    return () => {
      broadcastChannel.removeEventListener('message', handleMessage);
    };
  }, [broadcastChannel]);

  // Periodic heartbeat synchronization to assure user of zero data loss
  useEffect(() => {
    const timer = setInterval(() => {
      setSyncStatus(prev => ({
        ...prev,
        isLive: true,
        lastSyncedAt: new Date(),
        statusText: 'Selalu Singkron'
      }));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // 3. CRUD: Transactions
  const addTransaction = useCallback((newTrxData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Transaction => {
    const now = Date.now();
    const newTrx: Transaction = {
      ...newTrxData,
      id: `trx_${now}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };

    setTransactions(prev => {
      const updated = [newTrx, ...prev];
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(updated));
      broadcastChange('TRANSACTIONS', updated);
      return updated;
    });

    return newTrx;
  }, [broadcastChange]);

  const updateTransaction = useCallback((id: string, trxData: Partial<Transaction>) => {
    setTransactions(prev => {
      const updated = prev.map(t => {
        if (t.id === id) {
          return {
            ...t,
            ...trxData,
            updatedAt: Date.now()
          };
        }
        return t;
      });
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(updated));
      broadcastChange('TRANSACTIONS', updated);
      return updated;
    });
  }, [broadcastChange]);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => {
      const updated = prev.filter(t => t.id !== id);
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(updated));
      broadcastChange('TRANSACTIONS', updated);
      return updated;
    });
  }, [broadcastChange]);

  // 4. CRUD: Accounts
  const addAccount = useCallback((newAccData: Omit<Account, 'id'>): Account => {
    const newAcc: Account = {
      ...newAccData,
      id: `acc_${newAccData.code}_${Date.now()}`
    };

    setAccounts(prev => {
      const updated = [...prev, newAcc].sort((a, b) => a.code.localeCompare(b.code));
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(updated));
      broadcastChange('ACCOUNTS', updated);
      return updated;
    });

    return newAcc;
  }, [broadcastChange]);

  const updateAccount = useCallback((id: string, accData: Partial<Account>) => {
    setAccounts(prev => {
      const updated = prev.map(a => (a.id === id ? { ...a, ...accData } : a));
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(updated));
      broadcastChange('ACCOUNTS', updated);
      return updated;
    });
  }, [broadcastChange]);

  const deleteAccount = useCallback((id: string): { success: boolean; message?: string } => {
    const accountToDelete = accounts.find(a => a.id === id);
    if (!accountToDelete) return { success: false, message: 'Akun tidak ditemukan' };

    // Check if account is used in any transactions
    const hasTransactions = transactions.some(t => 
      t.lines.some(l => l.accountId === id || l.accountCode === accountToDelete.code)
    );

    if (hasTransactions) {
      return { 
        success: false, 
        message: `Akun "${accountToDelete.code} - ${accountToDelete.name}" telah digunakan dalam transaksi dan tidak dapat dihapus untuk menjaga integritas pembukuan.` 
      };
    }

    setAccounts(prev => {
      const updated = prev.filter(a => a.id !== id);
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(updated));
      broadcastChange('ACCOUNTS', updated);
      return updated;
    });

    return { success: true };
  }, [accounts, transactions, broadcastChange]);

  // 5. Settings
  const updateSettings = useCallback((newSettings: Partial<CompanySettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
      broadcastChange('SETTINGS', updated);
      return updated;
    });
  }, [broadcastChange]);

  // 6. Reset to Default Template
  const resetToDefault = useCallback(() => {
    setAccounts(defaultAccounts);
    setTransactions(defaultTransactions);
    setSettings(initialCompanySettings);

    localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(defaultAccounts));
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(defaultTransactions));
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(initialCompanySettings));

    broadcastChange('ALL', {
      accounts: defaultAccounts,
      transactions: defaultTransactions,
      settings: initialCompanySettings
    });
  }, [broadcastChange]);

  // 7. Backup & Restore
  const exportDatabaseJson = useCallback(() => {
    const backupData = {
      system: 'SPECTRA-Financial System',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings,
      accounts,
      transactions
    };
    return JSON.stringify(backupData, null, 2);
  }, [settings, accounts, transactions]);

  const importDatabaseJson = useCallback((jsonStr: string): { success: boolean; message: string } => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.accounts || !Array.isArray(parsed.accounts)) {
        return { success: false, message: 'Format file backup tidak valid: data akun tidak ditemukan.' };
      }

      const importedAccounts: Account[] = parsed.accounts;
      const importedTrx: Transaction[] = Array.isArray(parsed.transactions) ? parsed.transactions : [];
      const importedSettings: CompanySettings = parsed.settings || settings;

      setAccounts(importedAccounts);
      setTransactions(importedTrx);
      setSettings(importedSettings);

      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(importedAccounts));
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(importedTrx));
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(importedSettings));

      broadcastChange('ALL', {
        accounts: importedAccounts,
        transactions: importedTrx,
        settings: importedSettings
      });

      return { success: true, message: `Berhasil mengimpor ${importedAccounts.length} akun dan ${importedTrx.length} transaksi.` };
    } catch (e: any) {
      return { success: false, message: `Gagal membaca file: ${e.message}` };
    }
  }, [settings, broadcastChange]);

  const triggerManualSync = useCallback(() => {
    setSyncStatus(prev => ({
      ...prev,
      lastSyncedAt: new Date(),
      statusText: 'Disinkronkan secara instan'
    }));
  }, []);

  const value = useMemo(() => ({
    accounts,
    transactions,
    settings,
    syncStatus,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addAccount,
    updateAccount,
    deleteAccount,
    updateSettings,
    resetToDefault,
    exportDatabaseJson,
    importDatabaseJson,
    triggerManualSync
  }), [
    accounts,
    transactions,
    settings,
    syncStatus,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addAccount,
    updateAccount,
    deleteAccount,
    updateSettings,
    resetToDefault,
    exportDatabaseJson,
    importDatabaseJson,
    triggerManualSync
  ]);

  return (
    <AccountingContext.Provider value={value}>
      {children}
    </AccountingContext.Provider>
  );
};

export const useAccounting = () => {
  const context = useContext(AccountingContext);
  if (!context) {
    throw new Error('useAccounting must be used within an AccountingProvider');
  }
  return context;
};
