import * as XLSX from 'xlsx';
import { Account, CompanySettings, Transaction } from '../types/accounting';
import { calculateAccountBalance } from './accountingCalculations';
import { formatPeriodDisplay } from './formatPeriod';
import {
  DifferenceNature,
  FISCAL_RULE_CODES,
  FiscalDirection,
  TaxRegimeType,
  detectAutoFiscalSuggestion
} from '../data/fiscalTaxRules';

export interface FiscalAccountOverride {
  ruleCode: string;
  positiveAmount: number;
  negativeAmount: number;
  nature: DifferenceNature;
  note: string;
  isManualOverride: boolean;
}

export interface CustomFiscalAdjustment {
  id: string;
  description: string;
  ruleCode: string;
  direction: 'FPO' | 'FNE';
  nature: 'TETAP' | 'WAKTU';
  amount: number;
  note: string;
}

export interface FiscalReconciliationRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  category: string;
  section: 'PENDAPATAN' | 'BEBAN';
  commercialAmount: number;
  ruleCode: string;
  direction: FiscalDirection;
  nature: DifferenceNature;
  positiveCorrection: number;
  negativeCorrection: number;
  fiscalAmount: number;
  legalBasis: string;
  note: string;
  isAutoDetected: boolean;
  isManualOverride: boolean;
}

export interface FiscalReconciliationSummary {
  rows: FiscalAccountRowGroup;
  customAdjustments: CustomFiscalAdjustment[];
  totalRevenueCommercial: number;
  totalRevenuePositive: number;
  totalRevenueNegative: number;
  totalRevenueFiscal: number;
  totalExpenseCommercial: number;
  totalExpensePositive: number;
  totalExpenseNegative: number;
  totalExpenseFiscal: number;
  commercialNetProfit: number;
  totalPositiveCorrection: number;
  totalNegativeCorrection: number;
  fiscalNetProfit: number;
  reconciliationDiff: number;
  isReconciled: boolean;
}

export interface FiscalAccountRowGroup {
  revenues: FiscalReconciliationRow[];
  expenses: FiscalReconciliationRow[];
}

export interface CorporateTaxCalculation {
  regime: TaxRegimeType;
  grossTurnover: number;
  fiscalNetProfit: number;
  lossCarryForward: number;
  pkpRaw: number;
  pkpRounded: number;
  isEligible31E: boolean;
  pkpFacility: number;
  pkpNonFacility: number;
  taxFacility: number;
  taxNonFacility: number;
  totalIncomeTax: number;
  prepaidTaxCredits: number;
  taxPayable: number; // positif = Kurang Bayar (Ps. 29), negatif = Lebih Bayar (Ps. 28A)
  effectiveRatePercent: number;
}

/**
 * Menyusun Kertas Kerja Rekonsiliasi Fiskal lengkap dari COA & Transaksi SPECTRA.
 */
