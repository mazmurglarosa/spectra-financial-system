/**
 * Centralized Accounting Data Mapper for SPECTRA Financial System
 * Menghubungkan skema riil PostgreSQL Supabase Staging dengan model data frontend
 * sesuai definisi resmi di src/types/accounting.ts.
 *
 * Mencegah inkonsistensi field:
 * - accounts: category_name, pos ('Nrc'|'Lr'), sn ('Db'|'Kr'), debet_awal, kredit_awal, is_header
 * - transactions: created_at (bigint), updated_at (bigint), lines (jsonb), total_debit, total_credit
 * - contacts: type ('customer'|'vendor')
 * - company_settings: fiscal_year (integer), preparer_*, approver_*
 */

import { Account, Transaction, Contact, CompanySettings, ReportType, NormalBalance, AccountCategory } from '../../src/types/accounting.js';
import crypto from 'crypto';

/**
 * Menghitung canonical fingerprint SHA-256 dari seluruh data material transaksi akuntansi:
 * tanggal, ref_number, description, total_debit, total_credit, partner, dan seluruh baris jurnal
 * (accountCode, debit, credit, memo) yang diurutkan secara kanonikal.
 */
export function computeTransactionFingerprint(tx: any): string {
  if (!tx || typeof tx !== 'object') return '';
  const date = String(tx.date || '').trim().slice(0, 10);
  const refNumber = String(tx.refNumber || tx.ref_number || '').trim();
  const type = String(tx.type || 'general').trim();
  const description = String(tx.description || '').trim();
  const totalDebit = Number(tx.totalDebit ?? tx.total_debit ?? 0).toFixed(2);
  const totalCredit = Number(tx.totalCredit ?? tx.total_credit ?? 0).toFixed(2);
  const partner = String(tx.partner || '-').trim();

  const lines = Array.isArray(tx.lines)
    ? tx.lines
    : typeof tx.lines === 'string'
    ? JSON.parse(tx.lines || '[]')
    : [];

  const canonicalLines = lines.map((l: any) => ({
    accountCode: String(l.accountCode || l.accountId || '').trim(),
    debit: Number(l.debit || 0).toFixed(2),
    credit: Number(l.credit || 0).toFixed(2),
    memo: String(l.memo || '').trim()
  })).sort((a: any, b: any) => {
    return (
      a.accountCode.localeCompare(b.accountCode) ||
      Number(a.debit) - Number(b.debit) ||
      Number(a.credit) - Number(b.credit) ||
      a.memo.localeCompare(b.memo)
    );
  });

  const canonicalObj = {
    date,
    refNumber,
    type,
    description,
    totalDebit,
    totalCredit,
    partner,
    lines: canonicalLines
  };

  return crypto.createHash('sha256').update(JSON.stringify(canonicalObj)).digest('hex');
}

// =========================================================================
// 1. ACCOUNTS MAPPER
// =========================================================================

export function mapDbAccountToAccount(r: any): Account {
  if (!r) throw new Error('Cannot map null database account row');

  const pos: ReportType = r.pos === 'Lr' ? 'Lr' : 'Nrc';
  const rawSn = String(r.sn || '').trim().toLowerCase();
  const rawCategory = String(r.category || '').toUpperCase();
  const code = String(r.code || '').trim();
  const name = String(r.name || '').toLowerCase();

  let sn: NormalBalance = 'Db';
  if (rawSn === 'kr' || rawSn === 'kredit' || rawSn === 'cr' || rawSn === 'credit') {
    sn = 'Kr';
  } else if (rawSn === 'db' || rawSn === 'debet' || rawSn === 'debit') {
    sn = 'Db';
  } else {
    // SAK Normal Balance Inference jika di database bernilai null / kosong
    if (
      rawCategory === 'UTANG_LANCAR' || 
      rawCategory === 'UTANG_JANGKA_PANJANG' || 
      (rawCategory === 'EKUITAS' && !name.includes('prive')) ||
      rawCategory === 'PENDAPATAN' ||
      rawCategory === 'PENDAPATAN_LAIN' ||
      code.startsWith('2') || 
      (code.startsWith('3') && !name.includes('prive')) || 
      code.startsWith('4')
    ) {
      sn = 'Kr';
    }
  }

  return {
    id: String(r.id),
    code: String(r.code).trim(),
    name: String(r.name).trim(),
    category: (r.category as AccountCategory) || 'HARTA_LANCAR',
    categoryName: String(r.category_name || r.categoryName || r.category || '').trim(),
    pos,
    sn,
    debetAwal: Number(r.debet_awal ?? r.debetAwal) || 0,
    kreditAwal: Number(r.kredit_awal ?? r.kreditAwal) || 0,
    description: r.description || undefined,
    isHeader: Boolean(r.is_header ?? r.isHeader)
  };
}

