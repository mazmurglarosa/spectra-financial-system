import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Account, Transaction, Contact, CompanySettings, ActivityLog, User } from '../types/accounting';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

const DEFAULT_SUPABASE_URL = 'https://drsqwxkkcfqvooqzoyvm.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyc3F3eGtrY2Zxdm9vcXpveXZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjUyMDMsImV4cCI6MjEwNzY0MTIwM30.5ayLSmloCqvJ1PJsRDGM9ZPbfud-bwOBh0NfyshCOlg';

const STORAGE_KEYS = {
  URL: 'spectra_supabase_url',
  KEY: 'spectra_supabase_anon_key'
};

export function getSupabaseConfig(): SupabaseConfig {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.URL) || '' : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.KEY) || '' : '';

  const url = (storedUrl || envUrl).trim();
  const anonKey = (storedKey || envKey).trim();

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey)
  };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem(STORAGE_KEYS.URL, url.trim());
    else localStorage.removeItem(STORAGE_KEYS.URL);

    if (anonKey) localStorage.setItem(STORAGE_KEYS.KEY, anonKey.trim());
    else localStorage.removeItem(STORAGE_KEYS.KEY);
  }
}

let cachedClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  if (cachedClient && lastUsedUrl === url && lastUsedKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: false
      }
    });
    lastUsedUrl = url;
    lastUsedKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; tableCount?: number; latencyMs?: number }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Konfigurasi Supabase URL atau Anon Key belum diisi.'
    };
  }

  const startTime = performance.now();
  try {
    // Attempt a lightweight select from accounts
    const { data, error } = await client.from('accounts').select('id').limit(1);
    const latencyMs = Math.round(performance.now() - startTime);
    if (error) {
      // If table doesn't exist yet, it will report relation does not exist
      if (error.code === '42P01') {
        return {
          success: true,
          message: 'Koneksi ke instance Supabase berhasil! Catatan: Tabel belum dibuat, silakan jalankan schema.sql di SQL Editor Supabase.',
          latencyMs
        };
      }
      return {
        success: false,
        message: `Gagal query ke Supabase: ${error.message} (${error.code || 'ERR'})`,
        latencyMs
      };
    }

    return {
      success: true,
      message: 'Koneksi ke Supabase Database Online berhasil terhubung dan tersinkronisasi!',
      tableCount: data ? data.length : 0,
      latencyMs
    };
  } catch (e: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      message: `Gagal terhubung ke host Supabase: ${e?.message || 'Network Error'}`,
      latencyMs
    };
  }
}

