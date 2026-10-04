export type AccountCategory = 
  | 'HARTA_LANCAR' 
  | 'HARTA_TETAP' 
  | 'UTANG_LANCAR' 
  | 'UTANG_JANGKA_PANJANG' 
  | 'EKUITAS' 
  | 'PENDAPATAN_OPERASIONAL' 
  | 'PENDAPATAN_NON_OPERASIONAL' 
  | 'BEBAN_OPERASIONAL' 
  | 'BEBAN_NON_OPERASIONAL';

export type NormalBalance = 'Db' | 'Kr';
export type ReportType = 'Nrc' | 'Lr'; // Neraca (Balance Sheet) vs Laba Rugi (Income Statement)

export interface Account {
  id: string;
  code: string;
  name: string;
  category: AccountCategory;
  categoryName: string;
  pos: ReportType; // Nrc or Lr
  sn: NormalBalance; // Db or Kr
  debetAwal: number;
  kreditAwal: number;
  description?: string;
  isHeader?: boolean;
}

export interface TransactionLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  refNumber: string; // e.g. JU-001, BKK-001
  description: string;
  lines: TransactionLine[];
  totalDebit: number;
  totalCredit: number;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  partner?: string; // Client or Vendor for subsidiary ledger
}

export interface CompanySettings {
  companyName: string;
  businessType: string;
  fiscalPeriod: string;
  fiscalYear: number;
  currency: string;
  taxRatePercent: number;
  address: string;
  phone: string;
  email: string;
  directorName: string;
  accountantName: string;
  lastSyncedAt?: number;
  convexUrl?: string;
}

export interface LedgerEntry {
  transactionId: string;
  date: string;
  refNumber: string;
  description: string;
  debit: number;
  credit: number;
  balance: number; // Running balance according to account's normal balance
  memo?: string;
}

export interface AccountLedger {
  account: Account;
  startingBalance: number;
  entries: LedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  endingBalance: number;
}

export interface TrialBalanceItem {
  code: string;
  name: string;
  categoryName: string;
  debit: number;
  credit: number;
}

export interface WorksheetRow {
  code: string;
  name: string;
  pos: ReportType;
  sn: NormalBalance;
  // 1-2 Neraca Saldo
  nsDebit: number;
  nsCredit: number;
  // 3-4 Penyesuaian
  adjDebit: number;
  adjCredit: number;
  // 5-6 Neraca Saldo Disesuaikan
  nsdDebit: number;
  nsdCredit: number;
  // 7-8 Laba Rugi
  lrDebit: number;
  lrCredit: number;
  // 9-10 Neraca
  nrcDebit: number;
  nrcCredit: number;
}

export interface FinancialRatio {
  name: string;
  category: 'Likuiditas' | 'Solvabilitas' | 'Profitabilitas' | 'Aktivitas';
  value: number;
  unit: string;
  benchmark: string;
  status: 'Good' | 'Warning' | 'Danger' | 'Neutral';
  formula: string;
  description: string;
}
