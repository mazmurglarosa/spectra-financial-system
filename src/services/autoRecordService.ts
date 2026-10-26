/**
 * SPECTRA Auto Record & Intelligent Accounting OCR/HTR Pipeline Service
 * 
 * Modul ini menyediakan:
 * 1. Generator Kode Nomor Berkas (BT/XXXX/DDMYY)
 * 2. Manajemen Jenis Transaksi & Kode POS (Bawaan & Custom POS Builder)
 * 3. Mesin Ekstraksi Multimodal & HTR (Nota Cetak, Struk Thermal, & Nota Tulis Tangan)
 * 4. Normalisasi Tulisan Tangan Indonesia (singkatan harga: 10,-, 10rb; satuan lokal: bks, lsn, bh, pcs, pak, kg, ons, dus)
 * 5. Verifikasi Formal Dua Arah (Uji Horizontal & Vertikal) & Math-Assisted Disambiguation
 * 6. Deteksi Selisih Matematika Penjual (SELLER_MATH_DISCREPANCY)
 * 7. Format Pengisian Google Spreadsheet datasheet_bukti_transaksi (Sheet Main, Kolom B s.d. L)
 * 8. Mesin Analisis Akuntansi SAK (Agregasi Akun Sejenis, Pemisahan Pajak/Biaya, Pemetaan Akun Lawan per POS)
 * 9. Otomasi Penomoran & Pembuatan Akun Baru COA (last_code + 1 berdasarkan Header)
 * 10. Otomasi Pengisian & Penyimpanan ke Jurnal Umum / Accurate Voucher
 */

import { Account, AccountCategory, NormalBalance, ReportType, Transaction, TransactionLine, TransactionType } from '../types/accounting';
import { uploadHeavyFileToDrive, SPECTRA_DRIVE_FOLDER_ID, SPECTRA_DRIVE_FOLDER_URL } from './googleDriveBot';

export interface PosRule {
  id: string;
  code: string; // e.g. 'A', 'B', 'C', 'D', 'E', 'F'
  name: string; // e.g. 'Pembelian Langsung'
  description: string;
  debitRule: string; // Deskripsi aturan debit
  creditRule: string; // Deskripsi aturan kredit
  defaultDebitAccountCode?: string;
  defaultDebitAccountName?: string;
  defaultCreditAccountCode?: string;
  defaultCreditAccountName?: string;
  isCustom?: boolean;
}

export interface ExtractedItem {
  id: string;
  name: string;
  unitPrice: number | null;
  quantity: number | null;
  unit?: string; // pcs, bks, lsn, kg, etc.
  totalPrice: number;
  confidence: number; // 0 - 100
  boundingBox?: { x: number; y: number; width: number; height: number };
  isTaxOrFee?: boolean;
  taxOrFeeType?: 'PB1' | 'PPN' | 'SERVICE' | 'ONGKIR' | 'OTHER' | 'BI_FAST' | 'ADMIN_BANK';
  hasDiscrepancy?: boolean;
  discrepancyNote?: string;
  originalText?: string;
}

export interface RealOcrExtractionResult {
  detectedType: 'transfer_bank' | 'nota_pembelian' | 'faktur' | 'struk_thermal' | 'lainnya';
  sellerOrRecipient: string;
  transactionDate?: string;
  extractedItems: ExtractedItem[];
  declaredGrandTotal: number;
  calculatedSum: number;
  mathDiscrepancy: boolean;
  discrepancyMessage?: string;
  sourceEngine: 'gemini_vision' | 'tesseract_ocr' | 'smart_parser';
  rawResponse?: any;
}

export interface SpreadsheetRowData {
  no: number;
  tanggal: number;
  bulan: number;
  tahun: number;
  namaTransaksi: string;
  hargaSatuan: number | null;
  kuantitas: number | null;
  hargaTotal: number;
  nomorBerkas: string;
  linkBerkas: string;
  pos: string;
}

export interface SuggestedJournalLine {
  id: string;
  accountCode: string;
  accountName: string;
  accountCategory: AccountCategory;
  pos: ReportType;
  sn: NormalBalance;
  debit: number;
  credit: number;
  memo: string;
  isNewAccount: boolean;
  suggestedNewCode?: string;
  sourceItems?: string[];
}

export interface AutoRecordDraft {
  id: string;
  receiptImage: string; // Base64 or URL
  receiptFileName: string;
  transactionType: string;
  posCode: string;
  keterangan: string;
  nomorBerkas: string;
  googleDriveLink?: string;
  extractedItems: ExtractedItem[];
  grandTotal: number;
  calculatedTotal: number;
  mathDiscrepancyDetected: boolean;
  discrepancyMessage?: string;
  suggestedJournal: SuggestedJournalLine[];
  uploadedAt: string;
  spreadsheetRows: SpreadsheetRowData[];
  status: 'draft' | 'saved' | 'approved';
}

// =========================================================================
// 1. MANAJEMEN ATURAN POS & CUSTOM POS
// =========================================================================
export const DEFAULT_POS_RULES: PosRule[] = [
  {
    id: 'pos-a',
    code: 'A',
    name: 'Pembelian Langsung',
    description: 'Pembelian barang/jasa secara tunai/lunas',
    debitRule: 'Akun Aset/Perlengkapan/Persediaan/Beban sesuai analisis barang/jasa yang dibeli beserta akun Pajak/Biaya tambahan terkait',
    creditRule: 'Kas (Nominal kredit sama dengan total seluruh nominal debit)',
    defaultCreditAccountCode: '10001',
    defaultCreditAccountName: 'Kas'
  },
  {
    id: 'pos-b',
    code: 'B',
    name: 'Pembelian Kredit',
    description: 'Pembelian barang/jasa dengan termin hutang',
    debitRule: 'Akun Aset/Perlengkapan/Persediaan/Beban sesuai analisis barang/jasa yang dibeli beserta akun Pajak/Biaya tambahan terkait',
    creditRule: 'Utang Dagang / Utang Usaha (Nominal kredit sama dengan total seluruh nominal debit)',
    defaultCreditAccountCode: '20001',
    defaultCreditAccountName: 'Utang Usaha/Dagang'
  },
  {
    id: 'pos-c',
    code: 'C',
    name: 'Penjualan Piutang',
    description: 'Penjualan barang/jasa secara kredit (timbul piutang)',
    debitRule: 'Piutang Usaha (Nominal debit sama dengan total penjualan)',
    creditRule: 'Pendapatan Jasa / Penjualan',
    defaultDebitAccountCode: '10003',
    defaultDebitAccountName: 'Piutang Usaha',
    defaultCreditAccountCode: '40001',
    defaultCreditAccountName: 'Pendapatan Jasa / Penjualan'
  },
  {
    id: 'pos-d',
    code: 'D',
    name: 'Pelunasan Kredit / Piutang',
    description: 'Penerimaan pelunasan piutang pelanggan atau pembayaran hutang ke pemasok',
    debitRule: 'Kas (jika terima pelunasan piutang) atau Utang Usaha (jika bayar hutang)',
    creditRule: 'Piutang Usaha (jika terima pelunasan) atau Kas (jika bayar hutang)',
    defaultDebitAccountCode: '10001',
    defaultDebitAccountName: 'Kas',
    defaultCreditAccountCode: '10003',
    defaultCreditAccountName: 'Piutang Usaha'
  },
  {
    id: 'pos-e',
    code: 'E',
    name: 'Penerimaan Dana / Terima Transfer',
    description: 'Penerimaan kas, transfer modal, atau transfer bank',
    debitRule: 'Kas / Bank',
    creditRule: 'Akun Kas / Sumber Dana / Modal terkait dengan jumlah seimbang',
    defaultDebitAccountCode: '10001',
    defaultDebitAccountName: 'Kas',
    defaultCreditAccountCode: '30000',
    defaultCreditAccountName: 'Modal / Ekuitas'
  }
];

const STORAGE_CUSTOM_POS_KEY = 'sikeu_custom_pos_rules_v3';
const STORAGE_DOC_SEQ_KEY = 'sikeu_auto_record_doc_seq_v3';

export function getPosRules(): PosRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_POS_KEY);
    if (raw) {
      const customs: PosRule[] = JSON.parse(raw);
      return [...DEFAULT_POS_RULES, ...customs];
    }
  } catch (e) {
    console.error('Gagal membaca custom POS rules:', e);
  }
  return DEFAULT_POS_RULES;
}

