import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Account, 
  Transaction, 
  CompanySettings, 
  User, 
  ActivityLog, 
  Complaint, 
  Contact, 
  TransactionType,
  AccountCategory,
  ReportType,
  NormalBalance
} from '../types/accounting';
import { defaultAccounts, defaultTransactions, initialCompanySettings } from '../data/defaultAccounts';
import { 
  SupabaseConfig, 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  testSupabaseConnection, 
  syncPushAllToSupabase, 
  syncPullAllFromSupabase,
  pushTransactionToSupabase,
  deleteTransactionFromSupabase,
  pushSettingsToSupabase,
  pushAccountToSupabase,
  pushMultipleAccountsToSupabase,
  deleteAccountFromSupabase
} from '../lib/supabase';

export interface SyncStatus {
  isLive: boolean;
  lastSyncedAt: Date;
  statusText: string;
  source: string;
  convexConnected: boolean;
  supabaseConnected: boolean;
  supabaseUrl?: string;
}

export const DEFAULT_SUPERADMIN: User = {
  id: "usr-admin-master",
  username: "admin",
  password: "Ringgo5t@r",
  fullName: "Administrator",
  position: "Administrator Sistem",
  specialCode: "MASTER-SPECTRA-2026",
  role: "admin",
  isAuthority: true,
  status: "active",
  registeredAt: "24/09/2026, 00.00"
};

export const DEFAULT_CONTACTS: Contact[] = [
  { id: "c-001", code: "CUST-001", name: "Andi Transport Service", type: "customer", phone: "08123456789", balance: 500000 },
  { id: "c-002", code: "CUST-002", name: "CV Mitra Sejati", type: "customer", phone: "08198765432", balance: 0 },
  { id: "v-001", code: "VEND-001", name: "Toko ATK Sejahtera", type: "vendor", phone: "08561234567", balance: 0 },
  { id: "v-002", code: "VEND-002", name: "PT Sumber Perlengkapan", type: "vendor", phone: "08771122334", balance: 0 }
];

interface AccountingContextType {
  accounts: Account[];
  transactions: Transaction[];
  settings: CompanySettings;
  contacts: Contact[];
  syncStatus: SyncStatus;
  users: User[];
  currentUser: User | null;
  securityPin: string;
  activityLogs: ActivityLog[];
  complaints: Complaint[];
  
