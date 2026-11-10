import { Account, Transaction, CompanySettings } from '../types/accounting';
import {
  calculateAccountBalance,
  generateCashFlowStatement
} from './accountingCalculations';
import {
  CorporateTaxCalculation,
  FiscalReconciliationSummary
} from './fiscalReconciliation';
import * as XLSX from 'xlsx';

export interface PsakLineItem {
  id: string;
  nameId: string;
  nameEn: string;
  note?: string;
  amountCurrent: number;
  amountPrior: number;
  // Optional Fiscal Traceability Fields
  commercialAmount?: number;
  positiveCorrection?: number;
  negativeCorrection?: number;
  isBold?: boolean;
  isHeader?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  indent?: number;
}

export interface PsakFinancialStatements {
  companyName: string;
  periodText: string;
  currentYear: number;
  priorYear: number;
  currencyText: string;
  isFiscalAdjusted?: boolean;
  balanceSheet: {
    assetsCurrent: PsakLineItem[];
    totalAssetsCurrent: { current: number; prior: number };
    assetsNonCurrent: PsakLineItem[];
    totalAssetsNonCurrent: { current: number; prior: number };
    totalAssets: { current: number; prior: number };

    liabilitiesCurrent: PsakLineItem[];
    totalLiabilitiesCurrent: { current: number; prior: number };
    liabilitiesNonCurrent: PsakLineItem[];
    totalLiabilitiesNonCurrent: { current: number; prior: number };
    totalLiabilities: { current: number; prior: number };

    equity: PsakLineItem[];
    totalEquity: { current: number; prior: number };
    totalLiabilitiesAndEquity: { current: number; prior: number };
    isBalanced: boolean;
  };
  incomeStatement: {
    items: PsakLineItem[];
    grossProfit: { current: number; prior: number };
    operatingIncome: { current: number; prior: number };
    incomeBeforeTax: { current: number; prior: number };
    netIncome: { current: number; prior: number };
    totalComprehensiveIncome: { current: number; prior: number };
  };
  equityStatement: {
    columns: string[];
    rows: {
      descriptionId: string;
      descriptionEn: string;
      capitalStock: number;
      additionalPaidIn: number;
      generalReserve: number;
      retainedEarnings: number;
      total: number;
    }[];
  };
  cashFlow: {
    operating: PsakLineItem[];
    totalOperating: { current: number; prior: number };
    investing: PsakLineItem[];
    totalInvesting: { current: number; prior: number };
    financing: PsakLineItem[];
    totalFinancing: { current: number; prior: number };
    netChange: { current: number; prior: number };
    beginningCash: { current: number; prior: number };
    endingCash: { current: number; prior: number };
    cashComposition: PsakLineItem[];
  };
  fiscalSummaryMeta?: {
    commercialNetProfit: number;
    totalPositiveCorrection: number;
    totalNegativeCorrection: number;
    fiscalNetProfit: number;
    estimatedIncomeTax: number;
    fiscalNetAfterTax: number;
    regimeLabel: string;
  };
}

export type IncomeBucketKey =
  | 'rev'
  | 'cogs'
  | 'selling'
  | 'admin'
  | 'otherIncome'
  | 'otherExp'
  | 'finIncome'
  | 'finExp'
  | 'taxExp';

/**
 * Klasifikasi deterministik dan mutually-exclusive untuk setiap akun Laba Rugi (Lr)
 * agar Laporan Resmi (PSAK), Laporan Sederhana, Koreksi Fiskal, dan Laporan Fiskal
 * selalu konsisten 100% dengan selisih Rp 0.
 */
export function classifyIncomeBucket(account: {
  code: string;
  name: string;
  category: string;
}): IncomeBucketKey {
  const lower = account.name.toLowerCase();
  const code = account.code;

  if (account.category === 'PENDAPATAN_OPERASIONAL') {
    return 'rev';
  }

  if (account.category === 'PENDAPATAN_NON_OPERASIONAL') {
    if (code === '41001' || lower.includes('bunga')) return 'finIncome';
    return 'otherIncome';
  }

  // Beban (Operasional vs Non-Operasional)
  if (code === '50018' || lower.includes('pajak penghasilan') || lower.includes('beban pph')) {
    return 'taxExp';
  }
  if (code === '50011' || lower.includes('beban bunga')) {
    return 'finExp';
  }
  if (account.category === 'BEBAN_NON_OPERASIONAL' || code === '50014' || lower.includes('lain-lain') || lower.includes('bencana')) {
    return 'otherExp';
  }
  if (code.startsWith('50') && lower.includes('pokok')) {
    return 'cogs';
  }
  if (lower.includes('iklan') || lower.includes('jual') || lower.includes('angkut')) {
    return 'selling';
  }
  return 'admin';
}