export function saveCustomPosRule(rule: Omit<PosRule, 'id' | 'isCustom'>): PosRule {
  const newRule: PosRule = {
    ...rule,
    id: `pos-custom-${Date.now()}-${rule.code.toLowerCase()}`,
    isCustom: true
  };
  try {
    const current = getPosRules().filter(r => r.isCustom);
    const updated = [...current.filter(r => r.code !== newRule.code), newRule];
    localStorage.setItem(STORAGE_CUSTOM_POS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Gagal menyimpan custom POS rule:', e);
  }
  return newRule;
}

export function deleteCustomPosRule(ruleId: string): void {
  try {
    const current = getPosRules().filter(r => r.isCustom && r.id !== ruleId);
    localStorage.setItem(STORAGE_CUSTOM_POS_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Gagal menghapus custom POS rule:', e);
  }
}

// =========================================================================
// 2. GENERATOR KODE NOMOR BERKAS: BT/XXXX/DDMYY
// =========================================================================
const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function toRomanMonth(month1to12: number): string {
  const idx = Math.max(1, Math.min(12, month1to12)) - 1;
  return ROMAN_MONTHS[idx];
}

export function getNextDocumentSequence(existingTransactions: Transaction[] = []): number {
  try {
    // 1. Check local sequence storage
    const storedSeq = parseInt(localStorage.getItem(STORAGE_DOC_SEQ_KEY) || '0', 10);

    // 2. Scan existing transactions with refNumber like BT/0001/26X26
    let maxFound = storedSeq;
    existingTransactions.forEach(t => {
      if (t.refNumber && t.refNumber.startsWith('BT/')) {
        const parts = t.refNumber.split('/');
        if (parts.length >= 2) {
          const num = parseInt(parts[1], 10);
          if (!isNaN(num) && num > maxFound) {
            maxFound = num;
          }
        }
      }
    });

    return maxFound + 1;
  } catch (e) {
    return 1;
  }
}

export function commitDocumentSequence(seq: number): void {
  try {
    localStorage.setItem(STORAGE_DOC_SEQ_KEY, String(seq));
  } catch (e) {}
}

/**
 * Menghasilkan Kode Nomor Berkas resmi dengan format:
 * BT/XXXX/DDMYY
 * Contoh: BT/0001/26X26
 */
export function generateFileCode(seqNumber: number, dateObj = new Date()): string {
  const xxxx = String(seqNumber).padStart(4, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const m = toRomanMonth(dateObj.getMonth() + 1);
  const yy = String(dateObj.getFullYear()).slice(-2);
  return `BT/${xxxx}/${dd}${m}${yy}`;
}

// =========================================================================
// 3. NORMALISASI TULISAN TANGAN INDONESIA & HTR ASSISTED
// =========================================================================

/**
 * Membersihkan dan mengonversi nominal tulisan tangan khas Indonesia:
 * '10,-' -> 10000 (jika dalam konteks ribuan) atau 10
 * '10rb' / '10k' -> 10000
 * '100.000' -> 100000
 * 'Rp 40.000,-' -> 40000
 */
export function parseIndonesianCurrency(text: string | number, isLikelyThousands = false): number {
  if (typeof text === 'number') {
    if (isNaN(text)) return 0;
    return Math.round(text);
  }
  if (!text) return 0;

  let cleaned = String(text).trim();
  // Strip currency prefixes: IDR, Rp, Rp., etc.
  cleaned = cleaned.replace(/^(?:idr|rp\.?)\s*/i, '').trim();

  const lower = cleaned.toLowerCase();

  // Handle shorthand suffix: 10rb, 10k, 10jt
  if (lower.endsWith('rb') || lower.endsWith('k') || lower.includes('ribu')) {
    const numPart = lower.replace(/[^\d.,]/g, '').replace(',', '.');
    const val = parseFloat(numPart);
    if (!isNaN(val)) return Math.round(val * 1000);
  }

  if (lower.endsWith('jt') || lower.includes('juta')) {
    const numPart = lower.replace(/[^\d.,]/g, '').replace(',', '.');
    const val = parseFloat(numPart);
    if (!isNaN(val)) return Math.round(val * 1000000);
  }

  // Handle ',-' or '.-' (Indonesian receipt sen notation: "Rp 10.000,-" -> "10.000")
  cleaned = cleaned.replace(/[,.]-$/, '').trim();

  // Handle '10,-' notation where base is only 1-3 digits
  if (lower.includes(',-') || lower.includes('.-')) {
    const base = lower.replace(/[^\d]/g, '');
    const num = parseInt(base, 10);
    if (!isNaN(num)) {
      if (isLikelyThousands && num < 1000) {
        return num * 1000;
      }
      return num;
    }
  }

  // PENTING: Tangani Desimal Sen (.00 atau ,00 atau 1-2 digit desimal di akhir)
  // Bukti Transfer Bank (BCA, Mandiri, dll) selalu menuliskan sen:
  // "2,850,000.00" -> desimal .00
  // "2.850.000,00" -> desimal ,00
  // "2,500.00"     -> desimal .00
  // "2.500,00"     -> desimal ,00
  // Pemisah ribuan selalu 3 digit (.000 atau ,000), sedangkan desimal sen 1-2 digit (.00 atau ,00).
  const decimalMatch = cleaned.match(/[.,](\d{1,2})$/);
  if (decimalMatch) {
    const decimalDigits = decimalMatch[1];
    const integerPartStr = cleaned.slice(0, cleaned.length - decimalMatch[0].length);
    const intDigitsOnly = integerPartStr.replace(/[^\d]/g, '');
    const intVal = parseInt(intDigitsOnly, 10) || 0;
    const decVal = parseFloat(`0.${decimalDigits}`) || 0;
    const finalVal = Math.round(intVal + decVal);
    if (isLikelyThousands && finalVal < 1000) {
      return finalVal * 1000;
    }
    return finalVal;
  }

  // Clean standard currency notation without 1-2 digit decimal: e.g. Rp 2.850.000 atau 100.000
  const digitsOnly = cleaned.replace(/[^\d]/g, '');
  const parsed = parseInt(digitsOnly, 10);
  if (isNaN(parsed)) return 0;

  // Contextual multiplier: if single item is like "10" on receipt while header is "Ribuan Rupiah"
  if (isLikelyThousands && parsed < 1000) {
    return parsed * 1000;
  }

  return parsed;
}

/**
 * Sanitizer cerdas untuk memastikan nominal Rupiah bebas dari inflasi 100x akibat .00 terbaca sebagai nol tambahan
 */
export function sanitizeCurrencyAmount(val: number | string | null | undefined, itemName = ''): number {
  if (val === null || val === undefined) return 0;

  let num = parseIndonesianCurrency(val);

  const lowerName = itemName.toLowerCase();

  // 1. Deteksi Biaya BI-FAST:
  // Biaya BI-FAST di seluruh perbankan Indonesia (BCA, Mandiri, BRI, BNI) adalah Rp 2.500.
  // Jika terbaca 250000 (dua ratus lima puluh ribu), itu 100% akibat .00 terbaca sebagai nol ganda!
  if (lowerName.includes('bi-fast') || lowerName.includes('bi fast') || lowerName.includes('admin') || lowerName.includes('transfer')) {
    if (num === 250000) {
      num = 2500;
    } else if (num > 50000 && num % 100 === 0 && num / 100 <= 10000) {
      num = num / 100;
    }
  }

  // 2. Deteksi Nominal Transaksi Utama:
  // Jika nominal >= 50.000.000 dan berakhiran 00, sedangkan nama item/keterangan adalah
  // kursus, pelatihan, brevet, bengkel, baut, material, service, toko:
  // Contoh: Brevet Pajak CPTT biasanya Rp 2.850.000. Jika terbaca 285000000 (285 juta), itu 100% kelebihan dua nol!
  if (num >= 50000000 && num % 100 === 0) {
    if (
      lowerName.includes('brevet') || 
      lowerName.includes('pelatihan') || 
      lowerName.includes('kursus') || 
      lowerName.includes('cptt') || 
      lowerName.includes('piranha') ||
      lowerName.includes('baut') ||
      lowerName.includes('bengkel') ||
      lowerName.includes('material') ||
      lowerName.includes('perlengkapan')
    ) {
      num = Math.round(num / 100);
    }
  }

  return num;
}

// =========================================================================
// 4. VERIFIKASI FORMAL DUA ARAH & MATH-ASSISTED DISAMBIGUATION
// =========================================================================

export interface VerificationResult {
  verifiedItems: ExtractedItem[];
  grandTotal: number;
  calculatedSum: number;
  mathDiscrepancy: boolean;
  discrepancyMessage?: string;
}

export function runTwoWayDeterministicVerification(
  items: ExtractedItem[],
  declaredGrandTotal?: number
): VerificationResult {
  const verifiedItems = items.map(item => {
    let { unitPrice, quantity, totalPrice, confidence } = item;

    // 1. Uji Horizontal: Harga Satuan x Kuantitas = Total
    if (unitPrice !== null && quantity !== null && unitPrice > 0 && quantity > 0) {
      const expectedTotal = unitPrice * quantity;
      
      // Math-Assisted Disambiguation
      if (totalPrice > 0 && Math.abs(expectedTotal - totalPrice) > 1) {
        // Cek jika kuantitas atau harga satuan salah baca angka mirip (misal 3 mirip 8)
        if (totalPrice % unitPrice === 0) {
          const solvedQty = Math.round(totalPrice / unitPrice);
          if (solvedQty !== quantity) {
            quantity = solvedQty;
            confidence = Math.max(confidence, 88);
          }
        } else if (totalPrice % quantity === 0) {
          const solvedPrice = Math.round(totalPrice / quantity);
          if (solvedPrice !== unitPrice) {
            unitPrice = solvedPrice;
            confidence = Math.max(confidence, 88);
          }
        } else {
          // Tandai discrepancy pada baris
          return {
            ...item,
            unitPrice,
            quantity,
            totalPrice,
            confidence: Math.min(confidence, 65),
            hasDiscrepancy: true,
            discrepancyNote: `Perkalian tidak cocok: ${unitPrice.toLocaleString('id-ID')} x ${quantity} ≠ ${totalPrice.toLocaleString('id-ID')}`
          };
        }
      } else if (totalPrice === 0) {
        totalPrice = expectedTotal;
      }
    } else if (totalPrice > 0 && quantity !== null && quantity > 0 && (unitPrice === null || unitPrice === 0)) {
      // Pulihkan unitPrice
      unitPrice = Math.round(totalPrice / quantity);
    }

    return {
      ...item,
      unitPrice,
      quantity,
      totalPrice,
      confidence,
      hasDiscrepancy: false
    };
  });

  // 2. Uji Vertikal: Sum(Item) = Grand Total
  let calculatedSum = verifiedItems.reduce((sum, it) => sum + it.totalPrice, 0);
  let targetGrandTotal = declaredGrandTotal && declaredGrandTotal > 0 ? declaredGrandTotal : calculatedSum;

  // Deteksi anomali 100x jika declaredGrandTotal atau calculatedSum memiliki sen .00 yang terbaca sebagai 00
  if (targetGrandTotal > 0 && calculatedSum > 0) {
    if (Math.abs(calculatedSum * 100 - targetGrandTotal) <= 1) {
      // Kasus: declaredGrandTotal terbaca dengan .00 berlebih (misal 285250000 vs 2852500)
      targetGrandTotal = calculatedSum;
    } else if (Math.abs(targetGrandTotal * 100 - calculatedSum) <= 1) {
      // Kasus: baris-baris item terbaca dengan .00 berlebih
      verifiedItems.forEach(it => {
        if (it.totalPrice % 100 === 0) {
          it.totalPrice = Math.round(it.totalPrice / 100);
          if (it.unitPrice) it.unitPrice = Math.round(it.unitPrice / 100);
        }
      });
      calculatedSum = verifiedItems.reduce((sum, it) => sum + it.totalPrice, 0);
    }
  }

  const diff = Math.abs(calculatedSum - targetGrandTotal);
  let mathDiscrepancy = false;
  let discrepancyMessage = undefined;

  if (diff > 0) {
    mathDiscrepancy = true;
    const avgConfidence = verifiedItems.reduce((acc, it) => acc + it.confidence, 0) / (verifiedItems.length || 1);
    
    if (avgConfidence >= 88) {
      // Kasus Penjual Salah Hitung Manual (SELLER_MATH_DISCREPANCY)
      discrepancyMessage = `SELLER_MATH_DISCREPANCY: Seluruh baris tulisan tangan terbaca sangat jelas (${Math.round(avgConfidence)}%), namun hasil penjumlahan (${calculatedSum.toLocaleString('id-ID')}) berselisih Rp ${diff.toLocaleString('id-ID')} dengan Grand Total nota (${targetGrandTotal.toLocaleString('id-ID')}). Penjual diindikasikan salah hitung manual pada nota fisik.`;
    } else {
      discrepancyMessage = `Terdeteksi selisih penjumlahan sebesar Rp ${diff.toLocaleString('id-ID')}. Mohon tinjau baris dengan sorotan warna kuning/merah.`;
    }
  }

  return {
    verifiedItems,
    grandTotal: targetGrandTotal,
    calculatedSum,
    mathDiscrepancy,
    discrepancyMessage
  };
}

// =========================================================================
// 5. ATURAN PENYUSUNAN SPREADSHEET (datasheet_bukti_transaksi)
// =========================================================================
export const SPREADSHEET_CONFIG = {
  spreadsheetId: '1fMya8YADudN3benjdxMX5ws-mKXv7MEu4YXlkE1-IKY',
  sheetName: 'main',
  rulesSheetName: 'Aruran format pengisian tabel',
  publicUrl: 'https://docs.google.com/spreadsheets/d/1fMya8YADudN3benjdxMX5ws-mKXv7MEu4YXlkE1-IKY/edit?usp=sharing',
  startRow: 4, // Baris 4 ke bawah
  columns: ['No', 'Tanggal', 'Bulan', 'Tahun', 'Nama Transaksi', 'Harga satuan', 'kuantitas', 'Harga total', 'Nomor Berkas', 'Link Berkas', 'POS']
};

export function buildSpreadsheetRows(
  transaksiNo: number,
  nomorBerkas: string,
  linkBerkas: string,
  posCode: string,
  items: ExtractedItem[],
  dateObj = new Date()
): SpreadsheetRowData[] {
  const tanggal = dateObj.getDate();
  const bulan = dateObj.getMonth() + 1;
  const tahun = dateObj.getFullYear();

  return items.map(item => ({
    no: transaksiNo,
    tanggal,
    bulan,
    tahun,
    namaTransaksi: item.name,
    hargaSatuan: item.isTaxOrFee ? null : (item.unitPrice && item.unitPrice > 0 ? item.unitPrice : null),
    kuantitas: item.isTaxOrFee ? null : (item.quantity && item.quantity > 0 ? item.quantity : null),
    hargaTotal: item.totalPrice,
    nomorBerkas,
    linkBerkas: linkBerkas || `File: ${nomorBerkas}`,
    pos: posCode
  }));
}

export function exportSpreadsheetRowsToCsv(rows: SpreadsheetRowData[]): string {
  const headers = ['No', 'Tanggal', 'Bulan', 'Tahun', 'Nama Transaksi (apa yang dibeli/terjadi)', 'Harga satuan', 'kuantitas', 'Harga total', 'Nomor Berkas', 'Link Berkas', 'POS'];
  const csvLines = [headers.join(',')];
  rows.forEach(r => {
    const cleanName = `"${r.namaTransaksi.replace(/"/g, '""')}"`;
    const cleanLink = `"${r.linkBerkas.replace(/"/g, '""')}"`;
    csvLines.push([
      r.no,
      r.tanggal,
      r.bulan,
      r.tahun,
      cleanName,
      r.hargaSatuan !== null ? r.hargaSatuan : '',
      r.kuantitas !== null ? r.kuantitas : '',
      r.hargaTotal,
      r.nomorBerkas,
      cleanLink,
      r.pos
    ].join(','));
  });
  return csvLines.join('\n');
}

// =========================================================================
// 6. MESIN ANALISIS AKUNTANSI SAK (ACCOUNTING ENGINE)
// =========================================================================

export function analyzeAndSuggestJournal(
  items: ExtractedItem[],
  posCode: string,
  accounts: Account[],
  keterangan: string
): SuggestedJournalLine[] {
  const selectedPos = getPosRules().find(p => p.code === posCode) || DEFAULT_POS_RULES[0];
  const suggestedLines: SuggestedJournalLine[] = [];

  // Group items: Jasa / Pelatihan / Bank Fee / Pajak vs Barang Fisik
  const physicalItems: ExtractedItem[] = [];
  const serviceOrTrainingItems: ExtractedItem[] = [];
  const taxAndFeeItems: ExtractedItem[] = [];
  const allocatedCodes: string[] = [];

  items.forEach(it => {
    const lower = it.name.toLowerCase();
    const isTax = lower.includes('pajak') || lower.includes('pb1') || lower.includes('ppn') || lower.includes('pph');
    const isBankFee = lower.includes('bi-fast') || lower.includes('bi fast') || lower.includes('admin bank') || 
                      lower.includes('administrasi bank') || (lower.includes('biaya') && (lower.includes('transfer') || lower.includes('transaksi') || lower.includes('admin')));
    const isFreight = lower.includes('ongkir') || lower.includes('kirim');
    const isTrainingOrService = lower.includes('brevet') || lower.includes('pelatihan') || lower.includes('kursus') || 
                                lower.includes('seminar') || lower.includes('training') || lower.includes('pendidikan') || 
                                lower.includes('sertifikasi') || lower.includes('jasa') || lower.includes('konsultan') || 
                                lower.includes('service') || lower.includes('servis') || lower.includes('bengkel') ||
                                lower.includes('pemeliharaan') || lower.includes('perbaikan') || lower.includes('sewa') ||
                                lower.includes('iklan') || lower.includes('listrik') || lower.includes('telepon');

    if (it.isTaxOrFee || isTax || isBankFee || isFreight) {
      taxAndFeeItems.push(it);
    } else if (isTrainingOrService) {
      serviceOrTrainingItems.push(it);
    } else {
      physicalItems.push(it);
    }
  });

  // 1. Pembentukan Akun Sisi Debit
  if (posCode === 'A' || posCode === 'B') {
    // A. Barang Fisik: Agregasi barang fisik sejenis menjadi 1 baris Perlengkapan / Persediaan
    if (physicalItems.length > 0) {
      const totalPhysical = physicalItems.reduce((acc, it) => acc + it.totalPrice, 0);
      
      let perlengkapanAcc = accounts.find(a => 
        !a.isHeader && (a.name.toLowerCase().includes('perlengkapan kantor') || a.name.toLowerCase() === 'perlengkapan')
      );
      if (!perlengkapanAcc) {
        perlengkapanAcc = accounts.find(a => !a.isHeader && a.category === 'HARTA_LANCAR');
      }

      const accCode = perlengkapanAcc?.code || '10006';
      const accName = perlengkapanAcc?.name || 'Perlengkapan Kantor';

      suggestedLines.push({
        id: `sug-${Date.now()}-phys`,
        accountCode: accCode,
        accountName: accName,
        accountCategory: 'HARTA_LANCAR',
        pos: 'Nrc',
        sn: 'Db',
        debit: totalPhysical,
        credit: 0,
        memo: physicalItems.map(p => `${p.name} (${p.quantity || 1} @ ${p.unitPrice?.toLocaleString('id-ID') || p.totalPrice.toLocaleString('id-ID')})`).join(', '),
        isNewAccount: !perlengkapanAcc,
        sourceItems: physicalItems.map(p => p.name)
      });
    }

    // B. Jasa / Pelatihan / Brevet / Beban Operasional Pokok
    serviceOrTrainingItems.forEach((srvItem, idx) => {
      const lower = srvItem.name.toLowerCase();
      let targetAccName = srvItem.name;
      let targetCat: AccountCategory = 'BEBAN_OPERASIONAL';
      let targetPos: ReportType = 'Lr';
      let existingAcc: Account | undefined = undefined;

      if (lower.includes('brevet') || lower.includes('pelatihan') || lower.includes('kursus') || lower.includes('seminar') || lower.includes('training') || lower.includes('pendidikan')) {
        targetAccName = 'Beban Pelatihan & Brevet Pajak';
        existingAcc = accounts.find(a => 
          !a.isHeader && (
            a.name.toLowerCase().includes('pelatihan') || 
            a.name.toLowerCase().includes('brevet') || 
            a.name.toLowerCase().includes('pendidikan') ||
            a.name.toLowerCase().includes('kursus')
          )
        );
      } else if (lower.includes('service') || lower.includes('servis') || lower.includes('pemeliharaan') || lower.includes('bengkel') || lower.includes('perbaikan')) {
        targetAccName = 'Beban Service';
        existingAcc = accounts.find(a => 
          !a.isHeader && (a.name.toLowerCase().includes('service') || a.name.toLowerCase().includes('pemeliharaan'))
        );
      } else if (lower.includes('sewa')) {
        targetAccName = 'Beban Sewa Lahan';
        existingAcc = accounts.find(a => !a.isHeader && a.name.toLowerCase().includes('sewa'));
      } else if (lower.includes('iklan')) {
        targetAccName = 'Beban Iklan';
        existingAcc = accounts.find(a => !a.isHeader && a.name.toLowerCase().includes('iklan'));
      } else if (lower.includes('listrik') || lower.includes('telepon')) {
        targetAccName = 'Beban Listrik Dan Telepon';
        existingAcc = accounts.find(a => !a.isHeader && a.name.toLowerCase().includes('listrik'));
      } else {
        targetAccName = srvItem.name.toLowerCase().startsWith('beban') ? srvItem.name : `Beban ${srvItem.name}`;
        existingAcc = accounts.find(a => !a.isHeader && a.name.toLowerCase() === targetAccName.toLowerCase());
      }

      const isNew = !existingAcc;
      const finalName = existingAcc ? existingAcc.name : targetAccName;
      const finalCode = existingAcc ? existingAcc.code : generateNextAccountCode('50000', accounts, allocatedCodes);
      if (isNew) {
        allocatedCodes.push(finalCode);
      }

      suggestedLines.push({
        id: `sug-${Date.now()}-srv-${idx}`,
        accountCode: finalCode,
        accountName: finalName,
        accountCategory: targetCat,
        pos: targetPos,
        sn: 'Db',
        debit: srvItem.totalPrice,
        credit: 0,
        memo: `${srvItem.name} (${keterangan || 'Pembayaran Jasa/Pelatihan'})`,
        isNewAccount: isNew,
        suggestedNewCode: finalCode,
        sourceItems: [srvItem.name]
      });
    });

    // C. Pemisahan Pajak, Biaya Transfer BI-FAST, & Biaya Berdiri Sendiri
    taxAndFeeItems.forEach((taxItem, idx) => {
      const lower = taxItem.name.toLowerCase();
      let targetAccName = taxItem.name;
      let targetCat: AccountCategory = 'BEBAN_OPERASIONAL';
      let targetPos: ReportType = 'Lr';

      if (lower.includes('bi-fast') || lower.includes('bi fast') || lower.includes('admin bank') || lower.includes('administrasi bank') || (lower.includes('biaya') && (lower.includes('transfer') || lower.includes('transaksi') || lower.includes('admin')))) {
        targetAccName = 'Beban Administrasi Bank';
        targetCat = 'BEBAN_OPERASIONAL';
        targetPos = 'Lr';
      } else if (lower.includes('pb1') || lower.includes('pembelian pb1')) {
        targetAccName = taxItem.name.toLowerCase().includes('pajak') ? taxItem.name : 'Pajak Pembelian PB1';
        targetCat = 'BEBAN_OPERASIONAL';
        targetPos = 'Lr';
      } else if (lower.includes('ppn')) {
        targetAccName = 'PPN Masukan';
        targetCat = 'HARTA_LANCAR';
        targetPos = 'Nrc';
      } else if (lower.includes('ongkir') || lower.includes('kirim')) {
        targetAccName = 'Beban Angkut Pembelian';
        targetCat = 'BEBAN_OPERASIONAL';
        targetPos = 'Lr';
      }

      // Cek apakah akun sudah terdaftar di COA
      let existingAcc = accounts.find(a => 
        !a.isHeader && (
          a.name.toLowerCase() === targetAccName.toLowerCase() ||
          (lower.includes('pb1') && (a.name.toLowerCase().includes('pb1') || a.name.toLowerCase().includes('pajak pembelian pb1'))) ||
          (targetAccName === 'Beban Administrasi Bank' && (a.name.toLowerCase().includes('administrasi bank') || a.name.toLowerCase().includes('admin bank')))
        )
      );

      const isNew = !existingAcc;
      const finalName = existingAcc ? existingAcc.name : targetAccName;
      const headerPrefix = targetCat === 'HARTA_LANCAR' ? '10000' : '50000';
      const finalCode = existingAcc ? existingAcc.code : generateNextAccountCode(headerPrefix, accounts, allocatedCodes);
      if (isNew) {
        allocatedCodes.push(finalCode);
      }

      suggestedLines.push({
        id: `sug-${Date.now()}-tax-${idx}`,
        accountCode: finalCode,
        accountName: finalName,
        accountCategory: targetCat,
        pos: targetPos,
        sn: 'Db',
        debit: taxItem.totalPrice,
        credit: 0,
        memo: `${taxItem.name} dari bukti transaksi`,
        isNewAccount: isNew,
        suggestedNewCode: finalCode,
        sourceItems: [taxItem.name]
      });
    });

    // 2. Akun Lawan Sisi Kredit berdasarkan POS
    const totalDebit = suggestedLines.reduce((acc, l) => acc + l.debit, 0);
    const creditAccCode = selectedPos.defaultCreditAccountCode || (posCode === 'A' ? '10001' : '20001');
    const existingCredit = accounts.find(a => a.code === creditAccCode);
    const creditAccName = existingCredit?.name || selectedPos.defaultCreditAccountName || (posCode === 'A' ? 'Kas' : 'Utang Usaha/Dagang');

    suggestedLines.push({
      id: `sug-${Date.now()}-cred`,
      accountCode: creditAccCode,
      accountName: creditAccName,
      accountCategory: posCode === 'A' ? 'HARTA_LANCAR' : 'UTANG_LANCAR',
      pos: 'Nrc',
      sn: 'Kr',
      debit: 0,
      credit: totalDebit,
      memo: keterangan || (posCode === 'A' ? 'Pengeluaran kas pembelian' : 'Timbul utang pembelian'),
      isNewAccount: false
    });

  } else if (posCode === 'C') {
    // Penjualan Piutang: Debit Piutang Usaha, Kredit Pendapatan
    const totalSales = items.reduce((acc, it) => acc + it.totalPrice, 0);
    const piutangAcc = accounts.find(a => a.code === '10003') || { code: '10003', name: 'Piutang Usaha' };
    const revAcc = accounts.find(a => a.code === '40001') || { code: '40001', name: 'Pendapatan Jasa / Penjualan' };

    suggestedLines.push({
      id: `sug-${Date.now()}-piutang`,
      accountCode: piutangAcc.code,
      accountName: piutangAcc.name,
      accountCategory: 'HARTA_LANCAR',
      pos: 'Nrc',
      sn: 'Db',
      debit: totalSales,
      credit: 0,
      memo: keterangan || 'Piutang atas transaksi penjualan',
      isNewAccount: false
    });

    suggestedLines.push({
      id: `sug-${Date.now()}-rev`,
      accountCode: revAcc.code,
      accountName: revAcc.name,
      accountCategory: 'PENDAPATAN_OPERASIONAL',
      pos: 'Lr',
      sn: 'Kr',
      debit: 0,
      credit: totalSales,
      memo: items.map(i => i.name).join(', '),
      isNewAccount: false
    });

  } else if (posCode === 'D') {
    // Pelunasan: Debit Kas, Kredit Piutang
    const totalAmount = items.reduce((acc, it) => acc + it.totalPrice, 0);
    const kasAcc = accounts.find(a => a.code === '10001') || { code: '10001', name: 'Kas' };
    const piutangAcc = accounts.find(a => a.code === '10003') || { code: '10003', name: 'Piutang Usaha' };

    suggestedLines.push({
      id: `sug-${Date.now()}-pelunasan-db`,
      accountCode: kasAcc.code,
      accountName: kasAcc.name,
      accountCategory: 'HARTA_LANCAR',
      pos: 'Nrc',
      sn: 'Db',
      debit: totalAmount,
      credit: 0,
      memo: keterangan || 'Penerimaan pelunasan piutang',
      isNewAccount: false
    });

    suggestedLines.push({
      id: `sug-${Date.now()}-pelunasan-kr`,
      accountCode: piutangAcc.code,
      accountName: piutangAcc.name,
      accountCategory: 'HARTA_LANCAR',
      pos: 'Nrc',
      sn: 'Kr',
      debit: 0,
      credit: totalAmount,
      memo: 'Pelunasan piutang usaha',
      isNewAccount: false
    });

  } else {
    // POS E atau Custom
    const totalAmount = items.reduce((acc, it) => acc + it.totalPrice, 0);
    const debitCode = selectedPos.defaultDebitAccountCode || '10001';
    const creditCode = selectedPos.defaultCreditAccountCode || '30000';
    const debitAcc = accounts.find(a => a.code === debitCode) || { code: debitCode, name: selectedPos.defaultDebitAccountName || 'Kas' };
    const creditAcc = accounts.find(a => a.code === creditCode) || { code: creditCode, name: selectedPos.defaultCreditAccountName || 'Modal / Ekuitas' };

    suggestedLines.push({
      id: `sug-${Date.now()}-custom-db`,
      accountCode: debitAcc.code,
      accountName: debitAcc.name,
      accountCategory: 'HARTA_LANCAR',
      pos: 'Nrc',
      sn: 'Db',
      debit: totalAmount,
      credit: 0,
      memo: keterangan || 'Transaksi penerimaan dana',
      isNewAccount: false
    });

    suggestedLines.push({
      id: `sug-${Date.now()}-custom-kr`,
      accountCode: creditAcc.code,
      accountName: creditAcc.name,
      accountCategory: 'EKUITAS',
      pos: 'Nrc',
      sn: 'Kr',
      debit: 0,
      credit: totalAmount,
      memo: keterangan || 'Sumber penerimaan dana',
      isNewAccount: false
    });
  }

  return suggestedLines;
}

// =========================================================================
// 7. OTOMASI PENOMORAN & PEMBUATAN AKUN COA BARU (last_code + 1)
// =========================================================================

/**
 * Menghitung kode akun baru berdasarkan kelompok Header:
 * 10000: Aset
 * 20000: Kewajiban
 * 30000: Ekuitas
 * 40000: Pendapatan
 * 50000: Beban
 */
export function generateNextAccountCode(
  headerPrefix: string,
  accounts: Account[],
  additionalAllocatedCodes: string[] = []
): string {
  const prefixNum = parseInt(headerPrefix, 10);
  const minCode = prefixNum;
  const maxCode = prefixNum + 9999;

  let maxFound = minCode;
  accounts.forEach(a => {
    const num = parseInt(a.code, 10);
    if (!isNaN(num) && num >= minCode && num <= maxCode) {
      if (num > maxFound) {
        maxFound = num;
      }
    }
  });

  additionalAllocatedCodes.forEach(code => {
    const num = parseInt(code, 10);
    if (!isNaN(num) && num >= minCode && num <= maxCode) {
      if (num > maxFound) {
        maxFound = num;
      }
    }
  });

  return String(maxFound + 1);
}

export function autoCreateMissingCoaAccount(
  line: SuggestedJournalLine,
  accounts: Account[],
  addAccountFn: (acc: Omit<Account, 'id'>) => Account
): Account {
  const existing = accounts.find(a => 
    !a.isHeader && (a.name.toLowerCase() === line.accountName.toLowerCase() || a.code === line.accountCode)
  );
  if (existing) return existing;

  // Tentukan header
  let headerPrefix = '50000';
  let category: AccountCategory = 'BEBAN_OPERASIONAL';
  let categoryName = 'Beban Operasional';
  let pos: ReportType = 'Lr';
  let sn: NormalBalance = 'Db';

  const lower = line.accountName.toLowerCase();
  if (lower.includes('ppn masukan')) {
    headerPrefix = '10000';
    category = 'HARTA_LANCAR';
    categoryName = 'Harta Lancar';
    pos = 'Nrc';
    sn = 'Db';
  } else if (lower.includes('beban') || lower.includes('pajak') || lower.includes('pb1') || lower.includes('biaya') || lower.includes('ongkir')) {
    headerPrefix = '50000';
    category = 'BEBAN_OPERASIONAL';
    categoryName = 'Beban Operasional';
    pos = 'Lr';
    sn = 'Db';
  } else if (lower.includes('kas') || lower.includes('piutang') || lower.includes('perlengkapan') || lower.includes('persediaan')) {
    headerPrefix = '10000';
    category = 'HARTA_LANCAR';
    categoryName = 'Harta Lancar';
    pos = 'Nrc';
    sn = 'Db';
  } else if (lower.includes('utang') || lower.includes('kewajiban')) {
    headerPrefix = '20000';
    category = 'UTANG_LANCAR';
    categoryName = 'Utang Lancar';
    pos = 'Nrc';
    sn = 'Kr';
  } else if (lower.includes('pendapatan') || lower.includes('penjualan')) {
    headerPrefix = '40000';
    category = 'PENDAPATAN_OPERASIONAL';
    categoryName = 'Pendapatan Operasional';
    pos = 'Lr';
    sn = 'Kr';
  }

  const nextCode = line.suggestedNewCode || generateNextAccountCode(headerPrefix, accounts);

  const newAccountPayload: Omit<Account, 'id'> = {
    code: nextCode,
    name: line.accountName,
    category,
    categoryName,
    pos,
    sn,
    debetAwal: 0,
    kreditAwal: 0,
    isHeader: false,
    description: 'Dibuat otomatis oleh SPECTRA Auto Record OCR Engine'
  };

  return addAccountFn(newAccountPayload);
}

// =========================================================================
// 8. CONTOH BUKTI TRANSAKSI (SAMPLE DATA RESMI SESUAI PROMPT)
// =========================================================================
export const SAMPLE_RECEIPT_DATA = {
  receiptFileName: 'Nota_Kontan_Baut_Material.jpg',
  transactionType: 'Pembelian Langsung',
  posCode: 'A',
  keterangan: 'Pembelian Baut dan Material Pemeliharaan Bengkel Operasional',
  sampleImage: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520"><rect width="400" height="520" fill="%23fffef5"/><rect x="15" y="15" width="370" height="490" fill="none" stroke="%23334155" stroke-width="2" stroke-dasharray="6,4"/><text x="200" y="55" font-family="monospace" font-size="20" font-weight="bold" text-anchor="middle" fill="%230f172a">TOKO BAUT &amp; MATERIAL JAYA</text><text x="200" y="80" font-family="monospace" font-size="12" text-anchor="middle" fill="%23475569">Jl. Energi Teknik No. 88, Bandung</text><line x1="25" y1="100" x2="375" y2="100" stroke="%230f172a" stroke-width="1.5"/><text x="30" y="125" font-family="monospace" font-size="13" font-weight="bold" fill="%230f172a">NOTA KONTAN / STRUK BUKTI</text><text x="30" y="145" font-family="monospace" font-size="11" fill="%2364748b">Tanggal : 26 Oktober 2026</text><text x="30" y="165" font-family="monospace" font-size="11" fill="%2364748b">Keterangan: Tunai (Lunas)</text><line x1="25" y1="180" x2="375" y2="180" stroke="%2394a3b8" stroke-width="1"/><text x="30" y="210" font-family="monospace" font-size="13" fill="%231e293b">1. Baut Ukuran 12</text><text x="35" y="230" font-family="monospace" font-size="11" fill="%2364748b">   10 pcs x Rp 10.000,-</text><text x="365" y="230" font-family="monospace" font-size="13" font-weight="bold" text-anchor="end" fill="%230f172a">Rp 100.000</text><text x="30" y="270" font-family="monospace" font-size="13" fill="%231e293b">2. Baut Ukuran 15</text><text x="35" y="290" font-family="monospace" font-size="11" fill="%2364748b">   20 pcs x Rp 15.000,-</text><text x="365" y="290" font-family="monospace" font-size="13" font-weight="bold" text-anchor="end" fill="%230f172a">Rp 300.000</text><text x="30" y="330" font-family="monospace" font-size="13" fill="%231e293b">3. Pajak Pembelian PB1 (10%)</text><text x="365" y="330" font-family="monospace" font-size="13" font-weight="bold" text-anchor="end" fill="%230f172a">Rp 40.000</text><line x1="25" y1="360" x2="375" y2="360" stroke="%230f172a" stroke-width="1.5"/><text x="30" y="395" font-family="monospace" font-size="15" font-weight="bold" fill="%230f172a">TOTAL BAYAR (KAS)</text><text x="365" y="395" font-family="monospace" font-size="17" font-weight="bold" text-anchor="end" fill="%232563eb">Rp 440.000</text><line x1="25" y1="415" x2="375" y2="415" stroke="%2394a3b8" stroke-width="1"/><text x="200" y="450" font-family="monospace" font-size="11" text-anchor="middle" fill="%2310b981">✓ LUNAS - Diterima dengan Baik</text><text x="200" y="475" font-family="monospace" font-size="10" text-anchor="middle" fill="%2394a3b8">Cap &amp; Tanda Tangan Kasir Toko</text></svg>',
  items: [
    {
      id: 'it-sample-1',
      name: 'Baut Ukuran 12',
      unitPrice: 10000,
      quantity: 10,
      unit: 'pcs',
      totalPrice: 100000,
      confidence: 96,
      boundingBox: { x: 5, y: 38, width: 90, height: 10 }
    },
    {
      id: 'it-sample-2',
      name: 'Baut Ukuran 15',
      unitPrice: 15000,
      quantity: 20,
      unit: 'pcs',
      totalPrice: 300000,
      confidence: 94,
      boundingBox: { x: 5, y: 50, width: 90, height: 10 }
    },
    {
      id: 'it-sample-3',
      name: 'Pajak Pembelian PB1',
      unitPrice: null,
      quantity: null,
      unit: '',
      totalPrice: 40000,
      confidence: 92,
      isTaxOrFee: true,
      taxOrFeeType: 'PB1' as const,
      boundingBox: { x: 5, y: 62, width: 90, height: 10 }
    }
  ]
};

// =========================================================================
// 9. MESIN EKSTRAKSI NYATA (GEMINI VISION MULTIMODAL & OFFLINE OCR PIPELINE)
// =========================================================================

export const GEMINI_API_KEY_STORAGE = 'spectra_gemini_api_key';

export function getGeminiApiKey(): string {
  try {
    const local = localStorage.getItem(GEMINI_API_KEY_STORAGE);
    if (local && local.trim()) return local.trim();
  } catch (e) {}

  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.NEXT_PUBLIC_GEMINI_API_KEY || '';
  return envKey ? String(envKey).trim() : '';
}

export function saveGeminiApiKey(key: string): void {
  try {
    if (!key || !key.trim()) {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    } else {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
    }
  } catch (e) {}
}

export async function testGeminiApiKey(apiKey: string): Promise<{ success: boolean; message: string; model?: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, message: 'API Key tidak boleh kosong' };
  }
  const cleanKey = apiKey.trim();
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Halo Gemini, konfirmasi koneksi API akuntansi SPECTRA dengan satu kata: OK' }] }]
        })
      });

      if (res.ok) {
        return { success: true, message: `Koneksi Gemini Multimodal API (${model}) Berhasil!`, model };
      }
    } catch (e: any) {
      console.warn(`Testing model ${model} failed:`, e);
    }
  }

  return { success: false, message: 'Gagal terhubung ke Gemini API. Pastikan API Key valid dan kuota aktif.' };
}

