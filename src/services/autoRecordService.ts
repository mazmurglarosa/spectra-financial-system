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
  taxOrFeeType?: 'PB1' | 'PPN' | 'SERVICE' | 'ONGKIR' | 'OTHER';
  hasDiscrepancy?: boolean;
  discrepancyNote?: string;
  originalText?: string;
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
  justCreated?: boolean;
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
  if (typeof text === 'number') return Math.round(text);
  if (!text) return 0;

  let cleaned = String(text).trim().toLowerCase();

  // Handle shorthand suffix
  if (cleaned.endsWith('rb') || cleaned.endsWith('k') || cleaned.includes('ribu')) {
    const numPart = cleaned.replace(/[^\d.,]/g, '').replace(',', '.');
    const val = parseFloat(numPart);
    if (!isNaN(val)) return Math.round(val * 1000);
  }

  if (cleaned.endsWith('jt') || cleaned.includes('juta')) {
    const numPart = cleaned.replace(/[^\d.,]/g, '').replace(',', '.');
    const val = parseFloat(numPart);
    if (!isNaN(val)) return Math.round(val * 1000000);
  }

  // Handle '10,-' notation on Indonesian receipts
  if (cleaned.includes(',-') || cleaned.includes('.-')) {
    const base = cleaned.replace(/[^\d]/g, '');
    const num = parseInt(base, 10);
    if (!isNaN(num)) {
      if (isLikelyThousands && num < 1000) {
        return num * 1000;
      }
      return num;
    }
  }

  // Clean standard currency notation: Rp 100.000,00 or 100000
  const digitsOnly = cleaned.replace(/[^\d]/g, '');
  const parsed = parseInt(digitsOnly, 10);
  if (isNaN(parsed)) return 0;

  // Contextual multiplier: if single item is like "10" on receipt while header is "Ribuan Rupiah"
  if (isLikelyThousands && parsed < 1000) {
    return parsed * 1000;
  }

  return parsed;
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
  const calculatedSum = verifiedItems.reduce((sum, it) => sum + it.totalPrice, 0);
  const targetGrandTotal = declaredGrandTotal && declaredGrandTotal > 0 ? declaredGrandTotal : calculatedSum;
  
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
  keterangan: string,
  addAccountFn?: (acc: Omit<Account, 'id'>) => Account
): SuggestedJournalLine[] {
  const selectedPos = getPosRules().find(p => p.code === posCode) || DEFAULT_POS_RULES[0];
  const suggestedLines: SuggestedJournalLine[] = [];

  // Group items: Aggregasi fisik vs Pajak/Biaya tersendiri
  const physicalItems: ExtractedItem[] = [];
  const taxAndFeeItems: ExtractedItem[] = [];

  items.forEach(it => {
    const lower = it.name.toLowerCase();
    const isTax = lower.includes('pajak') || lower.includes('pb1') || lower.includes('ppn') || lower.includes('pph');
    const isFee = lower.includes('ongkir') || lower.includes('kirim') || lower.includes('service') || lower.includes('layanan');

    if (it.isTaxOrFee || isTax || isFee) {
      taxAndFeeItems.push(it);
    } else {
      physicalItems.push(it);
    }
  });

  // 1. Pembentukan Akun Sisi Debit
  if (posCode === 'A' || posCode === 'B') {
    // Pembelian: Agregasi barang fisik sejenis menjadi 1 baris akun Perlengkapan/Persediaan
    if (physicalItems.length > 0) {
      const totalPhysical = physicalItems.reduce((acc, it) => acc + it.totalPrice, 0);
      
      // Cari akun Perlengkapan di COA
      let perlengkapanAcc = accounts.find(a => 
        !a.isHeader && (a.name.toLowerCase().includes('perlengkapan kantor') || a.name.toLowerCase() === 'perlengkapan')
      );
      if (!perlengkapanAcc) {
        perlengkapanAcc = accounts.find(a => !a.isHeader && a.category === 'HARTA_LANCAR');
      }

      let wasPhysCreated = false;
      // Jika tidak ditemukan dan ada addAccountFn, langsung buat akun di COA
      if (!perlengkapanAcc && addAccountFn) {
        const nextCode = generateNextAccountCode('10000', accounts);
        perlengkapanAcc = addAccountFn({
          code: nextCode,
          name: 'Perlengkapan Kantor',
          category: 'HARTA_LANCAR',
          categoryName: 'Harta Lancar',
          pos: 'Nrc',
          sn: 'Db',
          debetAwal: 0,
          kreditAwal: 0,
          isHeader: false,
          description: 'Dibuat otomatis oleh SPECTRA Auto Record OCR Engine'
        });
        accounts.push(perlengkapanAcc);
        wasPhysCreated = true;
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
        isNewAccount: false,
        justCreated: wasPhysCreated,
        sourceItems: physicalItems.map(p => p.name)
      });
    }

    // Pemisahan Pajak & Biaya Berdiri Sendiri
    taxAndFeeItems.forEach((taxItem, idx) => {
      const lower = taxItem.name.toLowerCase();
      let targetAccName = taxItem.name;
      if (lower.includes('pb1') || lower.includes('pembelian pb1')) {
        targetAccName = 'Beban Pajak PB1';
      } else if (lower.includes('ppn')) {
        targetAccName = 'PPN Masukan';
      } else if (lower.includes('ongkir') || lower.includes('kirim')) {
        targetAccName = 'Beban Angkut Pembelian';
      }

      // Cek apakah akun sudah terdaftar di COA
      let existingAcc = accounts.find(a => 
        !a.isHeader && (a.name.toLowerCase() === targetAccName.toLowerCase() || (a.code === '50022' && targetAccName === 'Beban Pajak PB1'))
      );

      let finalCode = existingAcc ? existingAcc.code : generateNextAccountCode('50000', accounts);
      let wasTaxCreated = false;

      // LANGSUNG KERJAKAN SARAN: Langsung buat akun di COA seketika tanpa menunda ke tahap approve
      if (!existingAcc && addAccountFn) {
        const isPpn = lower.includes('ppn');
        const headerPrefix = isPpn ? '10000' : '50000';
        const newCode = generateNextAccountCode(headerPrefix, accounts);
        const newAcc = addAccountFn({
          code: newCode,
          name: targetAccName,
          category: isPpn ? 'HARTA_LANCAR' : 'BEBAN_OPERASIONAL',
          categoryName: isPpn ? 'Harta Lancar' : 'Beban Operasional',
          pos: isPpn ? 'Nrc' : 'Lr',
          sn: 'Db',
          debetAwal: 0,
          kreditAwal: 0,
          isHeader: false,
          description: 'Dibuat otomatis oleh SPECTRA Auto Record OCR Engine'
        });
        accounts.push(newAcc);
        existingAcc = newAcc;
        finalCode = newAcc.code;
        wasTaxCreated = true;
      }

      suggestedLines.push({
        id: `sug-${Date.now()}-tax-${idx}`,
        accountCode: finalCode,
        accountName: targetAccName,
        accountCategory: lower.includes('ppn') ? 'HARTA_LANCAR' : 'BEBAN_OPERASIONAL',
        pos: lower.includes('ppn') ? 'Nrc' : 'Lr',
        sn: 'Db',
        debit: taxItem.totalPrice,
        credit: 0,
        memo: `${taxItem.name} dari bukti transaksi`,
        isNewAccount: false,
        suggestedNewCode: finalCode,
        justCreated: wasTaxCreated,
        sourceItems: [taxItem.name]
      });
    });

    // 2. Akun Lawan Sisi Kredit berdasarkan POS
    const totalDebit = suggestedLines.reduce((acc, l) => acc + l.debit, 0);
    const creditAccCode = selectedPos.defaultCreditAccountCode || (posCode === 'A' ? '10001' : '20001');
    let existingCredit = accounts.find(a => a.code === creditAccCode);

    if (!existingCredit && addAccountFn) {
      const isKas = posCode === 'A';
      existingCredit = addAccountFn({
        code: creditAccCode,
        name: selectedPos.defaultCreditAccountName || (isKas ? 'Kas' : 'Utang Usaha'),
        category: isKas ? 'HARTA_LANCAR' : 'UTANG_LANCAR',
        categoryName: isKas ? 'Harta Lancar' : 'Utang Lancar',
        pos: 'Nrc',
        sn: isKas ? 'Db' : 'Kr',
        debetAwal: 0,
        kreditAwal: 0,
        isHeader: false,
        description: 'Dibuat otomatis oleh SPECTRA Auto Record OCR Engine'
      });
      accounts.push(existingCredit);
    }

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
export function generateNextAccountCode(headerPrefix: string, accounts: Account[]): string {
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

  return String(maxFound + 1);
}

export function autoCreateMissingCoaAccount(
  line: SuggestedJournalLine,
  accounts: Account[],
  addAccountFn: (acc: Omit<Account, 'id'>) => Account
): Account {
  const existing = accounts.find(a => a.name.toLowerCase() === line.accountName.toLowerCase());
  if (existing) return existing;

  // Tentukan header
  let headerPrefix = '50000';
  let category: AccountCategory = 'BEBAN_OPERASIONAL';
  let categoryName = 'Beban Operasional';
  let pos: ReportType = 'Lr';
  let sn: NormalBalance = 'Db';

  const lower = line.accountName.toLowerCase();
  if (lower.includes('beban') || lower.includes('pajak pb1') || lower.includes('biaya')) {
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