export function buildFiscalReconciliation(
  accounts: Account[],
  transactions: Transaction[],
  overrides: Record<string, FiscalAccountOverride> = {},
  customAdjustments: CustomFiscalAdjustment[] = [],
  includeZeroAccounts = false
): FiscalReconciliationSummary {
  const lrAccounts = accounts
    .filter(a => a.pos === 'Lr' && !a.isHeader)
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const revenues: FiscalReconciliationRow[] = [];
  const expenses: FiscalReconciliationRow[] = [];

  for (const acc of lrAccounts) {
    const { endingBalance } = calculateAccountBalance(acc, transactions);
    const hasOverride = Boolean(overrides[acc.code]?.isManualOverride);

    if (!includeZeroAccounts && endingBalance === 0 && !hasOverride) {
      continue;
    }

    const isRevenue = acc.category.startsWith('PENDAPATAN');
    const auto = detectAutoFiscalSuggestion(acc.code, acc.name, acc.category, endingBalance);
    const override = overrides[acc.code];

    const useOverride = Boolean(override && override.isManualOverride);
    const ruleCode = useOverride ? override.ruleCode : auto.ruleCode;
    const positiveCorrection = Math.max(0, Math.round(useOverride ? override.positiveAmount : auto.positiveAmount));
    const negativeCorrection = Math.max(0, Math.round(useOverride ? override.negativeAmount : auto.negativeAmount));

    const ruleMeta = FISCAL_RULE_CODES.find(r => r.code === ruleCode);
    const direction: FiscalDirection =
      positiveCorrection > 0 && negativeCorrection === 0
        ? 'FPO'
        : negativeCorrection > 0 && positiveCorrection === 0
        ? 'FNE'
        : ruleMeta?.direction || 'NONE';

    const nature: DifferenceNature = useOverride
      ? override.nature
      : ruleMeta?.nature || auto.nature;

    const note = useOverride ? override.note : auto.reason;
    const legalBasis = ruleMeta?.legalBasis || (direction === 'NONE' ? 'Sesuai UU PPh Ps. 4(1) / Ps. 6(1)' : 'UU PPh & PER-11/PJ/2025');

    // Persamaan Formulir 1771-I:
    // Pendapatan Fiskal = Komersial + Positif - Negatif
    // Beban Fiskal      = Komersial - Positif + Negatif
    const fiscalAmount = isRevenue
      ? endingBalance + positiveCorrection - negativeCorrection
      : endingBalance - positiveCorrection + negativeCorrection;

    const row: FiscalReconciliationRow = {
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      category: acc.category,
      section: isRevenue ? 'PENDAPATAN' : 'BEBAN',
      commercialAmount: endingBalance,
      ruleCode,
      direction,
      nature,
      positiveCorrection,
      negativeCorrection,
      fiscalAmount,
      legalBasis,
      note,
      isAutoDetected: !useOverride && (auto.positiveAmount > 0 || auto.negativeAmount > 0),
      isManualOverride: useOverride
    };

    if (isRevenue) revenues.push(row);
    else expenses.push(row);
  }

  const sumField = (list: FiscalReconciliationRow[], field: keyof FiscalReconciliationRow) =>
    list.reduce((s, r) => s + (Number(r[field]) || 0), 0);

  const totalRevenueCommercial = sumField(revenues, 'commercialAmount');
  const totalRevenuePositive = sumField(revenues, 'positiveCorrection');
  const totalRevenueNegative = sumField(revenues, 'negativeCorrection');
  const totalRevenueFiscal = sumField(revenues, 'fiscalAmount');

  const totalExpenseCommercial = sumField(expenses, 'commercialAmount');
  const totalExpensePositive = sumField(expenses, 'positiveCorrection');
  const totalExpenseNegative = sumField(expenses, 'negativeCorrection');
  const totalExpenseFiscal = sumField(expenses, 'fiscalAmount');

  const customPositive = customAdjustments
    .filter(c => c.direction === 'FPO')
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const customNegative = customAdjustments
    .filter(c => c.direction === 'FNE')
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const commercialNetProfit = totalRevenueCommercial - totalExpenseCommercial;
  const totalPositiveCorrection = totalRevenuePositive + totalExpensePositive + customPositive;
  const totalNegativeCorrection = totalRevenueNegative + totalExpenseNegative + customNegative;

  const fiscalNetProfit = commercialNetProfit + totalPositiveCorrection - totalNegativeCorrection;
  const verticalCrossCheck = (totalRevenueFiscal - totalExpenseFiscal) + customPositive - customNegative;
  const reconciliationDiff = Math.abs(fiscalNetProfit - verticalCrossCheck);

  return {
    rows: { revenues, expenses },
    customAdjustments,
    totalRevenueCommercial,
    totalRevenuePositive,
    totalRevenueNegative,
    totalRevenueFiscal,
    totalExpenseCommercial,
    totalExpensePositive,
    totalExpenseNegative,
    totalExpenseFiscal,
    commercialNetProfit,
    totalPositiveCorrection,
    totalNegativeCorrection,
    fiscalNetProfit,
    reconciliationDiff,
    isReconciled: reconciliationDiff === 0
  };
}

/**
 * Menghitung estimasi PPh Badan Terutang sesuai UU No. 7 Tahun 2021 (UU HPP),
 * Pasal 17 ayat (1)b, Pasal 31E ayat (1), atau PP 55 Tahun 2022 (UMKM 0,5%).
 */