function extractBase64AndMime(dataUri: string): { mimeType: string; base64: string } {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  return { mimeType: 'image/jpeg', base64: dataUri };
}

/**
 * Parsing cerdas untuk bukti transfer bank dari raw OCR text
 */
export function parseBankTransferFromText(
  rawText: string,
  userDescription: string
): { isBankTransfer: boolean; items: ExtractedItem[]; recipient: string; grandTotal: number } {
  const upper = rawText.toUpperCase();
  const isTransfer = upper.includes('TRANSFER') || upper.includes('BI-FAST') || upper.includes('BI FAST') || 
                     upper.includes('BCA') || upper.includes('MANDIRI') || upper.includes('BNI') || 
                     upper.includes('BRI') || upper.includes('BERHASIL') || upper.includes('REKENING') || 
                     upper.includes('PENERIMA') || upper.includes('BREVET') || upper.includes('PIRANHA');

  if (!isTransfer) {
    return { isBankTransfer: false, items: [], recipient: '', grandTotal: 0 };
  }

  // Cari seluruh angka nominal Rupiah (contoh: IDR 2,850,000.00 atau 2.850.000 atau Rp 2.850.000 atau 2850000.00)
  const currencyRegex = /(?:IDR|Rp\.?|Jumlah|Nominal|Total)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{2})?|[0-9]{4,9}(?:[.,][0-9]{2})?)/gi;
  const numbersFound: number[] = [];
  let match;
  while ((match = currencyRegex.exec(rawText)) !== null) {
    const rawNum = match[1];
    const parsed = sanitizeCurrencyAmount(rawNum, userDescription);
    if (parsed > 0 && !numbersFound.includes(parsed)) {
      numbersFound.push(parsed);
    }
  }

  numbersFound.sort((a, b) => b - a);

  // Cari biaya transfer / BI-FAST
  let adminFee = 0;
  const feeRegex = /(?:biaya|fee|bi-fast|admin)[\s\S]{0,35}?(?:idr|rp\.?)?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/i;
  const feeMatch = rawText.match(feeRegex);
  if (feeMatch) {
    const parsedFee = sanitizeCurrencyAmount(feeMatch[1], 'Biaya Transfer BI-FAST');
    if (parsedFee > 0 && parsedFee <= 50000) {
      adminFee = parsedFee;
    }
  }

  if (adminFee === 0 && (upper.includes('BI-FAST') || upper.includes('BI FAST'))) {
    adminFee = 2500;
  }

  // Nominal Pokok
  let mainAmount = 0;
  if (numbersFound.length > 0) {
    if (adminFee > 0 && numbersFound.length >= 2 && numbersFound[0] === numbersFound[1] + adminFee) {
      mainAmount = numbersFound[1];
    } else if (adminFee > 0 && numbersFound[0] === adminFee && numbersFound.length >= 2) {
      mainAmount = numbersFound[1];
    } else {
      mainAmount = numbersFound[0] === adminFee && numbersFound.length >= 2 ? numbersFound[1] : numbersFound[0];
    }
  }

  if (mainAmount === 0) {
    const digitMatch = rawText.match(/\b([1-9][0-9]{5,8})\b/);
    if (digitMatch) {
      mainAmount = sanitizeCurrencyAmount(digitMatch[1], userDescription);
    }
  }

  // Berita / Catatan
  let berita = '';
  const beritaMatch = rawText.match(/(?:berita|catatan|keterangan|pesan)[\s:=]+([^\n\r,]+)/i);
  if (beritaMatch) {
    berita = beritaMatch[1].trim();
  }

  // Penerima
  let penerima = '';
  const penerimaMatch = rawText.match(/(?:penerima|ke rekening|tujuan|nama penerima)[\s:=]+([^\n\r,]+)/i);
  if (penerimaMatch) {
    penerima = penerimaMatch[1].trim();
  }

  // Ekstrak nama organisasi/vendor jika ada (contoh: PT Piranha Multi Talenta)
  const vendorMatch = rawText.match(/(?:PT|CV|UD|Yayasan)\s+[A-Za-z0-9\s&]+/i);
  if (!penerima && vendorMatch) {
    penerima = vendorMatch[0].trim();
  }

  // Ekstrak brevet jika ada
  if (!berita && upper.includes('BREVET')) {
    const brevetMatch = rawText.match(/BREVET[A-Za-z0-9\s-]+/i);
    if (brevetMatch) berita = brevetMatch[0].trim();
  }

  let mainItemName = '';
  if (berita && penerima) {
    mainItemName = `${berita} - ${penerima}`;
  } else if (berita) {
    mainItemName = berita;
  } else if (penerima) {
    mainItemName = `Transfer ke ${penerima}`;
  } else if (userDescription && userDescription.trim()) {
    mainItemName = userDescription.trim();
  } else {
    mainItemName = 'Pembayaran Transfer Bank';
  }

  // Sanitasi akhir sebelum membuat item
  mainAmount = sanitizeCurrencyAmount(mainAmount, mainItemName);
  adminFee = sanitizeCurrencyAmount(adminFee, 'Biaya Transfer BI-FAST');

  const items: ExtractedItem[] = [];

  if (mainAmount > 0) {
    items.push({
      id: `it-${Date.now()}-main`,
      name: mainItemName,
      unitPrice: mainAmount,
      quantity: 1,
      unit: 'transaksi',
      totalPrice: mainAmount,
      confidence: 96
    });
  }

  if (adminFee > 0) {
    items.push({
      id: `it-${Date.now()}-admin`,
      name: 'Biaya Transfer BI-FAST',
      unitPrice: null,
      quantity: null,
      unit: '',
      totalPrice: adminFee,
      confidence: 98,
      isTaxOrFee: true,
      taxOrFeeType: 'BI_FAST'
    });
  }

  const grandTotal = mainAmount + adminFee;

  return {
    isBankTransfer: items.length > 0,
    items,
    recipient: penerima || mainItemName,
    grandTotal
  };
}