export function mapAccountToDb(a: any): any {
  if (!a || (!a.code && !a.id)) {
    throw new Error('Data akun tidak valid: id atau code wajib diisi.');
  }

  const id = String(a.id || a.code).trim();
  const code = String(a.code || id).trim();
  const name = String(a.name || '').trim();
  const category = String(a.category || 'HARTA_LANCAR').trim();
  const categoryName = String(a.categoryName || a.category_name || category).trim();
  
  // Validasi ketat Check Constraint database: pos = ANY ('Nrc', 'Lr')
  const pos = a.pos === 'Lr' ? 'Lr' : 'Nrc';
  
  // Validasi ketat Check Constraint database: sn = ANY ('Db', 'Kr')
  const sn = a.sn === 'Kr' ? 'Kr' : 'Db';

  return {
    id,
    code,
    name,
    category,
    category_name: categoryName,
    pos,
    sn,
    debet_awal: Number(a.debetAwal ?? a.debet_awal) || 0,
    kredit_awal: Number(a.kreditAwal ?? a.kredit_awal) || 0,
    description: a.description || null,
    is_header: Boolean(a.isHeader ?? a.is_header),
    updated_at: new Date().toISOString()
  };
}

// =========================================================================
// 2. TRANSACTIONS MAPPER
// =========================================================================

export function mapDbTransactionToTransaction(r: any): Transaction {
  if (!r) throw new Error('Cannot map null database transaction row');

  const lines = Array.isArray(r.lines)
    ? r.lines
    : typeof r.lines === 'string'
    ? JSON.parse(r.lines)
    : [];

  return {
    id: String(r.id),
    date: String(r.date).slice(0, 10),
    refNumber: String(r.ref_number || r.refNumber || ''),
    type: r.type || 'general',
    description: String(r.description || ''),
    lines,
    totalDebit: Number(r.total_debit ?? r.totalDebit) || 0,
    totalCredit: Number(r.total_credit ?? r.totalCredit) || 0,
    partner: r.partner || '-',
    createdAt: Number(r.created_at) || Date.now(),
    updatedAt: Number(r.updated_at) || Date.now()
  };
}

export function mapTransactionToDb(t: any): any {
  if (!t || !t.id || !t.refNumber || !t.date) {
    throw new Error('Data transaksi tidak valid: id, date, dan refNumber wajib disertakan.');
  }

  const now = Date.now();
  let createdAt = Number(t.createdAt ?? t.created_at);
  if (!createdAt || isNaN(createdAt)) createdAt = now;

  let updatedAt = Number(t.updatedAt ?? t.updated_at);
  if (!updatedAt || isNaN(updatedAt)) updatedAt = now;

  const lines = Array.isArray(t.lines) ? t.lines : [];

  return {
    id: String(t.id).trim(),
    date: String(t.date).slice(0, 10),
    ref_number: String(t.refNumber || t.ref_number).trim(),
    type: String(t.type || 'general'),
    description: String(t.description || '').trim(),
    lines,
    total_debit: Number(t.totalDebit ?? t.total_debit) || 0,
    total_credit: Number(t.totalCredit ?? t.total_credit) || 0,
    partner: String(t.partner || '-').trim(),
    created_at: Math.floor(createdAt), // BIGINT milliseconds
    updated_at: Math.floor(updatedAt)  // BIGINT milliseconds
  };
}

// =========================================================================
// 3. CONTACTS MAPPER
// =========================================================================