export function calculateCorporateTax(
  fiscalNetProfit: number,
  grossTurnover: number,
  regime: TaxRegimeType,
  lossCarryForward = 0,
  prepaidTaxCredits = 0
): CorporateTaxCalculation {
  const safeTurnover = Math.max(0, grossTurnover);
  const pkpRaw = Math.max(0, fiscalNetProfit - Math.max(0, lossCarryForward));
  // Pasal 17 ayat (4) UU PPh: Penghasilan Kena Pajak dibulatkan ke bawah dalam ribuan penuh
  const pkpRounded = Math.floor(pkpRaw / 1000) * 1000;

  let isEligible31E = safeTurnover <= 50_000_000_000;
  let pkpFacility = 0;
  let pkpNonFacility = 0;
  let taxFacility = 0;
  let taxNonFacility = 0;
  let totalIncomeTax = 0;

  if (regime === 'umkm05') {
    isEligible31E = false;
    totalIncomeTax = Math.round(safeTurnover * 0.005);
  } else if (regime === 'pasal31e' && safeTurnover > 0 && safeTurnover <= 50_000_000_000) {
    if (safeTurnover <= 4_800_000_000) {
      pkpFacility = pkpRounded;
      pkpNonFacility = 0;
    } else {
      pkpFacility = Math.round((4_800_000_000 / safeTurnover) * pkpRounded);
      pkpNonFacility = Math.max(0, pkpRounded - pkpFacility);
    }
    taxFacility = Math.round(pkpFacility * 0.11); // 50% x 22%
    taxNonFacility = Math.round(pkpNonFacility * 0.22);
    totalIncomeTax = taxFacility + taxNonFacility;
  } else {
    // Tarif Umum Pasal 17 ayat (1) huruf b UU HPP: 22%
    pkpNonFacility = pkpRounded;
    taxNonFacility = Math.round(pkpRounded * 0.22);
    totalIncomeTax = taxNonFacility;
  }

  const taxPayable = totalIncomeTax - Math.max(0, prepaidTaxCredits);
  const effectiveRatePercent =
    pkpRounded > 0 ? Math.round((totalIncomeTax / pkpRounded) * 10000) / 100 : 0;

  return {
    regime,
    grossTurnover: safeTurnover,
    fiscalNetProfit,
    lossCarryForward: Math.max(0, lossCarryForward),
    pkpRaw,
    pkpRounded,
    isEligible31E,
    pkpFacility,
    pkpNonFacility,
    taxFacility,
    taxNonFacility,
    totalIncomeTax,
    prepaidTaxCredits: Math.max(0, prepaidTaxCredits),
    taxPayable,
    effectiveRatePercent
  };
}

/**
 * Mengekspor Kertas Kerja Rekonsiliasi Fiskal & Estimasi PPh Badan ke Excel (.xlsx).
 */