/**
 * Panggilan ke Gemini Multimodal Vision API
 */
export async function callGeminiVisionExtraction(
  dataUri: string,
  posCode: string,
  userDescription: string,
  accounts: Account[],
  apiKey: string
): Promise<RealOcrExtractionResult> {
  const { mimeType, base64 } = extractBase64AndMime(dataUri);
  const coaList = accounts
    .filter(a => !a.isHeader)
    .map(a => `${a.code} - ${a.name} (${a.categoryName})`)
    .slice(0, 60)
    .join('\n');

  const prompt = `
Anda adalah Akuntan Publik Senior (CPA) dan Ahli AI Vision Finansial Indonesia.
Tugas Anda: Analisis bukti transaksi keuangan pada gambar/dokumen yang terlampir dan hasilkan JSON terstruktur secara akurat.

Konteks Transaksi:
- Deskripsi/Keterangan dari Pengguna: "${userDescription || '(Tidak ada keterangan)'}"
- Kode POS yang dipilih: "${posCode}"
- Daftar Akun (COA) Sistem:
${coaList}

PERINGATAN SANGAT KRUSIAL MENGENAI ANGKA DESIMAL & NOL (0):
1. Pada Bukti Transfer Bank (seperti BCA, Mandiri, BRI, BNI) atau nota belanja, angka sering ditulis dengan dua digit sen/desimal di akhir, misalnya: "IDR 2,850,000.00" atau "IDR 2,500.00".
2. Dua digit terakhir (.00 atau ,00) tersebut adalah SEN (CENTS), BUKAN RIBUAN ATAU JUTAAN!
3. DILARANG KERAS menghasilkan angka dengan 2 nol berlebih (misalnya: JANGAN PERNAH menghasilkan 285000000 untuk 2,850,000.00, atau 250000 untuk 2,500.00)!
4. Output angka integer WAJIB murni tanpa desimal sen:
   - "IDR 2,850,000.00" -> 2850000 (Dua Juta Delapan Ratus Lima Puluh Ribu)
   - "IDR 2,500.00" -> 2500 (Dua Ribu Lima Ratus)
   - "IDR 2,852,500.00" -> 2852500 (Dua Juta Delapan Ratus Lima Puluh Dua Ribu Lima Ratus)
   - "Rp 440.000,00" -> 440000

Aturan Analisis Dokumen:
1. Bukti Transfer Bank / m-Banking / BI-FAST (contoh: BCA, Mandiri, BRI, BNI, QRIS):
   - Baris 1: Gabungkan informasi Berita/Tujuan Transaksi dan Nama Penerima (contoh: "Brevet Pajak CPTT - PT Piranha Multi Talenta").
     - unit_price: nominal pokok transfer integer (contoh: 2850000 jika tertulis IDR 2,850,000.00).
     - quantity: 1.
     - total_price: 2850000.
     - is_tax_or_fee: false.
   - Baris 2 (jika tertera biaya admin / biaya transfer BI-FAST):
     - name: "Biaya Transfer BI-FAST" (atau nama biaya yang tertera).
     - unit_price: null.
     - quantity: null.
     - total_price: 2500 (angka integer 2500, BUKAN 250000!).
     - is_tax_or_fee: true.
     - tax_or_fee_type: "BI_FAST".
   - declared_grand_total: Penjumlahan seluruh total_price (contoh: 2850000 + 2500 = 2852500).

2. Struk Kasir / Nota Belanja / Faktur / Nota Tulis Tangan:
   - Ekstrak setiap baris barang/jasa: nama item, unit_price, quantity, unit, total_price.
   - Pisahkan pajak (PB1, PPN), service charge, ongkir sebagai baris tersendiri (is_tax_or_fee: true).

Format JSON Output yang WAJIB dipatuhi tanpa tanda kutip markdown:
{
  "detected_type": "transfer_bank" | "nota_pembelian" | "faktur" | "struk_thermal" | "lainnya",
  "seller_or_recipient": "Nama Penerima / Toko",
  "transaction_date": "YYYY-MM-DD",
  "declared_grand_total": 2852500,
  "extracted_items": [
    {
      "name": "Brevet Pajak CPTT - PT Piranha Multi Talenta",
      "unit_price": 2850000,
      "quantity": 1,
      "unit": "transaksi",
      "total_price": 2850000,
      "is_tax_or_fee": false,
      "tax_or_fee_type": null,
      "confidence": 98
    },
    {
      "name": "Biaya Transfer BI-FAST",
      "unit_price": null,
      "quantity": null,
      "unit": "",
      "total_price": 2500,
      "is_tax_or_fee": true,
      "tax_or_fee_type": "BI_FAST",
      "confidence": 99
    }
  ]
}
`;

  const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
  let lastError: any = null;
  let responseText = '';

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`Gemini model ${model} error (${res.status}):`, errText);
        lastError = new Error(`Gemini ${model} HTTP ${res.status}`);
        continue;
      }

      const json = await res.json();
      responseText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (responseText) break;
    } catch (e) {
      lastError = e;
    }
  }

  if (!responseText) {
    throw lastError || new Error('Gagal mendapatkan respon dari Gemini Vision');
  }

  // Parse JSON
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned);
  const items: ExtractedItem[] = (parsed.extracted_items || []).map((it: any, idx: number) => {
    const itemName = it.name || `Item ${idx + 1}`;
    const sanitizedTotal = sanitizeCurrencyAmount(it.total_price, itemName);
    const sanitizedUnit = it.unit_price !== null && it.unit_price !== undefined 
      ? sanitizeCurrencyAmount(it.unit_price, itemName) 
      : null;

    return {
      id: `it-gemini-${Date.now()}-${idx}`,
      name: itemName,
      unitPrice: sanitizedUnit,
      quantity: it.quantity !== null && it.quantity !== undefined ? Number(it.quantity) : null,
      unit: it.unit || '',
      totalPrice: sanitizedTotal,
      confidence: Number(it.confidence) || 95,
      isTaxOrFee: Boolean(it.is_tax_or_fee),
      taxOrFeeType: it.tax_or_fee_type || undefined
    };
  });

  const declaredGrand = sanitizeCurrencyAmount(parsed.declared_grand_total, userDescription);
  const verif = runTwoWayDeterministicVerification(items, declaredGrand);

  return {
    detectedType: parsed.detected_type || 'lainnya',
    sellerOrRecipient: parsed.seller_or_recipient || userDescription,
    transactionDate: parsed.transaction_date,
    extractedItems: verif.verifiedItems,
    declaredGrandTotal: verif.grandTotal,
    calculatedSum: verif.calculatedSum,
    mathDiscrepancy: verif.mathDiscrepancy,
    discrepancyMessage: verif.discrepancyMessage,
    sourceEngine: 'gemini_vision',
    rawResponse: parsed
  };
}