// Synchronisation helpers
export async function syncPushAllToSupabase(payload: {
  accounts: Account[];
  transactions: Transaction[];
  contacts?: Contact[];
  settings?: CompanySettings;
}): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase belum dikonfigurasi.' };
  }

  try {
    // 1. Upsert Accounts
    if (payload.accounts && payload.accounts.length > 0) {
      const rows = payload.accounts.map(a => ({
        id: a.id,
        code: a.code,
        name: a.name,
        category: a.category,
        category_name: a.categoryName,
        pos: a.pos,
        sn: a.sn,
        debet_awal: a.debetAwal || 0,
        kredit_awal: a.kreditAwal || 0,
        description: a.description || '',
        is_header: Boolean(a.isHeader),
        updated_at: new Date().toISOString()
      }));
      const { error } = await client.from('accounts').upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(`Accounts error: ${error.message}`);
    }

    // 2. Sync Transactions
    if (Array.isArray(payload.transactions)) {
      if (payload.transactions.length === 0) {
        // If 0 transactions (e.g. after system reset), delete all transactions in Supabase
        await client.from('transactions').delete().neq('id', '___non_existent___');
      } else {
        const txRows = payload.transactions.map(t => ({
          id: t.id,
          date: t.date,
          ref_number: t.refNumber,
          type: t.type || 'general',
          description: t.description,
          lines: t.lines,
          total_debit: t.totalDebit,
          total_credit: t.totalCredit,
          partner: t.partner || '-',
          created_at: t.createdAt,
          updated_at: t.updatedAt
        }));
        const { error } = await client.from('transactions').upsert(txRows, { onConflict: 'id' });
        if (error) throw new Error(`Transactions error: ${error.message}`);
      }
    }

    // 3. Upsert Contacts
    if (payload.contacts && payload.contacts.length > 0) {
      const contactRows = payload.contacts.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        type: c.type,
        phone: c.phone || '',
        balance: c.balance || 0
      }));
      const { error } = await client.from('contacts').upsert(contactRows, { onConflict: 'id' });
      if (error) throw new Error(`Contacts error: ${error.message}`);
    }

    // 4. Upsert Company Settings
    if (payload.settings) {
      const s = payload.settings;
      const { error } = await client.from('company_settings').upsert({
        id: 'primary',
        company_name: s.companyName,
        business_type: s.businessType,
        fiscal_period: s.fiscalPeriod,
        fiscal_year: s.fiscalYear,
        currency: s.currency || 'IDR',
        tax_rate_percent: s.taxRatePercent || 11,
        address: s.address || '',
        phone: s.phone || '',
        email: s.email || '',
        director_name: s.directorName,
        director_title: s.directorTitle || 'Direktur Utama',
        accountant_name: s.accountantName,
        accountant_title: s.accountantTitle || 'Direktur Keuangan',
        preparer_name: s.preparerName || '',
        approver_name: s.approverName || '',
        approver_title: s.approverTitle || '',
        login_bg_image: s.loginBgImage || '',
        login_quote: s.loginQuote || '',
        login_subtitle: s.loginSubtitle || '',
        login_overlay_darkness: s.loginOverlayDarkness || 'dark',
        booting_bg_image: s.bootingBgImage || '',
        booting_overlay_darkness: s.bootingOverlayDarkness || 'dark',
        booting_bg_pos_x: s.bootingBgPosX ?? 50,
        booting_bg_pos_y: s.bootingBgPosY ?? 50,
        booting_bg_zoom: s.bootingBgZoom ?? 100,
        login_logo_url: s.loginLogoUrl || '',
        login_logo_height: s.loginLogoHeight || 48,
        login_bg_pos_x: s.loginBgPosX ?? 50,
        login_bg_pos_y: s.loginBgPosY ?? 50,
        login_bg_zoom: s.loginBgZoom ?? 100,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (error) throw new Error(`Settings error: ${error.message}`);
    }

    return {
      success: true,
      message: 'Seluruh data berhasil diunggah dan disinkronkan ke Supabase Cloud!'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal sinkronisasi ke Supabase: ${err.message}`
    };
  }
}

export async function syncPullAllFromSupabase(): Promise<{
  success: boolean;
  message: string;
  data?: {
    accounts?: Account[];
    transactions?: Transaction[];
    contacts?: Contact[];
    settings?: CompanySettings;
  };
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase belum dikonfigurasi.' };
  }

  try {
    // 1. Pull Accounts (Always ordered by code ascending: 10000 -> 50000+)
    const { data: rawAccounts, error: accErr } = await client
      .from('accounts')
      .select('*')
      .order('code', { ascending: true });
    if (accErr) throw new Error(`Accounts pull error: ${accErr.message}`);

    const accounts: Account[] | undefined = rawAccounts ? rawAccounts.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category,
      categoryName: r.category_name,
      pos: r.pos,
      sn: r.sn,
      debetAwal: Number(r.debet_awal) || 0,
      kreditAwal: Number(r.kredit_awal) || 0,
      description: r.description,
      isHeader: Boolean(r.is_header)
    })).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })) : undefined;

    // 2. Pull Transactions
    const { data: rawTx, error: txErr } = await client.from('transactions').select('*').order('date', { ascending: true });
    if (txErr) throw new Error(`Transactions pull error: ${txErr.message}`);

    const transactions: Transaction[] | undefined = rawTx ? rawTx.map(r => ({
      id: r.id,
      date: r.date,
      refNumber: r.ref_number,
      type: r.type,
      description: r.description,
      lines: r.lines || [],
      totalDebit: Number(r.total_debit) || 0,
      totalCredit: Number(r.total_credit) || 0,
      partner: r.partner,
      createdAt: Number(r.created_at) || Date.now(),
      updatedAt: Number(r.updated_at) || Date.now()
    })) : undefined;

    // 3. Pull Contacts
    const { data: rawContacts } = await client.from('contacts').select('*');
    const contacts: Contact[] | undefined = rawContacts ? rawContacts.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      phone: r.phone,
      balance: Number(r.balance) || 0
    })) : undefined;

    // 4. Pull Settings
    const { data: rawSettings } = await client.from('company_settings').select('*').eq('id', 'primary').maybeSingle();
    let settings: CompanySettings | undefined;
    if (rawSettings) {
      settings = {
        companyName: rawSettings.company_name,
        businessType: rawSettings.business_type,
        fiscalPeriod: rawSettings.fiscal_period,
        fiscalYear: rawSettings.fiscal_year,
        currency: rawSettings.currency,
        taxRatePercent: Number(rawSettings.tax_rate_percent),
        address: rawSettings.address,
        phone: rawSettings.phone,
        email: rawSettings.email,
        directorName: rawSettings.director_name,
        directorTitle: rawSettings.director_title,
        accountantName: rawSettings.accountant_name,
        accountantTitle: rawSettings.accountant_title,
        preparerName: rawSettings.preparer_name,
        preparerTitle: rawSettings.preparer_title,
        approverName: rawSettings.approver_name,
        approverTitle: rawSettings.approver_title,
        loginBgImage: rawSettings.login_bg_image,
        loginQuote: rawSettings.login_quote,
        loginSubtitle: rawSettings.login_subtitle,
        loginOverlayDarkness: rawSettings.login_overlay_darkness,
        bootingBgImage: rawSettings.booting_bg_image,
        bootingOverlayDarkness: rawSettings.booting_overlay_darkness,
        bootingBgPosX: rawSettings.booting_bg_pos_x !== undefined && rawSettings.booting_bg_pos_x !== null ? Number(rawSettings.booting_bg_pos_x) : undefined,
        bootingBgPosY: rawSettings.booting_bg_pos_y !== undefined && rawSettings.booting_bg_pos_y !== null ? Number(rawSettings.booting_bg_pos_y) : undefined,
        bootingBgZoom: rawSettings.booting_bg_zoom !== undefined && rawSettings.booting_bg_zoom !== null ? Number(rawSettings.booting_bg_zoom) : undefined,
        loginLogoUrl: rawSettings.login_logo_url,
        loginLogoHeight: rawSettings.login_logo_height ? Number(rawSettings.login_logo_height) : undefined,
        loginBgPosX: rawSettings.login_bg_pos_x !== undefined && rawSettings.login_bg_pos_x !== null ? Number(rawSettings.login_bg_pos_x) : undefined,
        loginBgPosY: rawSettings.login_bg_pos_y !== undefined && rawSettings.login_bg_pos_y !== null ? Number(rawSettings.login_bg_pos_y) : undefined,
        loginBgZoom: rawSettings.login_bg_zoom !== undefined && rawSettings.login_bg_zoom !== null ? Number(rawSettings.login_bg_zoom) : undefined
      };
    }

    return {
      success: true,
      message: 'Berhasil menarik data terbaru dari Supabase Cloud!',
      data: {
        accounts,
        transactions,
        contacts,
        settings
      }
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menarik data dari Supabase: ${err.message}`
    };
  }
}