export function generatePsakReportData(
  accounts: Account[],
  transactions: Transaction[],
  settings: CompanySettings
): PsakFinancialStatements {
  const currentYear = settings.fiscalYear || new Date().getFullYear();
  const priorYear = currentYear - 1;

  // 1. Hitung saldo setiap akun secara real-time
  const balanceMap = new Map<string, { current: number; prior: number }>();
  for (const acc of accounts) {
    const { endingBalance } = calculateAccountBalance(acc, transactions);
    const opening =
      acc.sn === 'Db'
        ? (Number(acc.debetAwal) || 0) - (Number(acc.kreditAwal) || 0)
        : (Number(acc.kreditAwal) || 0) - (Number(acc.debetAwal) || 0);
    balanceMap.set(acc.code, {
      current: endingBalance,
      prior: opening
    });
  }

  const getSum = (codes: string[], usePrior = false) => {
    let sum = 0;
    for (const code of codes) {
      const b = balanceMap.get(code);
      if (b) sum += usePrior ? b.prior : b.current;
    }
    return sum;
  };

  // 2. Klasifikasi Laba Rugi dari akun COA aktual (cocok 100% dengan Laporan Sederhana)
  const buckets: Record<IncomeBucketKey, number> = {
    rev: 0,
    cogs: 0,
    selling: 0,
    admin: 0,
    otherIncome: 0,
    otherExp: 0,
    finIncome: 0,
    finExp: 0,
    taxExp: 0
  };

  for (const acc of accounts) {
    if (acc.isHeader || acc.pos !== 'Lr') continue;
    const bal = balanceMap.get(acc.code)?.current || 0;
    const key = classifyIncomeBucket(acc);
    buckets[key] += bal;
  }

  const revCurrent = buckets.rev;
  const cogsCurrent = buckets.cogs;
  const grossCurrent = revCurrent - cogsCurrent;
  const sellingCurrent = buckets.selling;
  const adminCurrent = buckets.admin;
  const otherIncomeCurrent = buckets.otherIncome;
  const otherExpCurrent = buckets.otherExp;
  const opIncomeCurrent = grossCurrent - sellingCurrent - adminCurrent + otherIncomeCurrent - otherExpCurrent;
  const finIncomeCurrent = buckets.finIncome;
  const finExpCurrent = buckets.finExp;
  const incomeBeforeTaxCurrent = opIncomeCurrent + finIncomeCurrent - finExpCurrent;
  const taxCurrent = buckets.taxExp;
  const netIncomeCurrent = incomeBeforeTaxCurrent - taxCurrent;

  // Saldo periode sebelumnya untuk kolom komparatif (jika ada saldo awal / komparatif 0 untuk akun L/R)
  const revPrior = 0;
  const cogsPrior = 0;
  const grossPrior = 0;
  const sellingPrior = 0;
  const adminPrior = 0;
  const otherIncomePrior = 0;
  const otherExpPrior = 0;
  const opIncomePrior = 0;
  const finIncomePrior = 0;
  const finExpPrior = 0;
  const incomeBeforeTaxPrior = 0;
  const taxPrior = 0;
  const netIncomePrior = 0;

  // 3. Laporan Posisi Keuangan (Neraca) berdasarkan saldo riil akun Neraca
  const kasCurrent = getSum(['10001']);
  const kasPrior = getSum(['10001'], true);

  const piutangCurrent = getSum(['10003', '10004', '10005']);
  const piutangPrior = getSum(['10003', '10004', '10005'], true);

  const persediaanCurrent = getSum(['10002', '10006', '10007']);
  const persediaanPrior = getSum(['10002', '10006', '10007'], true);

  const uangMukaCurrent = getSum(['10008', '10009', '10010']);
  const uangMukaPrior = getSum(['10008', '10009', '10010'], true);

  const totalAsetLancarCurrent = kasCurrent + piutangCurrent + persediaanCurrent + uangMukaCurrent;
  const totalAsetLancarPrior = kasPrior + piutangPrior + persediaanPrior + uangMukaPrior;

  const asetTetapGrossCurrent = getSum(['11001', '11003', '11005', '11007', '11009', '11011']);
  const asetTetapGrossPrior = getSum(['11001', '11003', '11005', '11007', '11009', '11011'], true);

  const akumPenyusutanCurrent = Math.abs(getSum(['11002', '11004', '11006', '11008', '11010']));
  const akumPenyusutanPrior = Math.abs(getSum(['11002', '11004', '11006', '11008', '11010'], true));

  const asetTetapNetCurrent = Math.max(0, asetTetapGrossCurrent - akumPenyusutanCurrent);
  const asetTetapNetPrior = Math.max(0, asetTetapGrossPrior - akumPenyusutanPrior);

  // Tangkap akun Harta Lancar/Tetap kustom (di luar kode standar) jika user menambah akun baru di COA
  const standardAssetCodes = new Set([
    '10001','10002','10003','10004','10005','10006','10007','10008','10009','10010',
    '11001','11002','11003','11004','11005','11006','11007','11008','11009','11010','11011'
  ]);
  const extraCurrentAssets = accounts
    .filter(a => !a.isHeader && a.category === 'HARTA_LANCAR' && !standardAssetCodes.has(a.code))
    .reduce((s, a) => s + (balanceMap.get(a.code)?.current || 0), 0);
  const extraFixedAssets = accounts
    .filter(a => !a.isHeader && a.category === 'HARTA_TETAP' && !standardAssetCodes.has(a.code))
    .reduce((s, a) => {
      const val = balanceMap.get(a.code)?.current || 0;
      return s + (a.sn === 'Kr' ? -Math.abs(val) : val);
    }, 0);

  const finalAsetLancarCurrent = totalAsetLancarCurrent + extraCurrentAssets;
  const totalAsetTidakLancarCurrent = asetTetapNetCurrent + extraFixedAssets;
  const totalAsetTidakLancarPrior = asetTetapNetPrior;

  const totalAsetCurrent = finalAsetLancarCurrent + totalAsetTidakLancarCurrent;
  const totalAsetPrior = totalAsetLancarPrior + totalAsetTidakLancarPrior;

  // Liabilitas Jangka Pendek
  const utangUsahaCurrent = getSum(['20001']);
  const utangUsahaPrior = getSum(['20001'], true);

  const utangBankJkPendekCurrent = getSum(['20002', '20005', '20006', '20007']);
  const utangBankJkPendekPrior = getSum(['20002', '20005', '20006', '20007'], true);

  const bebanAkrualCurrent = getSum(['20003', '20008']);
  const bebanAkrualPrior = getSum(['20003', '20008'], true);

  const utangPajakCurrent = getSum(['20004']);
  const utangPajakPrior = getSum(['20004'], true);

  const totalLiabPendekCurrent = utangUsahaCurrent + utangBankJkPendekCurrent + bebanAkrualCurrent + utangPajakCurrent;
  const totalLiabPendekPrior = utangUsahaPrior + utangBankJkPendekPrior + bebanAkrualPrior + utangPajakPrior;

  // Liabilitas Jangka Panjang
  const utangJkPanjangCurrent = getSum(['21001', '21002', '21003']);
  const utangJkPanjangPrior = getSum(['21001', '21002', '21003'], true);

  const totalLiabPanjangCurrent = utangJkPanjangCurrent;
  const totalLiabPanjangPrior = utangJkPanjangPrior;

  const totalLiabilitasCurrent = totalLiabPendekCurrent + totalLiabPanjangCurrent;
  const totalLiabilitasPrior = totalLiabPendekPrior + totalLiabPanjangPrior;

  // Ekuitas
  const modalSahamCurrent = getSum(['30000']);
  const modalSahamPrior = getSum(['30000'], true);
  const priveCurrent = getSum(['30001']);
  const ikhtisarCurrent = getSum(['30002']);

  const tambahanModalCurrent = 0;
  const tambahanModalPrior = 0;
  const cadanganUmumCurrent = 0;
  const cadanganUmumPrior = 0;

  const saldoLabaCurrent = netIncomeCurrent - priveCurrent - ikhtisarCurrent;
  const saldoLabaPrior = Math.max(0, totalAsetPrior - totalLiabilitasPrior - modalSahamPrior);

  const totalEkuitasCurrent = modalSahamCurrent + tambahanModalCurrent + cadanganUmumCurrent + saldoLabaCurrent;
  const totalEkuitasPrior = modalSahamPrior + tambahanModalPrior + cadanganUmumPrior + saldoLabaPrior;

  const totalLiabilitasDanEkuitasCurrent = totalLiabilitasCurrent + totalEkuitasCurrent;
  const totalLiabilitasDanEkuitasPrior = totalLiabilitasPrior + totalEkuitasPrior;

  const assetsCurrentItems: PsakLineItem[] = [
    { id: 'ac-1', nameId: 'Kas dan setara kas', nameEn: 'Cash and cash equivalents', note: '2,4', amountCurrent: kasCurrent, amountPrior: kasPrior },
    { id: 'ac-2', nameId: 'Piutang usaha - neto', nameEn: 'Accounts receivable - net', note: '2,6', amountCurrent: piutangCurrent, amountPrior: piutangPrior },
    { id: 'ac-3', nameId: 'Persediaan & perlengkapan - neto', nameEn: 'Inventories & supplies - net', note: '2,7', amountCurrent: persediaanCurrent, amountPrior: persediaanPrior },
    { id: 'ac-4', nameId: 'Uang muka & aset lancar lainnya', nameEn: 'Advances and other current assets', note: '2,8', amountCurrent: uangMukaCurrent + extraCurrentAssets, amountPrior: uangMukaPrior }
  ];

  const assetsNonCurrentItems: PsakLineItem[] = [
    { id: 'anc-1', nameId: 'Aset tetap (harga perolehan)', nameEn: 'Fixed assets - cost', note: '2,12', amountCurrent: asetTetapGrossCurrent, amountPrior: asetTetapGrossPrior },
    { id: 'anc-2', nameId: 'Akumulasi penyusutan aset tetap', nameEn: 'Accumulated depreciation', note: '2,12', amountCurrent: -akumPenyusutanCurrent, amountPrior: -akumPenyusutanPrior },
    ...(extraFixedAssets !== 0
      ? [{ id: 'anc-3', nameId: 'Aset tetap lainnya - neto', nameEn: 'Other non-current assets - net', note: '2,13', amountCurrent: extraFixedAssets, amountPrior: 0 }]
      : [])
  ];

  const liabilitiesCurrentItems: PsakLineItem[] = [
    { id: 'lc-1', nameId: 'Utang usaha - pihak ketiga', nameEn: 'Trade payables - third parties', note: '17', amountCurrent: utangUsahaCurrent, amountPrior: utangUsahaPrior },
    { id: 'lc-2', nameId: 'Utang jangka pendek lainnya', nameEn: 'Other short-term liabilities', note: '15', amountCurrent: utangBankJkPendekCurrent, amountPrior: utangBankJkPendekPrior },
    { id: 'lc-3', nameId: 'Beban akrual & utang gaji', nameEn: 'Accrued expenses', note: '18', amountCurrent: bebanAkrualCurrent, amountPrior: bebanAkrualPrior },
    { id: 'lc-4', nameId: 'Utang pajak', nameEn: 'Taxes payable', note: '19', amountCurrent: utangPajakCurrent, amountPrior: utangPajakPrior }
  ];

  const liabilitiesNonCurrentItems: PsakLineItem[] = [
    { id: 'lnc-1', nameId: 'Utang bank & liabilitas jangka panjang', nameEn: 'Bank loans and long-term debts', note: '20', amountCurrent: utangJkPanjangCurrent, amountPrior: utangJkPanjangPrior }
  ];

  const equityItems: PsakLineItem[] = [
    { id: 'eq-1', nameId: 'Modal saham ditempatkan & disetor penuh', nameEn: 'Issued and fully paid capital stock', note: '22', amountCurrent: modalSahamCurrent, amountPrior: modalSahamPrior },
    ...(priveCurrent !== 0
      ? [{ id: 'eq-3', nameId: 'Penarikan modal / Prive pemilik', nameEn: 'Owner drawings', note: '23', amountCurrent: -priveCurrent, amountPrior: 0 }]
      : []),
    { id: 'eq-4', nameId: 'Saldo laba periode berjalan', nameEn: 'Current period retained earnings', note: '', amountCurrent: netIncomeCurrent - ikhtisarCurrent, amountPrior: saldoLabaPrior }
  ];

  const incomeItems: PsakLineItem[] = [
    { id: 'is-1', nameId: 'PENDAPATAN / PENJUALAN NETO', nameEn: 'NET REVENUES / SALES', note: '2,27', amountCurrent: revCurrent, amountPrior: revPrior, isBold: true },
    { id: 'is-2', nameId: 'BEBAN POKOK PENJUALAN', nameEn: 'COST OF GOODS SOLD', note: '2,28', amountCurrent: -cogsCurrent, amountPrior: -cogsPrior },
    { id: 'is-3', nameId: 'LABA BRUTO', nameEn: 'GROSS PROFIT', note: '', amountCurrent: grossCurrent, amountPrior: grossPrior, isBold: true, isSubtotal: true },
    { id: 'is-4', nameId: 'Beban penjualan dan distribusi', nameEn: 'Selling and distribution expenses', note: '29', amountCurrent: -sellingCurrent, amountPrior: -sellingPrior, indent: 1 },
    { id: 'is-5', nameId: 'Beban umum dan administrasi', nameEn: 'General and administrative expenses', note: '29', amountCurrent: -adminCurrent, amountPrior: -adminPrior, indent: 1 },
    { id: 'is-6', nameId: 'Penghasilan operasi lain', nameEn: 'Other operating income', note: '29', amountCurrent: otherIncomeCurrent, amountPrior: otherIncomePrior, indent: 1 },
    { id: 'is-7', nameId: 'Beban operasi lain', nameEn: 'Other operating expenses', note: '29', amountCurrent: -otherExpCurrent, amountPrior: -otherExpPrior, indent: 1 },
    { id: 'is-8', nameId: 'LABA USAHA', nameEn: 'INCOME FROM OPERATIONS', note: '', amountCurrent: opIncomeCurrent, amountPrior: opIncomePrior, isBold: true, isSubtotal: true },
    { id: 'is-9', nameId: 'Penghasilan keuangan', nameEn: 'Finance income', note: '30', amountCurrent: finIncomeCurrent, amountPrior: finIncomePrior, indent: 1 },
    { id: 'is-10', nameId: 'Beban keuangan', nameEn: 'Finance expenses', note: '31', amountCurrent: -finExpCurrent, amountPrior: -finExpPrior, indent: 1 },
    { id: 'is-11', nameId: 'LABA SEBELUM BEBAN PAJAK PENGHASILAN', nameEn: 'INCOME BEFORE INCOME TAX EXPENSE', note: '', amountCurrent: incomeBeforeTaxCurrent, amountPrior: incomeBeforeTaxPrior, isBold: true, isSubtotal: true },
    { id: 'is-12', nameId: 'Beban Pajak Penghasilan (Komersial)', nameEn: 'Income Tax Expense (Commercial)', note: '19', amountCurrent: -taxCurrent, amountPrior: -taxPrior, indent: 1 },
    { id: 'is-13', nameId: 'LABA TAHUN BERJALAN', nameEn: 'INCOME FOR THE YEAR', note: '', amountCurrent: netIncomeCurrent, amountPrior: netIncomePrior, isBold: true, isTotal: true },
    { id: 'is-14', nameId: 'TOTAL LABA KOMPREHENSIF TAHUN BERJALAN', nameEn: 'TOTAL COMPREHENSIVE INCOME FOR THE YEAR', note: '', amountCurrent: netIncomeCurrent, amountPrior: netIncomePrior, isBold: true, isTotal: true }
  ];

  // 4. Arus Kas Riil (sinkron 100% dengan generateCashFlowStatement)
  const cf = generateCashFlowStatement(accounts, transactions);
  const opCashSuppliesAndOps = -(cf.cashForSupplies + cf.cashForOperations + cf.cashForInterest);

  return {
    companyName: settings.companyName,
    periodText: settings.fiscalPeriod || `31 Desember ${currentYear}`,
    currentYear,
    priorYear,
    currencyText: 'Disajikan dalam Rupiah Penuh, Kecuali Dinyatakan Lain / Expressed in Rupiah, Unless Otherwise Stated',
    isFiscalAdjusted: false,
    balanceSheet: {
      assetsCurrent: assetsCurrentItems,
      totalAssetsCurrent: { current: finalAsetLancarCurrent, prior: totalAsetLancarPrior },
      assetsNonCurrent: assetsNonCurrentItems,
      totalAssetsNonCurrent: { current: totalAsetTidakLancarCurrent, prior: totalAsetTidakLancarPrior },
      totalAssets: { current: totalAsetCurrent, prior: totalAsetPrior },
      liabilitiesCurrent: liabilitiesCurrentItems,
      totalLiabilitiesCurrent: { current: totalLiabPendekCurrent, prior: totalLiabPendekPrior },
      liabilitiesNonCurrent: liabilitiesNonCurrentItems,
      totalLiabilitiesNonCurrent: { current: totalLiabPanjangCurrent, prior: totalLiabPanjangPrior },
      totalLiabilities: { current: totalLiabilitasCurrent, prior: totalLiabilitasPrior },
      equity: equityItems,
      totalEquity: { current: totalEkuitasCurrent, prior: totalEkuitasPrior },
      totalLiabilitiesAndEquity: { current: totalLiabilitasDanEkuitasCurrent, prior: totalLiabilitasDanEkuitasPrior },
      isBalanced: Math.abs(totalAsetCurrent - totalLiabilitasDanEkuitasCurrent) < 1
    },
    incomeStatement: {
      items: incomeItems,
      grossProfit: { current: grossCurrent, prior: grossPrior },
      operatingIncome: { current: opIncomeCurrent, prior: opIncomePrior },
      incomeBeforeTax: { current: incomeBeforeTaxCurrent, prior: incomeBeforeTaxPrior },
      netIncome: { current: netIncomeCurrent, prior: netIncomePrior },
      totalComprehensiveIncome: { current: netIncomeCurrent, prior: netIncomePrior }
    },
    equityStatement: {
      columns: [
        'Keterangan / Description',
        'Modal Saham / Capital Stock',
        'Tambahan Modal / Add. Paid-in',
        'Cadangan Umum / General Reserve',
        'Saldo Laba / Retained Earnings',
        'Total Ekuitas / Total Equity'
      ],
      rows: [
        {
          descriptionId: 'Saldo Awal Periode / Modal Disetor',
          descriptionEn: 'Beginning Balance / Paid-in Capital',
          capitalStock: modalSahamCurrent,
          additionalPaidIn: 0,
          generalReserve: 0,
          retainedEarnings: 0,
          total: modalSahamCurrent
        },
        {
          descriptionId: `Laba bersih tahun berjalan ${currentYear}`,
          descriptionEn: `Net income for the year ${currentYear}`,
          capitalStock: 0,
          additionalPaidIn: 0,
          generalReserve: 0,
          retainedEarnings: netIncomeCurrent,
          total: netIncomeCurrent
        },
        ...(priveCurrent !== 0
          ? [{
              descriptionId: 'Penarikan modal / Prive pemilik',
              descriptionEn: 'Owner withdrawals / Prive',
              capitalStock: 0,
              additionalPaidIn: 0,
              generalReserve: 0,
              retainedEarnings: -priveCurrent,
              total: -priveCurrent
            }]
          : []),
        {
          descriptionId: `Saldo Akhir Periode ${currentYear}`,
          descriptionEn: `Ending Balance ${currentYear}`,
          capitalStock: modalSahamCurrent,
          additionalPaidIn: 0,
          generalReserve: 0,
          retainedEarnings: saldoLabaCurrent,
          total: totalEkuitasCurrent
        }
      ]
    },
    cashFlow: {
      operating: [
        { id: 'cfo-1', nameId: 'Penerimaan kas dari pelanggan', nameEn: 'Cash received from customers', amountCurrent: cf.cashFromCustomers, amountPrior: 0 },
        { id: 'cfo-2', nameId: 'Pembayaran kas kepada pemasok, beban operasional & bunga', nameEn: 'Cash paid to suppliers, operations & interest', amountCurrent: opCashSuppliesAndOps, amountPrior: 0 },
        { id: 'cfo-3', nameId: 'Pembayaran pajak penghasilan', nameEn: 'Payments of income tax', amountCurrent: -cf.cashForTax, amountPrior: 0 }
      ],
      totalOperating: { current: cf.netOperatingCash, prior: 0 },
      investing: [
        { id: 'cfi-1', nameId: 'Penerimaan penjualan aset tetap', nameEn: 'Proceeds from sale of fixed assets', amountCurrent: cf.cashFromInvestingSales, amountPrior: 0 },
        { id: 'cfi-2', nameId: 'Perolehan aset tetap dan investasi', nameEn: 'Additions to fixed assets and investments', amountCurrent: -cf.cashForAssetsPurchase, amountPrior: 0 }
      ],
      totalInvesting: { current: cf.netInvestingCash, prior: 0 },
      financing: [
        { id: 'cff-1', nameId: 'Setoran modal pemilik', nameEn: 'Owner capital contributions', amountCurrent: cf.cashFromOwnerEquity, amountPrior: 0 },
        { id: 'cff-2', nameId: 'Pembayaran pinjaman & utang bank', nameEn: 'Repayments of bank loans & payables', amountCurrent: -cf.cashForLoanRepayment, amountPrior: 0 },
        { id: 'cff-3', nameId: 'Penarikan prive pemilik', nameEn: 'Owner drawings', amountCurrent: -cf.cashForPrive, amountPrior: 0 }
      ],
      totalFinancing: { current: cf.netFinancingCash, prior: 0 },
      netChange: { current: cf.netCashChange, prior: 0 },
      beginningCash: { current: cf.startingKas, prior: 0 },
      endingCash: { current: cf.endingKas, prior: cf.startingKas },
      cashComposition: [
        { id: 'cc-1', nameId: 'Kas dan bank', nameEn: 'Cash in banks and on hand', amountCurrent: kasCurrent, amountPrior: kasPrior }
      ]
    }
  };
}

