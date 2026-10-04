import { 
  Account, 
  Transaction, 
  AccountLedger, 
  LedgerEntry, 
  TrialBalanceItem, 
  WorksheetRow,
  FinancialRatio 
} from '../types/accounting';
import * as XLSX from 'xlsx';

export function formatRupiah(amount: number | null | undefined, includeSymbol: boolean = true): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return includeSymbol ? 'Rp 0' : '0';
  }
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absAmount);

  if (isNegative) {
    return includeSymbol ? `(Rp ${formatted})` : `(${formatted})`;
  }
  return includeSymbol ? `Rp ${formatted}` : formatted;
}

export function getTransactionLines(trx: any): any[] {
  if (!trx) return [];
  if (Array.isArray(trx.lines)) return trx.lines;
  if (Array.isArray(trx.items)) {
    return trx.items.map((l: any, idx: number) => ({
      id: l.id || `line-${idx}`,
      accountId: l.accountId || l.accountCode || '',
      accountCode: l.accountCode || '',
      accountName: l.accountName || '',
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      memo: l.memo || ''
    }));
  }
  return [];
}

export function calculateAccountBalance(account: Account, transactions: Transaction[] = []): {
  debitMutation: number;
  creditMutation: number;
  endingBalance: number;
} {
  let debitMutation = 0;
  let creditMutation = 0;
  const safeTrxList = Array.isArray(transactions) ? transactions : [];

  for (const trx of safeTrxList) {
    const lines = getTransactionLines(trx);
    for (const line of lines) {
      if (line.accountId === account.id || line.accountCode === account.code) {
        debitMutation += Number(line.debit) || 0;
        creditMutation += Number(line.credit) || 0;
      }
    }
  }

  const debetAwal = Number(account?.debetAwal) || 0;
  const kreditAwal = Number(account?.kreditAwal) || 0;
  let endingBalance = 0;
  if (account?.sn === 'Db') {
    endingBalance = (debetAwal - kreditAwal) + debitMutation - creditMutation;
  } else {
    endingBalance = (kreditAwal - debetAwal) + creditMutation - debitMutation;
  }

  return { debitMutation, creditMutation, endingBalance };
}

