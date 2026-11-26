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
  History,
  Clock,
  ListFilter,
  Receipt,
  Calendar,
  Search,
  ArrowUpRight,
  Download,
  Camera,
  Bot,
  Copy,
  RefreshCw
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
  ensureSuggestedJournalWithAutoCreatedAccounts,
  saveRecordedReceipt,
  getRecordedReceipts,
  deleteRecordedReceipt,
  setPendingJournalDraft,
  RecordedReceipt,
  SAMPLE_RECEIPT_DATA, 
  SPREADSHEET_CONFIG,
  extractTransactionFromFile,
  RealOcrExtractionResult,
  BankTransferDetails,
  validateReceiptReadinessForAction
} from '../services/autoRecordService';
import { uploadHeavyFileToDrive, SPECTRA_TRANSACTIONS_DRIVE_FOLDER_ID, SPECTRA_TRANSACTIONS_DRIVE_FOLDER_URL, SPECTRA_DRIVE_FOLDER_URL } from '../services/googleDriveBot';
import { convertPdfToImages, isPdfFile, isPdfDataUri } from '../services/receiptMediaService';
import { getExternalSyncStatus, isExternalSyncDisabledOnPreview } from '../services/externalSyncGuard';
import { 
  getSpreadsheetWebhookUrl, 
  saveSpreadsheetWebhookUrl, 
  testSpreadsheetWebhook, 
  syncRowsToGoogleSpreadsheet,
  GOOGLE_APPS_SCRIPT_BOT_CODE
} from '../services/googleSpreadsheetBot';

interface AutoRecordViewProps {
  setActiveTab: (tab: any) => void;
  openNewTransactionModal: (preset?: any) => void;
}