export function exportFiscalReconciliationWorkbook(
  summary: FiscalReconciliationSummary,
  taxCalc: CorporateTaxCalculation,
  settings: CompanySettings
): void {
  const wb = XLSX.utils.book_new();
  const periodLabel = formatPeriodDisplay(settings.fiscalPeriod, settings.fiscalYear);

  const sheetRows: any[][] = [
    [settings.companyName.toUpperCase()],
    ['KERTAS KERJA REKONSILIASI FISKAL & PERHITUNGAN PPH BADAN (LAMPIRAN 1771-I / CORETAX L1)'],
    [`Periode: ${periodLabel}`],
    [''],
    [
      'KODE AKUN',
      'NAMA AKUN / URAIAN POS',
      'KATEGORI',
      'KOMERSIAL (SAK)',
      'KODE CORETAX',
      'SIFAT BEDA',
      'KOREKSI POSITIF (+)',
      'KOREKSI NEGATIF (-)',
      'NILAI FISKAL',
      'DASAR HUKUM & CATATAN'
    ],
    ['A', 'PENDAPATAN / PEREDARAN USAHA & LUAR USAHA', '', '', '', '', '', '', '', '']
  ];

  for (const r of summary.rows.revenues) {
    sheetRows.push([
      r.accountCode,
      r.accountName,
      'Pendapatan',
      r.commercialAmount,
      r.ruleCode || '-',
      r.nature === 'NONE' ? '-' : r.nature,
      r.positiveCorrection,
      r.negativeCorrection,
      r.fiscalAmount,
      r.note ? `${r.legalBasis} — ${r.note}` : r.legalBasis
    ]);
  }

  sheetRows.push([
    '',
    'SUBTOTAL PENDAPATAN',
    '',
    summary.totalRevenueCommercial,
    '',
    '',
    summary.totalRevenuePositive,
    summary.totalRevenueNegative,
    summary.totalRevenueFiscal,
    ''
  ]);

  sheetRows.push(['', '', '', '', '', '', '', '', '', '']);
  sheetRows.push(['B', 'BEBAN POKOK, OPERASIONAL & BEBAN LAIN-LAIN', '', '', '', '', '', '', '', '']);

  for (const r of summary.rows.expenses) {
    sheetRows.push([
      r.accountCode,
      r.accountName,
      'Beban',
      r.commercialAmount,
      r.ruleCode || '-',
      r.nature === 'NONE' ? '-' : r.nature,
      r.positiveCorrection,
      r.negativeCorrection,
      r.fiscalAmount,
      r.note ? `${r.legalBasis} — ${r.note}` : r.legalBasis
    ]);
  }

  sheetRows.push([
    '',
    'SUBTOTAL BEBAN',
    '',
    summary.totalExpenseCommercial,
    '',
    '',
    summary.totalExpensePositive,
    summary.totalExpenseNegative,
    summary.totalExpenseFiscal,
    ''
  ]);

  if (summary.customAdjustments.length > 0) {
    sheetRows.push(['', '', '', '', '', '', '', '', '', '']);
    sheetRows.push(['C', 'PENYESUAIAN FISKAL TAMBAHAN (NON-AKUN)', '', '', '', '', '', '', '', '']);
    for (const c of summary.customAdjustments) {
      sheetRows.push([
        'MANUAL',
        c.description,
        c.direction === 'FPO' ? 'Koreksi Positif' : 'Koreksi Negatif',
        0,
        c.ruleCode,
        c.nature,
        c.direction === 'FPO' ? c.amount : 0,
        c.direction === 'FNE' ? c.amount : 0,
        c.direction === 'FPO' ? c.amount : -c.amount,
        c.note || ''
      ]);
    }
  }

  sheetRows.push(['', '', '', '', '', '', '', '', '', '']);
  sheetRows.push([
    'D',
    'IKHTISAR PENGHASILAN NETO FISKAL',
    '',
    summary.commercialNetProfit,
    '',
    '',
    summary.totalPositiveCorrection,
    summary.totalNegativeCorrection,
    summary.fiscalNetProfit,
    'Laba Fiskal = Laba Komersial + Koreksi Positif - Koreksi Negatif'
  ]);

  const wsMain = XLSX.utils.aoa_to_sheet(sheetRows);
  wsMain['!cols'] = [
    { wch: 12 },
    { wch: 36 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 44 }
  ];
  XLSX.utils.book_append_sheet(wb, wsMain, 'Rekonsiliasi 1771-I');

  // Sheet 2: Simulasi PPh Badan
  const taxSheet: any[][] = [
    ['SIMULASI PERHITUNGAN PPH BADAN TERUTANG (INDUK 1771 / CORETAX)'],
    [`Perusahaan: ${settings.companyName} | Periode: ${periodLabel}`],
    [''],
    ['KOMPONEN PERHITUNGAN', 'NILAI (RP)', 'KETERANGAN / DASAR HUKUM'],
    ['Laba / (Rugi) Neto Komersial', summary.commercialNetProfit, 'Berdasarkan Pembukuan SAK'],
    ['Total Koreksi Fiskal Positif (+)', summary.totalPositiveCorrection, 'Pasal 9 UU PPh & FPO-01..12'],
    ['Total Koreksi Fiskal Negatif (-)', summary.totalNegativeCorrection, 'Pasal 4(2), 4(3), 11 UU PPh & FNE-01..04'],
    ['Penghasilan Neto Fiskal', summary.fiscalNetProfit, 'Formulir 1771-I Bagian D'],
    ['Kompensasi Kerugian Fiskal', taxCalc.lossCarryForward, 'Pasal 6 ayat (2) UU PPh'],
    ['Penghasilan Kena Pajak (PKP) - Dibulatkan Ribuan', taxCalc.pkpRounded, 'Pasal 17 ayat (4) UU PPh'],
    ['Peredaran Bruto (Omzet Usaha)', taxCalc.grossTurnover, 'Dasar Penentuan Fasilitas Pasal 31E'],
    ['Skema Tarif Dipilih', taxCalc.effectiveRatePercent + '%', taxCalc.regime.toUpperCase()],
    ['PKP Mendapat Fasilitas Pasal 31E (Tarif 11%)', taxCalc.pkpFacility, '50% x 22% untuk porsi s.d. Rp 4,8 M'],
    ['PPh Badan Fasilitas (11%)', taxCalc.taxFacility, '11% x PKP Fasilitas'],
    ['PKP Non-Fasilitas (Tarif Umum 22%)', taxCalc.pkpNonFacility, 'UU No. 7 Tahun 2021 (UU HPP)'],
    ['PPh Badan Non-Fasilitas (22%)', taxCalc.taxNonFacility, '22% x PKP Non-Fasilitas'],
    ['Total PPh Badan Terutang', taxCalc.totalIncomeTax, 'Induk SPT 1771 Huruf B'],
    ['Kredit Pajak (PPh Ps. 22, 23, 25)', taxCalc.prepaidTaxCredits, 'Pajak Dibayar Dimuka'],
    ['PPh Kurang / (Lebih) Bayar (Ps. 29 / Ps. 28A)', taxCalc.taxPayable, taxCalc.taxPayable >= 0 ? 'Kurang Bayar (Ps. 29)' : 'Lebih Bayar (Ps. 28A)']
  ];
  const wsTax = XLSX.utils.aoa_to_sheet(taxSheet);
  wsTax['!cols'] = [{ wch: 46 }, { wch: 22 }, { wch: 44 }];
  XLSX.utils.book_append_sheet(wb, wsTax, 'Perhitungan PPh Badan');

  const safeName = settings.companyName.replace(/[^a-zA-Z0-9]+/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Rekonsiliasi_Fiskal_1771_${safeName}_${dateStr}.xlsx`);
}