export function mapDbContactToContact(r: any): Contact {
  if (!r) throw new Error('Cannot map null database contact row');

  return {
    id: String(r.id),
    code: String(r.code),
    name: String(r.name),
    type: r.type === 'vendor' ? 'vendor' : 'customer',
    phone: r.phone || undefined,
    balance: Number(r.balance) || 0
  };
}

export function mapContactToDb(c: any): any {
  if (!c || (!c.code && !c.id)) {
    throw new Error('Data kontak tidak valid: id atau code wajib diisi.');
  }

  const rawType = String(c.type || '').toLowerCase().trim();
  // Validasi ketat check constraint: contacts_type_check: ANY ('customer', 'vendor')
  const type = rawType === 'vendor' ? 'vendor' : 'customer';

  return {
    id: String(c.id || c.code).trim(),
    code: String(c.code || c.id).trim(),
    name: String(c.name || '').trim(),
    type,
    phone: c.phone ? String(c.phone).trim() : null,
    balance: Number(c.balance) || 0
  };
}

// =========================================================================
// 4. COMPANY SETTINGS MAPPER
// =========================================================================

export function mapDbCompanySettingsToCompanySettings(r: any): CompanySettings {
  if (!r) {
    return {
      companyName: '',
      businessType: '',
      fiscalPeriod: '',
      fiscalYear: new Date().getFullYear(),
      currency: 'IDR',
      taxRatePercent: 11,
      address: '',
      phone: '',
      email: '',
      directorName: '',
      accountantName: ''
    };
  }

  return {
    companyName: r.company_name || '',
    businessType: r.business_type || '',
    fiscalPeriod: r.fiscal_period || '',
    fiscalYear: Number(r.fiscal_year) || new Date().getFullYear(),
    currency: r.currency || 'IDR',
    taxRatePercent: Number(r.tax_rate_percent) || 11,
    address: r.address || '',
    phone: r.phone || '',
    email: r.email || '',
    directorName: r.director_name || '',
    directorTitle: r.director_title || 'Direktur Utama',
    accountantName: r.accountant_name || '',
    accountantTitle: r.accountant_title || 'Direktur Keuangan',
    preparerName: r.preparer_name || undefined,
    preparerTitle: r.preparer_title || undefined,
    approverName: r.approver_name || undefined,
    approverTitle: r.approver_title || undefined
  };
}

export function mapCompanySettingsToDb(s: any): any {
  if (!s || typeof s !== 'object') {
    throw new Error('Data konfigurasi perusahaan tidak valid.');
  }

  return {
    id: 'primary',
    company_name: String(s.companyName || s.company_name || '').trim(),
    business_type: String(s.businessType || s.business_type || '').trim(),
    fiscal_period: String(s.fiscalPeriod || s.fiscal_period || '').trim(),
    fiscal_year: Number(s.fiscalYear || s.fiscal_year) || new Date().getFullYear(),
    currency: String(s.currency || 'IDR').trim(),
    tax_rate_percent: Number(s.taxRatePercent ?? s.tax_rate_percent) || 11,
    address: s.address ? String(s.address).trim() : null,
    phone: s.phone ? String(s.phone).trim() : null,
    email: s.email ? String(s.email).trim() : null,
    director_name: String(s.directorName || s.director_name || '').trim(),
    director_title: String(s.directorTitle || s.director_title || 'Direktur Utama').trim(),
    accountant_name: String(s.accountantName || s.accountant_name || '').trim(),
    accountant_title: String(s.accountantTitle || s.accountant_title || 'Direktur Keuangan').trim(),
    preparer_name: s.preparerName || s.preparer_name ? String(s.preparerName || s.preparer_name).trim() : null,
    preparer_title: s.preparerTitle || s.preparer_title ? String(s.preparerTitle || s.preparer_title).trim() : null,
    approver_name: s.approverName || s.approver_name ? String(s.approverName || s.approver_name).trim() : null,
    approver_title: s.approverTitle || s.approver_title ? String(s.approverTitle || s.approver_title).trim() : null,
    updated_at: new Date().toISOString()
  };
}