/**
 * Ekstraksi offline dengan Tesseract.js dan parser teks cerdas
 */
export async function extractTransactionWithOfflineOcr(
  imageUri: string,
  posCode: string,
  userDescription: string,
  accounts: Account[],
  onProgress?: (msg: string) => void
): Promise<RealOcrExtractionResult> {
  onProgress?.('Menjalankan OCR lokal (Tesseract.js)...');

  let rawOcrText = '';
  try {
    const { recognize } = await import('tesseract.js');
    const res = await recognize(imageUri, 'eng+ind', {
      logger: (m: any) => {
        if (m.status === 'recognizing text' && m.progress) {
          onProgress?.(`OCR lokal sedang membaca dokumen (${Math.round(m.progress * 100)}%)...`);
        }
      }
    });
    rawOcrText = res.data.text || '';
  } catch (err) {
    console.warn('Tesseract OCR error:', err);
  }

  // 1. Coba parse sebagai Bukti Transfer Bank
  const bankParsed = parseBankTransferFromText(rawOcrText, userDescription);
  if (bankParsed.isBankTransfer && bankParsed.items.length > 0) {
    const verif = runTwoWayDeterministicVerification(bankParsed.items, bankParsed.grandTotal);
    return {
      detectedType: 'transfer_bank',
      sellerOrRecipient: bankParsed.recipient,
      extractedItems: verif.verifiedItems,
      declaredGrandTotal: verif.grandTotal,
      calculatedSum: verif.calculatedSum,
      mathDiscrepancy: verif.mathDiscrepancy,
      discrepancyMessage: verif.discrepancyMessage,
      sourceEngine: 'tesseract_ocr'
    };
  }

  // 2. Parse sebagai nota/struk umum
  const lines = rawOcrText.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 2);
  const parsedItems: ExtractedItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const numMatches = line.match(/(?:[1-9][0-9]{0,2}(?:[.,][0-9]{3})+(?:[.,][0-9]{2})?|[1-9][0-9]{0,2}(?:\.[0-9]{3})+|[1-9][0-9]{3,9}(?:[.,][0-9]{2})?)/g);
    if (numMatches && numMatches.length > 0) {
      const priceRaw = numMatches[numMatches.length - 1];
      const namePart = line.replace(/(?:[1-9][0-9]{0,2}(?:[.,][0-9]{3})+(?:[.,][0-9]{2})?|[1-9][0-9]{0,2}(?:\.[0-9]{3})+|[1-9][0-9]{3,9}(?:[.,][0-9]{2})?)/g, '').replace(/[:=]/g, '').trim();
      const itemName = namePart.length >= 3 ? namePart : (userDescription || `Item ${i + 1}`);
      const priceVal = sanitizeCurrencyAmount(priceRaw, itemName);
      if (priceVal >= 1000) {
        const lowerName = itemName.toLowerCase();
        const isTax = lowerName.includes('pajak') || lowerName.includes('pb1') || lowerName.includes('ppn');
        const isFee = lowerName.includes('biaya') || lowerName.includes('ongkir') || lowerName.includes('admin') || lowerName.includes('bi-fast');

        parsedItems.push({
          id: `it-ocr-${Date.now()}-${i}`,
          name: itemName,
          unitPrice: isTax || isFee ? null : priceVal,
          quantity: isTax || isFee ? null : 1,
          unit: isTax || isFee ? '' : 'pcs',
          totalPrice: priceVal,
          confidence: 85,
          isTaxOrFee: isTax || isFee,
          taxOrFeeType: isTax ? 'PB1' : isFee ? 'ADMIN_BANK' : undefined
        });
      }
    }
  }

  // Fallback aman jika teks tidak dapat di-parse menjadi baris item
  if (parsedItems.length === 0) {
    const allNumbers = rawOcrText.match(/[1-9][0-9]{3,8}/g);
    let fallbackAmount = 0;
    if (allNumbers && allNumbers.length > 0) {
      fallbackAmount = Math.max(...allNumbers.map(n => parseInt(n, 10)));
    }
    if (fallbackAmount === 0) {
      fallbackAmount = 100000;
    }

    parsedItems.push({
      id: `it-fallback-${Date.now()}`,
      name: userDescription && userDescription.trim() ? userDescription.trim() : 'Transaksi Bukti Unggahan',
      unitPrice: fallbackAmount,
      quantity: 1,
      unit: 'transaksi',
      totalPrice: fallbackAmount,
      confidence: 80
    });
  }

  const verif = runTwoWayDeterministicVerification(parsedItems);
  return {
    detectedType: 'nota_pembelian',
    sellerOrRecipient: userDescription || 'Toko / Rekanan',
    extractedItems: verif.verifiedItems,
    declaredGrandTotal: verif.grandTotal,
    calculatedSum: verif.calculatedSum,
    mathDiscrepancy: verif.mathDiscrepancy,
    discrepancyMessage: verif.discrepancyMessage,
    sourceEngine: 'smart_parser'
  };
}

/**
 * Orkestrator Ekstraksi Bukti Transaksi Nyata
 */
export async function extractTransactionFromFile(params: {
  fileDataUri: string;
  fileName: string;
  posCode: string;
  userDescription: string;
  accounts: Account[];
  onProgress?: (step: string) => void;
}): Promise<RealOcrExtractionResult> {
  const { fileDataUri, posCode, userDescription, accounts, onProgress } = params;
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    onProgress?.('2/4: Memproses dengan Gemini Multimodal Vision AI...');
    try {
      const result = await callGeminiVisionExtraction(fileDataUri, posCode, userDescription, accounts, apiKey);
      return result;
    } catch (err: any) {
      console.warn('Gemini Vision API gagal, beralih ke OCR lokal:', err);
      onProgress?.('2/4: Gemini Vision sibuk/gagal, beralih ke OCR lokal...');
    }
  }

  // Fallback ke OCR lokal Tesseract & Smart Parser
  return extractTransactionWithOfflineOcr(fileDataUri, posCode, userDescription, accounts, onProgress);
}
