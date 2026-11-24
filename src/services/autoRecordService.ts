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
import { isPdfDataUri, isPdfFile, convertPdfToImages, optimizeReceiptImage } from './receiptMediaService';

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
  sourceEngine: 'groq_vision' | 'tesseract_ocr' | 'smart_parser';
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

export function resetAutoRecordState(): void {
  try {
    localStorage.removeItem(STORAGE_DOC_SEQ_KEY);
    localStorage.removeItem('sikeu_auto_record_doc_seq');
    localStorage.setItem(STORAGE_DOC_SEQ_KEY, '0');
    localStorage.setItem('sikeu_auto_record_doc_seq', '0');
    localStorage.removeItem(SPECTRA_RECORDED_RECEIPTS_KEY);
    localStorage.removeItem('spectra_pending_journal_draft');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spectra:reset-auto-record'));
    }
  } catch (e) {
    console.error('Failed to reset auto record state:', e);
  }
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
 * Sanitizer mata uang Indonesia: membersihkan string ke angka tanpa mengubah nilai secara diam-diam.
 * Seluruh nilai dikembalikan sesuai angka terbaca.
 */
export function sanitizeCurrencyAmount(val: number | string | null | undefined, _itemName = ''): number {
  if (val === null || val === undefined) return 0;
  return parseIndonesianCurrency(val);
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
    const { unitPrice, quantity, totalPrice, confidence } = item;
    const lowerName = item.name.toLowerCase();

    // Deteksi indikasi inflasi sen (.00) pada biaya admin / transfer bank tanpa mutasi diam-diam
    if (lowerName.includes('bi-fast') || lowerName.includes('admin bank') || lowerName.includes('transfer fee')) {
      if (totalPrice === 250000 || totalPrice === 650000) {
        const suggested = totalPrice === 250000 ? 2500 : 6500;
        return {
          ...item,
          confidence: Math.min(confidence, 65),
          hasDiscrepancy: true,
          discrepancyNote: `Nominal tertera Rp ${totalPrice.toLocaleString('id-ID')} dicurigai terinflasi dari sen (.00). Saran nilai: Rp ${suggested.toLocaleString('id-ID')}`
        };
      }
    }

    // 1. Uji Horizontal: Harga Satuan x Kuantitas = Total
    if (unitPrice !== null && quantity !== null && unitPrice > 0 && quantity > 0) {
      const expectedTotal = unitPrice * quantity;

      // Jika terjadi ketidakcocokan perkalian, jangan ubah nilai secara diam-diam!
      if (totalPrice > 0 && Math.abs(expectedTotal - totalPrice) > 1) {
        let suggestion = '';
        if (unitPrice > 0 && totalPrice % unitPrice === 0) {
          const solvedQty = Math.round(totalPrice / unitPrice);
          suggestion = `Saran kuantitas: ${solvedQty}`;
        } else if (quantity > 0 && totalPrice % quantity === 0) {
          const solvedPrice = Math.round(totalPrice / quantity);
          suggestion = `Saran harga satuan: Rp ${solvedPrice.toLocaleString('id-ID')}`;
        } else {
          suggestion = `Saran total: Rp ${expectedTotal.toLocaleString('id-ID')}`;
        }

        return {
          ...item,
          unitPrice,
          quantity,
          totalPrice,
          confidence: Math.min(confidence, 68),
          hasDiscrepancy: true,
          discrepancyNote: `Perkalian tidak cocok: ${unitPrice.toLocaleString('id-ID')} x ${quantity} = ${expectedTotal.toLocaleString('id-ID')} (tertera ${totalPrice.toLocaleString('id-ID')}). [${suggestion}]`
        };
      } else if (totalPrice === 0) {
        return {
          ...item,
          totalPrice: expectedTotal,
          hasDiscrepancy: false
        };
      }
    } else if (totalPrice > 0 && quantity !== null && quantity > 0 && (unitPrice === null || unitPrice === 0)) {
      // Pulihkan unitPrice jika hilang
      return {
        ...item,
        unitPrice: Math.round(totalPrice / quantity),
        hasDiscrepancy: false
      };
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

/**
 * Helper terpadu: Analisis Jurnal dan buat akun baru ke COA jika ada akun yang belum terdaftar (misal: Pajak Pembelian PB1)
 */
export function ensureSuggestedJournalWithAutoCreatedAccounts(
  items: ExtractedItem[],
  posCode: string,
  currentAccounts: Account[],
  txKeterangan: string,
  addAccountFn?: (acc: Omit<Account, 'id'>) => Account
): SuggestedJournalLine[] {
  const sug = analyzeAndSuggestJournal(items, posCode, currentAccounts, txKeterangan);
  let workingAccounts = [...currentAccounts];

  const finalLines = sug.map(line => {
    if (line.isNewAccount) {
      let existing = workingAccounts.find(a =>
        !a.isHeader && (
          a.code === line.accountCode ||
          a.name.toLowerCase() === line.accountName.toLowerCase() ||
          (line.accountName.toLowerCase().includes('pb1') && a.name.toLowerCase().includes('pb1'))
        )
      );

      if (!existing && addAccountFn) {
        const created = autoCreateMissingCoaAccount(line, workingAccounts, addAccountFn);
        workingAccounts.push(created);
        existing = created;
      }

      return {
        ...line,
        accountCode: existing ? existing.code : line.accountCode,
        accountName: existing ? existing.name : line.accountName,
        accountCategory: existing ? existing.category : line.accountCategory,
        isNewAccount: true,
        suggestedNewCode: existing ? existing.code : line.suggestedNewCode
      };
    }
    return line;
  });

  return finalLines;
}

// =========================================================================
// 7.1. REKAMAN BUKTI & MANAJEMEN DRAFT JURNAL OTOMATIS
// =========================================================================

export interface RecordedReceipt {
  id: string;
  nomorBerkas: string;
  seqNumber: number;
  date: string;
  keterangan: string;
  posCode: string;
  grandTotal: number;
  extractedItems: ExtractedItem[];
  spreadsheetRows: SpreadsheetRowData[];
  receiptFileName?: string;
  receiptImage?: string;
  googleDriveLink?: string;
  status: 'pending_journal' | 'journalized';
  createdAt: string;
  journalTxId?: string;
}

export const SPECTRA_RECORDED_RECEIPTS_KEY = 'spectra_recorded_receipts_list';
export const SPECTRA_PENDING_JOURNAL_KEY = 'spectra_pending_journal_draft';

export function getRecordedReceipts(): RecordedReceipt[] {
  try {
    const raw = localStorage.getItem(SPECTRA_RECORDED_RECEIPTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function saveRecordedReceipt(receipt: RecordedReceipt): void {
  try {
    const list = getRecordedReceipts();
    const idx = list.findIndex(r => r.nomorBerkas === receipt.nomorBerkas || r.id === receipt.id);
    if (idx >= 0) {
      list[idx] = receipt;
    } else {
      list.unshift(receipt);
    }
    localStorage.setItem(SPECTRA_RECORDED_RECEIPTS_KEY, JSON.stringify(list));
  } catch (e) {}
}

export function updateRecordedReceiptStatus(nomorBerkas: string, status: 'pending_journal' | 'journalized', journalTxId?: string): void {
  try {
    const list = getRecordedReceipts();
    const updated = list.map(r => {
      if (r.nomorBerkas === nomorBerkas) {
        return { ...r, status, journalTxId };
      }
      return r;
    });
    localStorage.setItem(SPECTRA_RECORDED_RECEIPTS_KEY, JSON.stringify(updated));
  } catch (e) {}
}

export function deleteRecordedReceipt(id: string): void {
  try {
    const list = getRecordedReceipts().filter(r => r.id !== id && r.nomorBerkas !== id);
    localStorage.setItem(SPECTRA_RECORDED_RECEIPTS_KEY, JSON.stringify(list));
  } catch (e) {}
}

export function setPendingJournalDraft(draft: any): void {
  try {
    if (!draft) {
      localStorage.removeItem(SPECTRA_PENDING_JOURNAL_KEY);
    } else {
      localStorage.setItem(SPECTRA_PENDING_JOURNAL_KEY, JSON.stringify(draft));
    }
  } catch (e) {}
}

export function getPendingJournalDraft(): any | null {
  try {
    const raw = localStorage.getItem(SPECTRA_PENDING_JOURNAL_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

export function clearPendingJournalDraft(): void {
  try {
    localStorage.removeItem(SPECTRA_PENDING_JOURNAL_KEY);
  } catch (e) {}
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
// 9. MESIN EKSTRAKSI NYATA (GROQ VISION AI & OFFLINE OCR PIPELINE)
// =========================================================================

// Pembersihan aman kredensial legacy Gemini dari browser jika masih ada (tanpa log/tampilan key)
if (typeof window !== 'undefined') {
  try {
    if (localStorage.getItem('spectra_gemini_api_key')) {
      localStorage.removeItem('spectra_gemini_api_key');
    }
  } catch (e) {}
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
 * Mengekstrak nominal transaksi yang sah dari teks mentah OCR dengan validasi ketat:
 * 1. Menolak angka tanggal (YYYYMMDD, DDMMYYYY, tahun 2020-2035).
 * 2. Menolak nomor handphone/telepon (08xx, 628xx).
 * 3. Menolak nomor faktur, resi, kode pos, NPWP.
 * 4. Hanya menerima angka yang berdekatan dengan indikator mata uang atau total (Rp, IDR, Total, Jumlah, Bayar, Subtotal).
 */
export function extractCandidateAmountFromOcrText(rawText: string): number {
  if (!rawText || !rawText.trim()) return 0;

  // Pola eksplisit dengan kata kunci total / bayar / jumlah / rp
  const currencyPatterns = [
    /(?:grand\s*total|total\s*bayar|total\s*tagihan|total|jumlah|subtotal|tagihan|bayar|netto)\s*[:=]?\s*(?:rp\.?|idr)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{2})?|[0-9]{4,9})/gi,
    /(?:rp\.?|idr)\s*[:=]?\s*([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{2})?|[0-9]{4,9})/gi
  ];

  const candidateAmounts: number[] = [];

  for (const pattern of currencyPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(rawText)) !== null) {
      if (match[1]) {
        const fullSnippet = match[0].toLowerCase();
        // Cek jika snippet ada kata penolak (telp, invoice, nota, resi, no, rek, tgl)
        if (
          fullSnippet.includes('telp') ||
          fullSnippet.includes('phone') ||
          fullSnippet.includes('hp') ||
          fullSnippet.includes('wa') ||
          fullSnippet.includes('tgl') ||
          fullSnippet.includes('tanggal') ||
          fullSnippet.includes('inv') ||
          fullSnippet.includes('nota') ||
          fullSnippet.includes('resi') ||
          fullSnippet.includes('npwp') ||
          fullSnippet.includes('rek')
        ) {
          continue;
        }

        const cleanNum = match[1].replace(/[.,](?=[0-9]{3})/g, '').replace(/,[0-9]{2}$/, '');
        const val = parseInt(cleanNum, 10);

        if (!val || isNaN(val) || val < 1000) continue;

        // Tolak tahun (2020-2035)
        if (val >= 2020 && val <= 2035) continue;

        // Tolak format tanggal YYYYMMDD atau DDMMYYYY 8-digit
        const valStr = String(val);
        if (valStr.length === 8) {
          if (valStr.startsWith('202') || valStr.startsWith('203')) continue;
          if (valStr.endsWith('2024') || valStr.endsWith('2025') || valStr.endsWith('2026') || valStr.endsWith('2027')) continue;
        }

        // Tolak format nomor HP
        if (/^(?:08|628|81)[0-9]{8,11}$/.test(valStr)) continue;

        candidateAmounts.push(val);
      }
    }
  }

  if (candidateAmounts.length > 0) {
    return Math.max(...candidateAmounts);
  }

  // Jika tidak ditemukan angka dengan konteks harga yang valid, kembalikan 0 (tanpa nominal fiktif)
  return 0;
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
    const lowerLine = line.toLowerCase();

    // Saring baris metadata yang sering berisi angka tanggal, nota, telepon, kasir
    const isMetadataLine =
      lowerLine.startsWith('no.') ||
      lowerLine.startsWith('no ') ||
      lowerLine.startsWith('nomor') ||
      lowerLine.startsWith('inv') ||
      lowerLine.startsWith('nota') ||
      lowerLine.startsWith('faktur') ||
      lowerLine.startsWith('tanggal') ||
      lowerLine.startsWith('tgl') ||
      lowerLine.startsWith('date') ||
      lowerLine.startsWith('waktu') ||
      lowerLine.startsWith('jam') ||
      lowerLine.startsWith('kasir') ||
      lowerLine.startsWith('operator') ||
      lowerLine.startsWith('telp') ||
      lowerLine.startsWith('phone') ||
      lowerLine.startsWith('npwp') ||
      lowerLine.startsWith('alamat');

    if (isMetadataLine) {
      continue;
    }

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

  // Fallback jika OCR tidak dapat membaca baris item secara terstruktur
  if (parsedItems.length === 0) {
    // Saring teks mentah dengan validasi ketat: cari hanya angka berkonteks harga/total yang valid
    const detectedAmount = extractCandidateAmountFromOcrText(rawOcrText);

    // STRICT: DILARANG membuat nominal fiktif (misal 100000) atau mengambil tanggal/nomor nota/telepon.
    // Jika tidak terbaca dengan konteks mata uang yang yakin, set 0 dan tandai wajib koreksi manual.
    const isUndetected = detectedAmount <= 0;
    parsedItems.push({
      id: `it-ocr-manual-${Date.now()}`,
      name: userDescription && userDescription.trim()
        ? userDescription.trim()
        : (isUndetected ? 'Item Belum Teridentifikasi (Wajib Diisi Manual)' : 'Pengeluaran Transaksi Umum'),
      unitPrice: detectedAmount > 0 ? detectedAmount : 0,
      quantity: 1,
      unit: 'transaksi',
      totalPrice: detectedAmount > 0 ? detectedAmount : 0,
      confidence: detectedAmount > 0 ? 50 : 0
    });
  }

  const verif = runTwoWayDeterministicVerification(parsedItems);
  const isIncomplete = verif.grandTotal <= 0 || parsedItems.some(it => !it.totalPrice || it.totalPrice <= 0);

  return {
    detectedType: 'nota_pembelian',
    sellerOrRecipient: userDescription || 'Toko / Rekanan',
    extractedItems: verif.verifiedItems,
    declaredGrandTotal: verif.grandTotal,
    calculatedSum: verif.calculatedSum,
    mathDiscrepancy: verif.mathDiscrepancy || isIncomplete,
    discrepancyMessage: isIncomplete
      ? 'OCR Tidak Lengkap: Nominal tidak terbaca dengan yakin. Wajib dilakukan koreksi manual pada Tabel Koreksi Tahap 2 sebelum jurnal dapat diposting.'
      : verif.discrepancyMessage,
    sourceEngine: 'smart_parser'
  };
}

/**
 * Pipeline Ekstraksi Citra Tunggal (Groq Vision -> Offline Tesseract OCR)
 */
async function extractSingleImageViaPipeline(params: {
  imageUri: string;
  posCode: string;
  userDescription: string;
  accounts: Account[];
  onProgress?: (step: string) => void;
  pageLabel?: string;
}): Promise<RealOcrExtractionResult> {
  const { imageUri, posCode, userDescription, accounts, onProgress, pageLabel } = params;
  const prefix = pageLabel ? `[${pageLabel}] ` : '';

  // 1. Prioritas 1: Cloud Serverless Groq Vision API (/api/scan-receipt)
  onProgress?.(`2/4: ${prefix}Memproses dengan Groq Vision AI (Serverless Cloud)...`);
  try {
    const groqRes = await fetch('/api/scan-receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        image: imageUri,
        posCode,
        userDescription
      })
    });

    if (groqRes.ok) {
      const data = await groqRes.json();
      if (data.success && data.data) {
        onProgress?.(`2/4: ${prefix}Berhasil mengekstrak data struk via Groq Vision!`);
        return {
          ...data.data,
          sourceEngine: 'groq_vision' as const
        };
      }
    } else {
      const errJson = await groqRes.json().catch(() => null);
      const errMsg = errJson?.error || `HTTP ${groqRes.status}`;
      console.warn(`Groq Vision API gagal (${errMsg}), beralih ke OCR offline lokal...`);
      onProgress?.(`2/4: ${prefix}Groq Vision (${errMsg}), beralih ke OCR offline lokal...`);
    }
  } catch (groqErr: any) {
    console.warn('Groq Vision backend unreachable/offline, beralih ke OCR offline lokal:', groqErr);
    onProgress?.(`2/4: ${prefix}Backend Groq offline, beralih ke OCR offline lokal...`);
  }

  // 2. Prioritas 2 (Fallback Offline): Offline OCR Tesseract.js & Smart Parser
  return extractTransactionWithOfflineOcr(imageUri, posCode, userDescription, accounts, onProgress);
}

/**
 * Orkestrator Ekstraksi Bukti Transaksi Nyata
 * Multi-Provider & Multi-Format Pipeline:
 * - Dukungan PDF (1 s.d. 5 halaman) via konversi cerdas PDF.js ke gambar JPEG beresolusi tinggi
 * - Optimasi & kompresi cerdas gambar struk (JPEG/PNG/WebP/kamera) agar di bawah batas Vercel 4.5MB
 * - Multi-tier AI: Groq Vision -> Offline Tesseract.js
 */
export async function extractTransactionFromFile(params: {
  fileDataUri: string;
  fileName: string;
  posCode: string;
  userDescription: string;
  accounts: Account[];
  onProgress?: (step: string) => void;
}): Promise<RealOcrExtractionResult> {
  const { fileDataUri, fileName, posCode, userDescription, accounts, onProgress } = params;

  // =========================================================================
  // KASUS 1: BERKAS MERUPAKAN DOKUMEN PDF
  // =========================================================================
  if (isPdfDataUri(fileDataUri) || isPdfFile(fileName)) {
    onProgress?.('1/4: Membaca & merender dokumen PDF dengan PDF.js...');
    const pdfRes = await convertPdfToImages(fileDataUri, {
      maxPages: 5,
      scale: 1.8,
      onProgress: (cur, tot) => onProgress?.(`1/4: Merender halaman PDF ${cur} dari ${tot}...`)
    });

    if (!pdfRes.success || pdfRes.pageImages.length === 0) {
      return {
        detectedType: 'lainnya',
        sellerOrRecipient: userDescription || 'Dokumen PDF',
        extractedItems: [],
        declaredGrandTotal: 0,
        calculatedSum: 0,
        mathDiscrepancy: false,
        discrepancyMessage: pdfRes.error || 'Gagal membaca isi dokumen PDF.',
        sourceEngine: 'smart_parser'
      };
    }

    // Jika PDF hanya 1 halaman
    if (pdfRes.pageImages.length === 1) {
      const singleRes = await extractSingleImageViaPipeline({
        imageUri: pdfRes.pageImages[0],
        posCode,
        userDescription,
        accounts,
        onProgress,
        pageLabel: 'Hal 1/1'
      });
      return singleRes;
    }

    // Jika PDF Multipage (2 s/d 10 halaman)
    const allItems: ExtractedItem[] = [];
    let detectedSeller = '';
    let detectedDate = '';
    let detectedType: RealOcrExtractionResult['detectedType'] = 'faktur';
    let primarySourceEngine: RealOcrExtractionResult['sourceEngine'] = 'groq_vision';
    const pageDeclaredTotals: { pageNum: number; declaredTotal: number }[] = [];

    for (let pIdx = 0; pIdx < pdfRes.pageImages.length; pIdx++) {
      const pageNum = pIdx + 1;
      const pageImage = pdfRes.pageImages[pIdx];

      // Beri jeda kecil (300ms) antar-request serverless jika multi-halaman
      if (pIdx > 0) {
        await new Promise(r => setTimeout(r, 300));
      }

      const pageRes = await extractSingleImageViaPipeline({
        imageUri: pageImage,
        posCode,
        userDescription,
        accounts,
        onProgress,
        pageLabel: `Hal ${pageNum}/${pdfRes.pageImages.length}`
      });

      // VALIDASI KEUTUHAN HALAMAN:
      // Jika salah satu halaman gagal total (tidak ada item dan tidak ada total), batalkan seluruhnya
      // demi mencegah hilangnya item transaksi atau pajak secara sepihak.
      if (!pageRes || (!pageRes.extractedItems.length && !pageRes.declaredGrandTotal)) {
        return {
          detectedType: 'lainnya',
          sellerOrRecipient: userDescription || 'Dokumen PDF',
          extractedItems: [],
          declaredGrandTotal: 0,
          calculatedSum: 0,
          mathDiscrepancy: true,
          discrepancyMessage: `Gagal mengekstrak data pada halaman ${pageNum} dari ${pdfRes.pageImages.length}. Pemrosesan dibatalkan demi mencegah transaksi parsial/tidak lengkap.`,
          sourceEngine: 'smart_parser'
        };
      }

      if (!detectedSeller && pageRes.sellerOrRecipient) {
        detectedSeller = pageRes.sellerOrRecipient;
      }
      if (!detectedDate && pageRes.transactionDate) {
        detectedDate = pageRes.transactionDate;
      }
      if (pageRes.detectedType && detectedType === 'faktur') {
        detectedType = pageRes.detectedType;
      }
      primarySourceEngine = pageRes.sourceEngine;

      if (pageRes.declaredGrandTotal > 0) {
        pageDeclaredTotals.push({ pageNum, declaredTotal: pageRes.declaredGrandTotal });
      }

      // KOREKSI MULTI-HALAMAN & PERLINDUNGAN ITEM SEBENARNYA:
      // 1. Beri ID terisolasi unik per halaman: `p${pageNum}-...`
      // 2. HANYA filter baris jika secara eksplisit merupakan baris teks subtotal/pindahan halaman.
      // 3. Item transaksi riil dengan nama & harga identik yang memang dibeli berulang TETAP DIPERTAHANKAN 100%!
      pageRes.extractedItems.forEach((item, itemIdx) => {
        const lowerName = (item.name || '').toLowerCase().trim();
        const isExplicitSubtotalLine =
          lowerName.includes('subtotal') ||
          lowerName.includes('sub-total') ||
          lowerName.includes('sub total') ||
          lowerName.includes('jumlah sementara') ||
          lowerName.includes('pindahan') ||
          lowerName.includes('jumlah dipindahkan') ||
          lowerName.includes('balance brought forward') ||
          lowerName.includes('carried forward');

        // Jika halaman > 1 dan baris adalah pengulangan subtotal dari halaman sebelumnya, abaikan agar tidak double count
        if (pIdx > 0 && isExplicitSubtotalLine) {
          return;
        }

        allItems.push({
          ...item,
          id: `p${pageNum}-${item.id || itemIdx + 1}`
        });
      });
    }

    // RESOLUSI GRAND TOTAL MULTI-HALAMAN:
    // Pada faktur komersial multipage, Grand Total final tercantum pada halaman terakhir (setelah PPN/Diskon),
    // atau merupakan penjumlahan item. DILARANG KERAS menjumlahkan declaredGrandTotal antar-halaman secara naif.
    const calculatedSum = allItems.reduce((acc, it) => acc + (Number(it.totalPrice) || 0), 0);
    const lastPageTotal = pageDeclaredTotals.find(p => p.pageNum === pdfRes.pageImages.length)?.declaredTotal || 0;

    let resolvedGrandTotal = calculatedSum;
    if (lastPageTotal > 0 && (Math.abs(lastPageTotal - calculatedSum) <= 1 || lastPageTotal >= calculatedSum * 0.7)) {
      // Halaman terakhir memuat grand total kumulatif seluruh faktur
      resolvedGrandTotal = lastPageTotal;
    } else {
      // Cari apakah ada halaman yang secara eksplisit memuat total kumulatif yang cocok dengan sum
      const matchingPage = pageDeclaredTotals.find(p => Math.abs(p.declaredTotal - calculatedSum) <= 1);
      if (matchingPage) {
        resolvedGrandTotal = matchingPage.declaredTotal;
      }
    }

    // Verifikasi deterministik hasil gabungan seluruh halaman
    const verif = runTwoWayDeterministicVerification(allItems, resolvedGrandTotal);
    const note = `Hasil gabungan dari ${pdfRes.pageImages.length} halaman dokumen PDF (Seluruh halaman terproses lengkap).`;

    return {
      detectedType,
      sellerOrRecipient: detectedSeller || userDescription || 'Rekanan / Penjual',
      transactionDate: detectedDate,
      extractedItems: verif.verifiedItems,
      declaredGrandTotal: verif.grandTotal,
      calculatedSum: verif.calculatedSum,
      mathDiscrepancy: verif.mathDiscrepancy,
      discrepancyMessage: verif.discrepancyMessage ? `${note} ${verif.discrepancyMessage}` : note,
      sourceEngine: primarySourceEngine
    };
  }

  // =========================================================================
  // KASUS 2: BERKAS MERUPAKAN GAMBAR BIASA (JPG/PNG/WEBP/KAMERA)
  // =========================================================================
  onProgress?.('1/4: Mengoptimasi resolusi & ukuran gambar struk...');
  const optimizedDataUri = await optimizeReceiptImage(fileDataUri, {
    maxDimension: 2048,
    targetMaxBytes: 2 * 1024 * 1024,
    quality: 0.88
  });

  return extractSingleImageViaPipeline({
    imageUri: optimizedDataUri,
    posCode,
    userDescription,
    accounts,
    onProgress
  });
}