export const AutoRecordView: React.FC<AutoRecordViewProps> = ({ setActiveTab }) => {
  const { accounts, transactions, addAccount, addTransaction, deleteTransaction, settings, logActivity, resetAllTransactions } = useAccounting();

  // 1. Master Data & Upload States (CLEAN & NON-HARDCODED)
  const [posRules, setPosRules] = useState<PosRule[]>(getPosRules);
  const [selectedPosCode, setSelectedPosCode] = useState<string>('A');
  const [keterangan, setKeterangan] = useState<string>('');
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [renderedPdfPages, setRenderedPdfPages] = useState<string[]>([]);
  const [currentPdfPagePreview, setCurrentPdfPagePreview] = useState<number>(0);
  const [isRenderingPdf, setIsRenderingPdf] = useState<boolean>(false);
  const [seqNumber, setSeqNumber] = useState<number>(() => getNextDocumentSequence(transactions));
  const [nomorBerkas, setNomorBerkas] = useState<string>(() => generateFileCode(getNextDocumentSequence(transactions)));
  const [recordedReceipts, setRecordedReceipts] = useState<RecordedReceipt[]>(() => getRecordedReceipts());

  // Sinkronisasi status arsip rekaman bukti lintas tab/komponen
  useEffect(() => {
    const handleReceiptUpdate = () => {
      setRecordedReceipts(getRecordedReceipts());
    };
    window.addEventListener('spectra:recorded-receipt-updated', handleReceiptUpdate);
    window.addEventListener('storage', handleReceiptUpdate);
    return () => {
      window.removeEventListener('spectra:recorded-receipt-updated', handleReceiptUpdate);
      window.removeEventListener('storage', handleReceiptUpdate);
    };
  }, []);

  // Groq Vision Backend Status (Neutral until verified by actual request or backend verification)
  const [groqStatus, setGroqStatus] = useState<'standby' | 'verified' | 'error'>('standby');

  // Pipeline Status & Stage (tahap1, tahap2, riwayat)
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractStep, setExtractStep] = useState<string>('');
  const [currentStage, setCurrentStage] = useState<'tahap1' | 'tahap2' | 'riwayat'>('tahap1');
  const [riwayatFilter, setRiwayatFilter] = useState<'all' | 'pending' | 'posted' | 'bt' | 'other'>('all');
  const [riwayatSearch, setRiwayatSearch] = useState<string>('');
  const isExternalSyncDisabled = isExternalSyncDisabledOnPreview();
  const syncStatus = getExternalSyncStatus();

  // Tahap 2: Extraction & Verification States
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [grandTotal, setGrandTotal] = useState<number>(0);
  const [calculatedTotal, setCalculatedTotal] = useState<number>(0);
  const [mathDiscrepancy, setMathDiscrepancy] = useState<boolean>(false);
  const [discrepancyMessage, setDiscrepancyMessage] = useState<string>('');
  const [googleDriveLink, setGoogleDriveLink] = useState<string>('');
  const [driveFileId, setDriveFileId] = useState<string>('');
  const [driveDirectUrl, setDriveDirectUrl] = useState<string>('');
  const [driveViewUrl, setDriveViewUrl] = useState<string>('');
  const [driveUploadStatus, setDriveUploadStatus] = useState<'IDLE' | 'UPLOADED' | 'SIMULATED' | 'FAILED'>('IDLE');
  const [spreadsheetRows, setSpreadsheetRows] = useState<SpreadsheetRowData[]>([]);
  const [activeSourceEngine, setActiveSourceEngine] = useState<'groq_vision' | 'tesseract_ocr' | 'smart_parser' | null>(null);
  const [hasUnconfirmedFee, setHasUnconfirmedFee] = useState<boolean>(false);
  const [unconfirmedFeeNote, setUnconfirmedFeeNote] = useState<string>('');
  const [bankTransferDetails, setBankTransferDetails] = useState<BankTransferDetails | null>(null);
  const [manualFeeInput, setManualFeeInput] = useState<string>('');
  const [manualFeeType, setManualFeeType] = useState<'BI_FAST' | 'ADMIN_BANK'>('BI_FAST');

  // Suggested Journal Lines (SAK)
  const [journalLines, setJournalLines] = useState<SuggestedJournalLine[]>([]);
  const [isJournalSaved, setIsJournalSaved] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  // Modals
  const [isCustomPosModalOpen, setIsCustomPosModalOpen] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [approvedTxId, setApprovedTxId] = useState<string>('');

  // Google Spreadsheet Apps Script Bot State
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState<boolean>(false);
  const [webhookInput, setWebhookInput] = useState<string>(() => getSpreadsheetWebhookUrl());
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncingSpreadsheet, setIsSyncingSpreadsheet] = useState<boolean>(false);
  const [syncSpreadsheetResult, setSyncSpreadsheetResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isCopiedBotCode, setIsCopiedBotCode] = useState<boolean>(false);

  // Modal Reset Transaksi & Nomor Berkas
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isResettingTransactions, setIsResettingTransactions] = useState<boolean>(false);
  const [resetFeedback, setResetFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleConfirmReset = async () => {
    setIsResettingTransactions(true);
    setResetFeedback(null);
    try {
      const res = await resetAllTransactions();
      setSeqNumber(1);
      setNomorBerkas(generateFileCode(1));
      setSpreadsheetRows([]);
      setExtractedItems([]);
      setGrandTotal(0);
      setCalculatedTotal(0);
      setReceiptImage('');
      setReceiptFileName('');
      setGoogleDriveLink('');
      setJournalLines([]);
      setMathDiscrepancy(false);
      setDiscrepancyMessage('');
      setHasUnconfirmedFee(false);
      setUnconfirmedFeeNote('');
      setBankTransferDetails(null);
      setManualFeeInput('');
      setManualFeeType('BI_FAST');
      setKeterangan('');
      setRecordedReceipts([]);
      setResetFeedback({
        type: 'success',
        message: res?.message || 'Seluruh transaksi berhasil di-reset total dan nomor berkas dimulai kembali dari 1.'
      });
      setTimeout(() => {
        setIsResetModalOpen(false);
        setResetFeedback(null);
      }, 1600);
    } catch (err: any) {
      setResetFeedback({
        type: 'error',
        message: err?.message || 'Gagal mengeksekusi reset transaksi.'
      });
    } finally {
      setIsResettingTransactions(false);
    }
  };

  // Sinkronisasi otomatis nomor berkas dengan transactions & event reset (Stabil: Jangan ubah saat berkas sedang diolah)
  useEffect(() => {
    // Kunci nomor berkas jika sedang memproses berkas, sudah ada gambar, atau sedang di Tahap 2
    if (receiptImage || currentStage !== 'tahap1') {
      return;
    }
    const nextSeq = getNextDocumentSequence(transactions);
    setSeqNumber(nextSeq);
    setNomorBerkas(generateFileCode(nextSeq));
  }, [transactions, currentStage, receiptImage]);

  useEffect(() => {
    const handleReset = () => {
      setSeqNumber(1);
      setNomorBerkas(generateFileCode(1));
      setSpreadsheetRows([]);
      setExtractedItems([]);
      setGrandTotal(0);
      setCalculatedTotal(0);
      setReceiptImage('');
      setReceiptFileName('');
      setGoogleDriveLink('');
      setJournalLines([]);
      setMathDiscrepancy(false);
      setDiscrepancyMessage('');
      setHasUnconfirmedFee(false);
      setUnconfirmedFeeNote('');
      setBankTransferDetails(null);
      setManualFeeInput('');
      setManualFeeType('BI_FAST');
      setRecordedReceipts([]);
    };
    const handleReceiptUpdate = (e: any) => {
      if (e?.detail?.receipts) {
        setRecordedReceipts(e.detail.receipts);
      }
    };
    window.addEventListener('spectra:reset-auto-record', handleReset);
    window.addEventListener('spectra:recorded-receipt-updated', handleReceiptUpdate);
    return () => {
      window.removeEventListener('spectra:reset-auto-record', handleReset);
      window.removeEventListener('spectra:recorded-receipt-updated', handleReceiptUpdate);
    };
  }, []);

  // Custom POS Form State
  const [newPosName, setNewPosName] = useState<string>('');
  const [newPosCode, setNewPosCode] = useState<string>('');
  const [newPosDebitRule, setNewPosDebitRule] = useState<string>('');
  const [newPosCreditRule, setNewPosCreditRule] = useState<string>('');
  const [newPosDebitAcc, setNewPosDebitAcc] = useState<string>('10001');
  const [newPosCreditAcc, setNewPosCreditAcc] = useState<string>('20001');

  // Kategori berkas tersimpan
  const pendingReceipts = useMemo(() => {
    return recordedReceipts.filter(r => r.status === 'pending_journal');
  }, [recordedReceipts]);

  const journalizedReceipts = useMemo(() => {
    return recordedReceipts.filter(r => r.status === 'journalized');
  }, [recordedReceipts]);

  // Filter daftar transaksi terekam
  const autoRecordTransactions = useMemo(() => {
    return transactions.filter(t => t.refNumber && t.refNumber.startsWith('BT/'));
  }, [transactions]);

  // Model terpadu arsip rekaman bukti & transaksi pembukuan
  const unifiedHistoryItems = useMemo(() => {
    const list: Array<{
      id: string;
      isPendingReceipt: boolean;
      date: string;
      refNumber: string;
      description: string;
      amount: number;
      partner?: string;
      status: 'pending_journal' | 'journalized' | 'posted_general';
      googleDriveLink?: string;
      driveViewUrl?: string;
      receipt?: RecordedReceipt;
      transaction?: Transaction;
    }> = [];

    // 1. Masukkan semua berkas dari recordedReceipts
    recordedReceipts.forEach(r => {
      const matchingTx = transactions.find(t => t.refNumber === r.nomorBerkas);
      const isPending = r.status === 'pending_journal' && !matchingTx;
      list.push({
        id: r.id,
        isPendingReceipt: isPending,
        date: r.date,
        refNumber: r.nomorBerkas,
        description: r.keterangan,
        amount: r.grandTotal,
        status: isPending ? 'pending_journal' : 'journalized',
        googleDriveLink: r.googleDriveLink,
        driveViewUrl: r.driveViewUrl || r.googleDriveLink,
        receipt: r,
        transaction: matchingTx
      });
    });

    // 2. Masukkan transaksi pembukuan yang belum ada di recordedReceipts
    transactions.forEach(t => {
      const alreadyInList = list.some(item => item.refNumber && item.refNumber === t.refNumber);
      if (!alreadyInList) {
        list.push({
          id: t.id,
          isPendingReceipt: false,
          date: t.date,
          refNumber: t.refNumber || 'REF-GENERAL',
          description: t.description,
          amount: t.totalDebit || 0,
          partner: t.partner,
          status: 'posted_general',
          transaction: t
        });
      }
    });

    return list.sort((a, b) => b.refNumber.localeCompare(a.refNumber));
  }, [recordedReceipts, transactions]);

  const filteredUnifiedHistory = useMemo(() => {
    return unifiedHistoryItems.filter(item => {
      if (riwayatFilter === 'pending' && item.status !== 'pending_journal') return false;
      if (riwayatFilter === 'posted' && item.status === 'pending_journal') return false;
      if (riwayatFilter === 'bt' && !item.refNumber.startsWith('BT/')) return false;
      if (riwayatFilter === 'other' && item.refNumber.startsWith('BT/')) return false;

      if (riwayatSearch.trim()) {
        const q = riwayatSearch.toLowerCase();
        const matchRef = item.refNumber.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchPartner = (item.partner || '').toLowerCase().includes(q);
        const matchLines = item.transaction?.lines.some(l =>
          (l.accountName || '').toLowerCase().includes(q) ||
          (l.accountCode || '').includes(q)
        );
        return matchRef || matchDesc || matchPartner || matchLines;
      }
      return true;
    });
  }, [unifiedHistoryItems, riwayatFilter, riwayatSearch]);

  const totalHistoryDebit = useMemo(() => {
    return filteredUnifiedHistory.reduce((acc, it) => acc + (it.amount || 0), 0);
  }, [filteredUnifiedHistory]);

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

  const handleLoadSampleRecordedTransaction = async () => {
    const existing = transactions.find(t => t.refNumber && t.refNumber.startsWith('BT/0001'));
    if (existing) {
      alert('Transaksi BT/0001 sudah ada dalam daftar transaksi yang terekam.');
      return;
    }

    const res = await addTransaction({
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

    if (!res.success) {
      alert(`Gagal menambahkan contoh transaksi: ${res.error}`);
      return;
    }

    commitDocumentSequence(2);
    logActivity('Auto Record Sample', 'Menambahkan contoh transaksi BT/0001/26X26 ke database');
    alert('Contoh transaksi BT/0001/26X26 berhasil ditambahkan ke daftar transaksi terekam!');
  };

  // Update nomor berkas when seq or transactions change - TERKUNCI saat berkas sedang diproses / diekstrak
  useEffect(() => {
    if (receiptImage || currentStage !== 'tahap1' || extractedItems.length > 0) {
      return;
    }
    const nextSeq = getNextDocumentSequence(transactions);
    setSeqNumber(nextSeq);
    setNomorBerkas(generateFileCode(nextSeq));
  }, [transactions, receiptImage, currentStage, extractedItems.length]);

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
    setRenderedPdfPages([]);
    setCurrentPdfPagePreview(0);
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

    if (file.size > 15 * 1024 * 1024) {
      alert('Ukuran berkas terlalu besar. Batas maksimal adalah 15 MB.');
      return;
    }

    setReceiptFileName(file.name);
    // Reset hasil ekstraksi lama agar murni membaca file baru yang diunggah
    setExtractedItems([]);
    setJournalLines([]);
    setSpreadsheetRows([]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUri = event.target?.result as string;
      setReceiptImage(dataUri);

      // Jika berkas adalah PDF, render pratinjau halaman dengan PDF.js
      if (isPdfFile(file.name, file.type) || isPdfDataUri(dataUri)) {
        setIsRenderingPdf(true);
        try {
          const pdfRes = await convertPdfToImages(dataUri, { maxPages: 10, scale: 1.5 });
          if (pdfRes.success && pdfRes.pageImages.length > 0) {
            setRenderedPdfPages(pdfRes.pageImages);
            setCurrentPdfPagePreview(0);
          } else {
            setRenderedPdfPages([]);
            if (pdfRes.error) {
              alert(pdfRes.error);
              setReceiptImage('');
              setReceiptFileName('');
            }
          }
        } catch (err) {
          console.warn('Gagal merender pratinjau PDF:', err);
          setRenderedPdfPages([]);
        } finally {
          setIsRenderingPdf(false);
        }
      } else {
        setRenderedPdfPages([]);
      }
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
      setHasUnconfirmedFee(Boolean(extractionResult.hasUnconfirmedFee));
      setUnconfirmedFeeNote(extractionResult.unconfirmedFeeNote || '');
      setBankTransferDetails(extractionResult.bankTransferDetails || null);
      setActiveSourceEngine(extractionResult.sourceEngine);
      if (extractionResult.sourceEngine === 'groq_vision') {
        setGroqStatus('verified');
      } else if (extractionResult.sourceEngine === 'tesseract_ocr') {
        setGroqStatus('error');
      }

      setExtractStep('4/4: Sinkronisasi Google Drive & Penamaan Otomatis (' + nomorBerkas + ')...');

      // Upload ke Google Drive Folder Transaksi Resmi jika berkas ada dan belum diunggah
      let driveLink = googleDriveLink;
      if (receiptImage && (!googleDriveLink || !googleDriveLink.includes('drive.google.com'))) {
        try {
          const driveRes = await uploadHeavyFileToDrive(
            receiptImage,
            `${nomorBerkas.replace(/\//g, '_')}_${receiptFileName}`,
            receiptFileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
            {
              documentCode: nomorBerkas,
              title: `Bukti Transaksi - ${keterangan || nomorBerkas}`,
              uploadedBy: 'Auto Record Engine',
              folderId: SPECTRA_TRANSACTIONS_DRIVE_FOLDER_ID
            }
          );
          if (driveRes.success && driveRes.viewUrl) {
            driveLink = driveRes.viewUrl;
            setGoogleDriveLink(driveLink);
            setDriveFileId(driveRes.fileId || '');
            setDriveDirectUrl(driveRes.directUrl || '');
            setDriveViewUrl(driveLink);
            setDriveUploadStatus('UPLOADED');
          } else if (driveRes.status === 'SIMULATED' || driveRes.isMocked) {
            driveLink = '[ARSIP_LOKAL_INDEXEDDB]';
            setGoogleDriveLink(driveLink);
            setDriveUploadStatus('SIMULATED');
          }
        } catch (err) {
          console.warn('Google Drive background sync info:', err);
          setDriveUploadStatus('FAILED');
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
      setGroqStatus('error');
      setIsExtracting(false);
      alert('Terjadi kesalahan saat memproses ekstraksi: ' + (err?.message || String(err)));
    }
  };

  // Recalculate Journal when user edits items in Tahap 2
  const handleUpdateItem = (id: string, field: keyof ExtractedItem, value: any) => {
    const updated = extractedItems.map(it => {
      if (it.id === id) {
        const copy: any = { ...it, [field]: value };
        if (field === 'name') {
          const lower = String(value).toLowerCase();
          if (lower.includes('bi-fast') || lower.includes('bi fast') || lower.includes('admin bank') || lower.includes('biaya transfer')) {
            copy.isTaxOrFee = true;
            copy.taxOrFeeType = (lower.includes('bi-fast') || lower.includes('bi fast')) ? 'BI_FAST' : 'ADMIN_BANK';
          }
        }
        if (field === 'unitPrice' || field === 'quantity') {
          const uP = field === 'unitPrice' ? Number(value) : (it.unitPrice || 0);
          const qty = field === 'quantity' ? Number(value) : (it.quantity || 1);
          copy.totalPrice = uP * qty;
        }
        return copy;
      }
      return it;
    });

    const hasBankFeeInItems = updated.some(it =>
      (it.isTaxOrFee && (it.taxOrFeeType === 'BI_FAST' || it.taxOrFeeType === 'ADMIN_BANK')) ||
      it.name.toLowerCase().includes('bi-fast') ||
      it.name.toLowerCase().includes('admin bank')
    );
    if (hasBankFeeInItems && hasUnconfirmedFee) {
      setHasUnconfirmedFee(false);
    }

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

    if (totalDebit <= 0 || totalCredit <= 0) {
      alert('Jurnal tidak boleh bernilai nol! Harap lengkapi nominal debit dan kredit yang valid pada Tabel Koreksi.');
      return;
    }

    if (diff !== 0) {
      alert(`Jurnal belum seimbang! Selisih: Rp ${diff.toLocaleString('id-ID')}. Total Debit harus sama persis dengan Total Kredit.`);
      return;
    }

    setIsJournalSaved(true);
    setSaveSuccessMsg('Saran Jurnal berhasil dikunci dan disimpan!');
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // SYNC ROWS DIRECTLY TO GOOGLE SPREADSHEET VIA APPS SCRIPT BOT
  const handleSyncSpreadsheet = async () => {
    if (hasUnconfirmedFee) {
      alert('Sinkronisasi ditolak: Terdapat indikasi biaya transfer bank yang belum dikonfirmasi. Harap selesaikan konfirmasi biaya pada Tabel Koreksi Tahap 2 terlebih dahulu.');
      return;
    }
    if (spreadsheetRows.length === 0) {
      alert('Tabel data transaksi masih kosong. Silakan jalankan ekstraksi terlebih dahulu.');
      return;
    }
    const webhookUrl = getSpreadsheetWebhookUrl();
    if (!webhookUrl) {
      setWebhookInput('');
      setWebhookTestResult(null);
      setIsWebhookModalOpen(true);
      return;
    }
    setIsSyncingSpreadsheet(true);
    setSyncSpreadsheetResult(null);
    const res = await syncRowsToGoogleSpreadsheet(spreadsheetRows, webhookUrl);
    setIsSyncingSpreadsheet(false);
    setSyncSpreadsheetResult(res);
    if (res.success) {
      logActivity(
        'Spreadsheet Bot Sync',
        `Bot berhasil mengisi ${spreadsheetRows.length} baris ke Google Spreadsheet main (${nomorBerkas})`
      );
    }
  };

  // Helper validasi item: mengizinkan diskon negatif, pembulatan, dan bonus/item gratis
  const isUnresolvedZeroItem = (item: ExtractedItem): boolean => {
    const price = Number(item.totalPrice) || 0;
    if (price > 0) return false; // Item positif sah

    const name = (item.name || '').toLowerCase();
    const isDiscount = price < 0 || name.includes('diskon') || name.includes('discount') || name.includes('potongan') || name.includes('voucher') || name.includes('promo') || name.includes('cashback');
    const isRounding = name.includes('pembulatan') || name.includes('rounding') || name.includes('selisih');
    const isFreeOrBonus = price === 0 && (name.includes('gratis') || name.includes('free') || name.includes('bonus') || name.includes('sample') || name.includes('hadiah') || name.includes('gift'));

    // Diskon, pembulatan, dan bonus gratis adalah sah
    if (isDiscount || isRounding || isFreeOrBonus) {
      return false;
    }

    // Jika bernilai 0 / kosong dan bukan kategori di atas, wajib dikoreksi manual
    return true;
  };

  // PROCEED TO AUTO JOURNAL & SAVE RECEIPT
  const handleProceedToAutoJournal = async () => {
    if (hasUnconfirmedFee) {
      alert('Perekaman ditolak: Terdapat indikasi biaya transfer bank yang belum dikonfirmasi. Harap masukkan nominal biaya manual atau verifikasi bebas biaya terlebih dahulu pada Tabel Koreksi Tahap 2.');
      return;
    }

    // Validasi ketat: Cegah posting nominal nol atau OCR yang belum tervalidasi, namun izinkan diskon dan bonus gratis yang sah
    const hasPositiveItem = extractedItems.some(it => (Number(it.totalPrice) || 0) > 0);
    const hasInvalidItem = extractedItems.some(isUnresolvedZeroItem);

    if (!grandTotal || grandTotal <= 0 || !hasPositiveItem || hasInvalidItem) {
      alert('Perekaman ditolak: Total transaksi harus lebih besar dari Rp 0 dan seluruh item non-diskon/non-bonus harus memiliki nominal yang valid. Harap periksa dan lengkapi Tabel Koreksi Tahap 2 sebelum melanjutkan ke Jurnal Otomatis.');
      return;
    }

    const recordPayload: RecordedReceipt = {
      id: `rec-${Date.now()}`,
      nomorBerkas,
      seqNumber,
      date: new Date().toISOString().slice(0, 10),
      keterangan,
      posCode: selectedPosCode,
      grandTotal,
      extractedItems,
      spreadsheetRows,
      receiptFileName,
      receiptImage,
      googleDriveLink: googleDriveLink || driveViewUrl || '',
      driveFileId: driveFileId || undefined,
      driveViewUrl: driveViewUrl || (googleDriveLink.includes('drive.google.com') ? googleDriveLink : undefined),
      driveDirectUrl: driveDirectUrl || undefined,
      driveUploadStatus: driveUploadStatus !== 'IDLE' ? driveUploadStatus : undefined,
      driveUploadedAt: driveUploadStatus === 'UPLOADED' ? new Date().toISOString() : undefined,
      spreadsheetSyncStatus: 'PENDING',
      spreadsheetRowsCount: spreadsheetRows.length,
      journalStatus: 'PENDING',
      status: 'pending_journal',
      createdAt: new Date().toISOString()
    };

    const saveRes = await saveRecordedReceipt(recordPayload);
    if (!saveRes.success) {
      alert(`Peringatan: Gagal menyimpan bukti transaksi ke penyimpanan (${saveRes.error || 'kesalahan storage'}). Draft dan berkas gambar tetap dipertahankan.`);
      return;
    }

    setRecordedReceipts(getRecordedReceipts());

    setPendingJournalDraft({
      nomorBerkas,
      seqNumber,
      keterangan,
      posCode: selectedPosCode,
      extractedItems,
      grandTotal,
      receiptFileName,
      receiptImage,
      googleDriveLink,
      date: new Date().toISOString().slice(0, 10)
    });

    commitDocumentSequence(seqNumber);

    // Auto-sync ke Google Spreadsheet jika webhook sudah disetel
    const webhookUrl = getSpreadsheetWebhookUrl();
    if (webhookUrl && spreadsheetRows.length > 0) {
      syncRowsToGoogleSpreadsheet(spreadsheetRows, webhookUrl).then(res => {
        if (res.success) {
          logActivity('Spreadsheet Bot Auto Sync', `Otomatis mengirim ${spreadsheetRows.length} baris ${nomorBerkas} ke Google Spreadsheet`);
        }
      }).catch(console.error);
    }

    logActivity(
      'Auto Record Save',
      `Menyimpan bukti transaksi ${nomorBerkas} (${keterangan}) dan meneruskan ke modul Jurnal Otomatis`
    );

    setActiveTab('auto-journal');
  };

  const handleSaveRecordedReceiptOnly = async () => {
    if (hasUnconfirmedFee) {
      alert('Penyimpanan ditolak: Terdapat indikasi biaya transfer bank yang belum dikonfirmasi. Harap masukkan nominal biaya manual atau verifikasi bebas biaya terlebih dahulu pada Tabel Koreksi Tahap 2.');
      return;
    }

    // Validasi ketat: Cegah penyimpanan nominal nol atau fiktif, namun izinkan diskon dan bonus gratis yang sah
    const hasPositiveItem = extractedItems.some(it => (Number(it.totalPrice) || 0) > 0);
    const hasInvalidItem = extractedItems.some(isUnresolvedZeroItem);

    if (!grandTotal || grandTotal <= 0 || !hasPositiveItem || hasInvalidItem) {
      alert('Perekaman ditolak: Total transaksi harus lebih besar dari Rp 0 dan seluruh item non-diskon/non-bonus harus memiliki nominal yang valid. Harap periksa dan lengkapi Tabel Koreksi Tahap 2 sebelum menyimpan.');
      return;
    }

    const recordPayload: RecordedReceipt = {
      id: `rec-${Date.now()}`,
      nomorBerkas,
      seqNumber,
      date: new Date().toISOString().slice(0, 10),
      keterangan,
      posCode: selectedPosCode,
      grandTotal,
      extractedItems,
      spreadsheetRows,
      receiptFileName,
      receiptImage,
      googleDriveLink: googleDriveLink || driveViewUrl || '',
      driveFileId: driveFileId || undefined,
      driveViewUrl: driveViewUrl || (googleDriveLink.includes('drive.google.com') ? googleDriveLink : undefined),
      driveDirectUrl: driveDirectUrl || undefined,
      driveUploadStatus: driveUploadStatus !== 'IDLE' ? driveUploadStatus : undefined,
      driveUploadedAt: driveUploadStatus === 'UPLOADED' ? new Date().toISOString() : undefined,
      spreadsheetSyncStatus: 'PENDING',
      spreadsheetRowsCount: spreadsheetRows.length,
      journalStatus: 'PENDING',
      status: 'pending_journal',
      createdAt: new Date().toISOString()
    };

    const saveRes = await saveRecordedReceipt(recordPayload);
    if (!saveRes.success) {
      alert(`Gagal menyimpan rekaman bukti: ${saveRes.error || 'Penyimpanan gagal'}. Draft tetap dipertahankan.`);
      return;
    }

    setRecordedReceipts(getRecordedReceipts());

    commitDocumentSequence(seqNumber);

    // Auto-sync ke Google Spreadsheet jika webhook sudah disetel
    const webhookUrl = getSpreadsheetWebhookUrl();
    if (webhookUrl && spreadsheetRows.length > 0) {
      syncRowsToGoogleSpreadsheet(spreadsheetRows, webhookUrl).then(res => {
        if (res.success) {
          logActivity('Spreadsheet Bot Auto Sync', `Otomatis mengirim ${spreadsheetRows.length} baris ${nomorBerkas} ke Google Spreadsheet`);
        }
      }).catch(console.error);
    }

    logActivity(
      'Auto Record Save',
      `Menyimpan bukti transaksi ${nomorBerkas} (${keterangan}) ke arsip rekaman bukti`
    );

    alert(`Bukti transaksi ${nomorBerkas} berhasil disimpan ke arsip rekaman! Anda dapat memproses jurnalnya kapan saja di menu Jurnal Otomatis.`);
    setCurrentStage('riwayat');
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
      
      {/* 1. Header Enterprise & Navigasi Alur */}
      <div className="relative rounded-xl overflow-hidden bg-slate-900 text-white shadow-sm border border-slate-800">
        <div className="p-5 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1 max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
              <Scan className="w-3.5 h-3.5 text-blue-400" />
              <span>SPECTRA Auto Record Engine</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Perekaman &amp; Ekstraksi Bukti Transaksi
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ekstraksi nota cetak, struk thermal, dan bukti transfer via Groq Vision AI dengan verifikasi horizontal-vertikal serta sinkronisasi Drive dan Spreadsheet.
            </p>
          </div>

          {/* Cluster Kontrol Header */}
          <div className="flex flex-col items-start lg:items-end gap-2.5 shrink-0">
            {/* Baris 1: Aksi Utama & Indikator Kode Berkas */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Tombol Buka Jurnal Otomatis */}
              <button
                type="button"
                onClick={() => setActiveTab('auto-journal')}
                className="h-9 inline-flex items-center gap-2 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
                title="Buka modul Jurnal Otomatis"
              >
                <Layers className="w-3.5 h-3.5 text-blue-200" />
                <span>Jurnal Otomatis</span>
                {pendingReceipts.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400 text-slate-900">
                    {pendingReceipts.length}
                  </span>
                )}
                <ArrowRight className="w-3 h-3 text-blue-200" />
              </button>

              {/* Box Kode Berkas Selanjutnya dengan Tombol Reset Terpadu */}
              <div className="h-9 flex items-center bg-slate-800 rounded-lg border border-slate-700 shadow-xs overflow-hidden divide-x divide-slate-700">
                <div className="px-3 py-1 flex flex-col justify-center text-left">
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none">Nomor Berkas</span>
                  <span className="text-xs font-mono font-bold text-amber-300 leading-tight mt-0.5">{nomorBerkas}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setResetFeedback(null);
                    setIsResetModalOpen(true);
                  }}
                  className="h-full px-2.5 bg-slate-800 hover:bg-rose-500/15 text-slate-400 hover:text-rose-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Reset hitungan nomor berkas kembali ke 1 dan bersihkan database transaksi"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="text-[10px] font-medium">Reset</span>
                </button>
              </div>

              {/* Tombol Buka Spreadsheet */}
              <a 
                href={SPREADSHEET_CONFIG.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="h-9 inline-flex items-center gap-2 px-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Buka Sheet</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </div>

            {/* Baris 2: Status Integrasi Sistem */}
            <div className="flex items-center gap-2 text-[11px]">
              {/* Status Groq AI */}
              <div
                className={`h-6 inline-flex items-center gap-1.5 px-2 text-[11px] font-medium rounded-md border transition-all whitespace-nowrap ${
                  groqStatus === 'verified'
                    ? 'bg-slate-800 text-emerald-300 border-emerald-500/40'
                    : groqStatus === 'error'
                    ? 'bg-slate-800 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
                title={
                  groqStatus === 'verified'
                    ? 'Groq AI Vision terverifikasi aktif.'
                    : groqStatus === 'error'
                    ? 'Fallback OCR Offline Tesseract.js aktif.'
                    : 'Groq AI Vision backend siaga.'
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    groqStatus === 'verified'
                      ? 'bg-emerald-400'
                      : groqStatus === 'error'
                      ? 'bg-amber-400'
                      : 'bg-slate-400'
                  }`}
                />
                <span>
                  {groqStatus === 'verified'
                    ? 'Groq AI: Aktif'
                    : groqStatus === 'error'
                    ? 'Groq AI: Fallback Offline'
                    : 'Groq AI: Siaga'}
                </span>
              </div>

              {/* Status Bot Apps Script */}
              <button
                type="button"
                onClick={() => {
                  setWebhookInput(getSpreadsheetWebhookUrl());
                  setWebhookTestResult(null);
                  setIsWebhookModalOpen(true);
                }}
                className={`h-6 inline-flex items-center gap-1.5 px-2 text-[11px] font-medium rounded-md border transition-all cursor-pointer whitespace-nowrap ${
                  getSpreadsheetWebhookUrl()
                    ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-400 border-slate-700'
                }`}
                title={getSpreadsheetWebhookUrl() ? 'Webhook Apps Script aktif. Klik untuk konfigurasi.' : 'Klik untuk menyetel Webhook Apps Script.'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${getSpreadsheetWebhookUrl() ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <Bot className="w-3 h-3 text-slate-400" />
                <span>{getSpreadsheetWebhookUrl() ? 'Bot Sheet: Aktif' : 'Setel Bot Sheet'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Banner Isolasi Preview & Staging */}
        {isExternalSyncDisabled && (
          <div className="mx-4 md:mx-6 mb-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span>
                <strong>Mode Isolasi ({syncStatus.environmentName.toUpperCase()}):</strong> Pengiriman ke Drive &amp; Spreadsheet dialihkan ke simulasi lokal (Mock Mode). Data pembukuan produksi terlindungi 100%.
              </span>
            </div>
            <span className="text-[10px] bg-amber-400/20 text-amber-300 font-mono px-2 py-0.5 rounded border border-amber-400/30 shrink-0 self-start sm:self-auto font-bold">
              Isolasi Aktif
            </span>
          </div>
        )}

        {/* Tab Indicator */}
        <div className="flex border-t border-slate-800 bg-slate-950/60 overflow-x-auto touch-scroll-x no-scrollbar">
          <button
            type="button"
            onClick={() => setCurrentStage('tahap1')}
            className={`flex-1 min-w-[200px] py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition border-b-2 cursor-pointer ${
              currentStage === 'tahap1'
                ? 'border-blue-500 text-white bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStage === 'tahap1' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}>1</span>
            <span>Tahap 1: Upload Bukti &amp; POS</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentStage('tahap2')}
            className={`flex-1 min-w-[220px] py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition border-b-2 cursor-pointer ${
              currentStage === 'tahap2'
                ? 'border-blue-500 text-white bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStage === 'tahap2' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}>2</span>
            <span>Tahap 2: Koreksi &amp; Spreadsheet</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentStage('riwayat')}
            className={`flex-1 min-w-[220px] py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition border-b-2 cursor-pointer ${
              currentStage === 'riwayat'
                ? 'border-blue-500 text-white bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4 text-slate-400" />
            <span>Arsip Rekaman Bukti &amp; Transaksi ({unifiedHistoryItems.length})</span>
            {pendingReceipts.length > 0 && (
              <span className="bg-amber-400/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono border border-amber-400/30">
                {pendingReceipts.length} Draf
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 rounded-xl cursor-pointer transition text-center space-y-1.5">
                    <Upload className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="text-xs font-bold text-slate-700">Pilih Berkas</div>
                      <div className="text-[10px] text-slate-400">JPG, PNG, PDF</div>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*,.pdf" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>

                  <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-xl cursor-pointer transition text-center space-y-1.5">
                    <Camera className="w-5 h-5 text-emerald-600" />
                    <div>
                      <div className="text-xs font-bold text-emerald-850">Kamera HP (GCam)</div>
                      <div className="text-[10px] text-slate-500">Jepret Langsung Bukti</div>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*"
                      capture="environment" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>

                  <button
                    type="button"
                    onClick={loadSampleData}
                    className="flex flex-col items-center justify-center p-3.5 border border-amber-300 bg-amber-50/50 hover:bg-amber-100/70 rounded-xl transition text-center space-y-1.5 cursor-pointer"
                  >
                    <Zap className="w-5 h-5 text-amber-600" />
                    <div>
                      <div className="text-xs font-bold text-amber-900">Contoh Resmi</div>
                      <div className="text-[10px] text-amber-700">Nota Baut &amp; PB1</div>
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
                {isRenderingPdf ? (
                  <div className="text-center text-xs text-slate-500 p-8 space-y-2">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="font-semibold text-slate-700">Membaca &amp; merender pratinjau PDF...</p>
                  </div>
                ) : renderedPdfPages.length > 0 ? (
                  <div className="flex flex-col items-center justify-center w-full h-full relative">
                    <img
                      src={renderedPdfPages[currentPdfPagePreview]}
                      alt={`Halaman PDF ${currentPdfPagePreview + 1}`}
                      className="max-h-[390px] max-w-full object-contain rounded shadow-xs"
                    />
                    {renderedPdfPages.length > 1 && (
                      <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-2 bg-black/75 backdrop-blur-xs py-1 px-3 rounded-full mx-auto w-fit text-white text-[11px] font-medium shadow-md">
                        <button
                          type="button"
                          onClick={() => setCurrentPdfPagePreview(p => Math.max(0, p - 1))}
                          disabled={currentPdfPagePreview === 0}
                          className="px-2 py-0.5 hover:bg-white/20 rounded disabled:opacity-30 cursor-pointer font-bold"
                          title="Halaman Sebelumnya"
                        >
                          ◀
                        </button>
                        <span>Hal {currentPdfPagePreview + 1} dari {renderedPdfPages.length}</span>
                        <button
                          type="button"
                          onClick={() => setCurrentPdfPagePreview(p => Math.min(renderedPdfPages.length - 1, p + 1))}
                          disabled={currentPdfPagePreview === renderedPdfPages.length - 1}
                          className="px-2 py-0.5 hover:bg-white/20 rounded disabled:opacity-30 cursor-pointer font-bold"
                          title="Halaman Berikutnya"
                        >
                          ▶
                        </button>
                      </div>
                    )}
                  </div>
                ) : receiptImage ? (
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
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <div className="bg-black/70 backdrop-blur-md text-amber-300 font-mono text-[10px] font-bold px-2 py-1 rounded border border-white/20">
                    {nomorBerkas}
                  </div>
                  {renderedPdfPages.length > 0 && (
                    <div className="bg-blue-600/90 backdrop-blur-md text-white font-mono text-[10px] font-bold px-2 py-1 rounded border border-white/20">
                      PDF ({renderedPdfPages.length} Hal)
                    </div>
                  )}
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

          {/* Section: Arsip Rekaman Bukti & Transaksi Terekam (Quick Preview) */}
          <div className="lg:col-span-12 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Arsip Rekaman Bukti &amp; Transaksi Terekam</span>
                    <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                      {unifiedHistoryItems.length} Total Berkas
                    </span>
                    {pendingReceipts.length > 0 && (
                      <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                        {pendingReceipts.length} Menunggu Jurnal
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Dokumen bukti transaksi yang telah terekam dan riwayat pembukuan yang tersimpan.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {pendingReceipts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('auto-journal')}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Proses Jurnal ({pendingReceipts.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCurrentStage('riwayat')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>Buka Semua Riwayat ({unifiedHistoryItems.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {unifiedHistoryItems.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 space-y-2">
                <Receipt className="w-7 h-7 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600 font-medium">
                  Belum ada bukti transaksi yang terekam.
                </p>
                <p className="text-[11px] text-slate-400">
                  Unggah foto struk/nota atau bukti transfer di atas lalu klik "Jalankan Ekstraksi Bukti".
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-3 min-w-[95px]">Tanggal</th>
                      <th className="py-2.5 px-3 min-w-[130px]">No. Berkas</th>
                      <th className="py-2.5 px-3 min-w-[220px]">Keterangan</th>
                      <th className="py-2.5 px-3 text-right min-w-[110px]">Total Nilai</th>
                      <th className="py-2.5 px-3 text-center min-w-[130px]">Status Pembukuan</th>
                      <th className="py-2.5 px-3 text-center min-w-[90px]">Google Drive</th>
                      <th className="py-2.5 px-3 text-center w-28">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {unifiedHistoryItems.slice(0, 5).map((item, idx) => {
                      const isPending = item.isPendingReceipt;
                      const hasDrive = item.googleDriveLink && item.googleDriveLink.includes('drive.google.com');

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 text-[11px] whitespace-nowrap">
                            <span className="flex items-center gap-1 font-mono">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {item.date}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {item.refNumber}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 text-xs">
                            <div className="font-medium line-clamp-1">{item.description}</div>
                            {item.partner && (
                              <div className="text-[10px] text-slate-400">Pihak: {item.partner}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {formatRupiah(item.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Menunggu Jurnal</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Sudah Dibukukan</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {hasDrive ? (
                              <a
                                href={item.googleDriveLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
                                title="Buka berkas di Google Drive"
                              >
                                <span>Drive</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">Lokal</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isPending ? (
                              <button
                                type="button"
                                onClick={() => setActiveTab('auto-journal')}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded border border-blue-200 inline-flex items-center gap-1 cursor-pointer"
                                title="Buka berkas ini di modul Jurnal Otomatis"
                              >
                                <span>Proses Jurnal</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setCurrentStage('riwayat')}
                                className="p-1 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded transition cursor-pointer"
                                title="Lihat Detail Transaksi"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
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

          {/* Bank Transfer Summary Card if Bank Details Available */}
          {bankTransferDetails && bankTransferDetails.transferAmount > 0 && (
            <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-blue-950 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-blue-900">Rincian Bukti Transfer Bank:</span>
                <span>Nominal Transfer: <strong className="font-mono text-blue-800">{formatRupiah(bankTransferDetails.transferAmount)}</strong></span>
                <span className="text-blue-300">•</span>
                <span>Biaya Admin: <strong className="font-mono text-blue-800">{bankTransferDetails.bankAdminFee > 0 ? formatRupiah(bankTransferDetails.bankAdminFee) : 'Rp 0 (Bebas Biaya)'}</strong> ({bankTransferDetails.feeType || 'TRANSFER'})</span>
                <span className="text-blue-300">•</span>
                <span>Total Dana Terdebit: <strong className="font-mono text-blue-900">{formatRupiah(bankTransferDetails.totalDebitedAmount)}</strong></span>
              </div>
              {bankTransferDetails.feeTextEvidence && (
                <div className="text-[11px] text-blue-700 bg-white/80 px-2.5 py-1 rounded-lg border border-blue-200 font-mono italic shrink-0">
                  Bukti teks: "{bankTransferDetails.feeTextEvidence}"
                </div>
              )}
            </div>
          )}

          {/* Unconfirmed Bank Fee Alert Banner if Fee Keyword Detected but Amount Missing */}
          {hasUnconfirmedFee && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-amber-900 shadow-xs">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
                    <span>Perhatian: Indikasi Biaya Transfer Bank Belum Dikonfirmasi</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-200 text-amber-900 rounded-full border border-amber-300">
                      Tindakan Diblokir
                    </span>
                  </div>
                  <p className="leading-relaxed">
                    {unconfirmedFeeNote || 'Metode transfer bank/BI-FAST terdeteksi pada struk, namun nominal biaya admin bank tidak tertera jelas. Sistem menolak mengarang nominal biaya secara otomatis.'}
                  </p>
                  <p className="text-[11px] text-amber-700 font-medium">
                    💡 Masukkan nominal biaya transfer yang tertera pada bukti dokumen atau mutasi rekening Anda, lalu klik "Konfirmasi Biaya". Jika transaksi bebas biaya, klik "Verifikasi Bebas Biaya (Rp 0)". Tindakan simpan/posting/sync diblokir hingga biaya terverifikasi.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 bg-white/80 p-2.5 rounded-xl border border-amber-200 shadow-xs">
                <div className="flex items-center gap-1.5">
                  <select
                    value={manualFeeType}
                    onChange={(e) => setManualFeeType(e.target.value as 'BI_FAST' | 'ADMIN_BANK')}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-amber-500"
                    title="Pilih Jenis Biaya Bank"
                  >
                    <option value="BI_FAST">BI-FAST</option>
                    <option value="ADMIN_BANK">Admin Bank</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={manualFeeInput}
                    onChange={(e) => setManualFeeInput(e.target.value)}
                    placeholder="Nominal biaya..."
                    className="w-32 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-amber-500 placeholder:text-slate-400 font-mono"
                    title="Input nominal biaya transfer manual"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const parsedFee = Math.round(Number(manualFeeInput) || 0);
                      if (parsedFee <= 0) {
                        alert('Harap masukkan nominal biaya transfer yang valid (> Rp 0) sesuai bukti dokumen, atau klik "Verifikasi Bebas Biaya (Rp 0)" jika transaksi tidak dikenakan biaya.');
                        return;
                      }
                      const feeItem: ExtractedItem = {
                        id: `it-${Date.now()}-admin-manual`,
                        name: manualFeeType === 'BI_FAST' ? 'Biaya Transfer BI-FAST' : 'Biaya Administrasi Bank',
                        unitPrice: null,
                        quantity: null,
                        unit: '',
                        totalPrice: parsedFee,
                        confidence: 100,
                        isTaxOrFee: true,
                        taxOrFeeType: manualFeeType
                      };
                      const updated = [...extractedItems, feeItem];
                      const verif = runTwoWayDeterministicVerification(updated);
                      setExtractedItems(verif.verifiedItems);
                      setGrandTotal(verif.grandTotal);
                      setCalculatedTotal(verif.calculatedSum);
                      setMathDiscrepancy(verif.mathDiscrepancy);
                      setHasUnconfirmedFee(false);
                      setManualFeeInput('');
                      const rows = buildSpreadsheetRows(seqNumber, nomorBerkas, googleDriveLink, selectedPosCode, verif.verifiedItems);
                      setSpreadsheetRows(rows);
                      const finalSug = ensureSuggestedJournalWithAutoCreatedAccounts(verif.verifiedItems, selectedPosCode, accounts, keterangan);
                      setJournalLines(finalSug);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    Konfirmasi Biaya
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasUnconfirmedFee(false);
                      setManualFeeInput('');
                      const verif = runTwoWayDeterministicVerification(extractedItems);
                      setExtractedItems(verif.verifiedItems);
                      setGrandTotal(verif.grandTotal);
                      setCalculatedTotal(verif.calculatedSum);
                      setMathDiscrepancy(verif.mathDiscrepancy);
                      const rows = buildSpreadsheetRows(seqNumber, nomorBerkas, googleDriveLink, selectedPosCode, verif.verifiedItems);
                      setSpreadsheetRows(rows);
                      const finalSug = ensureSuggestedJournalWithAutoCreatedAccounts(verif.verifiedItems, selectedPosCode, accounts, keterangan);
                      setJournalLines(finalSug);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold rounded-lg text-xs transition cursor-pointer whitespace-nowrap"
                  >
                    Verifikasi Bebas Biaya (Rp 0)
                  </button>
                </div>
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

              <div className="flex flex-wrap items-center gap-2">
                {activeSourceEngine && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    activeSourceEngine === 'groq_vision'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : activeSourceEngine === 'tesseract_ocr'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-blue-50 text-blue-800 border-blue-300'
                  }`}>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      {activeSourceEngine === 'groq_vision' ? 'Groq Vision — AI OCR' :
                       activeSourceEngine === 'tesseract_ocr' ? 'Offline OCR (Tesseract.js)' : 'Smart Rule Parser'}
                    </span>
                  </span>
                )}
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
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                            className="w-full px-2 py-1 bg-transparent border-b border-slate-200 focus:border-blue-500 focus:bg-white text-xs font-semibold text-slate-800"
                          />
                          {item.isTaxOrFee && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {item.taxOrFeeType === 'BI_FAST' ? 'BI-FAST' : item.taxOrFeeType === 'ADMIN_BANK' ? 'Admin Bank' : item.taxOrFeeType || 'Biaya'}
                            </span>
                          )}
                        </div>
                        {item.discrepancyNote && (
                          <div className="mt-1 text-[10px] text-amber-700 font-medium flex items-start gap-1 bg-amber-50/80 p-1 rounded border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                            <span>{item.discrepancyNote}</span>
                          </div>
                        )}
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
                    <td colSpan={2} className="py-3 px-4 text-center text-[10px]">
                      {mathDiscrepancy ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                          ⚠️ Terdapat Selisih
                        </span>
                      ) : hasUnconfirmedFee ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300" title={unconfirmedFeeNote}>
                          ⚠️ Konfirmasi Biaya Bank
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300">
                          ✓ Seimbang 100%
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Bagian 4.2: Pemisahan Modul - Teruskan ke Jurnal Otomatis */}
          <div className="bg-slate-900 text-white rounded-xl border border-slate-800 shadow-sm p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-semibold border border-slate-700">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>Kesiapan Pembukuan Akuntansi</span>
                </div>
                <h3 className="text-sm font-bold text-white">
                  Data Bukti Transaksi Siap Diproses ke Jurnal Akuntansi SAK
                </h3>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Nomor berkas <strong className="text-amber-300 font-mono">{nomorBerkas}</strong> dengan total nilai <strong className="text-emerald-400 font-mono tabular-nums">{formatRupiah(grandTotal)}</strong> telah terverifikasi. Teruskan ke modul <strong>Jurnal Otomatis</strong> untuk pembentukan jurnal SAK debit/kredit, atau simpan ke arsip rekaman bukti.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={hasUnconfirmedFee}
                  onClick={handleSaveRecordedReceiptOnly}
                  className={`px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs ${
                    hasUnconfirmedFee ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  title={hasUnconfirmedFee ? 'Konfirmasi biaya transfer bank terlebih dahulu' : 'Simpan Rekaman Saja'}
                >
                  <Save className="w-4 h-4 text-slate-400" />
                  <span>Simpan Rekaman Saja</span>
                </button>

                <button
                  type="button"
                  disabled={hasUnconfirmedFee}
                  onClick={handleProceedToAutoJournal}
                  className={`px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-xs ${
                    hasUnconfirmedFee ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  title={hasUnconfirmedFee ? 'Konfirmasi biaya transfer bank terlebih dahulu' : 'Lanjutkan ke Jurnal Otomatis'}
                >
                  <span>Lanjutkan ke Jurnal Otomatis</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          

          {/* Bagian 3.3: Pratinjau Google Spreadsheet Format (datasheet_bukti_transaksi) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  Pratinjau Format Spreadsheet "datasheet_bukti_transaksi" (Sheet: Main, Baris 6+)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  Kolom A s.d. K (Mulai A6)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsWebhookModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
                  title="Konfigurasi Google Apps Script Bot & Webhook URL"
                >
                  <Bot className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Setel Bot Apps Script</span>
                </button>

                <button
                  type="button"
                  disabled={isSyncingSpreadsheet || spreadsheetRows.length === 0 || hasUnconfirmedFee}
                  onClick={handleSyncSpreadsheet}
                  className={`px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold rounded-lg shadow-xs transition flex items-center gap-1.5 ${
                    isSyncingSpreadsheet || spreadsheetRows.length === 0 || hasUnconfirmedFee ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  title={hasUnconfirmedFee ? 'Konfirmasi biaya transfer bank terlebih dahulu' : 'Kirim ke Spreadsheet'}
                >
                  {isSyncingSpreadsheet ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Mengisi ke Sheet...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                      <span>Kirim ke Spreadsheet ⚡</span>
                    </>
                  )}
                </button>

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
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition"
                >
                  Unduh CSV
                </button>
                <a
                  href={SPREADSHEET_CONFIG.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-200 flex items-center gap-1 transition"
                >
                  <span>Buka Sheet Main</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {syncSpreadsheetResult && (
              <div className={`p-3 rounded-xl text-xs font-medium border flex items-start justify-between gap-2 ${
                syncSpreadsheetResult.success ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300'
              }`}>
                <div className="flex items-start gap-2">
                  {syncSpreadsheetResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">{syncSpreadsheetResult.success ? 'Berhasil Terkirim ke Spreadsheet!' : 'Gagal Mengirim ke Spreadsheet'}</div>
                    <div className="text-[11px] mt-0.5">{syncSpreadsheetResult.message}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSyncSpreadsheetResult(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse font-mono">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-2.5 text-center">A (No)</th>
                    <th className="py-2 px-2.5 text-center">B (Tgl)</th>
                    <th className="py-2 px-2.5 text-center">C (Bln)</th>
                    <th className="py-2 px-2.5 text-center">D (Thn)</th>
                    <th className="py-2 px-3 font-sans">E (Nama Transaksi)</th>
                    <th className="py-2 px-2.5 text-right">F (Harga satuan)</th>
                    <th className="py-2 px-2.5 text-center">G (kuantitas)</th>
                    <th className="py-2 px-2.5 text-right">H (Harga total)</th>
                    <th className="py-2 px-2.5">I (Nomor Berkas)</th>
                    <th className="py-2 px-2.5">J (Link Berkas)</th>
                    <th className="py-2 px-2.5 text-center">K (POS)</th>
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
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700 shrink-0 border border-blue-200">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Berkas &amp; Transaksi</div>
                <div className="text-xl font-bold font-mono text-slate-900">{unifiedHistoryItems.length} <span className="text-xs font-normal text-slate-500">dokumen</span></div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 shrink-0 border border-amber-200">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Menunggu Jurnal</div>
                <div className="text-xl font-bold font-mono text-amber-600">{pendingReceipts.length} <span className="text-xs font-normal text-slate-500">berkas</span></div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 shrink-0 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sudah Dibukukan</div>
                <div className="text-xl font-bold font-mono text-emerald-600">{transactions.length} <span className="text-xs font-normal text-slate-500">transaksi</span></div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-700 shrink-0 border border-slate-200">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Akumulasi Nilai</div>
                <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {formatRupiah(totalHistoryDebit)}
                </div>
              </div>
            </div>
          </div>

          {/* Table Container Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            
            {/* Header & Filter Controls */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" />
                  <span>Arsip Rekaman Bukti &amp; Transaksi Pembukuan</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Daftar seluruh berkas hasil rekaman bukti transaksi dan jurnal yang telah disetujui dalam database.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportHistoryExcel}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-lg border border-emerald-200 flex items-center gap-1.5 transition cursor-pointer"
                  title="Unduh seluruh daftar transaksi ke format Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStage('tahap1')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Scan className="w-3.5 h-3.5" />
                  <span>+ Rekam Bukti Baru</span>
                </button>
              </div>
            </div>

            {/* Filter Pills & Search Input */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mr-1">
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>Filter:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setRiwayatFilter('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                    riwayatFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Semua ({unifiedHistoryItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRiwayatFilter('pending')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                    riwayatFilter === 'pending'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Draf Menunggu Jurnal ({pendingReceipts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRiwayatFilter('posted')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                    riwayatFilter === 'posted'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Sudah Dibukukan ({transactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRiwayatFilter('bt')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                    riwayatFilter === 'bt'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Khusus Auto Record BT ({autoRecordTransactions.length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari ref, keterangan, pihak..."
                  value={riwayatSearch}
                  onChange={(e) => setRiwayatSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Table */}
            {filteredUnifiedHistory.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">Tidak ada berkas ditemukan</div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {riwayatSearch ? 'Coba ubah kata kunci pencarian Anda.' : 'Belum ada bukti transaksi yang terekam atau memenuhi filter ini.'}
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStage('tahap1')}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
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
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-3 min-w-[95px]">Tanggal</th>
                      <th className="py-2.5 px-3 min-w-[130px]">No. Berkas / Ref</th>
                      <th className="py-2.5 px-3 min-w-[220px]">Keterangan Transaksi</th>
                      <th className="py-2.5 px-3 min-w-[240px]">Rincian Jurnal Akun / Item</th>
                      <th className="py-2.5 px-3 text-right min-w-[120px]">Total Nilai</th>
                      <th className="py-2.5 px-3 text-center min-w-[120px]">Status Pembukuan</th>
                      <th className="py-2.5 px-3 text-center min-w-[85px]">Google Drive</th>
                      <th className="py-2.5 px-3 text-center w-28">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredUnifiedHistory.map((item, idx) => {
                      const isPending = item.isPendingReceipt;
                      const hasDrive = item.googleDriveLink && item.googleDriveLink.includes('drive.google.com');

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 text-[11px] whitespace-nowrap">
                            <span className="flex items-center gap-1 font-mono">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {item.date}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {item.refNumber}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 text-xs">
                            <div className="font-semibold text-slate-900 leading-snug">{item.description}</div>
                            {item.partner && (
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Pihak: <strong className="text-slate-700">{item.partner}</strong>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-xs">
                            {item.transaction?.lines ? (
                              <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                {item.transaction.lines.slice(0, 2).map((l, lIdx) => (
                                  <div key={lIdx} className="flex items-center justify-between text-[10px] gap-2">
                                    <span className="truncate max-w-[130px]" title={l.accountName}>
                                      <span className="font-mono text-slate-500 mr-1">{l.accountCode}</span>
                                      {l.accountName}
                                    </span>
                                    <span className="font-mono text-slate-700">
                                      {l.debit > 0 ? `(D) Rp ${l.debit.toLocaleString('id-ID')}` : `(K) Rp ${l.credit.toLocaleString('id-ID')}`}
                                    </span>
                                  </div>
                                ))}
                                {item.transaction.lines.length > 2 && (
                                  <div className="text-[10px] text-blue-600 italic">+{item.transaction.lines.length - 2} baris lainnya</div>
                                )}
                              </div>
                            ) : item.receipt?.extractedItems ? (
                              <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="font-semibold text-slate-800">{item.receipt.extractedItems.length} item terekam</span>
                                <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                                  {item.receipt.extractedItems.map(it => it.name).slice(0, 2).join(', ')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px] italic">Tidak ada rincian baris</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono text-xs tabular-nums">
                            {formatRupiah(item.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Menunggu Jurnal</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Sudah Dibukukan</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {hasDrive ? (
                              <a
                                href={item.googleDriveLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
                                title="Buka berkas di Google Drive"
                              >
                                <span>Drive</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">Lokal</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('auto-journal')}
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold rounded border border-amber-200 inline-flex items-center gap-1 cursor-pointer"
                                  title="Proses pembukuan jurnal berkas ini"
                                >
                                  <span>Jurnal</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                              {isPending ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Hapus berkas rekaman ${item.refNumber}?`)) {
                                      deleteRecordedReceipt(item.id);
                                      setRecordedReceipts(getRecordedReceipts());
                                    }
                                  }}
                                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                  title="Hapus Rekaman Berkas"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : item.transaction ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (window.confirm(`Hapus transaksi pembukuan ${item.refNumber}?`)) {
                                      const res = await deleteTransaction(item.transaction!.id);
                                      if (!res.success) {
                                        alert(res.error || 'Gagal menghapus transaksi dari database.');
                                      }
                                    }
                                  }}
                                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                  title="Hapus Transaksi"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Menampilkan <strong className="text-slate-900">{filteredUnifiedHistory.length}</strong> dari <strong className="text-slate-900">{unifiedHistoryItems.length}</strong> total berkas &amp; transaksi
              </div>
              <div className="flex items-center gap-4">
                <div>
                  Total Akumulasi: <strong className="font-mono text-slate-900 font-bold">{formatRupiah(totalHistoryDebit)}</strong>
                </div>
                <a
                  href={SPREADSHEET_CONFIG.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold"
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
      {/* MODAL KONFIGURASI BOT GOOGLE APPS SCRIPT SPREADSHEET */}
      {/* ========================================================================= */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Konfigurasi Bot Google Apps Script</h3>
                  <p className="text-[11px] text-slate-500">
                    Otomatis mengisi tabel Spreadsheet <span className="font-semibold text-emerald-700">"datasheet_bukti_transaksi"</span> (Sheet: main, Baris A6 s.d. K6 ke bawah)
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsWebhookModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-emerald-950 text-[11px] leading-relaxed space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Format Resmi PT. Nirwana Bhumi Energy (A6 s.d. K6)</span>
                </div>
                <p>
                  Bot Google Apps Script dikonfigurasi presisi sesuai tabel resmi: Header dokumen berada di baris 1 s.d. 5, dan <strong>pengisian data transaksi dimulai tepat dari baris A6 hingga K6</strong> ke bawah secara berurutan dan aman tanpa menimpa header atau data sebelumnya.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px] pt-1">
                  <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                    <div className="font-bold text-slate-800 mb-0.5">📍 Target Kolom (A s.d. K):</div>
                    <div className="text-slate-600">A: No, B: Tgl, C: Bln, D: Thn, E: Nama Transaksi, F: Harga Satuan, G: Qty, H: Total, I: No Berkas, J: Link Berkas, K: POS.</div>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                    <div className="font-bold text-slate-800 mb-0.5">📌 Posisi Pengisian:</div>
                    <div className="text-slate-600">Mulai dari baris ke-6 (sel A6:K6), otomatis mendeteksi baris kosong berikutnya (A7, A8, dst.) dan menerapkan border hitam solid &amp; format Rupiah.</div>
                  </div>
                </div>
              </div>

              {/* URL Webhook Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  URL Web App / Webhook Apps Script:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={webhookInput}
                    onChange={(e) => setWebhookInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    disabled={isTestingWebhook || !webhookInput.trim()}
                    onClick={async () => {
                      setIsTestingWebhook(true);
                      setWebhookTestResult(null);
                      const res = await testSpreadsheetWebhook(webhookInput.trim());
                      setIsTestingWebhook(false);
                      setWebhookTestResult(res);
                    }}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                  >
                    {isTestingWebhook ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin" />
                        <span>Menguji...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                        <span>Uji Koneksi</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {webhookTestResult && (
                <div className={`p-3 rounded-xl text-xs font-medium border flex items-start gap-2 ${
                  webhookTestResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}>
                  {webhookTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                  <div>{webhookTestResult.message}</div>
                </div>
              )}

              {/* Panduan 3 Langkah Memasang Bot di Google Sheets */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">!</span>
                    <span>Cara Pasang Bot di Google Sheets (Hanya Sekali Setup):</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_BOT_CODE);
                      setIsCopiedBotCode(true);
                      setTimeout(() => setIsCopiedBotCode(false), 2500);
                    }}
                    className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer border border-indigo-200"
                  >
                    {isCopiedBotCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Kode Berhasil Disalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Kode Apps Script</span>
                      </>
                    )}
                  </button>
                </div>

                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 pl-1 leading-relaxed">
                  <li>
                    Buka Google Spreadsheet:{' '}
                    <a
                      href={SPREADSHEET_CONFIG.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-emerald-700 underline inline-flex items-center gap-0.5"
                    >
                      Buka datasheet_bukti_transaksi <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </li>
                  <li>
                    Di bilah menu atas Google Sheets, klik <strong>Ekstensi (Extensions)</strong> &gt; <strong>Apps Script</strong>.
                  </li>
                  <li>
                    Hapus semua tulisan di editor kode, lalu <strong>Paste (Tempel)</strong> kode bot yang telah disalin.
                  </li>
                  <li>
                    Klik tombol <strong>Terapkan (Deploy)</strong> &gt; <strong>Penerapan Baru (New Deployment)</strong>:
                    <div className="ml-5 mt-1 text-[10.5px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200 space-y-0.5">
                      <div>• Pilih jenis: <strong>Aplikasi Web (Web App)</strong> (ikon roda gigi).</div>
                      <div>• Deskripsi: <code>SPECTRA Spreadsheet Bot</code></div>
                      <div>• Jalankan sebagai (Execute as): <strong>Saya (email Anda)</strong></div>
                      <div>• Yang memiliki akses (Who has access): <strong>Siapa saja (Anyone)</strong></div>
                    </div>
                  </li>
                  <li>
                    Klik <strong>Terapkan (Deploy)</strong>, izinkan akses akun (Review permissions &gt; Advanced &gt; Go to script), lalu salin <strong>URL Aplikasi Web (berakhiran /exec)</strong> dan simpan ke formulir di atas.
                  </li>
                </ol>

                {/* Preview Kode Apps Script */}
                <details className="mt-2 text-[11px] text-slate-600">
                  <summary className="font-semibold text-indigo-700 cursor-pointer hover:underline select-none">
                    Tampilkan Cuplikan Kode Apps Script (google_apps_script_bot.js)
                  </summary>
                  <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10px] overflow-x-auto max-h-48 leading-relaxed">
                    {GOOGLE_APPS_SCRIPT_BOT_CODE}
                  </pre>
                </details>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <a
                href={SPREADSHEET_CONFIG.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
              >
                <span>Buka Spreadsheet Google</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              </a>

              <div className="flex items-center gap-2">
                {webhookInput && (
                  <button
                    type="button"
                    onClick={() => {
                      saveSpreadsheetWebhookUrl('');
                      setWebhookInput('');
                      setWebhookTestResult({ success: true, message: 'URL Webhook berhasil dihapus dari browser.' });
                    }}
                    className="px-3 py-2 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Hapus
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    saveSpreadsheetWebhookUrl(webhookInput.trim());
                    setIsWebhookModalOpen(false);
                    alert(webhookInput.trim() ? 'URL Webhook Google Apps Script berhasil disimpan!' : 'URL Webhook dikosongkan.');
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Simpan URL Webhook
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI RESET SELURUH TRANSAKSI & NOMOR BERKAS KE 1 */}
      {/* ========================================================================= */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Reset Seluruh Transaksi &amp; Nomor Berkas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mulai ulang nomor berkas dari hitungan 1 dan bersihkan database
                  </p>
                </div>
              </div>
              <button 
                type="button"
                disabled={isResettingTransactions}
                onClick={() => {
                  if (!isResettingTransactions) {
                    setIsResetModalOpen(false);
                    setResetFeedback(null);
                  }
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Reset Sequence Pill */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Urutan Berkas Selanjutnya</span>
                <span className="text-xs text-slate-700">Kode saat ini: <strong className="font-mono text-slate-900">{nomorBerkas}</strong></span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Setelah Reset</span>
                <span className="text-sm font-mono font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {generateFileCode(1)}
                </span>
              </div>
            </div>

            {/* Konsekuensi Tindakan */}
            <div className="space-y-2.5 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">
                Tindakan ini akan mengeksekusi pembersihan total pada 4 lapisan sistem:
              </p>
              <ul className="space-y-2 pl-1">
                <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
                  <div>
                    <strong className="text-slate-800">Database Lokal &amp; Supabase Cloud:</strong> Seluruh transaksi jurnal akuntansi dihapus total (0 transaksi).
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                  <div>
                    <strong className="text-slate-800">Google Spreadsheet ("datasheet_bukti_transaksi"):</strong> Baris data transaksi dari sel <strong>A6</strong> ke bawah dikosongkan bersih. Header resmi baris 1 s.d. 5 tetap terlindungi.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</div>
                  <div>
                    <strong className="text-slate-800">Google Drive:</strong> Berkas bukti transfer &amp; nota fisik di folder Google Drive tetap tersimpan aman (tidak dihapus otomatis).
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">4</div>
                  <div>
                    <strong className="text-slate-800">Generator Nomor Bukti:</strong> Direset kembali ke hitungan awal <strong>1</strong> (<span className="font-mono text-slate-800 font-semibold">{generateFileCode(1)}</span>).
                  </div>
                </li>
              </ul>
            </div>

            {/* Feedback / Alert */}
            {resetFeedback && (
              <div className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                resetFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                {resetFeedback.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{resetFeedback.message}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isResettingTransactions}
                onClick={() => {
                  setIsResetModalOpen(false);
                  setResetFeedback(null);
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isResettingTransactions}
                onClick={handleConfirmReset}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isResettingTransactions ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengeksekusi Reset...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus &amp; Reset ke Hitungan 1</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
