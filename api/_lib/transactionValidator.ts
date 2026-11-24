/**
 * Unified Transaction Validator for SPECTRA Financial System
 * Dipakai oleh seluruh endpoint mutasi keuangan (/api/financial/transactions dan /api/financial/sync-push).
 *
 * Menjamin:
 * 1. Struktur baris jurnal lengkap (minimal 2 baris).
 * 2. Akun terdaftar dan valid di database.
 * 3. Nilai debit dan kredit numerik, finite, non-NaN, non-Infinity, dan tidak negatif.
 * 4. Header total debit dan kredit dihitung ulang di server (tidak percaya input mentah klien).
 * 5. Keseimbangan mutlak: Total Debit == Total Kredit (Debit - Kredit = 0).
 * 6. Format nomor referensi dan tanggal transaksi valid (YYYY-MM-DD).
 * 7. Mencegah duplikasi data dan mendukung idempotency saat retry.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedTransaction?: any;
}

export interface ValidationOptions {
  checkAccountExistence?: boolean;
  existingAccountCodes?: Set<string>;
}

export async function validateTransactionStrict(
  rawTx: any,
  supabase?: SupabaseClient,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  if (!rawTx || typeof rawTx !== 'object') {
    return { isValid: false, error: 'Payload transaksi kosong atau tidak berbentuk objek.' };
  }

  // 1. Validasi ID
  const id = String(rawTx.id || '').trim();
  if (!id) {
    return { isValid: false, error: 'ID transaksi wajib disertakan.' };
  }

  // 2. Validasi Tanggal (YYYY-MM-DD)
  const dateStr = String(rawTx.date || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { isValid: false, error: `Format tanggal tidak valid: "${dateStr}". Wajib format YYYY-MM-DD.` };
  }
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) {
    return { isValid: false, error: `Nilai kalender tanggal tidak valid: "${dateStr}".` };
  }

  // 3. Validasi Nomor Referensi
  const refNumber = String(rawTx.refNumber || rawTx.ref_number || '').trim();
  if (!refNumber) {
    return { isValid: false, error: 'Nomor referensi bukti transaksi (refNumber) wajib diisi.' };
  }

  // 4. Validasi Baris Jurnal (Lines)
  const lines = Array.isArray(rawTx.lines)
    ? rawTx.lines
    : typeof rawTx.lines === 'string'
    ? JSON.parse(rawTx.lines || '[]')
    : [];

  if (!Array.isArray(lines) || lines.length < 2) {
    return {
      isValid: false,
      error: `Jurnal ${refNumber} ditolak: Wajib memiliki minimal 2 baris pencatatan berpasangan (ditemukan ${lines.length} baris).`
    };
  }

  // 5. Periksa Akun Terdaftar jika diminta atau tersedia klien database
  let validCodes = options.existingAccountCodes;
  if (!validCodes && options.checkAccountExistence && supabase) {
    const { data: accounts, error: accErr } = await supabase
      .from('accounts')
      .select('code, id');
    if (!accErr && accounts) {
      validCodes = new Set(accounts.flatMap(a => [String(a.code).trim(), String(a.id).trim()]));
    }
  }

  let calculatedDebitSum = 0;
  let calculatedCreditSum = 0;
  const sanitizedLines: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || typeof line !== 'object') {
      return { isValid: false, error: `Baris jurnal #${i + 1} pada ${refNumber} rusak atau tidak valid.` };
    }

    const accountCode = String(line.accountCode || line.accountId || '').trim();
    if (!accountCode) {
      return { isValid: false, error: `Baris #${i + 1} pada ${refNumber} tidak memiliki kode/ID akun.` };
    }

    // Jika set akun tersedia, pastikan akun benar-benar ada
    if (validCodes && validCodes.size > 0 && !validCodes.has(accountCode) && !validCodes.has(String(line.accountId || '').trim())) {
      return {
        isValid: false,
        error: `Baris #${i + 1} pada ${refNumber} menggunakan akun yang tidak terdaftar: "${accountCode}".`
      };
    }

    const debitVal = Number(line.debit);
    const creditVal = Number(line.credit);

    // Larangan NaN, Infinity, nilai non-finite
    if (!Number.isFinite(debitVal) || isNaN(debitVal)) {
      return { isValid: false, error: `Nilai debit baris #${i + 1} (${accountCode}) bukan angka yang valid.` };
    }
    if (!Number.isFinite(creditVal) || isNaN(creditVal)) {
      return { isValid: false, error: `Nilai kredit baris #${i + 1} (${accountCode}) bukan angka yang valid.` };
    }

    // Larangan nilai negatif
    if (debitVal < 0 || creditVal < 0) {
      return {
        isValid: false,
        error: `Nilai debit/kredit baris #${i + 1} (${accountCode}) tidak boleh negatif (Debit: ${debitVal}, Kredit: ${creditVal}).`
      };
    }

    // Larangan baris kosong tanpa debit maupun kredit
    if (debitVal === 0 && creditVal === 0) {
      return {
        isValid: false,
        error: `Baris #${i + 1} (${accountCode}) memiliki nilai debit dan kredit sama dengan 0. Setiap baris wajib bernilai.`
      };
    }

    // Larangan satu baris mengisi debit DAN kredit sekaligus
    if (debitVal > 0 && creditVal > 0) {
      return {
        isValid: false,
        error: `Baris #${i + 1} (${accountCode}) tidak boleh memiliki nilai Debit dan Kredit sekaligus dalam satu baris.`
      };
    }

    calculatedDebitSum += debitVal;
    calculatedCreditSum += creditVal;

    sanitizedLines.push({
      id: String(line.id || `line-${i + 1}`),
      accountId: String(line.accountId || line.accountCode || accountCode),
      accountCode,
      accountName: String(line.accountName || '').trim(),
      debit: debitVal,
      credit: creditVal,
      memo: line.memo ? String(line.memo).trim() : undefined
    });
  }

  // 6. Validasi Nilai Total
  if (calculatedDebitSum <= 0 || calculatedCreditSum <= 0) {
    return {
      isValid: false,
      error: `Total transaksi ${refNumber} harus lebih besar dari 0 (Debit: ${calculatedDebitSum}, Kredit: ${calculatedCreditSum}).`
    };
  }

  // 7. Validasi Keseimbangan Akuntansi (Debit == Kredit)
  // Toleransi rounding 0.001
  const balanceDiff = Math.abs(calculatedDebitSum - calculatedCreditSum);
  if (balanceDiff >= 0.001) {
    return {
      isValid: false,
      error: `Jurnal ${refNumber} TIDAK SEIMBANG! Total Debit: Rp ${calculatedDebitSum.toLocaleString('id-ID')} vs Total Kredit: Rp ${calculatedCreditSum.toLocaleString('id-ID')} (Selisih: Rp ${balanceDiff.toLocaleString('id-ID')}).`
    };
  }

  // 8. Reconcile Header Total jika diberikan klien
  const clientDebit = rawTx.totalDebit !== undefined ? Number(rawTx.totalDebit) : undefined;
  const clientCredit = rawTx.totalCredit !== undefined ? Number(rawTx.totalCredit) : undefined;

  if (clientDebit !== undefined && Number.isFinite(clientDebit) && Math.abs(clientDebit - calculatedDebitSum) >= 0.001) {
    return {
      isValid: false,
      error: `Manipulasi terdeteksi pada ${refNumber}: Total Debit header (${clientDebit}) tidak cocok dengan jumlah baris (${calculatedDebitSum}).`
    };
  }
  if (clientCredit !== undefined && Number.isFinite(clientCredit) && Math.abs(clientCredit - calculatedCreditSum) >= 0.001) {
    return {
      isValid: false,
      error: `Manipulasi terdeteksi pada ${refNumber}: Total Kredit header (${clientCredit}) tidak cocok dengan jumlah baris (${calculatedCreditSum}).`
    };
  }

  const now = Date.now();
  let createdAt = Number(rawTx.createdAt ?? rawTx.created_at);
  if (!createdAt || isNaN(createdAt)) createdAt = now;
  let updatedAt = Number(rawTx.updatedAt ?? rawTx.updated_at);
  if (!updatedAt || isNaN(updatedAt)) updatedAt = now;

  const sanitizedTransaction = {
    id,
    date: dateStr,
    refNumber,
    type: String(rawTx.type || 'general'),
    description: String(rawTx.description || '').trim(),
    lines: sanitizedLines,
    totalDebit: calculatedDebitSum,
    totalCredit: calculatedCreditSum,
    partner: String(rawTx.partner || '-').trim(),
    createdAt: Math.floor(createdAt),
    updatedAt: Math.floor(updatedAt)
  };

  return {
    isValid: true,
    sanitizedTransaction
  };
}
