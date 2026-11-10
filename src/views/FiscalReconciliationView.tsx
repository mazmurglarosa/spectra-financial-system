import React, { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Plus,
  Trash2,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Calculator,
  Scale,
  Edit3,
  X,
  FileCheck2,
  ArrowUpRight
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { formatRupiah, generateIncomeStatement } from '../utils/accountingCalculations';
import { generatePsakReportData } from '../utils/psakReportGenerator';
import { formatPeriodDisplay } from '../utils/formatPeriod';
import { ActiveTab } from '../components/layout/Sidebar';
import {
  FISCAL_RULE_CODES,
  OFFICIAL_TAX_SOURCES,
  DifferenceNature,
  TaxRegimeType
} from '../data/fiscalTaxRules';
import {
  buildFiscalReconciliation,
  calculateCorporateTax,
  exportFiscalReconciliationWorkbook,
  CustomFiscalAdjustment,
  FiscalReconciliationRow
} from '../utils/fiscalReconciliation';

type FiscalSubTab = 'worksheet' | 'tax-sim' | 'reference';

interface FiscalReconciliationViewProps {
  setActiveTab?: (tab: ActiveTab) => void;
}

export const FiscalReconciliationView: React.FC<FiscalReconciliationViewProps> = ({ setActiveTab }) => {
  const {
    accounts,
    transactions,
    settings,
    logActivity,
    fiscalState,
    updateFiscalState,
    resetFiscalState
  } = useAccounting();

  const { overrides, customAdjustments, regime, lossCarryForward, prepaidTaxCredits } = fiscalState;

  const setRegime = (next: TaxRegimeType) => updateFiscalState({ regime: next });
  const setLossCarryForward = (val: number) => updateFiscalState({ lossCarryForward: val });
  const setPrepaidTaxCredits = (val: number) => updateFiscalState({ prepaidTaxCredits: val });

  const [activeSubTab, setActiveSubTab] = useState<FiscalSubTab>('worksheet');
  const [includeZeroAccounts, setIncludeZeroAccounts] = useState<boolean>(false);

  // Modal Tambah Penyesuaian Manual & Modal Edit Catatan
  const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);
  const [customDesc, setCustomDesc] = useState<string>('');
  const [customRuleCode, setCustomRuleCode] = useState<string>('FPO-03');
  const [customNature, setCustomNature] = useState<'TETAP' | 'WAKTU'>('TETAP');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>('');

  const [editingNoteRow, setEditingNoteRow] = useState<FiscalReconciliationRow | null>(null);
  const [noteInput, setNoteInput] = useState<string>('');

  // Pencarian pada tab Pustaka Kode
  const [refSearch, setRefSearch] = useState<string>('');
  const [refFilter, setRefFilter] = useState<'ALL' | 'FPO' | 'FNE' | 'TETAP' | 'WAKTU'>('ALL');

  // Keyboard Escape handler untuk modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCustomModalOpen(false);
        setEditingNoteRow(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const summary = useMemo(
    () => buildFiscalReconciliation(accounts, transactions, overrides, customAdjustments, includeZeroAccounts),
    [accounts, transactions, overrides, customAdjustments, includeZeroAccounts]
  );

  // Sinkronisasi langsung dengan Laporan Sederhana (Laba Rugi) & Laporan Resmi (PSAK)
  const simpleIncomeStatement = useMemo(
    () => generateIncomeStatement(accounts, transactions),
    [accounts, transactions]
  );
  const officialPsakData = useMemo(
    () => generatePsakReportData(accounts, transactions, settings),
    [accounts, transactions, settings]
  );

  const taxCalc = useMemo(
    () =>
      calculateCorporateTax(
        summary.fiscalNetProfit,
        summary.totalRevenueCommercial,
        regime,
        lossCarryForward,
        prepaidTaxCredits
      ),
    [summary.fiscalNetProfit, summary.totalRevenueCommercial, regime, lossCarryForward, prepaidTaxCredits]
  );

  const periodText = formatPeriodDisplay(settings.fiscalPeriod, settings.fiscalYear);
  const preparerName = settings.accountantName || settings.preparerName || 'Direktur Keuangan';
  const preparerTitle = settings.accountantTitle || settings.preparerTitle || 'Direktur Keuangan';
  const approverName = settings.directorName || settings.approverName || 'Direktur Utama';
  const approverTitle = settings.directorTitle || settings.approverTitle || 'Direktur Utama';

  const handleRuleChange = (row: FiscalReconciliationRow, newRuleCode: string) => {
    if (!newRuleCode) {
      updateFiscalState(prev => ({
        ...prev,
        overrides: {
          ...prev.overrides,
          [row.accountCode]: {
            ruleCode: '',
            positiveAmount: 0,
            negativeAmount: 0,
            nature: 'NONE',
            note: row.note,
            isManualOverride: true
          }
        }
      }));
      return;
    }

    const ruleMeta = FISCAL_RULE_CODES.find(r => r.code === newRuleCode);
    const defaultAmount = Math.max(0, Math.round(row.commercialAmount));
    const currentAmount =
      row.positiveCorrection > 0
        ? row.positiveCorrection
        : row.negativeCorrection > 0
        ? row.negativeCorrection
        : defaultAmount;

    updateFiscalState(prev => ({
      ...prev,
      overrides: {
        ...prev.overrides,
        [row.accountCode]: {
          ruleCode: newRuleCode,
          positiveAmount: ruleMeta?.direction === 'FPO' ? currentAmount : 0,
          negativeAmount: ruleMeta?.direction === 'FNE' ? currentAmount : 0,
          nature: ruleMeta?.nature || 'TETAP',
          note: prev.overrides[row.accountCode]?.note || ruleMeta?.description || '',
          isManualOverride: true
        }
      }
    }));
  };

  const handleAmountChange = (
    row: FiscalReconciliationRow,
    type: 'positive' | 'negative',
    rawVal: string
  ) => {
    const num = Math.max(0, parseInt(rawVal.replace(/[^0-9]/g, ''), 10) || 0);
    const fallbackRule =
      type === 'positive'
        ? row.ruleCode.startsWith('FPO')
          ? row.ruleCode
          : 'FPO-12'
        : row.ruleCode.startsWith('FNE')
        ? row.ruleCode
        : 'FNE-04';

    const ruleMeta = FISCAL_RULE_CODES.find(r => r.code === fallbackRule);

    updateFiscalState(prev => ({
      ...prev,
      overrides: {
        ...prev.overrides,
        [row.accountCode]: {
          ruleCode: num === 0 && (type === 'positive' ? row.negativeCorrection === 0 : row.positiveCorrection === 0) ? '' : fallbackRule,
          positiveAmount: type === 'positive' ? num : 0,
          negativeAmount: type === 'negative' ? num : 0,
          nature: prev.overrides[row.accountCode]?.nature && prev.overrides[row.accountCode].nature !== 'NONE'
            ? prev.overrides[row.accountCode].nature
            : ruleMeta?.nature || 'TETAP',
          note: prev.overrides[row.accountCode]?.note || row.note,
          isManualOverride: true
        }
      }
    }));
  };

  const handleNatureChange = (row: FiscalReconciliationRow, newNature: DifferenceNature) => {
    updateFiscalState(prev => ({
      ...prev,
      overrides: {
        ...prev.overrides,
        [row.accountCode]: {
          ruleCode: row.ruleCode,
          positiveAmount: row.positiveCorrection,
          negativeAmount: row.negativeCorrection,
          nature: newNature,
          note: prev.overrides[row.accountCode]?.note || row.note,
          isManualOverride: true
        }
      }
    }));
  };

  const handleResetToAuto = () => {
    resetFiscalState();
  };

  const handleAddCustomAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(customAmount.replace(/[^0-9]/g, ''), 10) || 0;
    if (!customDesc.trim() || num <= 0) return;
    const ruleMeta = FISCAL_RULE_CODES.find(r => r.code === customRuleCode);
    const direction = ruleMeta?.direction || (customRuleCode.startsWith('FNE') ? 'FNE' : 'FPO');

    const newItem: CustomFiscalAdjustment = {
      id: `cf-${Date.now()}`,
      description: customDesc.trim(),
      ruleCode: customRuleCode,
      direction,
      nature: customNature,
      amount: num,
      note: customNote.trim() || ruleMeta?.legalBasis || ''
    };
    updateFiscalState(prev => ({
      ...prev,
      customAdjustments: [...prev.customAdjustments, newItem]
    }));
    setCustomDesc('');
    setCustomAmount('');
    setCustomNote('');
    setIsCustomModalOpen(false);
    logActivity('Tambah Koreksi Fiskal', `Menambahkan baris penyesuaian ${newItem.ruleCode}: ${newItem.description} (${formatRupiah(newItem.amount)})`);
  };

  const handleSaveRowNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNoteRow) return;
    updateFiscalState(prev => ({
      ...prev,
      overrides: {
        ...prev.overrides,
        [editingNoteRow.accountCode]: {
          ruleCode: editingNoteRow.ruleCode,
          positiveAmount: editingNoteRow.positiveCorrection,
          negativeAmount: editingNoteRow.negativeCorrection,
          nature: editingNoteRow.nature,
          note: noteInput.trim(),
          isManualOverride: true
        }
      }
    }));
    setEditingNoteRow(null);
  };

  const filteredRules = useMemo(() => {
    const q = refSearch.trim().toLowerCase();
    return FISCAL_RULE_CODES.filter(r => {
      if (refFilter === 'FPO' && r.direction !== 'FPO') return false;
      if (refFilter === 'FNE' && r.direction !== 'FNE') return false;
      if (refFilter === 'TETAP' && r.nature !== 'TETAP') return false;
      if (refFilter === 'WAKTU' && r.nature !== 'WAKTU') return false;
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.legalBasis.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.examples.toLowerCase().includes(q)
      );
    });
  }, [refSearch, refFilter]);

  const hasData = summary.rows.revenues.length > 0 || summary.rows.expenses.length > 0 || customAdjustments.length > 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
      {/* Header Toolbar (no-print) */}
      <div className="no-print bg-white text-slate-800 p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-[#0284c7] shrink-0">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              Rekonsiliasi &amp; Koreksi Fiskal Perpajakan
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Kertas kerja penyesuaian Laba Komersial (SAK) ke Penghasilan Neto Fiskal untuk{' '}
              <strong className="text-slate-800">{settings.companyName}</strong> ({periodText}) mengacu pada{' '}
              <strong className="text-slate-800">UU PPh / UU HPP</strong>, <strong className="text-slate-800">PMK 66/2023</strong>, dan{' '}
              <strong className="text-slate-800">Kode Coretax PER-11/PJ/2025</strong>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetToAuto}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-600 outline-none"
            title="Kembalikan aturan koreksi fiskal ke deteksi otomatis akun COA"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            <span>Deteksi Otomatis COA</span>
          </button>

          <button
            type="button"
            onClick={() => exportFiscalReconciliationWorkbook(summary, taxCalc, settings)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-600 outline-none"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Unduh Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#0a192f] hover:bg-[#11243e] text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-600 outline-none"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak 1771-I</span>
          </button>

          {setActiveTab && (
            <button
              type="button"
              onClick={() => setActiveTab('fiscal-reports')}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-600 outline-none"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Buka Laporan Resmi Fiskal</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Bar Bukti Keterhubungan Laba Rugi (Sederhana ↔ Resmi PSAK ↔ Koreksi Fiskal) */}
      <div className="no-print bg-white rounded-xl border border-slate-200/90 shadow-xs px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Terhubung Langsung dengan Laba Rugi Komersial:</span>
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-slate-600">
            <span>
              Lap. Sederhana:{' '}
              <strong className="text-slate-900">{formatRupiah(simpleIncomeStatement.labaBersih)}</strong>
            </span>
            <span>
              Lap. Resmi PSAK:{' '}
              <strong className="text-slate-900">{formatRupiah(officialPsakData.incomeStatement.netIncome.current)}</strong>
            </span>
            <span className="text-emerald-700 font-semibold">
              {simpleIncomeStatement.labaBersih === officialPsakData.incomeStatement.netIncome.current &&
              simpleIncomeStatement.labaBersih === summary.commercialNetProfit
                ? '(Sinkron 100% — Selisih Rp 0)'
                : '(Tersinkronisasi)'}
            </span>
          </div>
        </div>
        {setActiveTab && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('profit-loss')}
              className="text-[11px] font-bold text-sky-700 hover:text-sky-800 underline cursor-pointer"
            >
              Cek Laba Rugi Sederhana
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setActiveTab('psak-report')}
              className="text-[11px] font-bold text-sky-700 hover:text-sky-800 underline cursor-pointer"
            >
              Cek Laporan Resmi PSAK
            </button>
          </div>
        )}
      </div>

      {/* Persamaan Utama Formulir 1771-I (Reconciliation Bridge) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Scale className="w-4 h-4 text-[#0284c7]" />
            <span>Ikhtisar Persamaan Penghasilan Neto Fiskal (Formulir 1771-I Bagian D)</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{summary.isReconciled ? 'Kalkulasi Terrekonsiliasi (Selisih Rp 0)' : 'Perlu Cek Ulang'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-stretch">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
            <div className="text-[11px] font-semibold text-slate-600">1. Laba/(Rugi) Komersial</div>
            <div className="text-lg font-mono font-bold text-slate-900 mt-1 tabular-nums">
              {formatRupiah(summary.commercialNetProfit)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Sesuai pembukuan SAK</div>
          </div>

          <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60">
            <div className="text-[11px] font-semibold text-rose-700">2. (+) Koreksi Positif (FPO)</div>
            <div className="text-lg font-mono font-bold text-rose-700 mt-1 tabular-nums">
              + {formatRupiah(summary.totalPositiveCorrection)}
            </div>
            <div className="text-[11px] text-rose-700/80 mt-0.5">Menambah PKP (Pasal 9)</div>
          </div>

          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
            <div className="text-[11px] font-semibold text-emerald-700">3. (-) Koreksi Negatif (FNE)</div>
            <div className="text-lg font-mono font-bold text-emerald-700 mt-1 tabular-nums">
              - {formatRupiah(summary.totalNegativeCorrection)}
            </div>
            <div className="text-[11px] text-emerald-700/80 mt-0.5">Mengurangi PKP (Pasal 4(2)/11)</div>
          </div>

          <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/80">
            <div className="text-[11px] font-semibold text-sky-700">4. (=) Laba/(Rugi) Fiskal</div>
            <div className="text-lg font-mono font-black text-slate-900 mt-1 tabular-nums">
              {formatRupiah(summary.fiscalNetProfit)}
            </div>
            <div className="text-[11px] text-sky-700 mt-0.5">Dasar PKP SPT 1771</div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-[#0a192f] text-white">
            <div className="text-[11px] font-semibold text-slate-300">5. Estimasi PPh Terutang</div>
            <div className="text-lg font-mono font-black text-white mt-1 tabular-nums">
              {formatRupiah(taxCalc.totalIncomeTax)}
            </div>
            <div className="text-[11px] text-sky-300 mt-0.5">
              Tarif efektif {taxCalc.effectiveRatePercent}% ({regime === 'pasal31e' ? 'Ps. 31E' : regime === 'pasal17' ? 'Ps. 17 22%' : 'UMKM 0,5%'})
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'worksheet'}
            onClick={() => setActiveSubTab('worksheet')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-600 outline-none ${
              activeSubTab === 'worksheet'
                ? 'bg-[#0a192f] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Kertas Kerja Koreksi (1771-I / Coretax L1)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'tax-sim'}
            onClick={() => setActiveSubTab('tax-sim')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-600 outline-none ${
              activeSubTab === 'tax-sim'
                ? 'bg-[#0a192f] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Simulasi PPh Badan (Pasal 17 &amp; 31E)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'reference'}
            onClick={() => setActiveSubTab('reference')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-600 outline-none ${
              activeSubTab === 'reference'
                ? 'bg-[#0a192f] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Pustaka Kode Coretax &amp; Sumber Hukum</span>
          </button>
        </div>

        {activeSubTab === 'worksheet' && (
          <div className="flex items-center gap-3 pr-2">
            <label className="flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeZeroAccounts}
                onChange={e => setIncludeZeroAccounts(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-600 cursor-pointer"
              />
              <span>Tampilkan semua akun L/R (termasuk Rp 0)</span>
            </label>
            <button
              type="button"
              onClick={() => setIsCustomModalOpen(true)}
              className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-600 outline-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Baris Koreksi Manual</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: KERTAS KERJA REKONSILIASI FISKAL */}
      {activeSubTab === 'worksheet' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden print:border-0 print:shadow-none">
          {/* Print Only Formal Header */}
          <div className="hidden print:block p-6 border-b-2 border-slate-900 text-center">
            <h2 className="text-lg font-black uppercase tracking-wider text-slate-900">{settings.companyName}</h2>
            <h1 className="text-base font-bold text-slate-800 mt-1">
              KERTAS KERJA REKONSILIASI FISKAL (LAMPIRAN 1771-I / CORETAX L1)
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">Periode Pajak: {periodText}</p>
          </div>

          {!hasData ? (
            <div className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Belum Ada Mutasi Akun Pendapatan &amp; Beban pada Periode Ini
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Kertas kerja koreksi fiskal menarik saldo Laba Rugi secara otomatis dari Jurnal Umum, Auto Record, atau data cadangan. Catat transaksi terlebih dahulu atau centang{' '}
                <strong>&ldquo;Tampilkan semua akun L/R&rdquo;</strong> untuk simulasi manual.
              </p>
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setIncludeZeroAccounts(true)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Tampilkan Semua Akun COA L/R
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(true)}
                  className="px-3.5 py-2 bg-[#0a192f] hover:bg-[#11243e] text-white text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Tambah Koreksi Manual
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1040px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3 px-4 w-64">Akun / Uraian Pos</th>
                    <th className="py-3 px-3 text-right w-36">Komersial (Rp)</th>
                    <th className="py-3 px-3 w-64 min-w-[240px]">Kode Coretax (PER-11)</th>
                    <th className="py-3 px-2 w-24">Beda</th>
                    <th className="py-3 px-3 text-right w-36 text-rose-700">Koreksi (+) Positif</th>
                    <th className="py-3 px-3 text-right w-36 text-emerald-700">Koreksi (-) Negatif</th>
                    <th className="py-3 px-4 text-right w-40">Nilai Fiskal (Rp)</th>
                    <th className="py-3 px-3 w-52 no-print">Dasar Hukum &amp; Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {/* SEKSI A: PENDAPATAN */}
                  <tr className="bg-slate-100/80 font-bold text-slate-900">
                    <td colSpan={8} className="py-2.5 px-4 text-xs tracking-wide uppercase">
                      A. Penghasilan / Pendapatan Komersial (Pasal 4 UU PPh)
                    </td>
                  </tr>
                  {summary.rows.revenues.map(row => (
                    <FiscalTableRow
                      key={row.accountCode}
                      row={row}
                      onRuleChange={handleRuleChange}
                      onAmountChange={handleAmountChange}
                      onNatureChange={handleNatureChange}
                      onEditNote={r => {
                        setEditingNoteRow(r);
                        setNoteInput(r.note || '');
                      }}
                    />
                  ))}
                  <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                    <td className="py-2.5 px-4">Subtotal Penghasilan (A)</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatRupiah(summary.totalRevenueCommercial)}</td>
                    <td colSpan={2}></td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-700">{formatRupiah(summary.totalRevenuePositive)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700">{formatRupiah(summary.totalRevenueNegative)}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">{formatRupiah(summary.totalRevenueFiscal)}</td>
                    <td className="no-print"></td>
                  </tr>

                  {/* SEKSI B: BEBAN */}
                  <tr className="bg-slate-100/80 font-bold text-slate-900">
                    <td colSpan={8} className="py-2.5 px-4 text-xs tracking-wide uppercase">
                      B. Beban Usaha &amp; Luar Usaha (Pasal 6 vs Pasal 9 UU PPh)
                    </td>
                  </tr>
                  {summary.rows.expenses.map(row => (
                    <FiscalTableRow
                      key={row.accountCode}
                      row={row}
                      onRuleChange={handleRuleChange}
                      onAmountChange={handleAmountChange}
                      onNatureChange={handleNatureChange}
                      onEditNote={r => {
                        setEditingNoteRow(r);
                        setNoteInput(r.note || '');
                      }}
                    />
                  ))}
                  <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                    <td className="py-2.5 px-4">Subtotal Beban Usaha (B)</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatRupiah(summary.totalExpenseCommercial)}</td>
                    <td colSpan={2}></td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-700">{formatRupiah(summary.totalExpensePositive)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700">{formatRupiah(summary.totalExpenseNegative)}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">{formatRupiah(summary.totalExpenseFiscal)}</td>
                    <td className="no-print"></td>
                  </tr>

                  {/* SEKSI C: PENYESUAIAN MANUAL TAMBAHAN (JIKA ADA) */}
                  {customAdjustments.length > 0 && (
                    <>
                      <tr className="bg-sky-50/70 font-bold text-slate-900">
                        <td colSpan={8} className="py-2.5 px-4 text-xs tracking-wide uppercase">
                          C. Penyesuaian Fiskal Tambahan / Multi-Kode Coretax
                        </td>
                      </tr>
                      {customAdjustments.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-900">{item.description}</div>
                            <div className="text-[11px] text-slate-500">Baris penyesuaian manual</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">-</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                                item.direction === 'FPO'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {item.ruleCode} ({item.direction})
                            </span>
                          </td>
                          <td className="py-2.5 px-2">
                            <span className="text-[11px] font-semibold text-slate-600">{item.nature}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-700 font-semibold">
                            {item.direction === 'FPO' ? formatRupiah(item.amount) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                            {item.direction === 'FNE' ? formatRupiah(item.amount) : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                            {item.direction === 'FPO' ? `+ ${formatRupiah(item.amount)}` : `- ${formatRupiah(item.amount)}`}
                          </td>
                          <td className="py-2.5 px-3 no-print">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-slate-600 line-clamp-2">{item.note}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateFiscalState(prev => ({
                                    ...prev,
                                    customAdjustments: prev.customAdjustments.filter(c => c.id !== item.id)
                                  }))
                                }
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                title="Hapus baris manual"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* SEKSI D: IKHTISAR PENGHASILAN NETO FISKAL */}
                  <tr className="bg-[#0a192f] text-white font-bold">
                    <td className="py-3.5 px-4 text-xs uppercase tracking-wider">
                      D. Penghasilan / (Rugi) Neto Fiskal
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-200">
                      {formatRupiah(summary.commercialNetProfit)}
                    </td>
                    <td colSpan={2} className="py-3.5 px-3 text-[11px] text-slate-300 font-normal">
                      Komersial + Positif - Negatif
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-rose-300">
                      + {formatRupiah(summary.totalPositiveCorrection)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-emerald-300">
                      - {formatRupiah(summary.totalNegativeCorrection)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-sm tabular-nums text-white">
                      {formatRupiah(summary.fiscalNetProfit)}
                    </td>
                    <td className="py-3.5 px-3 text-[11px] text-sky-300 font-normal no-print">
                      Siap ke Induk 1771 &amp; Coretax
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Print Only Signature Footer */}
          <div className="hidden print:grid grid-cols-2 gap-12 p-8 mt-4 text-center text-xs text-slate-800">
            <div>
              <p className="mb-16">Disiapkan oleh,</p>
              <p className="font-bold underline">{preparerName}</p>
              <p className="text-slate-600">{preparerTitle}</p>
            </div>
            <div>
              <p className="mb-16">Disetujui oleh,</p>
              <p className="font-bold underline">{approverName}</p>
              <p className="text-slate-600">{approverTitle}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SIMULASI PPH BADAN (PASAL 17 / PASAL 31E / PP 55) */}
      {activeSubTab === 'tax-sim' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kolom Kiri: Konfigurasi Tarif & Kredit Pajak */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black text-slate-900">Parameter Penghitungan PPh Badan</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Pilih skema tarif perpajakan sesuai omzet dan status badan usaha Anda.
              </p>
            </div>

            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700">Skema Tarif PPh Terutang</label>
              {[
                {
                  id: 'pasal31e' as TaxRegimeType,
                  title: 'Fasilitas Pasal 31E ayat (1) UU PPh',
                  desc: 'Pengurangan 50% tarif (11%) untuk bagian omzet s.d. Rp 4,8 Miliar (Omzet total ≤ Rp 50 Miliar).'
                },
                {
                  id: 'pasal17' as TaxRegimeType,
                  title: 'Tarif Umum Pasal 17 ayat (1)b (UU HPP)',
                  desc: 'Tarif tunggal 22% diterapkan atas seluruh Penghasilan Kena Pajak (Omzet > Rp 50 Miliar atau non-fasilitas).'
                },
                {
                  id: 'umkm05' as TaxRegimeType,
                  title: 'PPh Final UMKM 0,5% (PP No. 55 Tahun 2022)',
                  desc: 'Tarif final 0,5% langsung dari Peredaran Bruto usaha (selama masa berlaku fasilitas PT 3 tahun terpenuhi).'
                }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRegime(opt.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-600 outline-none ${
                    regime === opt.id
                      ? 'bg-sky-50 border-sky-600 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{opt.title}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        regime === opt.id
                          ? 'bg-sky-700 text-white border-sky-700'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {regime === opt.id ? 'Aktif' : 'Pilih'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{opt.desc}</p>
                </button>
              ))}
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label htmlFor="loss-carry" className="block text-xs font-bold text-slate-700 mb-1">
                  Kompensasi Kerugian Fiskal Tahun Sebelumnya (Ps. 6 ayat 2)
                </label>
                <input
                  id="loss-carry"
                  type="number"
                  min={0}
                  step={1000}
                  value={lossCarryForward || ''}
                  placeholder="0"
                  onChange={e => setLossCarryForward(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-600 focus:border-sky-600 outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Kerugian fiskal dapat dikompensasikan maksimal 5 tahun berturut-turut.
                </p>
              </div>

              <div>
                <label htmlFor="prepaid-tax" className="block text-xs font-bold text-slate-700 mb-1">
                  Kredit Pajak Dibayar Dimuka (PPh Pasal 22, 23, &amp; Angsuran Ps. 25)
                </label>
                <input
                  id="prepaid-tax"
                  type="number"
                  min={0}
                  step={1000}
                  value={prepaidTaxCredits || ''}
                  placeholder="0"
                  onChange={e => setPrepaidTaxCredits(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-600 focus:border-sky-600 outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Pengurang PPh Terutang untuk menentukan Kurang/(Lebih) Bayar SPT Tahunan (Pasal 29 / 28A).
                </p>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Kertas Kerja Rincian Kalkulasi PPh Badan */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900">Rincian Kalkulasi PPh Badan Terutang</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Struktur Induk SPT Tahunan 1771 Huruf A s.d. E
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                Tarif Efektif: {taxCalc.effectiveRatePercent}%
              </span>
            </div>

            <div className="p-5 space-y-2.5 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Peredaran Bruto / Omzet Usaha (Dasar Ps. 31E)</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">{formatRupiah(taxCalc.grossTurnover)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Penghasilan Neto Fiskal (Bagian D 1771-I)</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">{formatRupiah(taxCalc.fiscalNetProfit)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">(-) Kompensasi Kerugian Fiskal</span>
                <span className="font-mono font-semibold text-emerald-700 tabular-nums">({formatRupiah(taxCalc.lossCarryForward)})</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="font-bold text-slate-800">Penghasilan Kena Pajak (PKP) — Dibulatkan Ribuan (Ps. 17(4))</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">{formatRupiah(taxCalc.pkpRounded)}</span>
              </div>

              {regime !== 'umkm05' ? (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2.5 my-2">
                  <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Rincian Lapisan Tarif Pajak Badan (UU HPP &amp; Ps. 31E)
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      Bagian PKP Fasilitas 50% (Tarif <strong>11%</strong>):{' '}
                      <span className="font-mono">{formatRupiah(taxCalc.pkpFacility)}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">{formatRupiah(taxCalc.taxFacility)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      Bagian PKP Non-Fasilitas (Tarif <strong>22%</strong>):{' '}
                      <span className="font-mono">{formatRupiah(taxCalc.pkpNonFacility)}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">{formatRupiah(taxCalc.taxNonFacility)}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 space-y-1 my-2 text-amber-900">
                  <div className="font-bold text-xs">PPh Final UMKM 0,5% (PP No. 55 Tahun 2022)</div>
                  <p className="text-[11px] leading-relaxed">
                    Dihitung 0,5% × Omzet Bruto ({formatRupiah(taxCalc.grossTurnover)}) = <strong>{formatRupiah(taxCalc.totalIncomeTax)}</strong>. Jika menggunakan skema PPh Final penuh, seluruh omzet final pada Lampiran L1 dikoreksi negatif (`FNE-01`).
                  </p>
                </div>
              )}

              <div className="flex justify-between py-2.5 border-b border-slate-200 font-bold text-sm text-slate-900">
                <span>Total PPh Badan Terutang</span>
                <span className="font-mono tabular-nums">{formatRupiah(taxCalc.totalIncomeTax)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">(-) Kredit Pajak (PPh Ps. 22, 23, Angsuran Ps. 25)</span>
                <span className="font-mono font-semibold text-emerald-700 tabular-nums">({formatRupiah(taxCalc.prepaidTaxCredits)})</span>
              </div>
              <div
                className={`flex justify-between items-center p-4 rounded-xl border mt-2 ${
                  taxCalc.taxPayable >= 0
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                }`}
              >
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider">
                    {taxCalc.taxPayable > 0
                      ? 'PPh Kurang Bayar (SPT Pasal 29)'
                      : taxCalc.taxPayable < 0
                      ? 'PPh Lebih Bayar (Restitusi / Kompensasi Ps. 28A)'
                      : 'Status PPh Nihil'}
                  </div>
                  <div className={`text-[11px] mt-0.5 ${taxCalc.taxPayable >= 0 ? 'text-slate-300' : 'text-emerald-700'}`}>
                    Wajib disetor paling lambat sebelum penyampaian SPT Tahunan Badan (30 April)
                  </div>
                </div>
                <span className="text-lg font-mono font-black tabular-nums">
                  {formatRupiah(Math.abs(taxCalc.taxPayable))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PUSTAKA KODE CORETAX & SUMBER HUKUM INTERNET */}
      {activeSubTab === 'reference' && (
        <div className="space-y-6">
          {/* Sumber Hukum Resmi dari Internet */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Sumber Hukum &amp; Referensi Perpajakan Resmi
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Rujukan regulasi Indonesia untuk penyusunan Kertas Kerja 1771-I &amp; Coretax Lampiran L1.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {OFFICIAL_TAX_SOURCES.map(src => (
                <a
                  key={src.id}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50/40 transition flex flex-col justify-between gap-2 group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                        {src.regulationNumber}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-700 shrink-0" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 mt-2">{src.title}</h3>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{src.summary}</p>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 pt-1">
                    Penerbit: {src.publisher}
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Panduan Cepat PMK 66/2023 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-3">
            <h2 className="text-sm font-black text-slate-900">
              Ketentuan Khusus Natura &amp; Kenikmatan (PMK Nomor 66 Tahun 2023)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
                <div className="font-bold text-emerald-800">Dapat Dibiayakan Fiskal (Deductible — Tanpa Koreksi)</div>
                <ul className="list-disc pl-4 space-y-1 text-slate-700">
                  <li>Makanan &amp; minuman untuk seluruh pegawai di tempat kerja (tanpa batasan nilai).</li>
                  <li>Fasilitas kerja penunjang 3M: seragam keselamatan, helm, sepatu kerja, laptop &amp; ponsel dinas.</li>
                  <li>Bingkisan hari raya keagamaan (Idul Fitri, Natal, Nyepi, Waisak, Imlek) bagi seluruh pegawai.</li>
                  <li>Natura di daerah tertentu yang ditetapkan Kepala KPP/DJP.</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 space-y-1.5">
                <div className="font-bold text-rose-800">Wajib Koreksi Positif (FPO-03 / Non-Deductible)</div>
                <ul className="list-disc pl-4 space-y-1 text-slate-700">
                  <li>Natura atau fasilitas yang diberikan kepada pemegang saham tanpa hubungan kerja 3M.</li>
                  <li>Pembagian natura non-keagamaan atau fasilitas pribadi yang tidak menunjang kegiatan usaha 3M.</li>
                  <li>Pengeluaran entertainment/jamuan relasi tanpa melampirkan daftar nominatif pajak resmi.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Tabel Kode Penyesuaian PER-11/PJ/2025 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900">
                  Daftar Kode Penyesuaian Fiskal Coretax (PER-11/PJ/2025) &amp; Formulir 1771-I
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  12 Kode Penyesuaian Positif (FPO) dan 4 Kode Penyesuaian Negatif (FNE).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={refSearch}
                    onChange={e => setRefSearch(e.target.value)}
                    placeholder="Cari kode atau pasal..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-sky-600 outline-none"
                  />
                </div>
                {(['ALL', 'FPO', 'FNE', 'TETAP', 'WAKTU'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setRefFilter(f)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      refFilter === f
                        ? 'bg-[#0a192f] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'ALL' ? 'Semua (16)' : f}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[820px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase">
                    <th className="py-2.5 px-4 w-28">Kode Coretax</th>
                    <th className="py-2.5 px-3 w-24">Sifat</th>
                    <th className="py-2.5 px-3 w-64">Uraian Pos Penyesuaian</th>
                    <th className="py-2.5 px-3 w-48">Dasar Hukum &amp; 1771-I</th>
                    <th className="py-2.5 px-4">Penjelasan &amp; Contoh Praktis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredRules.map(rule => (
                    <tr key={rule.code} className="hover:bg-slate-50/70 align-top">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block font-mono font-bold px-2 py-0.5 rounded border text-[11px] ${
                            rule.direction === 'FPO'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {rule.code}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-1 font-semibold">
                          {rule.direction === 'FPO' ? 'Positif (+)' : 'Negatif (-)'}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        Beda {rule.nature === 'TETAP' ? 'Tetap' : 'Waktu'}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">{rule.label}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{rule.legalBasis}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{rule.form1771Ref}</div>
                      </td>
                      <td className="py-3 px-4 space-y-1">
                        <p className="leading-relaxed">{rule.description}</p>
                        <p className="text-[11px] text-slate-500">
                          <strong>Contoh:</strong> {rule.examples}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH KOREKSI MANUAL */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900">
                Tambah Penyesuaian Fiskal Manual (Multi-Kode Coretax)
              </h3>
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomAdjustment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Uraian Item Penyesuaian</label>
                <input
                  type="text"
                  required
                  value={customDesc}
                  onChange={e => setCustomDesc(e.target.value)}
                  placeholder="Contoh: Selisih Penyusutan Kendaraan Kelompok 2 atau Sanksi STP"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-600 focus:border-sky-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kode Penyesuaian (PER-11)</label>
                  <select
                    value={customRuleCode}
                    onChange={e => {
                      const val = e.target.value;
                      setCustomRuleCode(val);
                      const found = FISCAL_RULE_CODES.find(r => r.code === val);
                      if (found) setCustomNature(found.nature);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-600 focus:border-sky-600 outline-none bg-white"
                  >
                    {FISCAL_RULE_CODES.map(r => (
                      <option key={r.code} value={r.code}>
                        {r.code} ({r.direction === 'FPO' ? '+' : '-'}) — {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sifat Perbedaan</label>
                  <select
                    value={customNature}
                    onChange={e => setCustomNature(e.target.value as 'TETAP' | 'WAKTU')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-600 focus:border-sky-600 outline-none bg-white"
                  >
                    <option value="TETAP">Beda Tetap (Permanent)</option>
                    <option value="WAKTU">Beda Waktu (Timing)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nominal Penyesuaian (Rp)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  placeholder="Contoh: 1500000"
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-600 focus:border-sky-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dasar Hukum / Catatan Pemeriksaan</label>
                <input
                  type="text"
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                  placeholder="Opsional, misal: Lampiran Daftar Penyusutan Aset Tetap"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-600 focus:border-sky-600 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0a192f] hover:bg-[#11243e] text-white font-bold rounded-xl cursor-pointer"
                >
                  Simpan Baris Koreksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT CATATAN BARIS */}
      {editingNoteRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900">Catatan Koreksi Akun {editingNoteRow.accountCode}</h3>
                <p className="text-xs text-slate-600">{editingNoteRow.accountName}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingNoteRow(null)}
                className="p-1 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveRowNote} className="space-y-3 text-xs">
              <textarea
                rows={4}
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                placeholder="Tuliskan dasar koreksi, nomor bukti pendukung, atau penjelasan audit pajak..."
                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-600 focus:border-sky-600 outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingNoteRow(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0a192f] hover:bg-[#11243e] text-white font-bold rounded-xl cursor-pointer"
                >
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface FiscalTableRowProps {
  row: FiscalReconciliationRow;
  onRuleChange: (row: FiscalReconciliationRow, ruleCode: string) => void;
  onAmountChange: (row: FiscalReconciliationRow, type: 'positive' | 'negative', val: string) => void;
  onNatureChange: (row: FiscalReconciliationRow, nature: DifferenceNature) => void;
  onEditNote: (row: FiscalReconciliationRow) => void;
}

const FiscalTableRow: React.FC<FiscalTableRowProps> = ({
  row,
  onRuleChange,
  onAmountChange,
  onNatureChange,
  onEditNote
}) => {
  return (
    <tr className="hover:bg-slate-50/70 transition-colors align-middle">
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
            {row.accountCode}
          </span>
          <span className="font-semibold text-slate-900">{row.accountName}</span>
        </div>
        {(row.isAutoDetected || row.isManualOverride) && (
          <div className="mt-1">
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                row.isAutoDetected
                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {row.isAutoDetected ? 'Deteksi Otomatis COA' : 'Penyesuaian Manual'}
            </span>
          </div>
        )}
      </td>

      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-800">
        {formatRupiah(row.commercialAmount)}
      </td>

      <td className="py-2.5 px-3">
        <select
          aria-label={`Kode penyesuaian fiskal untuk ${row.accountName}`}
          value={row.ruleCode}
          onChange={e => onRuleChange(row, e.target.value)}
          className="w-full min-w-[230px] px-2.5 py-1.5 text-[11px] font-medium border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-sky-600 focus:border-sky-600 outline-none"
        >
          <option value="">Sesuai Fiskal (0)</option>
          <optgroup label="Koreksi Positif (FPO — Menambah PKP)">
            {FISCAL_RULE_CODES.filter(r => r.direction === 'FPO').map(r => (
              <option key={r.code} value={r.code}>
                {r.code}: {r.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Koreksi Negatif (FNE — Mengurangi PKP)">
            {FISCAL_RULE_CODES.filter(r => r.direction === 'FNE').map(r => (
              <option key={r.code} value={r.code}>
                {r.code}: {r.label}
              </option>
            ))}
          </optgroup>
        </select>
      </td>

      <td className="py-2.5 px-2">
        <select
          aria-label={`Sifat perbedaan untuk ${row.accountName}`}
          value={row.nature}
          onChange={e => onNatureChange(row, e.target.value as DifferenceNature)}
          disabled={!row.ruleCode && row.positiveCorrection === 0 && row.negativeCorrection === 0}
          className="w-full px-1.5 py-1.5 text-[11px] font-medium border border-slate-300 rounded-lg bg-white text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 focus:ring-2 focus:ring-sky-600 outline-none"
        >
          <option value="NONE">-</option>
          <option value="TETAP">Tetap</option>
          <option value="WAKTU">Waktu</option>
        </select>
      </td>

      <td className="py-2.5 px-3">
        <input
          type="text"
          inputMode="numeric"
          aria-label={`Koreksi positif untuk ${row.accountName}`}
          value={row.positiveCorrection ? row.positiveCorrection.toLocaleString('id-ID') : ''}
          placeholder="0"
          onChange={e => onAmountChange(row, 'positive', e.target.value)}
          className={`w-full px-2.5 py-1.5 text-right font-mono text-xs tabular-nums border rounded-lg focus:ring-2 focus:ring-sky-600 outline-none ${
            row.positiveCorrection > 0
              ? 'border-rose-300 bg-rose-50/70 text-rose-700 font-bold'
              : 'border-slate-300 bg-white text-slate-700'
          }`}
        />
      </td>

      <td className="py-2.5 px-3">
        <input
          type="text"
          inputMode="numeric"
          aria-label={`Koreksi negatif untuk ${row.accountName}`}
          value={row.negativeCorrection ? row.negativeCorrection.toLocaleString('id-ID') : ''}
          placeholder="0"
          onChange={e => onAmountChange(row, 'negative', e.target.value)}
          className={`w-full px-2.5 py-1.5 text-right font-mono text-xs tabular-nums border rounded-lg focus:ring-2 focus:ring-sky-600 outline-none ${
            row.negativeCorrection > 0
              ? 'border-emerald-300 bg-emerald-50/70 text-emerald-700 font-bold'
              : 'border-slate-300 bg-white text-slate-700'
          }`}
        />
      </td>

      <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
        {formatRupiah(row.fiscalAmount)}
      </td>

      <td className="py-2.5 px-3 no-print">
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-700 truncate" title={row.legalBasis}>
              {row.legalBasis}
            </div>
            {row.note && (
              <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5" title={row.note}>
                {row.note}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onEditNote(row)}
            className="p-1 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded cursor-pointer shrink-0"
            title="Edit catatan koreksi fiskal"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};