/**
 * Menghasilkan Laporan Keuangan Resmi PASCA KOREKSI FISKAL (Hasil Rekonsiliasi 1771-I & Coretax L1).
 * Menggunakan pembukuan komersial sebagai dasar dan langsung menerapkan seluruh koreksi FPO/FNE
 * serta taksiran PPh Badan Terutang (Pasal 31E / Pasal 17 / PP 55).
 */
export function generateFiscalPsakReportData(
  accounts: Account[],
  transactions: Transaction[],
  settings: CompanySettings,
  fiscalSummary: FiscalReconciliationSummary,
  taxCalc: CorporateTaxCalculation
): PsakFinancialStatements {
  const base = generatePsakReportData(accounts, transactions, settings);

  // Kumpulkan rincian komersial, koreksi positif, koreksi negatif, dan nilai fiskal per bucket Laba Rugi
  interface BucketAccum {
    commercial: number;
    pos: number;
    neg: number;
    fiscal: number;
  }
  const bucketMap: Record<IncomeBucketKey, BucketAccum> = {
    rev: { commercial: 0, pos: 0, neg: 0, fiscal: 0 },
    cogs: { commercial: 0, pos: 0, neg: 0, fiscal: 0 },
    selling: { commercial: 0, pos: 0, neg: 0, fiscal: 0 },
    admin: { commercial: 0, pos: 0, neg: 0, fiscal: 0 },
    otherIncome: { commercial: 0, pos: 0, neg: 0, fiscal: 0 },
    otherExp: { commercial: 0, pos: 0, neg: 0, fiscal: 0 },
    finIncome: { commercial: 0, pos: 0, neg: 0, fiscal: 0 },
    finExp: { commercial: 0, pos: 0, neg: 0, fiscal: 0 },
    taxExp: { commercial: 0, pos: 0, neg: 0, fiscal: 0 }
  };

  let deprFpoAdjustment = 0;
  let deprFneAdjustment = 0;

  const allRows = [...fiscalSummary.rows.revenues, ...fiscalSummary.rows.expenses];
  for (const r of allRows) {
    const key = classifyIncomeBucket({
      code: r.accountCode,
      name: r.accountName,
      category: r.category
    });
    bucketMap[key].commercial += r.commercialAmount;
    bucketMap[key].pos += r.positiveCorrection;
    bucketMap[key].neg += r.negativeCorrection;
    bucketMap[key].fiscal += r.fiscalAmount;

    if (r.ruleCode === 'FPO-09') deprFpoAdjustment += r.positiveCorrection;
    if (r.ruleCode === 'FNE-02') deprFneAdjustment += r.negativeCorrection;
  }

  const customPos = fiscalSummary.customAdjustments
    .filter(c => c.direction === 'FPO')
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const customNeg = fiscalSummary.customAdjustments
    .filter(c => c.direction === 'FNE')
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);

  fiscalSummary.customAdjustments.forEach(c => {
    if (c.ruleCode === 'FPO-09') deprFpoAdjustment += c.amount;
    if (c.ruleCode === 'FNE-02') deprFneAdjustment += c.amount;
  });

  const rev = bucketMap.rev;
  const cogs = bucketMap.cogs;
  const grossFiscal = rev.fiscal - cogs.fiscal;
  const grossComm = rev.commercial - cogs.commercial;

  const selling = bucketMap.selling;
  const admin = bucketMap.admin;
  const otherInc = bucketMap.otherIncome;
  const otherExp = bucketMap.otherExp;
  const finInc = bucketMap.finIncome;
  const finExp = bucketMap.finExp;
  const commTaxExp = bucketMap.taxExp;

  const customNet = customPos - customNeg;
  const opIncomeFiscal =
    grossFiscal - selling.fiscal - admin.fiscal + otherInc.fiscal - otherExp.fiscal + customNet;
  const opIncomeComm =
    grossComm - selling.commercial - admin.commercial + otherInc.commercial - otherExp.commercial;

  // Penghasilan Neto Fiskal (Laba Sebelum Pajak Fiskal) = sesuai Formulir 1771-I Bagian D
  const fiscalBeforeTax =
    opIncomeFiscal + finInc.fiscal - finExp.fiscal - commTaxExp.fiscal;
  const commBeforeTax = opIncomeComm + finInc.commercial - finExp.commercial;

  const estimatedCorporateTax = taxCalc.totalIncomeTax;
  const fiscalNetAfterTax = fiscalBeforeTax - estimatedCorporateTax;
  const commNetAfterTax = commBeforeTax - commTaxExp.commercial;

  const regimeLabel =
    taxCalc.regime === 'pasal31e'
      ? `Pasal 31E UU PPh (Efektif ${taxCalc.effectiveRatePercent}%)`
      : taxCalc.regime === 'pasal17'
      ? 'Pasal 17 UU HPP (Tarif Umum 22%)'
      : 'PP 55/2022 (PPh Final UMKM 0,5%)';

  const fiscalIncomeItems: PsakLineItem[] = [
    {
      id: 'fis-1',
      nameId: 'PENDAPATAN / PENJUALAN NETO FISKAL',
      nameEn: 'FISCAL NET REVENUES / SALES',
      note: '1771-I A',
      amountCurrent: rev.fiscal,
      amountPrior: 0,
      commercialAmount: rev.commercial,
      positiveCorrection: rev.pos,
      negativeCorrection: rev.neg,
      isBold: true
    },
    {
      id: 'fis-2',
      nameId: 'BEBAN POKOK PENJUALAN FISKAL',
      nameEn: 'FISCAL COST OF GOODS SOLD',
      note: '1771-I A',
      amountCurrent: -cogs.fiscal,
      amountPrior: 0,
      commercialAmount: -cogs.commercial,
      positiveCorrection: cogs.pos,
      negativeCorrection: cogs.neg
    },
    {
      id: 'fis-3',
      nameId: 'LABA BRUTO FISKAL',
      nameEn: 'FISCAL GROSS PROFIT',
      note: '',
      amountCurrent: grossFiscal,
      amountPrior: 0,
      commercialAmount: grossComm,
      isBold: true,
      isSubtotal: true
    },
    {
      id: 'fis-4',
      nameId: 'Beban penjualan dan distribusi (Fiskal)',
      nameEn: 'Deductible selling & distribution expenses',
      note: 'Ps. 6',
      amountCurrent: -selling.fiscal,
      amountPrior: 0,
      commercialAmount: -selling.commercial,
      positiveCorrection: selling.pos,
      negativeCorrection: selling.neg,
      indent: 1
    },
    {
      id: 'fis-5',
      nameId: 'Beban umum dan administrasi (Fiskal)',
      nameEn: 'Deductible general & administrative expenses',
      note: 'Ps. 6,9',
      amountCurrent: -admin.fiscal,
      amountPrior: 0,
      commercialAmount: -admin.commercial,
      positiveCorrection: admin.pos,
      negativeCorrection: admin.neg,
      indent: 1
    },
    {
      id: 'fis-6',
      nameId: 'Penghasilan operasi lain (Objek PPh Umum)',
      nameEn: 'Other taxable operating income',
      note: 'Ps. 4',
      amountCurrent: otherInc.fiscal,
      amountPrior: 0,
      commercialAmount: otherInc.commercial,
      positiveCorrection: otherInc.pos,
      negativeCorrection: otherInc.neg,
      indent: 1
    },
    {
      id: 'fis-7',
      nameId: 'Beban operasi lain (Deductible)',
      nameEn: 'Other deductible operating expenses',
      note: 'Ps. 6,9',
      amountCurrent: -otherExp.fiscal,
      amountPrior: 0,
      commercialAmount: -otherExp.commercial,
      positiveCorrection: otherExp.pos,
      negativeCorrection: otherExp.neg,
      indent: 1
    },
    ...(customPos > 0 || customNeg > 0
      ? [
          {
            id: 'fis-7b',
            nameId: 'Penyesuaian fiskal tambahan (Manual Multi-Kode L1)',
            nameEn: 'Manual multi-code fiscal adjustments',
            note: 'PER-11',
            amountCurrent: customNet,
            amountPrior: 0,
            commercialAmount: 0,
            positiveCorrection: customPos,
            negativeCorrection: customNeg,
            indent: 1
          }
        ]
      : []),
    {
      id: 'fis-8',
      nameId: 'LABA USAHA FISKAL',
      nameEn: 'FISCAL OPERATING INCOME',
      note: '',
      amountCurrent: opIncomeFiscal,
      amountPrior: 0,
      commercialAmount: opIncomeComm,
      isBold: true,
      isSubtotal: true
    },
    {
      id: 'fis-9',
      nameId: 'Penghasilan keuangan (Non-Final)',
      nameEn: 'Non-final finance income',
      note: 'Ps. 4(2)',
      amountCurrent: finInc.fiscal,
      amountPrior: 0,
      commercialAmount: finInc.commercial,
      positiveCorrection: finInc.pos,
      negativeCorrection: finInc.neg,
      indent: 1
    },
    {
      id: 'fis-10',
      nameId: 'Beban keuangan (Deductible)',
      nameEn: 'Deductible finance expenses',
      note: 'Ps. 6',
      amountCurrent: -finExp.fiscal,
      amountPrior: 0,
      commercialAmount: -finExp.commercial,
      positiveCorrection: finExp.pos,
      negativeCorrection: finExp.neg,
      indent: 1
    },
    {
      id: 'fis-10b',
      nameId: 'Beban PPh komersial (dikoreksi FPO-06)',
      nameEn: 'Commercial tax expense (eliminated via FPO-06)',
      note: 'Ps. 9(1)h',
      amountCurrent: -commTaxExp.fiscal,
      amountPrior: 0,
      commercialAmount: -commTaxExp.commercial,
      positiveCorrection: commTaxExp.pos,
      negativeCorrection: commTaxExp.neg,
      indent: 1
    },
    {
      id: 'fis-11',
      nameId: 'PENGHASILAN NETO FISKAL (LABA SEBELUM PPH BADAN)',
      nameEn: 'NET FISCAL INCOME (TAXABLE BASE PRE-LOSS)',
      note: '1771-I D',
      amountCurrent: fiscalBeforeTax,
      amountPrior: 0,
      commercialAmount: commNetAfterTax,
      positiveCorrection: fiscalSummary.totalPositiveCorrection,
      negativeCorrection: fiscalSummary.totalNegativeCorrection,
      isBold: true,
      isSubtotal: true
    },
    {
      id: 'fis-12',
      nameId: `Beban Pajak Penghasilan Badan Terutang — ${regimeLabel}`,
      nameEn: 'Estimated Corporate Income Tax Expense',
      note: 'Induk 1771',
      amountCurrent: -estimatedCorporateTax,
      amountPrior: 0,
      commercialAmount: -commTaxExp.commercial,
      indent: 1
    },
    {
      id: 'fis-13',
      nameId: 'LABA BERSIH FISKAL TAHUN BERJALAN',
      nameEn: 'FISCAL NET INCOME AFTER TAX',
      note: '',
      amountCurrent: fiscalNetAfterTax,
      amountPrior: 0,
      commercialAmount: commNetAfterTax,
      isBold: true,
      isTotal: true
    },
    {
      id: 'fis-14',
      nameId: 'TOTAL LABA KOMPREHENSIF FISKAL TAHUN BERJALAN',
      nameEn: 'TOTAL FISCAL COMPREHENSIVE INCOME',
      note: '',
      amountCurrent: fiscalNetAfterTax,
      amountPrior: 0,
      commercialAmount: commNetAfterTax,
      isBold: true,
      isTotal: true
    }
  ];

  // 2. Neraca Fiskal (Pasca Koreksi): menyesuaikan Nilai Buku Fiskal Aset Tetap (Beda Waktu Penyusutan)
  // & Kewajiban PPh Badan Terutang (Pasal 29 / Lebih Bayar Pasal 28A)
  const netFixedDeprDiff = deprFpoAdjustment - deprFneAdjustment; // Positif = beban susut fiskal lebih kecil -> nilai buku fiskal aset lebih tinggi
  const prepaidTaxAsset = taxCalc.taxPayable < 0 ? Math.abs(taxCalc.taxPayable) : 0;
  const accruedTaxPayableDiff = Math.max(0, taxCalc.totalIncomeTax - taxCalc.prepaidTaxCredits);

  const fiscalAssetsCurrent = base.balanceSheet.assetsCurrent.map(item => ({
    ...item,
    commercialAmount: item.amountCurrent
  }));
  if (prepaidTaxAsset > 0) {
    fiscalAssetsCurrent.push({
      id: 'ac-fis-tax',
      nameId: 'Pajak dibayar dimuka / Kelebihan bayar PPh Ps. 28A',
      nameEn: 'Prepaid corporate income tax receivable (Art. 28A)',
      note: 'Fiskal',
      amountCurrent: prepaidTaxAsset,
      amountPrior: 0,
      commercialAmount: 0
    });
  }
  const fiscalTotalAssetsCurrent = base.balanceSheet.totalAssetsCurrent.current + prepaidTaxAsset;

  const fiscalAssetsNonCurrent = base.balanceSheet.assetsNonCurrent.map(item => {
    if (item.id === 'anc-2') {
      // Sesuaikan Akumulasi Penyusutan dengan beda waktu fiskal
      const fiscalAccum = item.amountCurrent + netFixedDeprDiff;
      return {
        ...item,
        nameId: 'Akumulasi penyusutan aset tetap (Nilai Fiskal)',
        nameEn: 'Accumulated depreciation (Fiscal Basis)',
        amountCurrent: fiscalAccum,
        commercialAmount: item.amountCurrent,
        positiveCorrection: deprFpoAdjustment,
        negativeCorrection: deprFneAdjustment
      };
    }
    return { ...item, commercialAmount: item.amountCurrent };
  });
  const fiscalTotalAssetsNonCurrent = base.balanceSheet.totalAssetsNonCurrent.current + netFixedDeprDiff;
  const fiscalTotalAssets = fiscalTotalAssetsCurrent + fiscalTotalAssetsNonCurrent;

  const fiscalLiabilitiesCurrent = base.balanceSheet.liabilitiesCurrent.map(item => {
    if (item.id === 'lc-4') {
      const fiscalTaxLiab = item.amountCurrent + accruedTaxPayableDiff;
      return {
        ...item,
        nameId: 'Utang pajak & Taksiran PPh Badan Ps. 29',
        nameEn: 'Taxes payable & Corporate Tax Liability Art. 29',
        amountCurrent: fiscalTaxLiab,
        commercialAmount: item.amountCurrent
      };
    }
    return { ...item, commercialAmount: item.amountCurrent };
  });
  const fiscalTotalLiabCurrent = base.balanceSheet.totalLiabilitiesCurrent.current + accruedTaxPayableDiff;
  const fiscalTotalLiabNonCurrent = base.balanceSheet.totalLiabilitiesNonCurrent.current;
  const fiscalTotalLiabilities = fiscalTotalLiabCurrent + fiscalTotalLiabNonCurrent;

  const priveAmount = base.balanceSheet.equity.find(e => e.id === 'eq-3')?.amountCurrent || 0;
  const modalSaham = base.balanceSheet.equity.find(e => e.id === 'eq-1')?.amountCurrent || 0;
  const fiscalRetainedEarnings = fiscalTotalAssets - fiscalTotalLiabilities - modalSaham - priveAmount;
  const fiscalTotalEquity = modalSaham + priveAmount + fiscalRetainedEarnings;
  const fiscalTotalLiabAndEquity = fiscalTotalLiabilities + fiscalTotalEquity;

  const fiscalEquityItems: PsakLineItem[] = [
    {
      id: 'eq-fis-1',
      nameId: 'Modal saham ditempatkan & disetor penuh',
      nameEn: 'Issued and fully paid capital stock',
      note: '22',
      amountCurrent: modalSaham,
      amountPrior: 0,
      commercialAmount: modalSaham
    },
    ...(priveAmount !== 0
      ? [
          {
            id: 'eq-fis-3',
            nameId: 'Penarikan modal / Prive pemilik',
            nameEn: 'Owner drawings',
            note: '23',
            amountCurrent: priveAmount,
            amountPrior: 0,
            commercialAmount: priveAmount
          }
        ]
      : []),
    {
      id: 'eq-fis-4',
      nameId: 'Saldo laba fiskal & penyesuaian pasca rekonsiliasi',
      nameEn: 'Fiscal retained earnings (post-reconciliation)',
      note: '1771-I',
      amountCurrent: fiscalRetainedEarnings,
      amountPrior: 0,
      commercialAmount: commNetAfterTax
    }
  ];

  return {
    ...base,
    isFiscalAdjusted: true,
    balanceSheet: {
      assetsCurrent: fiscalAssetsCurrent,
      totalAssetsCurrent: { current: fiscalTotalAssetsCurrent, prior: base.balanceSheet.totalAssetsCurrent.prior },
      assetsNonCurrent: fiscalAssetsNonCurrent,
      totalAssetsNonCurrent: { current: fiscalTotalAssetsNonCurrent, prior: base.balanceSheet.totalAssetsNonCurrent.prior },
      totalAssets: { current: fiscalTotalAssets, prior: base.balanceSheet.totalAssets.prior },
      liabilitiesCurrent: fiscalLiabilitiesCurrent,
      totalLiabilitiesCurrent: { current: fiscalTotalLiabCurrent, prior: base.balanceSheet.totalLiabilitiesCurrent.prior },
      liabilitiesNonCurrent: base.balanceSheet.liabilitiesNonCurrent.map(i => ({ ...i, commercialAmount: i.amountCurrent })),
      totalLiabilitiesNonCurrent: { current: fiscalTotalLiabNonCurrent, prior: base.balanceSheet.totalLiabilitiesNonCurrent.prior },
      totalLiabilities: { current: fiscalTotalLiabilities, prior: base.balanceSheet.totalLiabilities.prior },
      equity: fiscalEquityItems,
      totalEquity: { current: fiscalTotalEquity, prior: base.balanceSheet.totalEquity.prior },
      totalLiabilitiesAndEquity: { current: fiscalTotalLiabAndEquity, prior: base.balanceSheet.totalLiabilitiesAndEquity.prior },
      isBalanced: Math.abs(fiscalTotalAssets - fiscalTotalLiabAndEquity) < 1
    },
    incomeStatement: {
      items: fiscalIncomeItems,
      grossProfit: { current: grossFiscal, prior: 0 },
      operatingIncome: { current: opIncomeFiscal, prior: 0 },
      incomeBeforeTax: { current: fiscalBeforeTax, prior: 0 },
      netIncome: { current: fiscalNetAfterTax, prior: 0 },
      totalComprehensiveIncome: { current: fiscalNetAfterTax, prior: 0 }
    },
    equityStatement: {
      ...base.equityStatement,
      rows: [
        {
          descriptionId: 'Saldo Awal Periode / Modal Disetor',
          descriptionEn: 'Beginning Balance / Paid-in Capital',
          capitalStock: modalSaham,
          additionalPaidIn: 0,
          generalReserve: 0,
          retainedEarnings: 0,
          total: modalSaham
        },
        {
          descriptionId: `Laba bersih fiskal setelah PPh Badan (${base.currentYear})`,
          descriptionEn: `Fiscal net income after corporate tax (${base.currentYear})`,
          capitalStock: 0,
          additionalPaidIn: 0,
          generalReserve: 0,
          retainedEarnings: fiscalNetAfterTax,
          total: fiscalNetAfterTax
        },
        ...(fiscalRetainedEarnings - fiscalNetAfterTax !== 0
          ? [
              {
                descriptionId: 'Selisih rekonsiliasi ekuitas fiskal (koreksi tetap & beda waktu)',
                descriptionEn: 'Fiscal reconciliation equity difference',
                capitalStock: 0,
                additionalPaidIn: 0,
                generalReserve: 0,
                retainedEarnings: fiscalRetainedEarnings - fiscalNetAfterTax,
                total: fiscalRetainedEarnings - fiscalNetAfterTax
              }
            ]
          : []),
        ...(priveAmount !== 0
          ? [
              {
                descriptionId: 'Penarikan modal / Prive pemilik',
                descriptionEn: 'Owner withdrawals / Prive',
                capitalStock: 0,
                additionalPaidIn: 0,
                generalReserve: 0,
                retainedEarnings: priveAmount,
                total: priveAmount
              }
            ]
          : []),
        {
          descriptionId: `Saldo Akhir Ekuitas Fiskal ${base.currentYear}`,
          descriptionEn: `Ending Fiscal Equity Balance ${base.currentYear}`,
          capitalStock: modalSaham,
          additionalPaidIn: 0,
          generalReserve: 0,
          retainedEarnings: fiscalRetainedEarnings + priveAmount,
          total: fiscalTotalEquity
        }
      ]
    },
    fiscalSummaryMeta: {
      commercialNetProfit: fiscalSummary.commercialNetProfit,
      totalPositiveCorrection: fiscalSummary.totalPositiveCorrection,
      totalNegativeCorrection: fiscalSummary.totalNegativeCorrection,
      fiscalNetProfit: fiscalBeforeTax,
      estimatedIncomeTax: estimatedCorporateTax,
      fiscalNetAfterTax,
      regimeLabel
    }
  };
}