  // Transaction CRUD
  addTransaction: (trx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => Transaction;
  updateTransaction: (id: string, trx: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  getNextRefNumber: (type: TransactionType) => string;

  // Account CRUD
  addAccount: (acc: Omit<Account, 'id'>) => Account;
  updateAccount: (id: string, acc: Partial<Account>) => void;
  deleteAccount: (id: string) => { success: boolean; message?: string };
  batchUpdateAccounts: (updatedList: Account[]) => Promise<void>;

  // Settings & DB
  updateSettings: (newSettings: Partial<CompanySettings>) => void;
  resetToDefault: () => void;
  resetWithPin: (pin: string) => { success: boolean; message: string };
  changePin: (oldPin: string, newPin: string) => { success: boolean; message: string };
  exportDatabaseJson: () => string;
  importDatabaseJson: (jsonStr: string) => { success: boolean; message: string };
  triggerManualSync: () => void;
  
  // Supabase Cloud Integration
  supabaseConfig: SupabaseConfig;
  saveSupabaseSettings: (url: string, key: string) => void;
  testSupabase: () => Promise<{ success: boolean; message: string; tableCount?: number }>;
  syncToSupabase: () => Promise<{ success: boolean; message: string }>;
  syncFromSupabase: () => Promise<{ success: boolean; message: string }>;

  // Auth & User Management
  login: (username: string, pass: string) => { success: boolean; message: string; user?: User; isPending?: boolean };
  register: (user: Omit<User, 'id' | 'role' | 'isAuthority' | 'status' | 'registeredAt'>) => { success: boolean; message: string };
  logout: () => void;
  approveUser: (userId: string) => void;
  rejectUser: (userId: string) => void;
  deleteUser: (userId: string) => void;
  toggleAuthority: (userId: string) => void;

  // Logs & Complaints
  logActivity: (action: string, detail: string) => void;
  submitComplaint: (subject: string, message: string) => void;
  respondComplaint: (complaintId: string, response: string) => void;
}

const STORAGE_KEYS = {
  ACCOUNTS: 'spectra_accounts_v1',
  TRANSACTIONS: 'spectra_transactions_v1',
  SETTINGS: 'spectra_settings_v1',
  USERS: 'spectra_users_v1',
  SESSION: 'spectra_auth_session_v1',
  PIN: 'spectra_security_pin_v1',
  LOGS: 'spectra_activity_logs_v1',
  COMPLAINTS: 'spectra_complaints_v1',
  CONTACTS: 'spectra_contacts_v1'
};

const BROADCAST_CHANNEL_NAME = 'spectra_realtime_sync_channel';

const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

function normalizeAccount(raw: any, index: number): Account {
  if (!raw || typeof raw !== 'object') {
    return defaultAccounts[index % defaultAccounts.length];
  }
  const code = String(raw.code || (10000 + index));
  const name = String(raw.name || 'Akun');
  const pos: ReportType = raw.pos === 'Lr' ? 'Lr' : 'Nrc';
  const sn: NormalBalance = raw.sn === 'Kr' ? 'Kr' : 'Db';
  const debetAwal = Number(raw.debetAwal ?? raw.debit ?? 0) || 0;
  const kreditAwal = Number(raw.kreditAwal ?? raw.credit ?? 0) || 0;
  const isHeader = raw.isHeader !== undefined ? Boolean(raw.isHeader) : raw.type === 'header';
  
  let category: AccountCategory = raw.category;
  let categoryName = raw.categoryName || '';
  
  const num = parseInt(code, 10);
  if (!category || typeof category !== 'string' || !category.includes('_')) {
    if (num < 11000) { category = 'HARTA_LANCAR'; categoryName = 'Harta Lancar'; }
    else if (num < 20000) { category = 'HARTA_TETAP'; categoryName = 'Harta Tetap'; }
    else if (num < 21000) { category = 'UTANG_LANCAR'; categoryName = 'Utang Lancar'; }
    else if (num < 30000) { category = 'UTANG_JANGKA_PANJANG'; categoryName = 'Utang Jangka Panjang'; }
    else if (num < 40000) { category = 'EKUITAS'; categoryName = 'Modal / Ekuitas'; }
    else if (num < 41000) { category = 'PENDAPATAN_OPERASIONAL'; categoryName = 'Pendapatan Operasional'; }
    else if (num < 50000) { category = 'PENDAPATAN_NON_OPERASIONAL'; categoryName = 'Pendapatan Non Operasional'; }
    else if (num < 60000) { category = 'BEBAN_OPERASIONAL'; categoryName = 'Beban Operasional'; }
    else { category = 'BEBAN_NON_OPERASIONAL'; categoryName = 'Beban Lain-lain'; }
  }

  let effectiveSn: NormalBalance = raw.sn === 'Kr' ? 'Kr' : 'Db';
  if (category === 'UTANG_LANCAR' || category === 'UTANG_JANGKA_PANJANG' || (num >= 20000 && num < 30000)) {
    effectiveSn = 'Kr';
  }

  return {
    id: raw.id || code,
    code,
    name,
    category,
    categoryName: categoryName || 'Akun',
    pos,
    sn: effectiveSn,
    debetAwal,
    kreditAwal,
    description: raw.description || '',
    isHeader
  };
}

function normalizeTransaction(raw: any, index: number): Transaction {
  if (!raw || typeof raw !== 'object') {
    return defaultTransactions[0];
  }
  const rawLines = Array.isArray(raw.lines) ? raw.lines : Array.isArray(raw.items) ? raw.items : [];
  const lines = rawLines.map((l: any, lIdx: number) => ({
    id: l.id || `line-${lIdx}`,
    accountId: l.accountId || l.accountCode || '',
    accountCode: l.accountCode || '',
    accountName: l.accountName || '',
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
    memo: l.memo || ''
  }));

  const totalDebit = Number(raw.totalDebit) || lines.reduce((s: number, l: any) => s + l.debit, 0);
  const totalCredit = Number(raw.totalCredit) || lines.reduce((s: number, l: any) => s + l.credit, 0);

  return {
    id: raw.id || `tx-${Date.now()}-${index}`,
    date: raw.date || new Date().toISOString().split('T')[0],
    refNumber: raw.refNumber || raw.ref || `JU-${index + 1}`,
    type: raw.type || 'general',
    description: raw.description || '',
    lines,
    totalDebit,
    totalCredit,
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    partner: raw.partner || raw.contact || '-'
  };
}

export const AccountingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Initialize State with safe fallbacks and normalization
  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACCOUNTS) || localStorage.getItem('sikeu_coa_v3');
      if (saved && saved !== 'null' && saved !== 'undefined') {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .map((acc, idx) => normalizeAccount(acc, idx))
            .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
        }
      }
    } catch (e) {
      console.error('Failed to load accounts from storage:', e);
    }
    return defaultAccounts.slice().sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || localStorage.getItem('sikeu_transactions_v3');
      if (saved && saved !== 'null' && saved !== 'undefined') {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((trx, idx) => normalizeTransaction(trx, idx));
        }
      }
    } catch (e) {
      console.error('Failed to load transactions from storage:', e);
    }
    return defaultTransactions;
  });

  const [settings, setSettings] = useState<CompanySettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS) || localStorage.getItem('sikeu_company_v3');
      if (saved && saved !== 'null' && saved !== 'undefined') {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const loaded = { ...initialCompanySettings, ...parsed };
          if (loaded.accountantName === 'Chief Financial Officer' || !loaded.accountantName) {
            loaded.accountantName = 'Direktur Keuangan';
          }
          // Self-heal fiscalYear if fiscalPeriod specifies a 4-digit year (e.g. "Oktober 2026")
          const yearMatch = loaded.fiscalPeriod?.match(/\b(20\d\d)\b/);
          if (yearMatch) {
            loaded.fiscalYear = parseInt(yearMatch[1], 10);
          }
          return loaded;
        }
      }
    } catch (e) {
      console.error('Failed to load settings from storage:', e);
    }
    return initialCompanySettings;
  });

  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONTACTS) || localStorage.getItem('sikeu_contacts_v3');
      if (saved && saved !== 'null' && saved !== 'undefined') {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load contacts:', e);
    }
    return DEFAULT_CONTACTS;
  });

  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS) || localStorage.getItem('sikeu_users_v3');
      if (saved && saved !== 'null' && saved !== 'undefined') {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.some(u => u && (u.username === 'admin' || u.username === 'administrator'))) {
            parsed.unshift(DEFAULT_SUPERADMIN);
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    }
    return [DEFAULT_SUPERADMIN];
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEYS.SESSION) || localStorage.getItem(STORAGE_KEYS.SESSION);
      if (saved && saved !== 'null' && saved !== 'undefined') {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.username) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load current session:', e);
    }
    return DEFAULT_SUPERADMIN;
  });

  const [securityPin, setSecurityPin] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.PIN) || localStorage.getItem('spectra_security_pin_v3') || '1234';
  });

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOGS) || localStorage.getItem('sikeu_activity_logs_v3');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load activity logs:', e);
    }
    return [
      {
        id: "log-init",
        timestamp: new Date().toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" }),
        username: "admin",
        fullName: "Administrator",
        position: "Administrator Sistem",
        action: "Inisialisasi Sistem",
        detail: "Sistem SPECTRA Accurate Edition aktif dan tersinkronisasi."
      }
    ];
  });

  const [complaints, setComplaints] = useState<Complaint[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COMPLAINTS) || localStorage.getItem('sikeu_complaints_v3');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load complaints:', e);
    }
    return [];
  });

  const [supabaseConfig, setSupabaseConfigState] = useState<SupabaseConfig>(() => getSupabaseConfig());

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => {
    const sbConfig = getSupabaseConfig();
    return {
      isLive: true,
      lastSyncedAt: new Date(),
      statusText: sbConfig.isConfigured ? 'Tersinkron Supabase Cloud' : 'Tersinkron Cloud Online (Real-time)',
      source: 'SPECTRA Cloud Engine (Vercel Production, Supabase & Convex Ready)',
      convexConnected: !!import.meta.env.VITE_CONVEX_URL,
      supabaseConnected: sbConfig.isConfigured,
      supabaseUrl: sbConfig.url
    };
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

  const broadcastChange = useCallback((type: string, payload: any) => {
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
      statusText: 'Tersinkron Otomatis'
    }));
  }, [broadcastChannel]);

  // Listen to remote changes from other browser tabs
  useEffect(() => {
    if (!broadcastChannel) return;

    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {};
      if (type === 'ACCOUNTS' && Array.isArray(payload)) {
        setAccounts(payload);
        localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(payload));
      } else if (type === 'TRANSACTIONS' && Array.isArray(payload)) {
        setTransactions(payload);
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(payload));
      } else if (type === 'SETTINGS' && payload) {
        setSettings(payload);
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(payload));
      } else if (type === 'USERS' && Array.isArray(payload)) {
        setUsers(payload);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(payload));
      } else if (type === 'LOGS' && Array.isArray(payload)) {
        setActivityLogs(payload);
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(payload));
      } else if (type === 'COMPLAINTS' && Array.isArray(payload)) {
        setComplaints(payload);
        localStorage.setItem(STORAGE_KEYS.COMPLAINTS, JSON.stringify(payload));
      } else if (type === 'CONTACTS' && Array.isArray(payload)) {
        setContacts(payload);
        localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(payload));
      } else if (type === 'ALL' && payload) {
        if (payload.accounts) {
          setAccounts(payload.accounts);
          localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(payload.accounts));
        }
        if (payload.transactions) {
          setTransactions(payload.transactions);
          localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(payload.transactions));
        }
        if (payload.contacts) {
          setContacts(payload.contacts);
          localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(payload.contacts));
        }
        if (payload.settings) {
          setSettings(payload.settings);
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(payload.settings));
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

  // Ensure local accounts are always sorted by code ascending (1xxxx to 5xxxx)
  useEffect(() => {
    setAccounts(prev => {
      const isOutOfOrder = prev.some((acc, idx) => idx > 0 && acc.code.localeCompare(prev[idx - 1].code, undefined, { numeric: true }) < 0);
      if (isOutOfOrder) {
        const sorted = [...prev].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
        localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(sorted));
        return sorted;
      }
      return prev;
    });
  }, []);

  // 3. Automatic Initial Sync from Supabase Cloud on mount (With Non-Destructive Auto-Preservation)
  useEffect(() => {
    let isCancelled = false;
    const fetchCloudData = async () => {
      const cfg = getSupabaseConfig();
      if (!cfg.isConfigured) return;
      try {
        const res = await syncPullAllFromSupabase();
        if (!isCancelled && res.success && res.data) {
          // A. Accounts Smart Sync (Protects User's Entered Initial Balances)
          if (res.data.accounts && res.data.accounts.length > 0) {
            const cloudAccounts = res.data.accounts.slice().sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
            setAccounts(prevLocal => {
              const localHasBalances = prevLocal.some(a => (Number(a.debetAwal) || 0) > 0 || (Number(a.kreditAwal) || 0) > 0);
              const cloudHasBalances = cloudAccounts.some(a => (Number(a.debetAwal) || 0) > 0 || (Number(a.kreditAwal) || 0) > 0);

              // CASE 1: Local user has entered initial balances, but cloud has 0 balances!
              // NEVER destroy user's work! Instead, push local up to cloud!
              if (localHasBalances && !cloudHasBalances) {
                console.log('[Auto-Sync] Mempertahankan saldo akun lokal pengguna dan mengunggah otomatis ke Cloud...');
                pushMultipleAccountsToSupabase(prevLocal);
                return prevLocal;
              }

              // CASE 2: Merge if both have data
              if (localHasBalances && cloudHasBalances) {
                const merged = cloudAccounts.map(ca => {
                  const localMatch = prevLocal.find(la => la.code === ca.code);
                  if (localMatch && (!ca.debetAwal && !ca.kreditAwal) && (localMatch.debetAwal || localMatch.kreditAwal)) {
                    return { ...ca, debetAwal: localMatch.debetAwal, kreditAwal: localMatch.kreditAwal };
                  }
                  return ca;
                });
                try { localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(merged)); } catch (e) {}
                return merged;
              }

              // CASE 3: Standard cloud sync
              try { localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(cloudAccounts)); } catch (e) {}
              return cloudAccounts;
            });
          }

          // B. Transactions Smart Sync (Protects User's Locally Created Transactions)
          if (Array.isArray(res.data.transactions)) {
            const cloudTx = res.data.transactions;
            setTransactions(prevLocal => {
              if (prevLocal.length > 0 && cloudTx.length === 0) {
                console.log('[Auto-Sync] Mempertahankan transaksi lokal dan mengunggah otomatis ke Cloud...');
                prevLocal.forEach(t => pushTransactionToSupabase(t));
                return prevLocal;
              }
              if (cloudTx.length > 0) {
                try { localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(cloudTx)); } catch (e) {}
                return cloudTx;
              }
              return prevLocal;
            });
          }

          // C. Contacts Smart Sync
          if (res.data.contacts && res.data.contacts.length > 0) {
            setContacts(res.data.contacts);
            try { localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(res.data.contacts)); } catch (e) {}
          }

          // D. Settings Smart Sync (Protects Custom Backgrounds & Logos)
          if (res.data.settings) {
            const cloudSettings = res.data.settings;
            setSettings(prevLocal => {
              const merged = { ...cloudSettings, ...prevLocal };
              if (cloudSettings.loginBgImage && cloudSettings.loginBgImage.trim() !== '') {
                merged.loginBgImage = cloudSettings.loginBgImage;
              }
              if (cloudSettings.bootingBgImage && cloudSettings.bootingBgImage.trim() !== '') {
                merged.bootingBgImage = cloudSettings.bootingBgImage;
              }
              if (cloudSettings.bootingOverlayDarkness) {
                merged.bootingOverlayDarkness = cloudSettings.bootingOverlayDarkness;
              }
              if (cloudSettings.bootingBgPosX !== undefined) {
                merged.bootingBgPosX = cloudSettings.bootingBgPosX;
              }
              if (cloudSettings.bootingBgPosY !== undefined) {
                merged.bootingBgPosY = cloudSettings.bootingBgPosY;
              }
              if (cloudSettings.bootingBgZoom !== undefined) {
                merged.bootingBgZoom = cloudSettings.bootingBgZoom;
              }
              if (cloudSettings.loginLogoUrl && cloudSettings.loginLogoUrl.trim() !== '') {
                merged.loginLogoUrl = cloudSettings.loginLogoUrl;
              }
              try { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged)); } catch (e) {}
              return merged;
            });
          }

          setSyncStatus(prev => ({
            ...prev,
            lastSyncedAt: new Date(),
            statusText: 'Data tersinkron otomatis dari Supabase Cloud'
          }));
        }
      } catch (e) {
        console.warn('Initial cloud sync warning:', e);
      }
    };
    fetchCloudData();
    return () => { isCancelled = true; };
  }, []);

  // Helper to log activities
  const logActivity = useCallback((action: string, detail: string) => {
    const newLog: ActivityLog = {
      id: "log-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" }),
      username: currentUser ? currentUser.username : "admin",
      fullName: currentUser ? currentUser.fullName : "Administrator",
      position: currentUser ? currentUser.position : "Administrator Sistem",
      action,
      detail
    };
    setActivityLogs(prev => {
      const updated = [newLog, ...prev.slice(0, 499)];
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updated));
      broadcastChange('LOGS', updated);
      return updated;
    });
  }, [currentUser, broadcastChange]);

  // Transaction CRUD
  const getNextRefNumber = useCallback((type: TransactionType) => {
    const prefix = 
      type === 'adjustment' ? 'AP-' :
      type === 'cash_in' ? 'KM-' :
      type === 'cash_out' ? 'KK-' :
      type === 'sales' ? 'FP-' :
      type === 'purchase' ? 'FB-' : 'JU-';
    
    const count = transactions.filter(t => t.refNumber?.startsWith(prefix) || t.type === type).length + 1;
    return `${prefix}${count}`;
  }, [transactions]);

  const addTransaction = useCallback((trx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Transaction => {
    const newTx: Transaction = {
      ...trx,
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      type: trx.type || 'general',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setTransactions(prev => {
      const updated = [...prev, newTx];
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
      broadcastChange('TRANSACTIONS', updated);
      return updated;
    });

    // Auto-sync to Supabase Cloud in background
    pushTransactionToSupabase(newTx);

    logActivity('Input Jurnal', `Transaksi ${newTx.refNumber} (${newTx.type}): ${newTx.description} - Rp ${newTx.totalDebit.toLocaleString('id-ID')}`);
    return newTx;
  }, [broadcastChange, logActivity]);

  const updateTransaction = useCallback((id: string, trx: Partial<Transaction>) => {
    setTransactions(prev => {
      const updated = prev.map(t => {
        if (t.id === id) {
          const merged = { ...t, ...trx, updatedAt: Date.now() };
          pushTransactionToSupabase(merged);
          return merged;
        }
        return t;
      });
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
      broadcastChange('TRANSACTIONS', updated);
      return updated;
    });
    logActivity('Edit Jurnal', `Memperbarui transaksi ID: ${id}`);
  }, [broadcastChange, logActivity]);

  const deleteTransaction = useCallback((id: string) => {
    const target = transactions.find(t => t.id === id);
    setTransactions(prev => {
      const updated = prev.filter(t => t.id !== id);
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
      broadcastChange('TRANSACTIONS', updated);
      return updated;
    });

    // Auto-sync deletion to Supabase Cloud in background
    deleteTransactionFromSupabase(id);

    logActivity('Hapus Jurnal', `Menghapus transaksi: ${target?.refNumber || id} (${target?.description || ''})`);
  }, [transactions, broadcastChange, logActivity]);

  // Account CRUD (With Real-Time Supabase Auto-Save)
  const addAccount = useCallback((acc: Omit<Account, 'id'>): Account => {
    const newAcc: Account = {
      ...acc,
      id: 'acc-' + acc.code
    };
    setAccounts(prev => {
      const updated = [...prev, newAcc].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      try { localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated)); } catch (e) {}
      broadcastChange('ACCOUNTS', updated);
      return updated;
    });
    // Auto-save new account to Supabase Cloud
    pushAccountToSupabase(newAcc);
    logActivity('Tambah Akun', `Menambah akun baru: ${newAcc.code} - ${newAcc.name}`);
    return newAcc;
  }, [broadcastChange, logActivity]);

  const updateAccount = useCallback((id: string, acc: Partial<Account>) => {
    let targetAcc: Account | undefined;
    setAccounts(prev => {
      const updated = prev
        .map(a => {
          if (a.id === id) {
            targetAcc = { ...a, ...acc };
            return targetAcc;
          }
          return a;
        })
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      try { localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated)); } catch (e) {}
      broadcastChange('ACCOUNTS', updated);
      return updated;
    });
    // Auto-save updated account & balances to Supabase Cloud
    if (targetAcc) {
      pushAccountToSupabase(targetAcc);
    }
    logActivity('Edit Akun', `Memperbarui akun ID: ${id}`);
  }, [broadcastChange, logActivity]);

  const deleteAccount = useCallback((id: string): { success: boolean; message?: string } => {
    const target = accounts.find(a => a.id === id);
    if (!target) return { success: false, message: 'Akun tidak ditemukan' };

    // Check if account has transactions
    const hasTransactions = transactions.some(t => 
      t.lines.some(l => l.accountId === id || l.accountCode === target.code)
    );
    if (hasTransactions) {
      return { success: false, message: `Akun ${target.code} - ${target.name} tidak dapat dihapus karena sudah memiliki riwayat mutasi jurnal!` };
    }

    setAccounts(prev => {
      const updated = prev.filter(a => a.id !== id);
      try { localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated)); } catch (e) {}
      broadcastChange('ACCOUNTS', updated);
      return updated;
    });
    // Auto-delete from Supabase Cloud
    deleteAccountFromSupabase(id);
    logActivity('Hapus Akun', `Menghapus akun: ${target.code} - ${target.name}`);
    return { success: true };
  }, [accounts, transactions, broadcastChange, logActivity]);

  const batchUpdateAccounts = useCallback(async (updatedList: Account[]): Promise<void> => {
    const sorted = [...updatedList].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    setAccounts(sorted);
    try { localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(sorted)); } catch (e) {}
    broadcastChange('ACCOUNTS', sorted);
    await pushMultipleAccountsToSupabase(sorted);
    logActivity('Batch Update Akun', `Memperbarui massal ${sorted.length} akun dan saldo ke Supabase Cloud`);
  }, [broadcastChange, logActivity]);

  // Settings & Reset (With Safe Storage Quota Handling & Real-time Auto-Save)
  const updateSettings = useCallback((newSettings: Partial<CompanySettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      // Keep fiscalYear in sync with fiscalPeriod if it contains a 4-digit year
      const yearMatch = updated.fiscalPeriod?.match(/\b(20\d\d)\b/);
      if (yearMatch) {
        updated.fiscalYear = parseInt(yearMatch[1], 10);
      }
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      } catch (storageErr) {
        console.warn('LocalStorage quota warning for settings, pushing to cloud directly:', storageErr);
      }
      broadcastChange('SETTINGS', updated);
      // Auto-sync company settings to Supabase in background
      pushSettingsToSupabase(updated);
      return updated;
    });
    logActivity('Pengaturan Perusahaan', 'Memperbarui profil atau konfigurasi entitas');
  }, [broadcastChange, logActivity]);

  const resetToDefault = useCallback(() => {
    const zeroedDefaultAccounts = defaultAccounts.map(a => ({
      ...a,
      debetAwal: 0,
      kreditAwal: 0
    }));
    const zeroedContacts = DEFAULT_CONTACTS.map(c => ({
      ...c,
      balance: 0
    }));

    setAccounts(zeroedDefaultAccounts);
    setTransactions([]);
    setContacts(zeroedContacts);
    setSettings(initialCompanySettings);

    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(zeroedDefaultAccounts));
    localStorage.setItem('sikeu_coa_v3', JSON.stringify(zeroedDefaultAccounts));
    localStorage.setItem('sikeu_accounts_v3', JSON.stringify(zeroedDefaultAccounts));

    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
    localStorage.setItem('sikeu_transactions_v3', JSON.stringify([]));
    localStorage.setItem('sikeu_transactions', JSON.stringify([]));

    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(zeroedContacts));
    localStorage.setItem('sikeu_contacts_v3', JSON.stringify(zeroedContacts));

    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(initialCompanySettings));

    broadcastChange('TRANSACTIONS', []);
    broadcastChange('ACCOUNTS', zeroedDefaultAccounts);
    broadcastChange('CONTACTS', zeroedContacts);
    broadcastChange('ALL', { 
      accounts: zeroedDefaultAccounts, 
      transactions: [], 
      contacts: zeroedContacts, 
      settings: initialCompanySettings 
    });

    // Auto-wipe Supabase cloud transactions and zero accounts
    syncPushAllToSupabase({ 
      accounts: zeroedDefaultAccounts, 
      transactions: [], 
      contacts: zeroedContacts, 
      settings: initialCompanySettings 
    });

    logActivity('Reset Sistem', 'Mengosongkan seluruh jurnal (0 transaksi) dan menolkan seluruh saldo perkiraan akun.');
  }, [broadcastChange, logActivity]);

  const resetWithPin = useCallback((pin: string): { success: boolean; message: string } => {
    if (pin.trim() !== securityPin.trim()) {
      return { success: false, message: 'PIN Otorisasi salah! Akses RESET ditolak.' };
    }

    // Atomically reset journals and zero accounts across local storage, broadcast channels, and cloud
    setTransactions([]);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
    localStorage.setItem('sikeu_transactions_v3', JSON.stringify([]));
    localStorage.setItem('sikeu_transactions', JSON.stringify([]));

    const zeroed = accounts.map(a => ({
      ...a,
      debetAwal: 0,
      kreditAwal: 0
    }));
    setAccounts(zeroed);
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(zeroed));
    localStorage.setItem('sikeu_coa_v3', JSON.stringify(zeroed));
    localStorage.setItem('sikeu_accounts_v3', JSON.stringify(zeroed));

    const zeroedContacts = contacts.map(c => ({
      ...c,
      balance: 0
    }));
    setContacts(zeroedContacts);
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(zeroedContacts));
    localStorage.setItem('sikeu_contacts_v3', JSON.stringify(zeroedContacts));

    broadcastChange('TRANSACTIONS', []);
    broadcastChange('ACCOUNTS', zeroed);
    broadcastChange('CONTACTS', zeroedContacts);
    broadcastChange('ALL', { 
      accounts: zeroed, 
      transactions: [], 
      contacts: zeroedContacts, 
      settings 
    });

    syncPushAllToSupabase({ 
      accounts: zeroed, 
      transactions: [], 
      contacts: zeroedContacts, 
      settings 
    });

    // 6. Activity log
    logActivity('RESET PEMBUKUAN (BERHASIL)', 'Seluruh transaksi jurnal dihapus bersih (0 transaksi) dan seluruh saldo nominal akun dinol-kan (Rp 0) dengan otorisasi PIN.');

    return { 
      success: true, 
      message: 'SUKSES: Reset sistem berhasil! Semua transaksi dan jurnal telah dihapus (0 transaksi), dan seluruh saldo akun telah dinol-kan (Rp 0).' 
    };
  }, [securityPin, accounts, contacts, settings, broadcastChange, logActivity]);

  const changePin = useCallback((oldPin: string, newPin: string): { success: boolean; message: string } => {
    if (oldPin.trim() !== securityPin.trim()) {
      return { success: false, message: 'PIN Saat Ini salah! Gagal memperbarui PIN.' };
    }
    if (newPin.trim().length < 4) {
      return { success: false, message: 'PIN Baru minimal 4 karakter/digit.' };
    }
    setSecurityPin(newPin.trim());
    localStorage.setItem(STORAGE_KEYS.PIN, newPin.trim());
    logActivity('Ganti PIN', 'Memperbarui PIN otorisasi keamanan RESET');
    return { success: true, message: 'PIN Keamanan berhasil diperbarui!' };
  }, [securityPin, logActivity]);

  // Auth & User Management
  const login = useCallback((username: string, pass: string) => {
    const cleanUser = username.trim().toLowerCase();
    let found = users.find(u => u.username.toLowerCase() === cleanUser);
    if (!found && (cleanUser === 'admin' || cleanUser === 'administrator')) {
      found = users.find(u => u.role === 'admin');
    }

    if (!found) {
      return { success: false, message: 'Nama akun (username) tidak ditemukan! Silakan periksa kembali atau ajukan pendaftaran akun baru.' };
    }
    if (found.password !== pass) {
      return { success: false, message: 'Password akun salah! Silakan coba lagi.' };
    }
    if (found.status === 'pending') {
      return { 
        success: false, 
        isPending: true,
        message: 'Saat ini data anda sedang diverifikasi oleh otoritas terkait, harap tunggu beberapa saat.' 
      };
    }

    setCurrentUser(found);
    sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(found));
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(found));
    logActivity('Login', `${found.fullName} (${found.position}) berhasil masuk ke sistem`);
    return { success: true, message: 'Login berhasil', user: found };
  }, [users, logActivity]);

  const register = useCallback((data: Omit<User, 'id' | 'role' | 'isAuthority' | 'status' | 'registeredAt'>) => {
    const cleanUser = data.username.trim().toLowerCase();
    if (users.some(u => u.username.toLowerCase() === cleanUser)) {
      return { success: false, message: 'Nama akun (username) ini sudah terdaftar. Silakan pilih nama akun lain.' };
    }

    const newUser: User = {
      ...data,
      id: 'usr-' + Date.now(),
      username: cleanUser,
      role: 'user',
      isAuthority: false,
      status: 'pending',
      registeredAt: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
    };

    setUsers(prev => {
      const updated = [...prev, newUser];
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
      broadcastChange('USERS', updated);
      return updated;
    });

    logActivity('Registrasi Akun', `Pengajuan pendaftaran: ${newUser.fullName} (${newUser.position}), username: ${newUser.username}`);
    return { 
      success: true, 
      message: 'Pendaftaran Berhasil! Saat ini data anda sedang diverifikasi oleh otoritas terkait, harap tunggu beberapa saat.' 
    };
  }, [users, broadcastChange, logActivity]);

  const logout = useCallback(() => {
    if (currentUser) {
      logActivity('Logout', `${currentUser.fullName} (${currentUser.position}) keluar dari sistem`);
    }
    setCurrentUser(null);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  }, [currentUser, logActivity]);

  const approveUser = useCallback((userId: string) => {
    setUsers(prev => {
      const updated = prev.map(u => u.id === userId ? { ...u, status: 'active' as const } : u);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
      broadcastChange('USERS', updated);
      return updated;
    });
    logActivity('Aktivasi Pengguna', `Administrator mengaktifkan akun ID: ${userId}`);
  }, [broadcastChange, logActivity]);

  const rejectUser = useCallback((userId: string) => {
    setUsers(prev => {
      const updated = prev.filter(u => u.id !== userId);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
      broadcastChange('USERS', updated);
      return updated;
    });
    logActivity('Tolak Pengguna', `Administrator menolak permohonan akun ID: ${userId}`);
  }, [broadcastChange, logActivity]);

  const deleteUser = useCallback((userId: string) => {
    setUsers(prev => {
      const updated = prev.filter(u => u.id !== userId);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
      broadcastChange('USERS', updated);
      return updated;
    });
    logActivity('Hapus Pengguna', `Administrator menghapus akun pengguna ID: ${userId}`);
  }, [broadcastChange, logActivity]);

  const toggleAuthority = useCallback((userId: string) => {
    setUsers(prev => {
      const updated = prev.map(u => u.id === userId ? { ...u, isAuthority: !u.isAuthority } : u);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
      broadcastChange('USERS', updated);
      return updated;
    });
    logActivity('Ubah Hak Otoritas', `Mengubah hak otoritas pengguna ID: ${userId}`);
  }, [broadcastChange, logActivity]);

  // Complaints
  const submitComplaint = useCallback((subject: string, message: string) => {
    const newComplaint: Complaint = {
      id: 'comp-' + Date.now(),
      timestamp: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
      username: currentUser?.username || 'user',
      fullName: currentUser?.fullName || 'Pengguna',
      position: currentUser?.position || 'Staff',
      subject,
      message,
      status: 'pending'
    };
    setComplaints(prev => {
      const updated = [newComplaint, ...prev];
      localStorage.setItem(STORAGE_KEYS.COMPLAINTS, JSON.stringify(updated));
      broadcastChange('COMPLAINTS', updated);
      return updated;
    });
    logActivity('Kirim Keluhan', `Keluhan dari ${newComplaint.fullName}: ${subject}`);
  }, [currentUser, broadcastChange, logActivity]);

  const respondComplaint = useCallback((complaintId: string, response: string) => {
    setComplaints(prev => {
      const updated = prev.map(c => c.id === complaintId ? {
        ...c,
        response,
        respondedAt: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
        status: 'resolved' as const
      } : c);
      localStorage.setItem(STORAGE_KEYS.COMPLAINTS, JSON.stringify(updated));
      broadcastChange('COMPLAINTS', updated);
      return updated;
    });
    logActivity('Tanggapi Keluhan', `Administrator menanggapi keluhan ID: ${complaintId}`);
  }, [broadcastChange, logActivity]);

  // JSON Database Export/Import
  const exportDatabaseJson = useCallback((): string => {
    const backupData = {
      version: '3.0',
      timestamp: new Date().toISOString(),
      company: settings,
      accounts,
      transactions,
      contacts,
      users: users.map(u => ({ ...u, password: '***' })),
      activityLogs: activityLogs.slice(0, 100)
    };
    logActivity('Backup Database', 'Mencadangkan seluruh database sistem ke berkas JSON');
    return JSON.stringify(backupData, null, 2);
  }, [settings, accounts, transactions, contacts, users, activityLogs, logActivity]);

  const importDatabaseJson = useCallback((jsonStr: string): { success: boolean; message: string } => {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.accounts || !data.transactions) {
        return { success: false, message: 'Format file JSON tidak valid. Memerlukan properti accounts dan transactions.' };
      }
      setAccounts(data.accounts);
      setTransactions(data.transactions);
      if (data.company) setSettings(data.company);
      if (data.contacts) setContacts(data.contacts);

      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(data.accounts));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(data.transactions));
      if (data.company) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.company));
      if (data.contacts) localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(data.contacts));

      broadcastChange('ALL', data);
      logActivity('Restore Database', `Memulihkan database: ${data.accounts.length} akun, ${data.transactions.length} transaksi`);
      return { success: true, message: `Berhasil memulihkan ${data.accounts.length} akun dan ${data.transactions.length} transaksi!` };
    } catch (e: any) {
      return { success: false, message: `Gagal membaca berkas JSON: ${e.message}` };
    }
  }, [broadcastChange, logActivity]);

  const triggerManualSync = useCallback(() => {
    setSyncStatus(prev => ({
      ...prev,
      lastSyncedAt: new Date(),
      statusText: 'Disinkronkan secara manual'
    }));
    broadcastChange('ALL', { accounts, transactions, settings, users });
  }, [accounts, transactions, settings, users, broadcastChange]);

  // Supabase Cloud Sync Actions
  const saveSupabaseSettings = useCallback((url: string, key: string) => {
    saveSupabaseConfig(url, key);
    const updated = getSupabaseConfig();
    setSupabaseConfigState(updated);
    setSyncStatus(prev => ({
      ...prev,
      supabaseConnected: updated.isConfigured,
      supabaseUrl: updated.url,
      statusText: updated.isConfigured ? 'Konfigurasi Supabase Tersimpan' : 'Supabase Dinonaktifkan'
    }));
    logActivity('Konfigurasi Supabase', `Memperbarui endpoint Supabase: ${url ? url : '(Dikosongkan)'}`);
  }, [logActivity]);

  const testSupabase = useCallback(async () => {
    const res = await testSupabaseConnection();
    if (res.success) {
      setSyncStatus(prev => ({
        ...prev,
        supabaseConnected: true,
        lastSyncedAt: new Date(),
        statusText: 'Terhubung ke Supabase Cloud'
      }));
    }
    return res;
  }, []);

  const syncToSupabase = useCallback(async () => {
    const res = await syncPushAllToSupabase({ accounts, transactions, contacts, settings });
    if (res.success) {
      setSyncStatus(prev => ({
        ...prev,
        lastSyncedAt: new Date(),
        statusText: 'Data terunggah ke Supabase'
      }));
      logActivity('Sinkronisasi Supabase', `Berhasil mengunggah ${accounts.length} akun & ${transactions.length} transaksi ke Supabase.`);
    }
    return res;
  }, [accounts, transactions, contacts, settings, logActivity]);

  const syncFromSupabase = useCallback(async () => {
    const res = await syncPullAllFromSupabase();
    if (res.success && res.data) {
      if (res.data.accounts && res.data.accounts.length > 0) {
        const sortedAccounts = res.data.accounts.slice().sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
        setAccounts(sortedAccounts);
        localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(sortedAccounts));
      }
      if (Array.isArray(res.data.transactions)) {
        setTransactions(res.data.transactions);
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(res.data.transactions));
      }
      if (res.data.contacts) {
        setContacts(res.data.contacts);
        localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(res.data.contacts));
      }
      if (res.data.settings) {
        setSettings(res.data.settings);
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(res.data.settings));
      }
      broadcastChange('ALL', res.data);
      logActivity('Tarik Data Supabase', 'Berhasil memperbarui data lokal dari Supabase Cloud.');
    }
    return res;
  }, [broadcastChange, logActivity]);

  return (
    <AccountingContext.Provider
      value={{
        accounts,
        transactions,
        settings,
        contacts,
        syncStatus,
        users,
        currentUser,
        securityPin,
        activityLogs,
        complaints,
        supabaseConfig,
        saveSupabaseSettings,
        testSupabase,
        syncToSupabase,
        syncFromSupabase,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        getNextRefNumber,
        addAccount,
        updateAccount,
        deleteAccount,
        batchUpdateAccounts,
        updateSettings,
        resetToDefault,
        resetWithPin,
        changePin,
        exportDatabaseJson,
        importDatabaseJson,
        triggerManualSync,
        login,
        register,
        logout,
        approveUser,
        rejectUser,
        deleteUser,
        toggleAuthority,
        logActivity,
        submitComplaint,
        respondComplaint
      }}
    >
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
