import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  BookOpen, 
  Plus, 
  Trash2, 
  Save, 
  ExternalLink, 
  Check, 
  FileSpreadsheet, 
  Zap, 
  Eye, 
  HardDrive,
  CheckCircle,
  Clock,
  History,
  ListFilter,
  ArrowRight,
  ArrowUpRight,
  Download,
  RotateCcw,
  FileText,
  Search,
  Scan
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { TransactionLine, Transaction } from '../types/accounting';
import { formatRupiah, exportTableToExcel } from '../utils/accountingCalculations';
import { 
  getPosRules, 
  PosRule, 
  ExtractedItem, 
  SuggestedJournalLine,
  ensureSuggestedJournalWithAutoCreatedAccounts,
  autoCreateMissingCoaAccount,
  getRecordedReceipts,
  updateRecordedReceiptStatus,
  getPendingJournalDraft,
  clearPendingJournalDraft,
  deleteRecordedReceipt,
  RecordedReceipt,
  SAMPLE_RECEIPT_DATA,
  SPREADSHEET_CONFIG
} from '../services/autoRecordService';

interface AutoJournalViewProps {
  setActiveTab: (tab: any) => void;
  openNewTransactionModal?: (preset?: any) => void;
}

export const AutoJournalView: React.FC<AutoJournalViewProps> = ({ setActiveTab }) => {
  const { accounts, addAccount, transactions, addTransaction, logActivity } = useAccounting();

  // Active Tab: 'generator' (Pembentukan & Review), 'antrean' (Antrean Berkas Auto Record), 'riwayat' (Sudah Dibukukan)
  const [activeSubTab, setActiveSubTab] = useState<'generator' | 'antrean' | 'riwayat'>('generator');

  // Master POS Rules
  const [posRules, setPosRules] = useState<PosRule[]>(() => getPosRules());

  // Form State
  const [nomorBerkas, setNomorBerkas] = useState<string>('BT/0001/26X26');
  const [selectedPosCode, setSelectedPosCode] = useState<string>('A');
  const [keterangan, setKeterangan] = useState<string>('Pembelian Baut dan Material Pemeliharaan Bengkel Operasional');
  const [transactionDate, setTransactionDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [googleDriveLink, setGoogleDriveLink] = useState<string>('');
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [grandTotal, setGrandTotal] = useState<number>(440000);

  // Journal Lines State
  const [journalLines, setJournalLines] = useState<SuggestedJournalLine[]>([]);
  const [isJournalSaved, setIsJournalSaved] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [approvedTxId, setApprovedTxId] = useState<string>('');

  // Antrean & Riwayat States
  const [antreanList, setAntreanList] = useState<RecordedReceipt[]>(() => getRecordedReceipts());
  const [riwayatFilter, setRiwayatFilter] = useState<'all' | 'bt' | 'other'>('all');
  const [riwayatSearch, setRiwayatSearch] = useState<string>('');

  // Load Pending Draft if redirected from Auto Record
  useEffect(() => {
    const draft = getPendingJournalDraft();
    if (draft && draft.nomorBerkas) {
      setNomorBerkas(draft.nomorBerkas);
      setSelectedPosCode(draft.posCode || 'A');
      setKeterangan(draft.keterangan || '');
      setTransactionDate(draft.date || new Date().toISOString().slice(0, 10));
      setReceiptImage(draft.receiptImage || '');
      setGoogleDriveLink(draft.googleDriveLink || '');
      setItems(draft.extractedItems || []);
      setGrandTotal(draft.grandTotal || 0);

      const sug = ensureSuggestedJournalWithAutoCreatedAccounts(
        draft.extractedItems || [],
        draft.posCode || 'A',
        accounts,
        draft.keterangan || '',
        addAccount
      );
      setJournalLines(sug);
      setActiveSubTab('generator');
      clearPendingJournalDraft();
    } else if (journalLines.length === 0) {
      // Initialize with sample receipt if empty
      loadSampleJournal();
    }
  }, []);

  // Refresh recorded receipts list when viewing antrean
  useEffect(() => {
    setAntreanList(getRecordedReceipts());
  }, [activeSubTab]);

  // Selected POS Rule Detail
  const selectedPos = useMemo(() => {
    return posRules.find(p => p.code === selectedPosCode) || posRules[0];
  }, [posRules, selectedPosCode]);

  // Calculate totals
  const totalDebitJurnal = useMemo(() => {
    return journalLines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  }, [journalLines]);

  const totalCreditJurnal = useMemo(() => {
    return journalLines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  }, [journalLines]);

  const selisihJurnal = useMemo(() => {
    return Math.abs(totalDebitJurnal - totalCreditJurnal);
  }, [totalDebitJurnal, totalCreditJurnal]);

  // Load Sample Journal Data
  const loadSampleJournal = () => {
    setNomorBerkas('BT/0001/26X26');
    setSelectedPosCode(SAMPLE_RECEIPT_DATA.posCode);
    setKeterangan(SAMPLE_RECEIPT_DATA.keterangan);
    setReceiptImage(SAMPLE_RECEIPT_DATA.sampleImage);
    setItems(SAMPLE_RECEIPT_DATA.items as any);
    setGrandTotal(440000);

    const sug = ensureSuggestedJournalWithAutoCreatedAccounts(
      SAMPLE_RECEIPT_DATA.items as any,
      SAMPLE_RECEIPT_DATA.posCode,
      accounts,
      SAMPLE_RECEIPT_DATA.keterangan,
      addAccount
    );
    setJournalLines(sug);
  };

  // Re-generate journal lines when POS or items change
  const handleRegenerateFromItems = () => {
    const sug = ensureSuggestedJournalWithAutoCreatedAccounts(
      items,
      selectedPosCode,
      accounts,
      keterangan,
      addAccount
    );
    setJournalLines(sug);
    setIsJournalSaved(false);
  };

  // Select receipt from antrean
  const handleSelectFromAntrean = (receipt: RecordedReceipt) => {
    setNomorBerkas(receipt.nomorBerkas);
    setSelectedPosCode(receipt.posCode);
    setKeterangan(receipt.keterangan);
    setTransactionDate(receipt.date || new Date().toISOString().slice(0, 10));
    setReceiptImage(receipt.receiptImage || '');
    setGoogleDriveLink(receipt.googleDriveLink || '');
    setItems(receipt.extractedItems || []);
    setGrandTotal(receipt.grandTotal);

    const sug = ensureSuggestedJournalWithAutoCreatedAccounts(
      receipt.extractedItems || [],
      receipt.posCode,
      accounts,
      receipt.keterangan,
      addAccount
    );
    setJournalLines(sug);
    setActiveSubTab('generator');
  };

  // Edit Journal Line
  const handleUpdateJournalLine = (id: string, field: keyof SuggestedJournalLine, value: any) => {
    setJournalLines(prev => prev.map(l => {
      if (l.id === id) {
        if (field === 'accountCode') {
          const acc = accounts.find(a => a.code === value);
          return {
            ...l,
            accountCode: value,
            accountName: acc?.name || l.accountName,
            accountCategory: acc?.category || l.accountCategory,
            isNewAccount: !acc
          };
        }
        return { ...l, [field]: value };
      }
      return l;
    }));
    setIsJournalSaved(false);
  };

  const handleAddJournalLine = (type: 'debit' | 'credit') => {
    const newLine: SuggestedJournalLine = {
      id: `sug-${Date.now()}-${type}`,
      accountCode: '10001',
      accountName: 'Kas',
      accountCategory: 'HARTA_LANCAR',
      pos: 'Nrc',
      sn: type === 'debit' ? 'Db' : 'Kr',
      debit: 0,
      credit: 0,
      memo: keterangan,
      isNewAccount: false
    };
    setJournalLines(prev => [...prev, newLine]);
    setIsJournalSaved(false);
  };

  const handleDeleteJournalLine = (id: string) => {
    setJournalLines(prev => prev.filter(l => l.id !== id));
    setIsJournalSaved(false);
  };

  const handleSaveJournalEdits = () => {
    if (selisihJurnal !== 0) {
      alert(`Jurnal belum seimbang! Selisih: Rp ${selisihJurnal.toLocaleString('id-ID')}. Total Debit harus sama persis dengan Total Kredit.`);
      return;
    }
    setIsJournalSaved(true);
    setSaveSuccessMsg('Saran Jurnal berhasil dikunci dan diverifikasi!');
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // APPROVE & POST TO GENERAL JOURNAL
  const handleApprove = async () => {
    if (selisihJurnal !== 0) {
      alert(`Gagal Bukukan: Jurnal belum seimbang! Selisih: Rp ${selisihJurnal.toLocaleString('id-ID')}. Pastikan Total Debit dan Total Kredit sama.`);
      return;
    }

    // 1. Auto-Create Akun Baru di COA jika ada
    const finalLines: TransactionLine[] = [];
    let currentAccounts = [...accounts];

    for (let i = 0; i < journalLines.length; i++) {
      const line = journalLines[i];
      let existingAcc = currentAccounts.find(a => 
        a.code === line.accountCode || a.name.toLowerCase() === line.accountName.toLowerCase()
      );

      if (!existingAcc || line.isNewAccount) {
        const createdAcc = autoCreateMissingCoaAccount(line, currentAccounts, addAccount);
        currentAccounts.push(createdAcc);
        existingAcc = createdAcc;
      }

      finalLines.push({
        id: `line-${nomorBerkas.replace(/\//g, '_')}-${i + 1}`,
        accountId: existingAcc.id || `acc-${existingAcc.code}`,
        accountCode: existingAcc.code,
        accountName: existingAcc.name,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        memo: line.memo || keterangan
      });
    }

    // 2. Submit ke Jurnal Umum Transaksi
    const createdTx = addTransaction({
      date: transactionDate,
      refNumber: nomorBerkas,
      type: 'general',
      description: keterangan,
      lines: finalLines,
      totalDebit: totalDebitJurnal,
      totalCredit: totalCreditJurnal,
      partner: ''
    });

    // 3. Update status antrean berkas
    updateRecordedReceiptStatus(nomorBerkas, 'journalized', createdTx.id);

    logActivity(
      'Jurnal Otomatis Approval',
      `Menyetujui & membukukan otomatis Bukti Transaksi ${nomorBerkas} (${keterangan}) - Total Rp ${totalDebitJurnal.toLocaleString('id-ID')}`
    );

    setApprovedTxId(createdTx.id);
    setIsSuccessModalOpen(true);
  };

  // Filtered Riwayat Transaksi Jurnal
  const filteredHistoryTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (riwayatFilter === 'bt' && (!t.refNumber || !t.refNumber.startsWith('BT/'))) return false;
      if (riwayatFilter === 'other' && t.refNumber && t.refNumber.startsWith('BT/')) return false;

      if (riwayatSearch.trim()) {
        const q = riwayatSearch.toLowerCase();
        const matchRef = (t.refNumber || '').toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchLine = t.lines.some(l => (l.accountName || '').toLowerCase().includes(q) || (l.accountCode || '').includes(q));
        if (!matchRef && !matchDesc && !matchLine) return false;
      }
      return true;
    });
  }, [transactions, riwayatFilter, riwayatSearch]);

  const totalHistoryDebit = useMemo(() => {
    return filteredHistoryTransactions.reduce((acc, t) => acc + (t.totalDebit || 0), 0);
  }, [filteredHistoryTransactions]);

  const handleExportHistoryExcel = () => {
    const data: any[][] = [
      ['TANGGAL', 'NOMOR BERKAS / REF', 'TIPE', 'KETERANGAN', 'KODE AKUN', 'NAMA AKUN', 'DEBIT (RP)', 'KREDIT (RP)']
    ];

    filteredHistoryTransactions.forEach(trx => {
      trx.lines.forEach((line, idx) => {
        data.push([
          idx === 0 ? trx.date : '',
          idx === 0 ? trx.refNumber : '',
          idx === 0 ? (trx.type || 'general') : '',
          idx === 0 ? trx.description : (line.memo || ''),
          line.accountCode,
          line.accountName,
          line.debit,
          line.credit
        ]);
      });
    });

    exportTableToExcel(data, `Riwayat_Jurnal_Otomatis_${new Date().toISOString().split('T')[0]}`, 'Riwayat Jurnal Otomatis');
  };

  const pendingCount = antreanList.filter(r => r.status === 'pending_journal').length;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* 1. Header Banner & Navigasi */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-purple-800/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold backdrop-blur-md border border-purple-500/30">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>SPECTRA SAK Intelligent Journal Engine</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white drop-shadow">
              Jurnal Otomatis Akuntansi
            </h1>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              Membentuk jurnal umum akuntansi standar SAK secara otomatis: segregasi akun, pemisahan pajak PB1/PPN &amp; biaya transfer BI-FAST, serta penambahan akun baru COA otomatis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('auto-record')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Buka modul Auto Record untuk scan bukti transaksi"
            >
              <Scan className="w-4 h-4 text-indigo-400" />
              <span>Buka Auto Record</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('journals')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Buka Jurnal Umum & AJP"
            >
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span>Jurnal Umum</span>
            </button>
          </div>
        </div>

        {/* Tab Sub-Navigation */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveSubTab('generator')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'generator'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Form &amp; Generator Jurnal SAK</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('antrean')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer relative ${
              activeSubTab === 'antrean'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Antrean Berkas dari Auto Record</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-900">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('riwayat')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'riwayat'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Riwayat Jurnal yang Telah Dibukukan ({transactions.filter(t => t.refNumber && t.refNumber.startsWith('BT/')).length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB 1: FORM & GENERATOR JURNAL SAK */}
      {/* ========================================================================= */}
      {activeSubTab === 'generator' && (
        <div className="space-y-6">
          {/* Parameter Transaksi Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Parameter Dasar Jurnal Otomatis</h2>
                  <p className="text-[11px] text-slate-500">Tentukan aturan POS dan keterangan transaksi untuk memetakan akun debit/kredit</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadSampleJournal}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>Muat Contoh Nota Resmi (Baut &amp; PB1)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nomor Berkas / Ref:
                </label>
                <input
                  type="text"
                  value={nomorBerkas}
                  onChange={(e) => setNomorBerkas(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-purple-500"
                  placeholder="BT/0001/26X26"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Tanggal Transaksi:
                </label>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Aturan POS (Penentu Akun Lawan):
                </label>
                <select
                  value={selectedPosCode}
                  onChange={(e) => {
                    setSelectedPosCode(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-purple-500 text-slate-800"
                >
                  {posRules.map(p => (
                    <option key={p.code} value={p.code}>
                      POS [{p.code}] - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Keterangan atas Transaksi:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-purple-500"
                    placeholder="Contoh: Pembelian Baut dan Material Pemeliharaan Bengkel"
                  />
                  <button
                    type="button"
                    onClick={handleRegenerateFromItems}
                    className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Generate Ulang Jurnal SAK</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Aturan POS Aktif Banner */}
            <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl text-xs text-purple-950 space-y-1">
              <div className="font-bold text-[11px] text-purple-900">
                Aturan POS "{selectedPos.code}": {selectedPos.name}
              </div>
              <div className="text-[11px] text-slate-600">
                <span className="font-semibold text-emerald-800">Debit:</span> {selectedPos.debitRule} | <span className="font-semibold text-rose-800">Kredit:</span> {selectedPos.creditRule}
              </div>
            </div>
          </div>

          {/* Rincian Item / Sumber Berkas (Jika Ada) */}
          {items.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-800">
                    Rincian Item Sumber Transaksi ({items.length} item)
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-purple-700">
                  Total Nilai: {formatRupiah(grandTotal)}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {items.map((it, idx) => (
                  <div key={it.id || idx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-800 truncate">{it.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {it.quantity ? `${it.quantity} ${it.unit || 'pcs'} x ` : ''}
                        {it.unitPrice ? formatRupiah(it.unitPrice) : ''}
                        {it.isTaxOrFee && <span className="ml-1 text-purple-700 font-bold">({it.taxOrFeeType || 'Pajak/Biaya'})</span>}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-slate-900 shrink-0">
                      {formatRupiah(it.totalPrice)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabel Usulan Jurnal Umum Akuntansi SAK */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span>Usulan Jurnal Umum Akuntansi (Prinsip SAK)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Agregasi akun sejenis, pemisahan pajak PB1/PPN &amp; biaya BI-FAST, serta penentuan akun lawan POS "{selectedPosCode}".
                </p>
              </div>

              {/* Status Balance */}
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                  selisihJurnal === 0 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${selisihJurnal === 0 ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'}`} />
                  <span>{selisihJurnal === 0 ? 'Status: Seimbang (Selisih Rp 0)' : `Selisih: ${formatRupiah(selisihJurnal)}`}</span>
                </div>
              </div>
            </div>

            {/* List of Journal Lines */}
            <div className="space-y-2.5">
              {journalLines.map((line, index) => (
                <div 
                  key={line.id} 
                  className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                    line.credit > 0 ? 'bg-slate-50/70 border-slate-200' : 'bg-purple-50/30 border-purple-200/60'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-400 w-6">
                      #{index + 1}
                    </span>

                    {/* D/K Badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${
                      line.debit > 0 ? 'bg-purple-600 text-white' : 'bg-slate-700 text-white'
                    }`}>
                      {line.debit > 0 ? 'DEBIT' : 'KREDIT'}
                    </span>

                    {/* Account Selector */}
                    <div className="flex-1 min-w-[200px]">
                      <select
                        value={line.accountCode}
                        onChange={(e) => handleUpdateJournalLine(line.id, 'accountCode', e.target.value)}
                        className="w-full px-2.5 py-1 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500"
                      >
                        {!accounts.some(a => a.code === line.accountCode) && (
                          <option value={line.accountCode}>
                            {line.accountCode} - {line.accountName} ({line.accountCategory || 'Beban Operasional'})
                          </option>
                        )}
                        {accounts.filter(a => !a.isHeader).map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.code} - {a.name} ({a.categoryName})
                          </option>
                        ))}
                      </select>
                      {line.isNewAccount && (
                        <div className="text-[10px] font-bold text-amber-700 mt-0.5 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>+ Akun Baru Otomatis: {line.accountName} (Kode: {line.suggestedNewCode || line.accountCode})</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nominal Inputs */}
                  <div className="flex items-center gap-2">
                    <div>
                      <span className="text-[9px] text-slate-400 block text-right font-semibold">Debit (Rp)</span>
                      <input 
                        type="number"
                        value={line.debit}
                        onChange={(e) => handleUpdateJournalLine(line.id, 'debit', Number(e.target.value))}
                        className="w-28 text-right px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block text-right font-semibold">Kredit (Rp)</span>
                      <input 
                        type="number"
                        value={line.credit}
                        onChange={(e) => handleUpdateJournalLine(line.id, 'credit', Number(e.target.value))}
                        className="w-28 text-right px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteJournalLine(line.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer mt-3"
                      title="Hapus baris jurnal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Balance Summary Bar */}
            <div className="bg-slate-900 text-white p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">Total Debit:</span>
                  <div className="font-mono font-bold text-purple-300">{formatRupiah(totalDebitJurnal)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">Total Kredit:</span>
                  <div className="font-mono font-bold text-emerald-300">{formatRupiah(totalCreditJurnal)}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddJournalLine('debit')}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  + Tambah Baris Debit
                </button>
                <button
                  type="button"
                  onClick={() => handleAddJournalLine('credit')}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  + Tambah Baris Kredit
                </button>
                <button
                  type="button"
                  onClick={handleSaveJournalEdits}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Kunci Jurnal</span>
                </button>
              </div>
            </div>

            {saveSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-1.5 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* ACTION APPROVE BUTTON */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Menyetujui jurnal akan otomatis membuat akun baru di COA (jika belum ada) dan membukukan transaksi secara permanen ke <strong>Jurnal Umum &amp; AJP</strong>.
              </div>

              <button
                type="button"
                disabled={selisihJurnal !== 0}
                onClick={handleApprove}
                className="py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4 text-emerald-200" />
                <span>Approve &amp; Simpan ke Jurnal Umum</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: ANTREAN BERKAS DARI AUTO RECORD */}
      {/* ========================================================================= */}
      {activeSubTab === 'antrean' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <span>Antrean Berkas dari Auto Record</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Daftar bukti transaksi yang telah terekam dan diekstrak di modul Auto Record, siap untuk diproses jurnal akuntansinya.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('auto-record')}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Scan className="w-3.5 h-3.5" />
              <span>+ Unggah Bukti Baru di Auto Record</span>
            </button>
          </div>

          {antreanList.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-slate-700">Belum Ada Berkas di Antrean</div>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Rekam bukti transaksi baru di modul Auto Record, lalu teruskan ke sini untuk dibentuk jurnal otomatisnya.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('auto-record')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Buka Auto Record Sekarang
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                    <th className="py-2.5 px-3">No. Berkas</th>
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Keterangan</th>
                    <th className="py-2.5 px-3">POS</th>
                    <th className="py-2.5 px-3 text-right">Total Transaksi</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {antreanList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-mono font-bold text-purple-700">
                        {item.nomorBerkas}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {item.date}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800">
                        {item.keterangan}
                        {item.receiptFileName && (
                          <div className="text-[10px] text-slate-400">Berkas: {item.receiptFileName}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-700">
                        POS [{item.posCode}]
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatRupiah(item.grandTotal)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {item.status === 'journalized' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Sudah Dijurnal
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            ⏳ Menunggu Jurnal
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleSelectFromAntrean(item)}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <span>Proses Jurnal</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: RIWAYAT JURNAL OTOMATIS YANG TELAH DIBUKUKAN */}
      {/* ========================================================================= */}
      {activeSubTab === 'riwayat' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-purple-600" />
                <span>Riwayat Transaksi Jurnal Otomatis yang Telah Dibukukan</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Seluruh transaksi dengan kode berkas (BT/...) yang telah divalidasi dan masuk ke Jurnal Umum &amp; Buku Besar.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportHistoryExcel}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('journals')}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Buka Jurnal Umum</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 text-xs">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari berdasarkan nomor berkas, akun, atau keterangan..."
                value={riwayatSearch}
                onChange={(e) => setRiwayatSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-purple-500"
              />
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <select
                value={riwayatFilter}
                onChange={(e) => setRiwayatFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >
                <option value="all">Semua Transaksi</option>
                <option value="bt">Khusus Berkas (BT/)</option>
                <option value="other">Transaksi Non-BT</option>
              </select>
            </div>
          </div>

          {/* Tabel Riwayat */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Nomor Ref</th>
                  <th className="py-2.5 px-3">Keterangan</th>
                  <th className="py-2.5 px-3">Akun Debet</th>
                  <th className="py-2.5 px-3">Akun Kredit</th>
                  <th className="py-2.5 px-3 text-right">Total Debit</th>
                  <th className="py-2.5 px-3 text-right">Total Kredit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistoryTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      Tidak ada transaksi yang sesuai kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredHistoryTransactions.map((trx) => {
                    const debits = trx.lines.filter(l => l.debit > 0);
                    const credits = trx.lines.filter(l => l.credit > 0);

                    return (
                      <tr key={trx.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{trx.date}</td>
                        <td className="py-3 px-3 font-mono font-bold text-purple-700 whitespace-nowrap">
                          {trx.refNumber || '-'}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800 max-w-xs truncate">
                          {trx.description}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          {debits.map((d, i) => (
                            <div key={i} className="text-[11px]">
                              {d.accountCode} - {d.accountName}
                            </div>
                          ))}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          {credits.map((c, i) => (
                            <div key={i} className="text-[11px]">
                              {c.accountCode} - {c.accountName}
                            </div>
                          ))}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(trx.totalDebit)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(trx.totalCredit)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL SUCCESS APPROVAL */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 text-center animate-scaleUp">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">
                Jurnal Otomatis Berhasil Dibukukan!
              </h3>
              <p className="text-xs text-slate-500">
                Bukti transaksi <strong className="text-purple-700">{nomorBerkas}</strong> telah resmi dibukukan ke <strong>Jurnal Umum &amp; AJP</strong> dan buku besar.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-left space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Nominal:</span>
                <span className="font-mono font-bold text-slate-800">{formatRupiah(totalDebitJurnal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Jurnal:</span>
                <span className="font-bold text-emerald-600">✓ Seimbang (Balance)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  setActiveSubTab('riwayat');
                }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Lihat Riwayat
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  setActiveTab('journals');
                }}
                className="py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md"
              >
                Buka Jurnal Umum ➔
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