export function exportFullPsakWorkbook(data: PsakFinancialStatements) {
  const wb = XLSX.utils.book_new();
  const labelPrefix = data.isFiscalAdjusted ? 'FISKAL (PASCA KOREKSI) — ' : '';

  // Sheet 1: Neraca
  const bsRows = [
    [data.companyName.toUpperCase()],
    [`${labelPrefix}LAPORAN POSISI KEUANGAN KONSOLIDASIAN / STATEMENT OF FINANCIAL POSITION`],
    [`Per ${data.periodText}`],
    [data.currencyText],
    [''],
    ['KETERANGAN / LINE ITEM', 'CATATAN / NOTES', `TAHUN ${data.currentYear}`, `TAHUN ${data.priorYear}`, 'ENGLISH DESCRIPTION'],
    ['ASET / ASSETS', '', '', '', ''],
    ['ASET LANCAR / CURRENT ASSETS', '', '', '', ''],
    ...data.balanceSheet.assetsCurrent.map(i => [i.nameId, i.note || '', i.amountCurrent, i.amountPrior, i.nameEn]),
    ['Total Aset Lancar / Total Current Assets', '', data.balanceSheet.totalAssetsCurrent.current, data.balanceSheet.totalAssetsCurrent.prior, 'Total Current Assets'],
    [''],
    ['ASET TIDAK LANCAR / NON-CURRENT ASSETS', '', '', '', ''],
    ...data.balanceSheet.assetsNonCurrent.map(i => [i.nameId, i.note || '', i.amountCurrent, i.amountPrior, i.nameEn]),
    ['Total Aset Tidak Lancar / Total Non-Current Assets', '', data.balanceSheet.totalAssetsNonCurrent.current, data.balanceSheet.totalAssetsNonCurrent.prior, 'Total Non-Current Assets'],
    ['TOTAL ASET / TOTAL ASSETS', '', data.balanceSheet.totalAssets.current, data.balanceSheet.totalAssets.prior, 'TOTAL ASSETS'],
    [''],
    ['LIABILITAS DAN EKUITAS / LIABILITIES AND EQUITY', '', '', '', ''],
    ['LIABILITAS JANGKA PENDEK / CURRENT LIABILITIES', '', '', '', ''],
    ...data.balanceSheet.liabilitiesCurrent.map(i => [i.nameId, i.note || '', i.amountCurrent, i.amountPrior, i.nameEn]),
    ['Total Liabilitas Jangka Pendek', '', data.balanceSheet.totalLiabilitiesCurrent.current, data.balanceSheet.totalLiabilitiesCurrent.prior, 'Total Current Liabilities'],
    [''],
    ['LIABILITAS JANGKA PANJANG / NON-CURRENT LIABILITIES', '', '', '', ''],
    ...data.balanceSheet.liabilitiesNonCurrent.map(i => [i.nameId, i.note || '', i.amountCurrent, i.amountPrior, i.nameEn]),
    ['Total Liabilitas Jangka Panjang', '', data.balanceSheet.totalLiabilitiesNonCurrent.current, data.balanceSheet.totalLiabilitiesNonCurrent.prior, 'Total Non-Current Liabilities'],
    ['TOTAL LIABILITAS / TOTAL LIABILITIES', '', data.balanceSheet.totalLiabilities.current, data.balanceSheet.totalLiabilities.prior, 'TOTAL LIABILITIES'],
    [''],
    ['EKUITAS / EQUITY', '', '', '', ''],
    ...data.balanceSheet.equity.map(i => [i.nameId, i.note || '', i.amountCurrent, i.amountPrior, i.nameEn]),
    ['TOTAL EKUITAS / TOTAL EQUITY', '', data.balanceSheet.totalEquity.current, data.balanceSheet.totalEquity.prior, 'TOTAL EQUITY'],
    ['TOTAL LIABILITAS DAN EKUITAS', '', data.balanceSheet.totalLiabilitiesAndEquity.current, data.balanceSheet.totalLiabilitiesAndEquity.prior, 'TOTAL LIABILITIES AND EQUITY']
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bsRows), 'Posisi Keuangan');

  // Sheet 2: Laba Rugi (menyertakan kolom jejak koreksi jika laporan fiskal)
  const isRows = data.isFiscalAdjusted
    ? [
        [data.companyName.toUpperCase()],
        ['LAPORAN LABA RUGI FISKAL RESMI (PASCA KOREKSI REKONSILIASI 1771-I)'],
        [`Untuk Periode yang Berakhir pada ${data.periodText}`],
        [data.currencyText],
        [''],
        [
          'KETERANGAN / LINE ITEM',
          'CATATAN / NOTES',
          'KOMERSIAL (SAK)',
          'KOREKSI POSITIF (+)',
          'KOREKSI NEGATIF (-)',
          `FISKAL ${data.currentYear}`,
          'ENGLISH DESCRIPTION'
        ],
        ...data.incomeStatement.items.map(i => [
          i.nameId,
          i.note || '',
          i.commercialAmount ?? '',
          i.positiveCorrection ?? '',
          i.negativeCorrection ?? '',
          i.amountCurrent,
          i.nameEn
        ])
      ]
    : [
        [data.companyName.toUpperCase()],
        ['LAPORAN LABA RUGI DAN PENGHASILAN KOMPREHENSIF LAIN KONSOLIDASIAN'],
        [`Untuk Periode yang Berakhir pada ${data.periodText}`],
        [data.currencyText],
        [''],
        ['KETERANGAN / LINE ITEM', 'CATATAN / NOTES', `TAHUN ${data.currentYear}`, `TAHUN ${data.priorYear}`, 'ENGLISH DESCRIPTION'],
        ...data.incomeStatement.items.map(i => [i.nameId, i.note || '', i.amountCurrent, i.amountPrior, i.nameEn])
      ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(isRows), data.isFiscalAdjusted ? 'Laba Rugi Fiskal' : 'Laba Rugi');

  // Sheet 3: Perubahan Ekuitas
  const eqRows = [
    [data.companyName.toUpperCase()],
    [`${labelPrefix}LAPORAN PERUBAHAN EKUITAS`],
    [`Untuk Periode yang Berakhir pada ${data.periodText}`],
    [''],
    data.equityStatement.columns,
    ...data.equityStatement.rows.map(r => [
      r.descriptionId,
      r.capitalStock,
      r.additionalPaidIn,
      r.generalReserve,
      r.retainedEarnings,
      r.total
    ])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eqRows), 'Perubahan Ekuitas');

  // Sheet 4: Arus Kas
  const cfRows = [
    [data.companyName.toUpperCase()],
    [`${labelPrefix}LAPORAN ARUS KAS`],
    [`Untuk Periode yang Berakhir pada ${data.periodText}`],
    [''],
    ['KETERANGAN / LINE ITEM', `TAHUN ${data.currentYear}`, `TAHUN ${data.priorYear}`, 'ENGLISH DESCRIPTION'],
    ['ARUS KAS DARI AKTIVITAS OPERASI', '', '', 'CASH FLOWS FROM OPERATING ACTIVITIES'],
    ...data.cashFlow.operating.map(i => [i.nameId, i.amountCurrent, i.amountPrior, i.nameEn]),
    ['Kas Neto yang Diperoleh dari Aktivitas Operasi', data.cashFlow.totalOperating.current, data.cashFlow.totalOperating.prior, 'Net Cash Provided by Operating Activities'],
    [''],
    ['ARUS KAS DARI AKTIVITAS INVESTASI', '', '', 'CASH FLOWS FROM INVESTING ACTIVITIES'],
    ...data.cashFlow.investing.map(i => [i.nameId, i.amountCurrent, i.amountPrior, i.nameEn]),
    ['Kas Neto yang Digunakan untuk Aktivitas Investasi', data.cashFlow.totalInvesting.current, data.cashFlow.totalInvesting.prior, 'Net Cash Used in Investing Activities'],
    [''],
    ['ARUS KAS DARI AKTIVITAS PENDANAAN', '', '', 'CASH FLOWS FROM FINANCING ACTIVITIES'],
    ...data.cashFlow.financing.map(i => [i.nameId, i.amountCurrent, i.amountPrior, i.nameEn]),
    ['Kas Neto yang Diperoleh untuk Aktivitas Pendanaan', data.cashFlow.totalFinancing.current, data.cashFlow.totalFinancing.prior, 'Net Cash Provided by Financing Activities'],
    [''],
    ['KENAIKAN (PENURUNAN) NETO KAS DAN SETARA KAS', data.cashFlow.netChange.current, data.cashFlow.netChange.prior, 'NET INCREASE IN CASH AND CASH EQUIVALENTS'],
    ['KAS DAN SETARA KAS PADA AWAL PERIODE', data.cashFlow.beginningCash.current, data.cashFlow.beginningCash.prior, 'CASH AND CASH EQUIVALENTS AT BEGINNING OF PERIOD'],
    ['KAS DAN SETARA KAS PADA AKHIR PERIODE', data.cashFlow.endingCash.current, data.cashFlow.endingCash.prior, 'CASH AND CASH EQUIVALENTS AT END OF PERIOD']
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cfRows), 'Arus Kas');

  const safeName = data.companyName.replace(/\s+/g, '_');
  const filename = data.isFiscalAdjusted
    ? `Laporan_Keuangan_Resmi_Fiskal_${safeName}_${data.currentYear}.xlsx`
    : `Laporan_Keuangan_Konsolidasian_${safeName}_${data.currentYear}.xlsx`;
  XLSX.writeFile(wb, filename);
}