export async function pushTransactionToSupabase(tx: Transaction): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('transactions').upsert({
      id: tx.id,
      date: tx.date,
      ref_number: tx.refNumber,
      type: tx.type || 'general',
      description: tx.description,
      lines: tx.lines,
      total_debit: tx.totalDebit,
      total_credit: tx.totalCredit,
      partner: tx.partner || '-',
      created_at: tx.createdAt,
      updated_at: tx.updatedAt
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('Auto push tx to Supabase failed:', e);
  }
}

export async function deleteTransactionFromSupabase(id: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('transactions').delete().eq('id', id);
  } catch (e) {
    console.warn('Auto delete tx from Supabase failed:', e);
  }
}

export async function pushSettingsToSupabase(s: CompanySettings): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('company_settings').upsert({
      id: 'primary',
      company_name: s.companyName,
      business_type: s.businessType,
      fiscal_period: s.fiscalPeriod,
      fiscal_year: s.fiscalYear,
      currency: s.currency || 'IDR',
      tax_rate_percent: s.taxRatePercent || 11,
      address: s.address || '',
      phone: s.phone || '',
      email: s.email || '',
      director_name: s.directorName,
      director_title: s.directorTitle || 'Direktur Utama',
      accountant_name: s.accountantName,
      accountant_title: s.accountantTitle || 'Direktur Keuangan',
      preparer_name: s.preparerName || '',
      preparer_title: s.preparerTitle || '',
      approver_name: s.approverName || '',
      approver_title: s.approverTitle || '',
      login_bg_image: s.loginBgImage || '',
      login_quote: s.loginQuote || '',
      login_subtitle: s.loginSubtitle || '',
      login_overlay_darkness: s.loginOverlayDarkness || 'dark',
      booting_bg_image: s.bootingBgImage || '',
      booting_overlay_darkness: s.bootingOverlayDarkness || 'dark',
      booting_bg_pos_x: s.bootingBgPosX ?? 50,
      booting_bg_pos_y: s.bootingBgPosY ?? 50,
      booting_bg_zoom: s.bootingBgZoom ?? 100,
      login_logo_url: s.loginLogoUrl || '',
      login_logo_height: s.loginLogoHeight || 48,
      login_bg_pos_x: s.loginBgPosX ?? 50,
      login_bg_pos_y: s.loginBgPosY ?? 50,
      login_bg_zoom: s.loginBgZoom ?? 100,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('Auto push settings to Supabase failed:', e);
  }
}

export async function pushAccountToSupabase(a: Account): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('accounts').upsert({
      id: a.id,
      code: a.code,
      name: a.name,
      category: a.category,
      category_name: a.categoryName,
      pos: a.pos,
      sn: a.sn,
      debet_awal: Number(a.debetAwal) || 0,
      kredit_awal: Number(a.kreditAwal) || 0,
      description: a.description || '',
      is_header: Boolean(a.isHeader),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('Auto push account to Supabase failed:', e);
  }
}

export async function pushMultipleAccountsToSupabase(accounts: Account[]): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !accounts.length) return;
  try {
    const rows = accounts.map(a => ({
      id: a.id,
      code: a.code,
      name: a.name,
      category: a.category,
      category_name: a.categoryName,
      pos: a.pos,
      sn: a.sn,
      debet_awal: Number(a.debetAwal) || 0,
      kredit_awal: Number(a.kreditAwal) || 0,
      description: a.description || '',
      is_header: Boolean(a.isHeader),
      updated_at: new Date().toISOString()
    }));
    await client.from('accounts').upsert(rows, { onConflict: 'id' });
  } catch (e) {
    console.warn('Auto push multiple accounts to Supabase failed:', e);
  }
}

export async function deleteAccountFromSupabase(id: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('accounts').delete().eq('id', id);
  } catch (e) {
    console.warn('Auto delete account from Supabase failed:', e);
  }
}

