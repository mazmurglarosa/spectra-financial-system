import React, { useState, useEffect, useMemo } from 'react';
import { 
  Scan, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  ExternalLink, 
  RotateCcw, 
  Sparkles, 
  Sliders, 
  ArrowRight, 
  Check, 
  HelpCircle, 
  FileSpreadsheet, 
  FolderCheck, 
  Layers, 
  Zap, 
  Eye, 
  HardDrive,
  CheckCircle,
  X,
  Key,
  EyeOff,
  History,
  Clock,
  ListFilter,
  Receipt,
  Calendar,
  Search,
  ArrowUpRight,
  Download
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { TransactionLine, Transaction } from '../types/accounting';
import { formatRupiah, exportTableToExcel } from '../utils/accountingCalculations';
import { 
  getPosRules, 
  saveCustomPosRule, 
  deleteCustomPosRule, 
  PosRule, 
  ExtractedItem, 
  AutoRecordDraft, 
  SpreadsheetRowData, 
  SuggestedJournalLine, 
  generateFileCode, 
  getNextDocumentSequence, 
  commitDocumentSequence, 
  parseIndonesianCurrency, 
  runTwoWayDeterministicVerification, 
  buildSpreadsheetRows, 
  exportSpreadsheetRowsToCsv, 
  analyzeAndSuggestJournal, 
  autoCreateMissingCoaAccount, 
  SAMPLE_RECEIPT_DATA, 
  SPREADSHEET_CONFIG,
  extractTransactionFromFile,
  getGeminiApiKey,
  saveGeminiApiKey,
  testGeminiApiKey,
  RealOcrExtractionResult
} from '../services/autoRecordService';
import { uploadHeavyFileToDrive, SPECTRA_DRIVE_FOLDER_URL } from '../services/googleDriveBot';

interface AutoRecordViewProps {
  setActiveTab: (tab: any) => void;
  openNewTransactionModal: (preset?: any) => void;
}

export const AutoRecordView: React.FC<AutoRecordViewProps> = ({ setActiveTab }) => {
  const { accounts, transactions, addAccount, addTransaction, deleteTransaction, settings, logActivity } = useAccounting();

  // 1. Master Data & Upload States (CLEAN & NON-HARDCODED)
  const [posRules, setPosRules] = useState<PosRule[]>(getPosRules);
  const [selectedPosCode, setSelectedPosCode] = useState<string>('A');
  const [keterangan, setKeterangan] = useState<string>('');
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [seqNumber, setSeqNumber] = useState<number>(() => getNextDocumentSequence(transactions));
  const [nomorBerkas, setNomorBerkas] = useState<string>(() => generateFileCode(getNextDocumentSequence(transactions)));

  // Gemini API Key Modal State
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => getGeminiApiKey());
  const [showApiKeyText, setShowApiKeyText] = useState<boolean>(false);
  const [apiTesting, setApiTesting] = useState<boolean>(false);
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Pipeline Status & Stage (tahap1, tahap2, riwayat)
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractStep, setExtractStep] = useState<string>('');
  const [currentStage, setCurrentStage] = useState<'tahap1' | 'tahap2' | 'riwayat'>('tahap1');
  const [riwayatFilter, setRiwayatFilter] = useState<'all' | 'bt' | 'other'>('all');
  const [riwayatSearch, setRiwayatSearch] = useState<string>('');

  // Tahap 2: Extraction & Verification States
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [grandTotal, setGrandTotal] = useState<number>(0);
  const [calculatedTotal, setCalculatedTotal] = useState<number>(0);
  const [mathDiscrepancy, setMathDiscrepancy] = useState<boolean>(false);
  const [discrepancyMessage, setDiscrepancyMessage] = useState<string>('');
  const [googleDriveLink, setGoogleDriveLink] = useState<string>('');
  const [spreadsheetRows, setSpreadsheetRows] = useState<SpreadsheetRowData[]>([]);

  // Suggested Journal Lines (SAK)
  const [journalLines, setJournalLines] = useState<SuggestedJournalLine[]>([]);
  const [isJournalSaved, setIsJournalSaved] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  // Modals
  const [isCustomPosModalOpen, setIsCustomPosModalOpen] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [approvedTxId, setApprovedTxId] = useState<string>('');

  // Custom POS Form State
  const [newPosName, setNewPosName] = useState<string>('');
  const [newPosCode, setNewPosCode] = useState<string>('');
  const [newPosDebitRule, setNewPosDebitRule] = useState<string>('');
  const [newPosCreditRule, setNewPosCreditRule] = useState<string>('');
  const [newPosDebitAcc, setNewPosDebitAcc] = useState<string>('10001');
  const [newPosCreditAcc, setNewPosCreditAcc] = useState<string>('20001');

  // Filter daftar transaksi terekam
  const autoRecordTransactions = useMemo(() => {
    return transactions.filter(t => t.refNumber && t.refNumber.startsWith('BT/'));
  }, [transactions]);

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

    exportTableToExcel(data, `Riwayat_Transaksi_AutoRecord_${new Date().toISOString().split('T')[0]}`, 'Riwayat Transaksi');
  };

  const handleLoadSampleRecordedTransaction = () => {
    const existing = transactions.find(t => t.refNumber && t.refNumber.startsWith('BT/0001'));
    if (existing) {
      alert('Transaksi BT/0001 sudah ada dalam daftar transaksi yang terekam.');
      return;
    }

    addTransaction({
      date: new Date().toISOString().slice(0, 10),
      refNumber: 'BT/0001/26X26',
      type: 'general',
      description: 'Pembelian Baut dan Material Pemeliharaan Bengkel Operasional',
      lines: [
        {
          id: 'line-bt1-1',
          accountId: 'acc_10006',
          accountCode: '10006',
          accountName: 'Perlengkapan Kantor',
          debit: 400000,
          credit: 0,
          memo: 'Baut Ukuran 12 & Baut Ukuran 15'
        },
        {
          id: 'line-bt1-2',
          accountId: 'acc_50022',
          accountCode: '50022',
          accountName: 'Pajak Pembelian PB1',
          debit: 40000,
          credit: 0,
          memo: 'Pajak Pembelian PB1 (10%)'
        },
        {
          id: 'line-bt1-3',
          accountId: 'acc_10001',
          accountCode: '10001',
          accountName: 'Kas',
          debit: 0,
          credit: 440000,
          memo: 'Pengeluaran kas pembelian tunai'
        }
      ],
      totalDebit: 440000,
      totalCredit: 440000,
      partner: 'TOKO BAUT & MATERIAL JAYA'
    });
    commitDocumentSequence(2);
    logActivity('Auto Record Sample', 'Menambahkan contoh transaksi BT/0001/26X26 ke database');
    alert('Contoh transaksi BT/0001/26X26 berhasil ditambahkan ke daftar transaksi terekam!');
  };

  // Update nomor berkas when seq or transactions change
  useEffect(() => {
    const nextSeq = getNextDocumentSequence(transactions);
    setSeqNumber(nextSeq);
    setNomorBerkas(generateFileCode(nextSeq));
  }, [transactions]);

  // Helper: Analisis Jurnal dan LANGSUNG buat akun baru ke COA jika ada akun yang belum terdaftar (misal: Pajak Pembelian PB1)
  const ensureSuggestedJournalWithAutoCreatedAccounts = (
    items: ExtractedItem[],
    posCode: string,
    currentAccounts: typeof accounts,
    txKeterangan: string
  ): SuggestedJournalLine[] => {
    const sug = analyzeAndSuggestJournal(items, posCode, currentAccounts, txKeterangan);
    let workingAccounts = [...currentAccounts];

    const finalLines = sug.map(line => {
      if (line.isNewAccount) {
        // Cek apakah akun dengan nama atau kode ini sudah ada di COA
        let existing = workingAccounts.find(a => 
          !a.isHeader && (
            a.code === line.accountCode || 
            a.name.toLowerCase() === line.accountName.toLowerCase() ||
            (line.accountName.toLowerCase().includes('pb1') && a.name.toLowerCase().includes('pb1'))
          )
        );

        if (!existing) {
          // LANGSUNG buat akun baru ke COA sesuai skema Tambah Akun Baru!
          const created = autoCreateMissingCoaAccount(line, workingAccounts, addAccount);
          workingAccounts.push(created);
          existing = created;
        }

        return {
          ...line,
          accountCode: existing.code,
          accountName: existing.name,
          accountCategory: existing.category,
          isNewAccount: true, // Biarkan badge 'Akun Baru Otomatis' tetap terlihat oleh user
          suggestedNewCode: existing.code
        };
      }
      return line;
    });

    return finalLines;
  };

  const loadSampleData = () => {
    setReceiptImage(SAMPLE_RECEIPT_DATA.sampleImage);
    setReceiptFileName(SAMPLE_RECEIPT_DATA.receiptFileName);
    setSelectedPosCode(SAMPLE_RECEIPT_DATA.posCode);
    setKeterangan(SAMPLE_RECEIPT_DATA.keterangan);
    
    const verif = runTwoWayDeterministicVerification(SAMPLE_RECEIPT_DATA.items, 440000);
    setExtractedItems(verif.verifiedItems);
    setGrandTotal(verif.grandTotal);
    setCalculatedTotal(verif.calculatedSum);
    setMathDiscrepancy(verif.mathDiscrepancy);
    setDiscrepancyMessage(verif.discrepancyMessage || '');

    const rows = buildSpreadsheetRows(seqNumber, nomorBerkas, '', 'A', verif.verifiedItems);
    setSpreadsheetRows(rows);

    const finalSug = ensureSuggestedJournalWithAutoCreatedAccounts(verif.verifiedItems, 'A', accounts, SAMPLE_RECEIPT_DATA.keterangan);
    setJournalLines(finalSug);
  };

  // Handle File Upload from User
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptFileName(file.name);
    // Reset hasil ekstraksi lama agar murni membaca file baru yang diunggah
    setExtractedItems([]);
    setJournalLines([]);
    setSpreadsheetRows([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      setReceiptImage(dataUri);
    };
    reader.readAsDataURL(file);
  };

  // Run Tahap 1 AI Pipeline
  const handleRunExtraction = async () => {
    if (!receiptImage) {
      alert('Silakan pilih berkas bukti transaksi terlebih dahulu atau klik tombol "Gunakan Contoh Bukti Resmi"!');
      return;
    }
    if (!keterangan.trim()) {
      alert('Keterangan atas Transaksi wajib diisi sebelum menjalankan ekstraksi!');
      return;
    }

    setIsExtracting(true);
    setExtractStep('1/4: Pra-pemrosesan Visual & Validasi Berkas...');
    await new Promise(r => setTimeout(r, 400));

    try {
      setExtractStep('2/4: Memproses dengan Multimodal Vision AI / OCR...');

      let extractionResult: RealOcrExtractionResult;
      const isSample = receiptImage === SAMPLE_RECEIPT_DATA.sampleImage;

      if (isSample) {
        const verif = runTwoWayDeterministicVerification(SAMPLE_RECEIPT_DATA.items, 440000);
        extractionResult = {
          detectedType: 'nota_pembelian',
          sellerOrRecipient: 'TOKO BAUT & MATERIAL JAYA',
          extractedItems: verif.verifiedItems,
          declaredGrandTotal: verif.grandTotal,
          calculatedSum: verif.calculatedSum,
          mathDiscrepancy: verif.mathDiscrepancy,
          discrepancyMessage: verif.discrepancyMessage,
          sourceEngine: 'smart_parser'
        };
      } else {
        // REAL EXTRACTION MENGGUNAKAN FILE ASLI YANG DIUNGGAH!
        extractionResult = await extractTransactionFromFile({
          fileDataUri: receiptImage,
          fileName: receiptFileName,
          posCode: selectedPosCode,
          userDescription: keterangan,
          accounts,
          onProgress: (stepText) => setExtractStep(stepText)
        });
      }

      setExtractStep('3/4: Menjalankan Verifikasi Formal Dua Arah (Uji Horizontal & Vertikal)...');
      setExtractedItems(extractionResult.extractedItems);
      setGrandTotal(extractionResult.declaredGrandTotal);
      setCalculatedTotal(extractionResult.calculatedSum);
      setMathDiscrepancy(extractionResult.mathDiscrepancy);
      setDiscrepancyMessage(extractionResult.discrepancyMessage || '');

      setExtractStep('4/4: Sinkronisasi Google Drive & Penamaan Otomatis (' + nomorBerkas + ')...');

      // Upload to Google Drive if image exists
      let driveLink = googleDriveLink;
      if (receiptImage && receiptImage.startsWith('data:')) {
        try {
          const driveRes = await uploadHeavyFileToDrive(
            receiptImage,
            `${nomorBerkas.replace(/\//g, '_')}_${receiptFileName}`,
            'image/jpeg',
            {
              documentCode: nomorBerkas,
              title: `Bukti Transaksi - ${keterangan}`,
              uploadedBy: 'Auto Record Engine'
            }
          );
          if (driveRes.success && driveRes.viewUrl) {
            driveLink = driveRes.viewUrl;
            setGoogleDriveLink(driveLink);
          }
        } catch (err) {
          console.warn('Google Drive background sync info:', err);
        }
      }

      // Build spreadsheet rows dari HASIL EKSTRAKSI NYATA!
      const rows = buildSpreadsheetRows(seqNumber, nomorBerkas, driveLink, selectedPosCode, extractionResult.extractedItems);
      setSpreadsheetRows(rows);

      // Analyze SAK Journal & LANGSUNG buat akun baru ke COA jika ada akun belum terdaftar
      const finalSug = ensureSuggestedJournalWithAutoCreatedAccounts(
        extractionResult.extractedItems,
        selectedPosCode,
        accounts,
        keterangan
      );
      setJournalLines(finalSug);

      await new Promise(r => setTimeout(r, 400));
      setIsExtracting(false);
      setCurrentStage('tahap2');
    } catch (err: any) {
      console.error('Extraction error:', err);
      setIsExtracting(false);
      alert('Terjadi kesalahan saat memproses ekstraksi: ' + (err?.message || String(err)));
    }
  };

  // Recalculate Journal when user edits items in Tahap 2
  const handleUpdateItem = (id: string, field: keyof ExtractedItem, value: any) => {
    const updated = extractedItems.map(it => {
      if (it.id === id) {
        const copy: any = { ...it, [field]: value };
        if (field === 'unitPrice' || field === 'quantity') {
          const uP = field === 'unitPrice' ? Number(value) : (it.unitPrice || 0);
          const qty = field === 'quantity' ? Number(value) : (it.quantity || 1);
          copy.totalPrice = uP * qty;
        }
        return copy;
      }
      return it;
    });

    const verif = runTwoWayDeterministicVerification(updated);
    setExtractedItems(verif.verifiedItems);
    setGrandTotal(verif.grandTotal);
    setCalculatedTotal(verif.calculatedSum);
    setMathDiscrepancy(verif.mathDiscrepancy);
    setDiscrepancyMessage(verif.discrepancyMessage || '');

    const rows = buildSpreadsheetRows(seqNumber, nomorBerkas, googleDriveLink, selectedPosCode, verif.verifiedItems);
    setSpreadsheetRows(rows);

    const finalSug = ensureSuggestedJournalWithAutoCreatedAccounts(verif.verifiedItems, selectedPosCode, accounts, keterangan);
    setJournalLines(finalSug);
  };

  const handleDeleteItem = (id: string) => {
    const filtered = extractedItems.filter(it => it.id !== id);
    const verif = runTwoWayDeterministicVerification(filtered);
    setExtractedItems(verif.verifiedItems);
    setGrandTotal(verif.grandTotal);
    setCalculatedTotal(verif.calculatedSum);
    setMathDiscrepancy(verif.mathDiscrepancy);

    const rows = buildSpreadsheetRows(seqNumber, nomorBerkas, googleDriveLink, selectedPosCode, verif.verifiedItems);
    setSpreadsheetRows(rows);

    const finalSug = ensureSuggestedJournalWithAutoCreatedAccounts(verif.verifiedItems, selectedPosCode, accounts, keterangan);
    setJournalLines(finalSug);
  };

  const handleAddNewItem = () => {
    const newItem: ExtractedItem = {
      id: `it-${Date.now()}`,
      name: 'Item Tambahan Baru',
      unitPrice: 10000,
      quantity: 1,
      unit: 'pcs',
      totalPrice: 10000,
      confidence: 100,
      isTaxOrFee: false
    };
    const updated = [...extractedItems, newItem];
    const verif = runTwoWayDeterministicVerification(updated);
    setExtractedItems(verif.verifiedItems);
    setGrandTotal(verif.grandTotal);
    setCalculatedTotal(verif.calculatedSum);
    setMathDiscrepancy(verif.mathDiscrepancy);

    const rows = buildSpreadsheetRows(seqNumber, nomorBerkas, googleDriveLink, selectedPosCode, verif.verifiedItems);
    setSpreadsheetRows(rows);

    const finalSug = ensureSuggestedJournalWithAutoCreatedAccounts(verif.verifiedItems, selectedPosCode, accounts, keterangan);
    setJournalLines(finalSug);
  };

  // Journal Line Editing
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
      debit: type === 'debit' ? 0 : 0,
      credit: type === 'credit' ? 0 : 0,
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
    const totalDebit = journalLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = journalLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    const diff = Math.abs(totalDebit - totalCredit);

    if (diff !== 0) {
      alert(`Jurnal belum seimbang! Selisih: Rp ${diff.toLocaleString('id-ID')}. Total Debit harus sama persis dengan Total Kredit.`);
      return;
    }

    setIsJournalSaved(true);
    setSaveSuccessMsg('Saran Jurnal berhasil dikunci dan disimpan!');
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // APPROVE WORKFLOW (Section 5)
  const handleApprove = async () => {
    const totalDebit = journalLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = journalLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    const diff = Math.abs(totalDebit - totalCredit);

    if (diff !== 0) {
      alert(`Gagal Approve: Jurnal belum seimbang! Selisih: Rp ${diff.toLocaleString('id-ID')}. Pastikan Total Debit dan Total Kredit sama.`);
      return;
    }

    // 1. Cek & Auto-Create Akun Baru di COA
    const finalLines: TransactionLine[] = [];
    let currentAccounts = [...accounts];

    for (let i = 0; i < journalLines.length; i++) {
      const line = journalLines[i];
      let existingAcc = currentAccounts.find(a => a.code === line.accountCode || a.name.toLowerCase() === line.accountName.toLowerCase());

      if (!existingAcc || line.isNewAccount) {
        // Auto-create missing account in COA
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

    // 2. Auto-Submit ke Input Jurnal Transaksi (Accurate Voucher)
    const today = new Date().toISOString().slice(0, 10);
    const createdTx = addTransaction({
      date: today,
      refNumber: nomorBerkas,
      type: 'general',
      description: keterangan,
      lines: finalLines,
      totalDebit,
      totalCredit,
      partner: ''
    });

    // 3. Commit Sequence Number
    commitDocumentSequence(seqNumber);

    logActivity(
      'Auto Record Approval',
      `Menyetujui & membukukan otomatis Bukti Transaksi ${nomorBerkas} (${keterangan}) - Total Rp ${totalDebit.toLocaleString('id-ID')}`
    );

    setApprovedTxId(createdTx.id);
    setIsSuccessModalOpen(true);
  };

  // Custom POS Save
  const handleSaveCustomPos = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPosCode.trim() || !newPosName.trim()) {
      alert('Nama dan Kode POS wajib diisi!');
      return;
    }

    const saved = saveCustomPosRule({
      code: newPosCode.toUpperCase().trim(),
      name: newPosName.trim(),
      description: `Kustom: ${newPosName}`,
      debitRule: newPosDebitRule || 'Akun debit sesuai transaksi',
      creditRule: newPosCreditRule || 'Akun kredit sesuai transaksi',
      defaultDebitAccountCode: newPosDebitAcc,
      defaultCreditAccountCode: newPosCreditAcc
    });

    setPosRules(getPosRules());
    setSelectedPosCode(saved.code);
    setIsCustomPosModalOpen(false);
    alert(`Jenis Transaksi "${saved.name}" (Kode POS = ${saved.code}) berhasil ditambahkan!`);
  };

  const totalDebitJurnal = journalLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCreditJurnal = journalLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const selisihJurnal = Math.abs(totalDebitJurnal - totalCreditJurnal);

  const selectedRule = posRules.find(p => p.code === selectedPosCode) || posRules[0];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full animate-fadeIn select-none">
      
      {/* 1. Header Banner & Navigasi Tahap */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 text-white shadow-xl border border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 via-slate-900/95 to-indigo-950/90 z-0" />
        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>SPECTRA Auto Record &amp; Intelligent Accounting OCR/HTR</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white drop-shadow">
              Otomasi Perekaman Bukti Transaksi
            </h1>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              Mengekstrak nota cetak, struk thermal, &amp; nota tulis tangan (HTR), sinkronisasi spreadsheet, serta membentuk jurnal akuntansi otomatis sesuai Standar Akuntansi Keuangan (SAK).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Tombol Konfigurasi Gemini Vision API Key */}
            <button
              type="button"
              onClick={() => {
                setApiKeyInput(getGeminiApiKey());
                setApiTestResult(null);
                setIsApiKeyModalOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl border transition cursor-pointer shadow-sm ${
                getGeminiApiKey()
                  ? 'bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border-emerald-400/50'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-400/50'
              }`}
            >
              <Key className={`w-3.5 h-3.5 ${getGeminiApiKey() ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span>{getGeminiApiKey() ? 'AI Vision: Terhubung' : 'Setel Gemini API Key'}</span>
            </button>

            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-right">
              <div className="text-[10px] text-blue-200 font-bold uppercase tracking-wider">Kode Berkas Selanjutnya</div>
              <div className="text-base font-mono font-black text-amber-300">{nomorBerkas}</div>
            </div>
            <a 
              href={SPREADSHEET_CONFIG.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Buka Spreadsheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Tab Indicator: Tahap 1 vs Tahap 2 vs Riwayat Transaksi */}
        <div className="relative z-10 flex border-t border-white/10 bg-black/20 overflow-x-auto">
          <button
            type="button"
            onClick={() => setCurrentStage('tahap1')}
            className={`flex-1 min-w-[200px] py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 transition border-b-2 cursor-pointer ${
              currentStage === 'tahap1'
                ? 'border-blue-400 text-blue-300 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-black">1</span>
            <span>Tahap 1: Master Data &amp; Upload Bukti</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentStage('tahap2')}
            className={`flex-1 min-w-[220px] py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 transition border-b-2 cursor-pointer ${
              currentStage === 'tahap2'
                ? 'border-emerald-400 text-emerald-300 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">2</span>
            <span>Tahap 2: Koreksi Data &amp; Approval</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentStage('riwayat')}
            className={`flex-1 min-w-[220px] py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 transition border-b-2 cursor-pointer ${
              currentStage === 'riwayat'
                ? 'border-amber-400 text-amber-300 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4 text-amber-400" />
            <span>Daftar Transaksi Terekam ({transactions.length})</span>
            {autoRecordTransactions.length > 0 && (
              <span className="bg-amber-400/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono border border-amber-400/30">
                {autoRecordTransactions.length} BT
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAHAP 1: MASTER DATA & UPLOAD BUKTI TRANSAKSI */}
      {/* ========================================================================= */}
      {currentStage === 'tahap1' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Kolom Kiri: Form Input Wajib (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Scan className="w-4 h-4 text-blue-600" />
                  <span>Form Parameter &amp; Unggah Bukti Transaksi</span>
                </h2>
                <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  Wajib Diisi Lengkap
                </span>
              </div>

              {/* Input 1: Dropdown Jenis Transaksi & Penentu POS */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>1. Jenis Transaksi (Penentu Kode POS)</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomPosModalOpen(true)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Tambah Jenis Transaksi &amp; POS</span>
                  </button>
                </div>

                <select
                  value={selectedPosCode}
                  onChange={(e) => setSelectedPosCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden transition cursor-pointer"
                >
                  {posRules.map((rule) => (
                    <option key={rule.code} value={rule.code}>
                      POS [{rule.code}] - {rule.name}
                    </option>
                  ))}
                </select>

                {/* Info Aturan POS Terpilih */}
                <div className="mt-2.5 p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-blue-950 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <span>Aturan POS "{selectedRule.code}":</span>
                    <span className="font-semibold text-blue-800">{selectedRule.name}</span>
                  </div>
                  <div><strong className="text-emerald-700">Debit:</strong> {selectedRule.debitRule}</div>
                  <div><strong className="text-rose-700">Kredit:</strong> {selectedRule.creditRule}</div>
                </div>
              </div>

              {/* Input 2: Keterangan Transaksi (Wajib) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  <span>2. Keterangan atas Transaksi</span>
                  <span className="text-rose-500 ml-1">*</span>
                </label>
                <textarea
                  rows={2}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Contoh: Pembelian Baut & Material Pemeliharaan Bengkel atau Pembayaran Brevet Pajak CPTT ke PT Piranha Multi Talenta..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden transition leading-relaxed font-medium"
                />
                <span className="text-[10px] text-slate-400">
                  Keterangan ini akan otomatis menjadi deskripsi baku pada Jurnal Umum dan Spreadsheet.
                </span>
              </div>

              {/* Input 3: Upload Bukti Transaksi */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  <span>3. Unggah Berkas Bukti Transaksi</span>
                  <span className="text-slate-400 font-normal ml-1">(Struk thermal, nota tulis tangan, faktur PDF)</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 rounded-xl cursor-pointer transition text-center space-y-2">
                    <Upload className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="text-xs font-bold text-slate-700">Pilih Berkas / Foto Baru</div>
                      <div className="text-[10px] text-slate-400">JPG, PNG, WEBP, PDF</div>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*,.pdf" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>

                  <button
                    type="button"
                    onClick={loadSampleData}
                    className="flex flex-col items-center justify-center p-4 border border-amber-300 bg-amber-50/50 hover:bg-amber-100/70 rounded-xl transition text-center space-y-2 cursor-pointer"
                  >
                    <Zap className="w-5 h-5 text-amber-600" />
                    <div>
                      <div className="text-xs font-bold text-amber-900">Gunakan Contoh Bukti Resmi</div>
                      <div className="text-[10px] text-amber-700">Nota Baut 12, Baut 15 &amp; Pajak PB1</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Tombol Eksekusi Pipeline AI */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isExtracting}
                  onClick={handleRunExtraction}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {isExtracting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{extractStep}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Jalankan Ekstraksi AI &amp; HTR (Lanjut ke Tahap 2)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>

          {/* Kolom Kanan: Pratinjau Bukti Fisik & Format Berkas (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  Pratinjau Fisik Bukti Transaksi
                </span>
                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]">
                  {receiptFileName}
                </span>
              </div>

              {/* Receipt View Container */}
              <div className="w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center min-h-[360px] max-h-[460px] p-2 relative group">
                {receiptImage ? (
                  <img 
                    src={receiptImage} 
                    alt="Receipt Preview" 
                    className="max-h-[420px] max-w-full object-contain rounded shadow-xs" 
                  />
                ) : (
                  <div className="text-center text-xs text-slate-400 p-8 space-y-2">
                    <Scan className="w-8 h-8 text-slate-300 mx-auto" />
                    <p>Belum ada berkas bukti diunggah.</p>
                  </div>
                )}

                {/* Badge Nomor Berkas */}
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-amber-300 font-mono text-[10px] font-bold px-2 py-1 rounded border border-white/20">
                  {nomorBerkas}
                </div>
              </div>

              {/* Bot Rename Info */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FolderCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Otomasi Google Drive "Data Hasil Transaksi"</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Berkas otomatis diganti nama menjadi <strong className="text-slate-800">{nomorBerkas.replace(/\//g, '_')}</strong> saat diunggah ke Google Drive agar database Supabase tetap berukuran nol/ringan.
                </p>
              </div>
            </div>
          </div>

          {/* Section: Daftar Transaksi yang Sebelumnya Sudah Terekam (Quick Preview) */}
          <div className="lg:col-span-12 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 border border-amber-200">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Daftar Transaksi yang Sebelumnya Sudah Terekam</span>
                    <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                      {transactions.length} Total Transaksi
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Dokumen bukti transaksi dan jurnal yang telah disetujui sebelumnya dalam database.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSampleRecordedTransaction}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                  title="Tambahkan contoh transaksi BT/0001 ke database"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ Muat Contoh BT/0001</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStage('riwayat')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>Buka Semua Riwayat ({transactions.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
                <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">
                  Belum ada transaksi yang terekam dalam sistem. Selesaikan proses Tahap 2 atau klik tombol di bawah untuk memuat transaksi contoh.
                </p>
                <button
                  type="button"
                  onClick={handleLoadSampleRecordedTransaction}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambahkan Contoh Transaksi BT/0001/26X26</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-3 min-w-[110px]">Tanggal</th>
                      <th className="py-2.5 px-3 min-w-[130px]">No. Berkas / Ref</th>
                      <th className="py-2.5 px-3 min-w-[240px]">Keterangan Transaksi</th>
                      <th className="py-2.5 px-3 min-w-[220px]">Rincian Akun Jurnal (Debit / Kredit)</th>
                      <th className="py-2.5 px-3 text-right min-w-[120px]">Total Nominal</th>
                      <th className="py-2.5 px-3 text-center w-20">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {transactions.slice(0, 5).map((trx, idx) => {
                      const isAutoRecord = trx.refNumber && trx.refNumber.startsWith('BT/');
                      return (
                        <tr key={trx.id || idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 text-[11px] whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {trx.date}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${
                              isAutoRecord 
                                ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {trx.refNumber || 'REF-GENERAL'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 text-xs">
                            <div className="font-semibold">{trx.description}</div>
                            {trx.partner && (
                              <div className="text-[10px] text-slate-400">Pihak: {trx.partner}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[11px]">
                            <div className="space-y-0.5">
                              {trx.lines.slice(0, 3).map((l, lIdx) => (
                                <div key={lIdx} className="flex items-center justify-between text-[10px] text-slate-600 gap-2">
                                  <span className="truncate max-w-[140px]" title={l.accountName}>
                                    {l.accountCode} - {l.accountName}
                                  </span>
                                  <span className="font-mono text-slate-700">
                                    {l.debit > 0 ? `(D) Rp ${l.debit.toLocaleString('id-ID')}` : `(K) Rp ${l.credit.toLocaleString('id-ID')}`}
                                  </span>
                                </div>
                              ))}
                              {trx.lines.length > 3 && (
                                <div className="text-[10px] text-blue-600 italic">+{trx.lines.length - 3} baris akun lainnya</div>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono text-xs">
                            Rp {(trx.totalDebit || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setCurrentStage('riwayat')}
                              className="p-1 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded transition cursor-pointer"
                              title="Lihat Detail Transaksi"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAHAP 2: KOREKSI DATA, ANALISIS JURNAL SAK & APPROVAL */}
      {/* ========================================================================= */}
      {currentStage === 'tahap2' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Discrepancy Warning Banner if Detected */}
          {mathDiscrepancy && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-extrabold text-sm text-amber-950">
                  Peringatan Deteksi Selisih Matematika (Uji Formal Vertikal / Horizontal)
                </div>
                <p className="leading-relaxed">{discrepancyMessage}</p>
                <p className="text-[11px] text-amber-700 italic">
                  💡 Anda dapat mengoreksi angka langsung pada tabel di bawah ini sebelum menyetujui jurnal.
                </p>
              </div>
            </div>
          )}

          {/* Bagian 4.1: Tabel Koreksi Hasil Ekstraksi */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>4.1. Tabel Koreksi Hasil Ekstraksi &amp; Uji Akurasi</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Verifikasi nominal setiap baris barang, jasa, atau pajak dari bukti transaksi.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddNewItem}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-2.5 px-4 w-12 text-center">No</th>
                    <th className="py-2.5 px-4 min-w-[220px]">Item yang Dibeli / Terjadi</th>
                    <th className="py-2.5 px-4 text-right min-w-[130px]">Harga Satuan</th>
                    <th className="py-2.5 px-4 text-center min-w-[100px]">Jumlah (Qty)</th>
                    <th className="py-2.5 px-4 text-right min-w-[140px]">Harga Total 1 Item</th>
                    <th className="py-2.5 px-4 text-center min-w-[120px]">Status Akurasi</th>
                    <th className="py-2.5 px-3 w-10 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {extractedItems.map((item, index) => (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/60 transition ${
                        item.hasDiscrepancy ? 'bg-amber-50/40' : item.confidence < 80 ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 text-center font-mono text-slate-500 font-semibold">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-4">
                        <input 
                          type="text" 
                          value={item.name} 
                          onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                          className="w-full px-2 py-1 bg-transparent border-b border-slate-200 focus:border-blue-500 focus:bg-white text-xs font-semibold text-slate-800"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <input 
                          type="number" 
                          value={item.unitPrice !== null ? item.unitPrice : ''} 
                          placeholder="(Kosong jika pajak)"
                          onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value ? Number(e.target.value) : null)}
                          className="w-full text-right px-2 py-1 bg-transparent border-b border-slate-200 focus:border-blue-500 focus:bg-white text-xs font-mono font-medium text-slate-800"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <input 
                          type="number" 
                          value={item.quantity !== null ? item.quantity : ''} 
                          placeholder="-"
                          onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value ? Number(e.target.value) : null)}
                          className="w-16 text-center mx-auto px-2 py-1 bg-transparent border-b border-slate-200 focus:border-blue-500 focus:bg-white text-xs font-mono font-medium text-slate-800"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <input 
                          type="number" 
                          value={item.totalPrice} 
                          onChange={(e) => handleUpdateItem(item.id, 'totalPrice', Number(e.target.value))}
                          className="w-full text-right px-2 py-1 bg-transparent border-b border-slate-200 focus:border-blue-500 focus:bg-white text-xs font-mono font-bold text-slate-900"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.confidence >= 90
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.confidence >= 80
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          <span>{item.confidence}%</span>
                          <span>{item.confidence >= 80 ? '✓ Valid' : '⚠️ Periksa'}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="Hapus Baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-extrabold text-slate-900">
                    <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider text-xs">
                      Grand Total Nota / Transaksi:
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-blue-700">
                      {formatRupiah(grandTotal)}
                    </td>
                    <td colSpan={2} className="py-3 px-4 text-center text-[10px] text-slate-500">
                      {mathDiscrepancy ? '⚠️ Terdapat Selisih' : '✓ Seimbang 100%'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Bagian 4.2: Mesin Analisis Akuntansi SAK & Saran Jurnal Umum */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>4.2. Saran Jurnal Umum Akuntansi (Prinsip SAK)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Agregasi akun sejenis (contoh: Baut 12 &amp; Baut 15 &rarr; Perlengkapan), pemisahan beban pajak berdiri sendiri, dan penentuan akun lawan POS "{selectedPosCode}".
                </p>
              </div>

              {/* Status Balance Jurnal */}
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
                    line.credit > 0 ? 'bg-slate-50/70 border-slate-200' : 'bg-blue-50/30 border-blue-200/60'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-400 w-6">
                      #{index + 1}
                    </span>

                    {/* D/K Badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${
                      line.debit > 0 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white'
                    }`}>
                      {line.debit > 0 ? 'DEBIT' : 'KREDIT'}
                    </span>

                      {/* Account Selector */}
                    <div className="flex-1 min-w-[200px]">
                      <select
                        value={line.accountCode}
                        onChange={(e) => handleUpdateJournalLine(line.id, 'accountCode', e.target.value)}
                        className="w-full px-2.5 py-1 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500"
                      >
                        {/* Fallback option agar select TIDAK PERNAH salah memilih opsi pertama (Kas) jika state belum re-render */}
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
                        className="w-28 text-right px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block text-right font-semibold">Kredit (Rp)</span>
                      <input 
                        type="number"
                        value={line.credit}
                        onChange={(e) => handleUpdateJournalLine(line.id, 'credit', Number(e.target.value))}
                        className="w-28 text-right px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteJournalLine(line.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer mt-3"
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
                  <div className="font-mono font-bold text-blue-300">{formatRupiah(totalDebitJurnal)}</div>
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
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Jurnal</span>
                </button>
              </div>
            </div>

            {saveSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-1.5 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* ACTION APPROVE BUTTON (SECTION 5) */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Menekan tombol <strong>"Approve"</strong> akan otomatis membuat akun baru di COA (jika belum ada) dan membukukan transaksi ke Jurnal Umum / Accurate Voucher.
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

          {/* Bagian 3.3: Pratinjau Google Spreadsheet Format (datasheet_bukti_transaksi) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  Pratinjau Format Spreadsheet "datasheet_bukti_transaksi" (Sheet: Main, Baris 4+)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const csv = exportSpreadsheetRowsToCsv(spreadsheetRows);
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `datasheet_bukti_transaksi_${nomorBerkas.replace(/\//g, '_')}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition"
                >
                  Unduh CSV
                </button>
                <a
                  href={SPREADSHEET_CONFIG.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-200 flex items-center gap-1 transition"
                >
                  <span>Buka Sheet Main</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse font-mono">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-2.5 text-center">B (No)</th>
                    <th className="py-2 px-2.5 text-center">C (Tgl)</th>
                    <th className="py-2 px-2.5 text-center">D (Bln)</th>
                    <th className="py-2 px-2.5 text-center">E (Thn)</th>
                    <th className="py-2 px-3 font-sans">F (Nama Transaksi)</th>
                    <th className="py-2 px-2.5 text-right">G (Harga satuan)</th>
                    <th className="py-2 px-2.5 text-center">H (kuantitas)</th>
                    <th className="py-2 px-2.5 text-right">I (Harga total)</th>
                    <th className="py-2 px-2.5">J (Nomor Berkas)</th>
                    <th className="py-2 px-2.5">K (Link Berkas)</th>
                    <th className="py-2 px-2.5 text-center">L (POS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {spreadsheetRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2 px-2.5 text-center">{r.no}</td>
                      <td className="py-2 px-2.5 text-center">{r.tanggal}</td>
                      <td className="py-2 px-2.5 text-center">{r.bulan}</td>
                      <td className="py-2 px-2.5 text-center">{r.tahun}</td>
                      <td className="py-2 px-3 font-sans font-semibold text-slate-800">{r.namaTransaksi}</td>
                      <td className="py-2 px-2.5 text-right">{r.hargaSatuan ? r.hargaSatuan.toLocaleString('id-ID') : '-'}</td>
                      <td className="py-2 px-2.5 text-center">{r.kuantitas || '-'}</td>
                      <td className="py-2 px-2.5 text-right font-bold text-slate-900">{r.hargaTotal.toLocaleString('id-ID')}</td>
                      <td className="py-2 px-2.5 text-amber-700 font-bold">{r.nomorBerkas}</td>
                      <td className="py-2 px-2.5 text-blue-600 truncate max-w-[120px]" title={r.linkBerkas}>{r.linkBerkas || 'Google Drive Bot'}</td>
                      <td className="py-2 px-2.5 text-center font-bold text-indigo-700">{r.pos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAHAP 3 / RIWAYAT: DAFTAR TRANSAKSI YANG SEBELUMNYA SUDAH TEREKAM */}
      {/* ========================================================================= */}
      {currentStage === 'riwayat' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Transaksi</div>
                <div className="text-xl font-black text-slate-900">{transactions.length} <span className="text-xs font-normal text-slate-500">dokumen</span></div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                <Scan className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bukti Auto Record (BT)</div>
                <div className="text-xl font-black text-amber-600">{autoRecordTransactions.length} <span className="text-xs font-normal text-slate-500">berkas</span></div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Nilai Transaksi</div>
                <div className="text-lg font-black font-mono text-emerald-600">
                  Rp {totalHistoryDebit.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Keseimbangan SAK</div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-emerald-700 font-extrabold">100% Balanced</span>
                </div>
                <div className="text-[10px] text-slate-400">Debit = Kredit (Selisih Rp 0)</div>
              </div>
            </div>
          </div>

          {/* Table Container Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            
            {/* Header & Filter Controls */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" />
                  <span>Daftar Transaksi yang Sebelumnya Sudah Terekam</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Semua transaksi yang disetujui tersimpan permanen di database dan tersinkronisasi ke Jurnal Umum &amp; Spreadsheet.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSampleRecordedTransaction}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                  title="Tambahkan contoh transaksi BT/0001 ke database"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ Muat Contoh BT/0001</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportHistoryExcel}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 flex items-center gap-1.5 transition cursor-pointer"
                  title="Unduh seluruh daftar transaksi ke format Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStage('tahap1')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Scan className="w-3.5 h-3.5" />
                  <span>+ Rekam Transaksi Baru</span>
                </button>
              </div>
            </div>

            {/* Filter Pills & Search Input */}
            <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1">
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>Filter:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setRiwayatFilter('all')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    riwayatFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Semua ({transactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRiwayatFilter('bt')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    riwayatFilter === 'bt'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Khusus Auto Record BT ({autoRecordTransactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRiwayatFilter('other')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    riwayatFilter === 'other'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Jurnal Lainnya ({transactions.length - autoRecordTransactions.length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari ref, keterangan, akun..."
                  value={riwayatSearch}
                  onChange={(e) => setRiwayatSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Table */}
            {filteredHistoryTransactions.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">Tidak ada transaksi ditemukan</div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {riwayatSearch ? 'Coba ubah kata kunci pencarian Anda.' : 'Belum ada transaksi yang tersimpan. Mulai rekam bukti transaksi atau klik tombol muat contoh di bawah.'}
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadSampleRecordedTransaction}
                    className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Muat Contoh BT/0001/26X26</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStage('tahap1')}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Scan className="w-3.5 h-3.5" />
                    <span>Unggah Bukti Baru (Tahap 1)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="py-3 px-3.5 w-12 text-center">No</th>
                      <th className="py-3 px-3.5 min-w-[100px]">Tanggal</th>
                      <th className="py-3 px-3.5 min-w-[140px]">No. Berkas / Ref</th>
                      <th className="py-3 px-3.5 min-w-[240px]">Keterangan Transaksi</th>
                      <th className="py-3 px-3.5 min-w-[320px]">Rincian Jurnal Akun (Debit &amp; Kredit)</th>
                      <th className="py-3 px-3.5 text-right min-w-[130px]">Total Nilai</th>
                      <th className="py-3 px-3.5 text-center min-w-[100px]">Status SAK</th>
                      <th className="py-3 px-3.5 text-center w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredHistoryTransactions.map((trx, idx) => {
                      const isAutoRecord = trx.refNumber && trx.refNumber.startsWith('BT/');
                      const isBalanced = (trx.totalDebit || 0) === (trx.totalCredit || 0);

                      return (
                        <tr key={trx.id || idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3.5 text-slate-700 text-xs whitespace-nowrap">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {trx.date}
                            </span>
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="space-y-1">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                                isAutoRecord 
                                  ? 'bg-amber-100/70 text-amber-900 border border-amber-300' 
                                  : 'bg-slate-100 text-slate-800 border border-slate-200'
                              }`}>
                                {trx.refNumber || 'REF-GENERAL'}
                              </span>
                              {isAutoRecord && (
                                <div className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  <span>Auto Record Bukti</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 text-slate-900 text-xs">
                            <div className="font-bold text-slate-900 leading-snug">{trx.description}</div>
                            {trx.partner && (
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Mitra/Pihak: <strong className="text-slate-700">{trx.partner}</strong>
                              </div>
                            )}
                            {trx.type && (
                              <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">
                                Tipe: {trx.type}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-xs">
                            <div className="space-y-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                              {trx.lines.map((l, lIdx) => (
                                <div key={lIdx} className="flex items-center justify-between text-[11px] gap-3">
                                  <div className="truncate min-w-0" title={l.accountName}>
                                    <span className="font-mono text-slate-500 mr-1.5">{l.accountCode}</span>
                                    <span className="font-medium text-slate-800">{l.accountName}</span>
                                    {l.memo && (
                                      <span className="text-[10px] text-slate-400 ml-1 italic">({l.memo})</span>
                                    )}
                                  </div>
                                  <div className="font-mono whitespace-nowrap text-right shrink-0">
                                    {l.debit > 0 ? (
                                      <span className="text-blue-700 font-bold">(D) Rp {l.debit.toLocaleString('id-ID')}</span>
                                    ) : (
                                      <span className="text-slate-700 font-medium">(K) Rp {l.credit.toLocaleString('id-ID')}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 text-right font-bold text-slate-900 font-mono text-xs">
                            Rp {(trx.totalDebit || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            {isBalanced ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3" />
                                <span>Seimbang</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Selisih</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Apakah Anda yakin ingin menghapus transaksi "${trx.refNumber || trx.description}"?`)) {
                                  deleteTransaction(trx.id);
                                }
                              }}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Footer */}
            <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Menampilkan <strong className="text-slate-900">{filteredHistoryTransactions.length}</strong> dari <strong className="text-slate-900">{transactions.length}</strong> total transaksi
              </div>
              <div className="flex items-center gap-4">
                <div>
                  Total Akumulasi: <strong className="font-mono text-slate-900 font-bold">Rp {totalHistoryDebit.toLocaleString('id-ID')}</strong>
                </div>
                <a
                  href={SPREADSHEET_CONFIG.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Lihat di Spreadsheet</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

          </div>

          {/* Sync Status Info Banner */}
          <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200/80 flex items-start gap-3 text-blue-900">
            <FolderCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <div className="font-bold text-blue-950">
                Penyimpanan Data Terpadu &amp; Bebas Kuota Supabase
              </div>
              <p className="text-blue-800 leading-relaxed">
                Setiap kali transaksi baru disetujui, jurnal akuntansi otomatis dicatat ke Buku Besar dan Jurnal Umum, 
                data baris diekspor ke baris spreadsheet <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">datasheet_bukti_transaksi</code>, 
                dan berkas fisik diarsipkan otomatis ke Google Drive folder <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">Data Hasil Transaksi</code> dengan kode berkas terstandarisasi.
              </p>
            </div>
          </div>

        </div>
      )}
      {/* ========================================================================= */}
      {isCustomPosModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <span>Tambah Jenis Transaksi &amp; Kode POS Kustom</span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsCustomPosModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomPos} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block font-bold text-slate-700 mb-1">Kode POS</label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    placeholder="Contoh: F"
                    value={newPosCode}
                    onChange={(e) => setNewPosCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-center uppercase"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Nama Jenis Transaksi</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Pembelian Aset Tetap Mesin"
                    value={newPosName}
                    onChange={(e) => setNewPosName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Aturan Akun Sisi Debit</label>
                <input
                  type="text"
                  placeholder="Contoh: Akun Aset Tetap / Peralatan Mesin"
                  value={newPosDebitRule}
                  onChange={(e) => setNewPosDebitRule(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Aturan Akun Sisi Kredit</label>
                <input
                  type="text"
                  placeholder="Contoh: Kas / Bank / Utang Pengadaan"
                  value={newPosCreditRule}
                  onChange={(e) => setNewPosCreditRule(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Akun Debit</label>
                  <select
                    value={newPosDebitAcc}
                    onChange={(e) => setNewPosDebitAcc(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-medium"
                  >
                    {accounts.filter(a => !a.isHeader).map(a => (
                      <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Akun Kredit</label>
                  <select
                    value={newPosCreditAcc}
                    onChange={(e) => setNewPosCreditAcc(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-medium"
                  >
                    {accounts.filter(a => !a.isHeader).map(a => (
                      <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomPosModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Simpan Jenis POS Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SUCCESS APPROVAL MODAL */}
      {/* ========================================================================= */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-emerald-200 animate-scaleUp">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">
                Perekaman Transaksi Berhasil!
              </h3>
              <p className="text-xs text-slate-500">
                Bukti transaksi <strong className="text-slate-800">{nomorBerkas}</strong> telah berhasil diverifikasi, diapprove, dan otomatis dibukukan ke sistem akuntansi.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">No. Bukti:</span>
                <span className="font-bold text-amber-700">{nomorBerkas}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Tipe Transaksi:</span>
                <span className="font-bold text-blue-700">Jurnal Umum (JU)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Total Transaksi:</span>
                <span className="font-bold text-emerald-700">{formatRupiah(grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Status Balance:</span>
                <span className="font-bold text-emerald-600">✓ Balance 100% (Selisih Rp 0)</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  setActiveTab('journals');
                }}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                Lihat di Menu Jurnal Umum &amp; AJP &rarr;
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  setCurrentStage('tahap1');
                  // Generate next code
                  const nextSeq = getNextDocumentSequence(transactions) + 1;
                  setSeqNumber(nextSeq);
                  setNomorBerkas(generateFileCode(nextSeq));
                  setKeterangan('');
                  setReceiptImage('');
                  setReceiptFileName('');
                  setExtractedItems([]);
                  setJournalLines([]);
                  setSpreadsheetRows([]);
                }}
                className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Proses Bukti Transaksi Berikutnya
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL KONFIGURASI GEMINI VISION API KEY */}
      {/* ========================================================================= */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Konfigurasi Gemini Multimodal Vision AI</h3>
                  <p className="text-[11px] text-slate-500">Google AI Studio API Key (Tersimpan aman di localStorage)</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsApiKeyModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 text-[11px] leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ekstraksi Visioner Berbasis Gemini 2.5 Flash</span>
                </div>
                <p>
                  API Key memungkinkan sistem membaca struk kasir, nota tulis tangan, dan <strong>Bukti Transfer Bank (BCA, Mandiri, BI-FAST, dll)</strong> secara cerdas dan akurat.
                </p>
                <p className="text-[10px] text-blue-700 pt-1">
                  Belum punya key? Dapatkan secara gratis di:{' '}
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="font-bold underline text-blue-800 hover:text-blue-950 inline-flex items-center gap-0.5"
                  >
                    Google AI Studio <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Google Gemini API Key:
                </label>
                <div className="relative">
                  <input
                    type={showApiKeyText ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3.5 py-2.5 pr-10 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeyText(!showApiKeyText)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showApiKeyText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {apiTestResult && (
                <div className={`p-3 rounded-xl text-xs font-medium border flex items-start gap-2 ${
                  apiTestResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}>
                  {apiTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                  <div>{apiTestResult.message}</div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={apiTesting}
                onClick={async () => {
                  if (!apiKeyInput.trim()) {
                    setApiTestResult({ success: false, message: 'Ketik API Key terlebih dahulu untuk diuji.' });
                    return;
                  }
                  setApiTesting(true);
                  setApiTestResult(null);
                  const res = await testGeminiApiKey(apiKeyInput.trim());
                  setApiTesting(false);
                  setApiTestResult(res);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {apiTesting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin" />
                    <span>Menguji...</span>
                  </>
                ) : (
                  <span>Uji Koneksi AI</span>
                )}
              </button>

              <div className="flex items-center gap-2">
                {apiKeyInput && (
                  <button
                    type="button"
                    onClick={() => {
                      saveGeminiApiKey('');
                      setApiKeyInput('');
                      setApiTestResult({ success: true, message: 'API Key berhasil dihapus dari browser.' });
                    }}
                    className="px-3 py-2 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Hapus
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    saveGeminiApiKey(apiKeyInput.trim());
                    setIsApiKeyModalOpen(false);
                    alert(apiKeyInput.trim() ? 'Gemini API Key berhasil disimpan!' : 'API Key dikosongkan.');
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Simpan API Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