export function generateAccountLedger(account: Account, transactions: Transaction[] = [], startDate?: string, endDate?: string): AccountLedger {
  const safeTrxList = Array.isArray(transactions) ? transactions : [];
  const sortedTrx = [...safeTrxList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const debetAwal = Number(account?.debetAwal) || 0;
  const kreditAwal = Number(account?.kreditAwal) || 0;
  const startingBalance = account?.sn === 'Db' 
    ? (debetAwal - kreditAwal) 
    : (kreditAwal - debetAwal);

  let currentBalance = startingBalance;
  let totalDebit = 0;
  let totalCredit = 0;
  const entries: LedgerEntry[] = [];

  for (const trx of sortedTrx) {
    if (startDate && trx.date < startDate) continue;
    if (endDate && trx.date > endDate) continue;

    const lines = getTransactionLines(trx);
    for (const line of lines) {
      if (line.accountId === account.id || line.accountCode === account.code) {
        const d = Number(line.debit) || 0;
        const c = Number(line.credit) || 0;
        totalDebit += d;
        totalCredit += c;

        if (account.sn === 'Db') {
          currentBalance += (d - c);
        } else {
          currentBalance += (c - d);
        }

        entries.push({
          transactionId: trx.id,
          date: trx.date,
          refNumber: trx.refNumber || (trx as any).ref || 'JU-1',
          description: trx.description,
          debit: d,
          credit: c,
          balance: currentBalance,
          memo: line.memo
        });
      }
    }
  }

  return {
    account,
    startingBalance,
    entries,
    totalDebit,
    totalCredit,
    endingBalance: currentBalance
  };
}

export function generateTrialBalance(accounts: Account[], transactions: Transaction[]): {
  items: TrialBalanceItem[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
} {
  const nonHeaderAccounts = accounts.filter(a => !a.isHeader);
  const items: TrialBalanceItem[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const acc of nonHeaderAccounts) {
    const { endingBalance } = calculateAccountBalance(acc, transactions);
    let debit = 0;
    let credit = 0;

    if (acc.sn === 'Db') {
      if (endingBalance >= 0) {
        debit = endingBalance;
      } else {
        credit = Math.abs(endingBalance);
      }
    } else {
      if (endingBalance >= 0) {
        credit = endingBalance;
      } else {
        debit = Math.abs(endingBalance);
      }
    }

    if (debit !== 0 || credit !== 0 || acc.debetAwal !== 0 || acc.kreditAwal !== 0) {
      items.push({
        code: acc.code,
        name: acc.name,
        categoryName: acc.categoryName,
        debit,
        credit
      });
      totalDebit += debit;
      totalCredit += credit;
    }
  }

  items.sort((a, b) => a.code.localeCompare(b.code));

  return {
    items,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 1
  };
}

export function generateWorksheet(accounts: Account[], transactions: Transaction[]): {
  rows: WorksheetRow[];
  totals: {
    nsDebit: number;
    nsCredit: number;
    adjDebit: number;
    adjCredit: number;
    nsdDebit: number;
    nsdCredit: number;
    lrDebit: number;
    lrCredit: number;
    nrcDebit: number;
    nrcCredit: number;
  };
  netIncome: number;
} {
  const nonHeaderAccounts = accounts.filter(a => !a.isHeader);
  const rows: WorksheetRow[] = [];

  let nsDebitTot = 0;
  let nsCreditTot = 0;
  let adjDebitTot = 0;
  let adjCreditTot = 0;
  let nsdDebitTot = 0;
  let nsdCreditTot = 0;
  let lrDebitTot = 0;
  let lrCreditTot = 0;
  let nrcDebitTot = 0;
  let nrcCreditTot = 0;

  for (const acc of nonHeaderAccounts) {
    // 1. Initial trial balance from opening balance
    const nsDebit = acc.debetAwal;
    const nsCredit = acc.kreditAwal;
    nsDebitTot += nsDebit;
    nsCreditTot += nsCredit;

    // 2. Adjustments/mutations from transactions
    let adjDebit = 0;
    let adjCredit = 0;
    const safeTrxList = Array.isArray(transactions) ? transactions : [];
    for (const trx of safeTrxList) {
      const lines = getTransactionLines(trx);
      for (const line of lines) {
        if (line.accountId === acc.id || line.accountCode === acc.code) {
          adjDebit += Number(line.debit) || 0;
          adjCredit += Number(line.credit) || 0;
        }
      }
    }
    adjDebitTot += adjDebit;
    adjCreditTot += adjCredit;

    // 3. Adjusted trial balance (NSD)
    let nsdDebit = 0;
    let nsdCredit = 0;
    const { endingBalance } = calculateAccountBalance(acc, transactions);
    if (acc.sn === 'Db') {
      if (endingBalance >= 0) nsdDebit = endingBalance;
      else nsdCredit = Math.abs(endingBalance);
    } else {
      if (endingBalance >= 0) nsdCredit = endingBalance;
      else nsdDebit = Math.abs(endingBalance);
    }
    nsdDebitTot += nsdDebit;
    nsdCreditTot += nsdCredit;

    // 4. Laba Rugi vs Neraca
    let lrDebit = 0;
    let lrCredit = 0;
    let nrcDebit = 0;
    let nrcCredit = 0;

    if (acc.pos === 'Lr') {
      lrDebit = nsdDebit;
      lrCredit = nsdCredit;
      lrDebitTot += lrDebit;
      lrCreditTot += lrCredit;
    } else {
      nrcDebit = nsdDebit;
      nrcCredit = nsdCredit;
      nrcDebitTot += nrcDebit;
      nrcCreditTot += nrcCredit;
    }

    if (nsDebit || nsCredit || adjDebit || adjCredit || nsdDebit || nsdCredit) {
      rows.push({
        code: acc.code,
        name: acc.name,
        pos: acc.pos,
        sn: acc.sn,
        nsDebit,
        nsCredit,
        adjDebit,
        adjCredit,
        nsdDebit,
        nsdCredit,
        lrDebit,
        lrCredit,
        nrcDebit,
        nrcCredit
      });
    }
  }

  rows.sort((a, b) => a.code.localeCompare(b.code));

  // Net Income = Total Credit L/R (Revenue) - Total Debit L/R (Expense)
  const netIncome = lrCreditTot - lrDebitTot;

  return {
    rows,
    totals: {
      nsDebit: nsDebitTot,
      nsCredit: nsCreditTot,
      adjDebit: adjDebitTot,
      adjCredit: adjCreditTot,
      nsdDebit: nsdDebitTot,
      nsdCredit: nsdCreditTot,
      lrDebit: lrDebitTot,
      lrCredit: lrCreditTot,
      nrcDebit: nrcDebitTot,
      nrcCredit: nrcCreditTot,
    },
    netIncome
  };
}

export function generateIncomeStatement(accounts: Account[], transactions: Transaction[]) {
  const lrAccounts = accounts.filter(a => a.pos === 'Lr' && !a.isHeader);
  
  const operasionalRevenue: { code: string; name: string; amount: number }[] = [];
  const nonOperasionalRevenue: { code: string; name: string; amount: number }[] = [];
  const operasionalExpense: { code: string; name: string; amount: number }[] = [];
  const nonOperasionalExpense: { code: string; name: string; amount: number }[] = [];

  let totalOperasionalRevenue = 0;
  let totalNonOperasionalRevenue = 0;
  let totalOperasionalExpense = 0;
  let totalNonOperasionalExpense = 0;

  for (const acc of lrAccounts) {
    const { endingBalance } = calculateAccountBalance(acc, transactions);
    if (endingBalance === 0) continue;

    if (acc.category === 'PENDAPATAN_OPERASIONAL') {
      operasionalRevenue.push({ code: acc.code, name: acc.name, amount: endingBalance });
      totalOperasionalRevenue += endingBalance;
    } else if (acc.category === 'PENDAPATAN_NON_OPERASIONAL') {
      nonOperasionalRevenue.push({ code: acc.code, name: acc.name, amount: endingBalance });
      totalNonOperasionalRevenue += endingBalance;
    } else if (acc.category === 'BEBAN_OPERASIONAL') {
      operasionalExpense.push({ code: acc.code, name: acc.name, amount: endingBalance });
      totalOperasionalExpense += endingBalance;
    } else {
      nonOperasionalExpense.push({ code: acc.code, name: acc.name, amount: endingBalance });
      totalNonOperasionalExpense += endingBalance;
    }
  }

  const labaKotor = totalOperasionalRevenue;
  const labaOperasi = labaKotor - totalOperasionalExpense;
  const totalLuarUsaha = totalNonOperasionalRevenue - totalNonOperasionalExpense;
  const labaBersih = labaOperasi + totalLuarUsaha;

  return {
    operasionalRevenue,
    nonOperasionalRevenue,
    operasionalExpense,
    nonOperasionalExpense,
    totalOperasionalRevenue,
    totalNonOperasionalRevenue,
    totalOperasionalExpense,
    totalNonOperasionalExpense,
    labaKotor,
    labaOperasi,
    totalLuarUsaha,
    labaBersih
  };
}

export function generateBalanceSheet(accounts: Account[], transactions: Transaction[]) {
  const nrcAccounts = accounts.filter(a => a.pos === 'Nrc' && !a.isHeader);
  const incomeStatement = generateIncomeStatement(accounts, transactions);
  const netIncome = incomeStatement.labaBersih;

  const asetLancar: { code: string; name: string; amount: number }[] = [];
  const asetTetap: { code: string; name: string; amount: number }[] = [];
  const utangLancar: { code: string; name: string; amount: number }[] = [];
  const utangJangkaPanjang: { code: string; name: string; amount: number }[] = [];
  const ekuitas: { code: string; name: string; amount: number }[] = [];

  let totalAsetLancar = 0;
  let totalAsetTetap = 0;
  let totalUtangLancar = 0;
  let totalUtangJangkaPanjang = 0;
  let totalEkuitas = 0;

  for (const acc of nrcAccounts) {
    const { endingBalance } = calculateAccountBalance(acc, transactions);
    if (endingBalance === 0) continue;

    if (acc.category === 'HARTA_LANCAR') {
      asetLancar.push({ code: acc.code, name: acc.name, amount: endingBalance });
      totalAsetLancar += endingBalance;
    } else if (acc.category === 'HARTA_TETAP') {
      // Akumulasi penyusutan is contra-asset (credit normal)
      const adjustedAmount = acc.sn === 'Kr' ? -Math.abs(endingBalance) : endingBalance;
      asetTetap.push({ code: acc.code, name: acc.name, amount: adjustedAmount });
      totalAsetTetap += adjustedAmount;
    } else if (acc.category === 'UTANG_LANCAR') {
      utangLancar.push({ code: acc.code, name: acc.name, amount: endingBalance });
      totalUtangLancar += endingBalance;
    } else if (acc.category === 'UTANG_JANGKA_PANJANG') {
      utangJangkaPanjang.push({ code: acc.code, name: acc.name, amount: endingBalance });
      totalUtangJangkaPanjang += endingBalance;
    } else if (acc.category === 'EKUITAS') {
      // Prive is contra-equity
      const adjustedAmount = acc.sn === 'Db' ? -Math.abs(endingBalance) : endingBalance;
      ekuitas.push({ code: acc.code, name: acc.name, amount: adjustedAmount });
      totalEkuitas += adjustedAmount;
    }
  }

  // Add Current Period Net Income to Equity
  if (netIncome !== 0) {
    ekuitas.push({
      code: '30009',
      name: 'Laba Bersih Periode Berjalan',
      amount: netIncome
    });
    totalEkuitas += netIncome;
  }

  const totalAset = totalAsetLancar + totalAsetTetap;
  const totalKewajiban = totalUtangLancar + totalUtangJangkaPanjang;
  const totalKewajibanDanEkuitas = totalKewajiban + totalEkuitas;
  const isBalanced = Math.abs(totalAset - totalKewajibanDanEkuitas) < 1;

  return {
    asetLancar,
    asetTetap,
    utangLancar,
    utangJangkaPanjang,
    ekuitas,
    totalAsetLancar,
    totalAsetTetap,
    totalAset,
    totalUtangLancar,
    totalUtangJangkaPanjang,
    totalKewajiban,
    totalEkuitas,
    totalKewajibanDanEkuitas,
    netIncome,
    isBalanced,
    discrepancy: totalAset - totalKewajibanDanEkuitas
  };
}

export function generateCashFlowStatement(accounts: Account[], transactions: Transaction[]) {
  // Direct Method Cash Flow based on Kas (10001) transactions
  const kasAccount = accounts.find(a => a.code === '10001') || accounts[1];
  const startingKas = (kasAccount?.debetAwal || 0) - (kasAccount?.kreditAwal || 0);

  let cashFromCustomers = 0;
  let cashForSupplies = 0;
  let cashForOperations = 0;
  let cashForInterest = 0;
  let cashForTax = 0;

  let cashFromInvestingSales = 0;
  let cashForAssetsPurchase = 0;

  let cashFromOwnerEquity = 0;
  let cashForLoanRepayment = 0;
  let cashForPrive = 0;

  const safeTrxList = Array.isArray(transactions) ? transactions : [];
  for (const trx of safeTrxList) {
    const lines = getTransactionLines(trx);
    const hasKasDebit = lines.some(l => l.accountCode === '10001' && l.debit > 0);
    const hasKasCredit = lines.some(l => l.accountCode === '10001' && l.credit > 0);

    if (hasKasDebit) {
      // Inflow
      for (const l of lines) {
        if (l.accountCode === '10001') continue;
        if (l.accountCode.startsWith('40') || l.accountCode === '10003') {
          cashFromCustomers += l.credit;
        } else if (l.accountCode.startsWith('11')) {
          cashFromInvestingSales += l.credit;
        } else if (l.accountCode === '30000') {
          cashFromOwnerEquity += l.credit;
        }
      }
    }

    if (hasKasCredit) {
      // Outflow
      for (const l of lines) {
        if (l.accountCode === '10001') continue;
        if (l.accountCode === '10006' || l.accountCode === '10007' || l.accountCode === '10002') {
          cashForSupplies += l.debit;
        } else if (l.accountCode.startsWith('50')) {
          if (l.accountCode === '50011') cashForInterest += l.debit;
          else if (l.accountCode === '50018') cashForTax += l.debit;
          else cashForOperations += l.debit;
        } else if (l.accountCode.startsWith('11')) {
          cashForAssetsPurchase += l.debit;
        } else if (l.accountCode.startsWith('20') || l.accountCode.startsWith('21')) {
          cashForLoanRepayment += l.debit;
        } else if (l.accountCode === '30001') {
          cashForPrive += l.debit;
        }
      }
    }
  }

  const netOperatingCash = cashFromCustomers - (cashForSupplies + cashForOperations + cashForInterest + cashForTax);
  const netInvestingCash = cashFromInvestingSales - cashForAssetsPurchase;
  const netFinancingCash = cashFromOwnerEquity - (cashForLoanRepayment + cashForPrive);
  const netCashChange = netOperatingCash + netInvestingCash + netFinancingCash;
  const endingKas = startingKas + netCashChange;

  return {
    startingKas,
    cashFromCustomers,
    cashForSupplies,
    cashForOperations,
    cashForInterest,
    cashForTax,
    netOperatingCash,
    cashFromInvestingSales,
    cashForAssetsPurchase,
    netInvestingCash,
    cashFromOwnerEquity,
    cashForLoanRepayment,
    cashForPrive,
    netFinancingCash,
    netCashChange,
    endingKas
  };
}

export function calculateFinancialRatios(accounts: Account[], transactions: Transaction[]): FinancialRatio[] {
  const bs = generateBalanceSheet(accounts, transactions);
  const is = generateIncomeStatement(accounts, transactions);

  // Current Ratio = Aset Lancar / Utang Lancar
  const currentRatio = bs.totalUtangLancar > 0 ? (bs.totalAsetLancar / bs.totalUtangLancar) : bs.totalAsetLancar > 0 ? 99 : 0;
  
  // Quick Ratio = (Aset Lancar - Persediaan) / Utang Lancar
  const persediaanAcc = accounts.find(a => a.code === '10002');
  const persediaanVal = persediaanAcc ? calculateAccountBalance(persediaanAcc, transactions).endingBalance : 0;
  const quickAssets = Math.max(0, bs.totalAsetLancar - persediaanVal);
  const quickRatio = bs.totalUtangLancar > 0 ? (quickAssets / bs.totalUtangLancar) : 0;

  // Debt to Asset Ratio = Total Utang / Total Aset
  const debtToAsset = bs.totalAset > 0 ? (bs.totalKewajiban / bs.totalAset) * 100 : 0;

  // Debt to Equity Ratio = Total Utang / Total Ekuitas
  const debtToEquity = bs.totalEkuitas > 0 ? (bs.totalKewajiban / bs.totalEkuitas) * 100 : 0;

  // Net Profit Margin = Laba Bersih / Total Pendapatan
  const netProfitMargin = is.totalOperasionalRevenue > 0 ? (is.labaBersih / is.totalOperasionalRevenue) * 100 : 0;

  // ROA = Laba Bersih / Total Aset
  const roa = bs.totalAset > 0 ? (is.labaBersih / bs.totalAset) * 100 : 0;

  // ROE = Laba Bersih / Total Ekuitas
  const roe = bs.totalEkuitas > 0 ? (is.labaBersih / bs.totalEkuitas) * 100 : 0;

  return [
    {
      name: 'Current Ratio (Rasio Lancar)',
      category: 'Likuiditas',
      value: Math.round(currentRatio * 100) / 100,
      unit: 'x',
      benchmark: 'Min. 1.5x - 2.0x',
      status: currentRatio >= 1.5 ? 'Good' : currentRatio >= 1.0 ? 'Warning' : 'Danger',
      formula: 'Aset Lancar / Utang Lancar',
      description: 'Kemampuan perusahaan membayar kewajiban jangka pendek dengan aset lancar.'
    },
    {
      name: 'Quick Ratio (Rasio Cepat)',
      category: 'Likuiditas',
      value: Math.round(quickRatio * 100) / 100,
      unit: 'x',
      benchmark: 'Min. 1.0x',
      status: quickRatio >= 1.0 ? 'Good' : quickRatio >= 0.8 ? 'Warning' : 'Danger',
      formula: '(Aset Lancar - Persediaan) / Utang Lancar',
      description: 'Kemampuan membayar kewajiban segera tanpa mengandalkan persediaan.'
    },
    {
      name: 'Debt to Asset Ratio (DAR)',
      category: 'Solvabilitas',
      value: Math.round(debtToAsset * 10) / 10,
      unit: '%',
      benchmark: 'Maks. 50%',
      status: debtToAsset <= 50 ? 'Good' : debtToAsset <= 70 ? 'Warning' : 'Danger',
      formula: '(Total Utang / Total Aset) x 100%',
      description: 'Persentase aset perusahaan yang didanai dari utang.'
    },
    {
      name: 'Debt to Equity Ratio (DER)',
      category: 'Solvabilitas',
      value: Math.round(debtToEquity * 10) / 10,
      unit: '%',
      benchmark: 'Maks. 100%',
      status: debtToEquity <= 100 ? 'Good' : debtToEquity <= 150 ? 'Warning' : 'Danger',
      formula: '(Total Utang / Total Ekuitas) x 100%',
      description: 'Perbandingan total utang terhadap modal sendiri perusahaan.'
    },
    {
      name: 'Net Profit Margin (NPM)',
      category: 'Profitabilitas',
      value: Math.round(netProfitMargin * 10) / 10,
      unit: '%',
      benchmark: 'Min. 10% - 20%',
      status: netProfitMargin >= 15 ? 'Good' : netProfitMargin > 0 ? 'Warning' : 'Danger',
      formula: '(Laba Bersih / Pendapatan) x 100%',
      description: 'Efisiensi perusahaan menghasilkan laba bersih dari setiap rupiah pendapatan.'
    },
    {
      name: 'Return on Assets (ROA)',
      category: 'Profitabilitas',
      value: Math.round(roa * 10) / 10,
      unit: '%',
      benchmark: 'Min. 5%',
      status: roa >= 5 ? 'Good' : roa > 0 ? 'Warning' : 'Danger',
      formula: '(Laba Bersih / Total Aset) x 100%',
      description: 'Tingkat pengembalian laba dari seluruh aset yang digunakan.'
    },
    {
      name: 'Return on Equity (ROE)',
      category: 'Profitabilitas',
      value: Math.round(roe * 10) / 10,
      unit: '%',
      benchmark: 'Min. 10%',
      status: roe >= 10 ? 'Good' : roe > 0 ? 'Warning' : 'Danger',
      formula: '(Laba Bersih / Total Ekuitas) x 100%',
      description: 'Kemampuan perusahaan menghasilkan laba bagi pemilik modal.'
    }
  ];
}

export function exportTableToExcel(data: any[][], fileName: string, sheetName: string = 'Laporan') {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function calculateBalanceSheet(accounts: Account[], transactions: Transaction[]) {
  const bs = generateBalanceSheet(accounts, transactions);
  return {
    ...bs,
    totalAssets: bs.totalAset,
    totalLiabilities: bs.totalKewajiban,
    totalLiabilitiesAndEquity: bs.totalKewajibanDanEkuitas,
    diff: bs.discrepancy,
    difference: bs.discrepancy
  };
}

export function calculateProfitAndLoss(accounts: Account[], transactions: Transaction[]) {
  const is = generateIncomeStatement(accounts, transactions);
  const totalRevenues = is.totalOperasionalRevenue + is.totalNonOperasionalRevenue;
  const totalCOGS = 0;
  const totalOperatingExpenses = is.totalOperasionalExpense;
  const grossProfit = is.labaKotor;
  const operatingIncome = is.labaOperasi;
  const netIncome = is.labaBersih;
  const isProfit = is.labaBersih >= 0;

  return {
    ...is,
    totalRevenues,
    totalCOGS,
    totalOperatingExpenses,
    grossProfit,
    operatingIncome,
    netIncome,
    isProfit
  };
}

export function calculateGeneralLedgers(accounts: Account[], transactions: Transaction[]): Record<string, AccountLedger> {
  const ledgers: Record<string, AccountLedger> = {};
  for (const acc of accounts) {
    if (!acc.isHeader) {
      ledgers[acc.code] = generateAccountLedger(acc, transactions);
    }
  }
  return ledgers;
}

export function calculateTrialBalance(accounts: Account[], transactions: Transaction[]): TrialBalanceItem[] {
  return generateTrialBalance(accounts, transactions).items;
}

export function calculateWorksheet(accounts: Account[], transactions: Transaction[]) {
  return generateWorksheet(accounts, transactions);
}

