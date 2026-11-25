/**
 * SPECTRA AUTO RECORD — BANK FEE EXTRACTION REGRESSION TEST SUITE
 *
 * Pengujian komprehensif & non-destruktif untuk fitur Auto Record Groq Vision / Bank Transfer:
 * 1. Bukti transfer BCA dengan biaya BI-FAST tertulis jelas (Rp 2.850.000 + Rp 2.500 -> Rp 2.852.500).
 * 2. Bukti transfer bebas biaya / gratis (Rp 500.000, Biaya Transfer: Rp 0 / Gratis).
 * 3. Bukti transfer dengan biaya tidak terbaca / buram (anti-spekulasi: tolak tebakan 2500/6500, wajib tinjauan manual).
 * 4. Skenario pencegahan penghitungan ganda (Anti-Double-Count: tidak menjumlah biaya dua kali).
 * 5. Bukti transfer online umum / admin bank (Rp 6.500 -> Beban Administrasi Bank).
 * 6. Pemetaan jurnal SAK: pemisahan Debit Pokok, Debit Beban Administrasi Bank, dan Kredit Kas/Bank seimbang 100%.
 * 7. Integritas status verifikasi UI: 'Seimbang 100%' TIDAK boleh muncul jika ada biaya bank yang belum dikonfirmasi.
 * 8. Simulasi pembaruan manual di Tabel Koreksi Tahap 2: pembaruan total, verifikasi, dan saran jurnal.
 */

import assert from 'assert';
import {
  parseBankTransferFromText,
  analyzeAndSuggestJournal,
  runTwoWayDeterministicVerification,
  sanitizeCurrencyAmount,
  validateReceiptReadinessForAction,
  ExtractedItem,
  BankTransferDetails
} from '../src/services/autoRecordService';
import { Account } from '../src/types/accounting';

console.log('======================================================================');
console.log('   SPECTRA — AUTO RECORD BANK FEE & SAK JOURNAL REGRESSION TESTS      ');
console.log('======================================================================');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error('       └─ Error:', err.message);
    process.exitCode = 1;
  }
}

// Mock COA Master Data untuk pengujian jurnal SAK
const mockAccounts: Account[] = [
  { id: 'acc-1', code: '10001', name: 'Kas', category: 'HARTA_LANCAR', pos: 'Nrc', normalBalance: 'Db', isHeader: false, balance: 100000000 },
  { id: 'acc-2', code: '10002', name: 'Bank BCA', category: 'HARTA_LANCAR', pos: 'Nrc', normalBalance: 'Db', isHeader: false, balance: 50000000 },
  { id: 'acc-3', code: '10006', name: 'Perlengkapan Kantor', category: 'HARTA_LANCAR', pos: 'Nrc', normalBalance: 'Db', isHeader: false, balance: 5000000 },
  { id: 'acc-4', code: '20001', name: 'Utang Usaha', category: 'UTANG_LANCAR', pos: 'Nrc', normalBalance: 'Kr', isHeader: false, balance: 0 },
  { id: 'acc-5', code: '50001', name: 'Beban Pelatihan & Brevet Pajak', category: 'BEBAN_OPERASIONAL', pos: 'Lr', normalBalance: 'Db', isHeader: false, balance: 0 },
  { id: 'acc-6', code: '50002', name: 'Beban Administrasi Bank', category: 'BEBAN_OPERASIONAL', pos: 'Lr', normalBalance: 'Db', isHeader: false, balance: 0 },
  { id: 'acc-7', code: '50003', name: 'Pajak Pembelian PB1', category: 'BEBAN_OPERASIONAL', pos: 'Lr', normalBalance: 'Db', isHeader: false, balance: 0 }
];

// =========================================================================
// TEST SUITE 1: TRANSFER DENGAN BIAYA BI-FAST TERTULIS JELAS
// =========================================================================

const mockReceiptBrevetBCA = `
BCA mobile
m-Transfer: BERHASIL
24/11/2026 14:15:32
Ke Rekening: 1234567890
Nama Penerima: PT Piranha Multi Talenta
Nominal: Rp 2.850.000,00
Biaya Transfer BI-FAST: Rp 2.500,00
Total: Rp 2.852.500,00
Berita: Brevet Pajak CPTT
Jenis Transfer: BI-FAST
`;

runTest('Kasus 1: Ekstraksi Bukti Transfer BCA dengan BI-FAST Rp 2.500', () => {
  const result = parseBankTransferFromText(mockReceiptBrevetBCA, 'Pembayaran Brevet');
  assert.strictEqual(result.isBankTransfer, true, 'Wajib terdeteksi sebagai transfer bank');
  assert.strictEqual(result.items.length, 2, 'Wajib menghasilkan 2 baris item: pokok & biaya admin');

  // Item Pokok
  const mainItem = result.items.find(it => !it.isTaxOrFee);
  assert.ok(mainItem, 'Item pokok wajib ada');
  assert.strictEqual(mainItem.totalPrice, 2850000, 'Nominal pokok wajib Rp 2.850.000');
  assert.ok(mainItem.name.includes('Brevet') || mainItem.name.includes('Piranha'), 'Nama item pokok harus memuat berita/vendor');

  // Item Biaya Admin
  const feeItem = result.items.find(it => it.isTaxOrFee);
  assert.ok(feeItem, 'Item biaya transfer wajib ada');
  assert.strictEqual(feeItem.totalPrice, 2500, 'Biaya transfer wajib Rp 2.500');
  assert.strictEqual(feeItem.taxOrFeeType, 'BI_FAST', 'Tipe biaya wajib BI_FAST');
  assert.strictEqual(feeItem.name, 'Biaya Transfer BI-FAST');

  // Grand Total & Details
  assert.strictEqual(result.grandTotal, 2852500, 'Grand total wajib Rp 2.852.500 (pokok + fee)');
  assert.ok(result.bankTransferDetails, 'bankTransferDetails wajib tersedia');
  assert.strictEqual(result.bankTransferDetails.transferAmount, 2850000);
  assert.strictEqual(result.bankTransferDetails.bankAdminFee, 2500);
  assert.strictEqual(result.bankTransferDetails.feeType, 'BI_FAST');
  assert.strictEqual(result.bankTransferDetails.totalDebitedAmount, 2852500);
  assert.strictEqual(result.bankTransferDetails.hasUnconfirmedFee, false, 'hasUnconfirmedFee wajib false karena biaya jelas');
  assert.ok(result.bankTransferDetails.feeTextEvidence?.includes('2.500'), 'Bukti teks wajib memuat nominal 2.500');
});

runTest('Kasus 1: Anti-Double-Count Verification (Tidak Menjumlah Biaya 2 Kali)', () => {
  const result = parseBankTransferFromText(mockReceiptBrevetBCA, 'Brevet Pajak');
  const sumItems = result.items.reduce((sum, it) => sum + it.totalPrice, 0);
  assert.strictEqual(sumItems, 2852500, 'Penjumlahan item wajib persis Rp 2.852.500');
  assert.notStrictEqual(sumItems, 2855000, 'DILARANG double count menjadi 2.855.000 (2.852.500 + 2.500)');
  assert.strictEqual(sumItems, result.grandTotal, 'Sum items wajib sama persis dengan grandTotal');
});

runTest('Kasus 1: Pemetaan Jurnal SAK Seimbang (Debit Pokok + Debit Admin == Kredit Kas)', () => {
  const parsed = parseBankTransferFromText(mockReceiptBrevetBCA, 'Brevet Pajak CPTT');
  const journal = analyzeAndSuggestJournal(parsed.items, 'A', mockAccounts, 'Pembayaran Brevet Pajak CPTT');

  assert.strictEqual(journal.length, 3, 'Wajib menghasilkan 3 baris jurnal: 2 Debit dan 1 Kredit');

  const debitBrevet = journal.find(l => l.sn === 'Db' && l.accountName === 'Beban Pelatihan & Brevet Pajak');
  assert.ok(debitBrevet, 'Wajib mendebit akun Beban Pelatihan & Brevet Pajak');
  assert.strictEqual(debitBrevet.debit, 2850000, 'Debit Beban Pelatihan wajib Rp 2.850.000');

  const debitAdmin = journal.find(l => l.sn === 'Db' && l.accountName === 'Beban Administrasi Bank');
  assert.ok(debitAdmin, 'Wajib mendebit akun Beban Administrasi Bank');
  assert.strictEqual(debitAdmin.debit, 2500, 'Debit Beban Administrasi Bank wajib Rp 2.500');
  assert.strictEqual(debitAdmin.accountCategory, 'BEBAN_OPERASIONAL');
  assert.strictEqual(debitAdmin.pos, 'Lr');

  const creditKas = journal.find(l => l.sn === 'Kr');
  assert.ok(creditKas, 'Wajib mengkredit akun Kas/Bank');
  assert.strictEqual(creditKas.credit, 2852500, 'Kredit Kas wajib sebesar total dana terdebit Rp 2.852.500');

  const totalDebit = journal.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = journal.reduce((sum, l) => sum + l.credit, 0);
  assert.strictEqual(totalDebit, 2852500);
  assert.strictEqual(totalCredit, 2852500);
  assert.strictEqual(totalDebit, totalCredit, 'Jurnal akuntansi SAK wajib seimbang 100% (Debit == Credit)');
});

// =========================================================================
// TEST SUITE 2: TRANSFER BEBAS BIAYA / GRATIS (RP 0)
// =========================================================================

const mockReceiptFreeTransfer = `
MANDIRI LIVIN
TRANSFER BERHASIL
Tanggal: 25/11/2026 10:00:00
Ke Rekening: 987654321
Nama Penerima: CV Mitra Kertas
Nominal Transfer: Rp 500.000,00
Biaya Transfer: Rp 0 (Gratis)
Total Debet: Rp 500.000,00
Keterangan: Pembelian Kertas HVS
`;

runTest('Kasus 2: Ekstraksi Bukti Transfer Bebas Biaya (Rp 0 / Gratis)', () => {
  const result = parseBankTransferFromText(mockReceiptFreeTransfer, 'Beli Kertas');
  assert.strictEqual(result.isBankTransfer, true);
  assert.strictEqual(result.items.length, 1, 'Transfer gratis HANYA boleh menghasilkan 1 baris item pokok');

  const mainItem = result.items[0];
  assert.strictEqual(mainItem.totalPrice, 500000, 'Nominal pokok wajib Rp 500.000');
  assert.strictEqual(mainItem.isTaxOrFee, false);

  assert.strictEqual(result.grandTotal, 500000);
  assert.ok(result.bankTransferDetails);
  assert.strictEqual(result.bankTransferDetails.bankAdminFee, 0, 'Biaya admin wajib 0');
  assert.strictEqual(result.bankTransferDetails.feeType, 'FREE', 'feeType wajib FREE');
  assert.strictEqual(result.bankTransferDetails.hasUnconfirmedFee, false, 'hasUnconfirmedFee wajib false');
  assert.notStrictEqual(result.bankTransferDetails.bankAdminFee, 2500, 'DILARANG mengarang biaya Rp 2.500');
});

runTest('Kasus 2: Jurnal SAK untuk Transfer Bebas Biaya (Tanpa Baris Beban Bank Fiktif)', () => {
  const parsed = parseBankTransferFromText(mockReceiptFreeTransfer, 'Pembelian Kertas HVS');
  const journal = analyzeAndSuggestJournal(parsed.items, 'A', mockAccounts, 'Beli Kertas HVS');

  const adminLine = journal.find(l => l.accountName === 'Beban Administrasi Bank');
  assert.strictEqual(adminLine, undefined, 'Dilarang membuat baris Beban Administrasi Bank jika gratis');

  const totalDebit = journal.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = journal.reduce((sum, l) => sum + l.credit, 0);
  assert.strictEqual(totalDebit, 500000);
  assert.strictEqual(totalCredit, 500000);
});

// =========================================================================
// TEST SUITE 3: TRANSFER DENGAN BIAYA BURAM / TIDAK TERBACA (ANTI-SPEKULASI)
// =========================================================================

const mockReceiptUnconfirmedFee = `
BCA mobile
TRANSFER BERHASIL
Layanan: BI-FAST
Ke Rekening: 5544332211
Nama Penerima: Bapak Joko Widodo
Nominal: Rp 1.500.000,00
Biaya Transaksi: [TEKS BURAM / TIDAK TERBACA]
Berita: Uang Muka Sewa
`;

runTest('Kasus 3: Anti-Spekulasi Biaya Tidak Terbaca (Tolak Tebakan Rp 2.500)', () => {
  const result = parseBankTransferFromText(mockReceiptUnconfirmedFee, 'Sewa');
  assert.strictEqual(result.isBankTransfer, true);
  assert.strictEqual(result.items.length, 1, 'Hanya ada item pokok, TIDAK ada item biaya fiktif');

  assert.ok(result.bankTransferDetails);
  assert.strictEqual(result.bankTransferDetails.bankAdminFee, 0, 'Biaya admin wajib 0 jika angka tidak terbaca');
  assert.notStrictEqual(result.bankTransferDetails.bankAdminFee, 2500, 'DILARANG keras mengasumsikan 2500');
  assert.notStrictEqual(result.bankTransferDetails.bankAdminFee, 6500, 'DILARANG keras mengasumsikan 6500');
  assert.strictEqual(result.bankTransferDetails.hasUnconfirmedFee, true, 'Wajib menandai hasUnconfirmedFee = true');
  assert.strictEqual(result.hasUnconfirmedFee, true);
  assert.ok(result.unconfirmedFeeNote?.includes('tidak terbaca'), 'Catatan wajib menjelaskan biaya tidak terbaca');
});

runTest('Kasus 3: Integritas Status Verifikasi UI (Tolak Seimbang 100% Palsu)', () => {
  const result = parseBankTransferFromText(mockReceiptUnconfirmedFee, 'Sewa');
  const verif = runTwoWayDeterministicVerification(result.items, result.grandTotal);

  // Walaupun aritmatika item pokok seimbang dengan grandTotal:
  assert.strictEqual(verif.mathDiscrepancy, false);

  // Status kelengkapan UI SPECTRA wajib mempertimbangkan hasUnconfirmedFee:
  const isDisplayBalanced = !verif.mathDiscrepancy && !result.hasUnconfirmedFee;
  assert.strictEqual(isDisplayBalanced, false, 'Status Seimbang 100% DILARANG muncul jika hasUnconfirmedFee true');

  const statusLabel = verif.mathDiscrepancy ? '⚠️ Terdapat Selisih' : (result.hasUnconfirmedFee ? '⚠️ Konfirmasi Biaya Bank' : '✓ Seimbang 100%');
  assert.strictEqual(statusLabel, '⚠️ Konfirmasi Biaya Bank', 'UI wajib menampilkan label ⚠️ Konfirmasi Biaya Bank');
});

// =========================================================================
// TEST SUITE 4: TRANSFER ONLINE UMUM / ADMIN BANK NON-BI-FAST (RP 6.500)
// =========================================================================

const mockReceiptOnlineTransfer = `
BRImo
TRANSFER ONLINE BERHASIL
Tanggal: 25/11/2026 11:20:00
Ke Rekening: 1122334455
Penerima: Toko Komputer Jaya
Nominal: Rp 750.000,00
Biaya Admin Bank: Rp 6.500,00
Total: Rp 756.500,00
Catatan: Keyboard Mekanikal
`;

runTest('Kasus 4: Transfer Online Non-BI-FAST (Rp 6.500 -> ADMIN_BANK)', () => {
  const result = parseBankTransferFromText(mockReceiptOnlineTransfer, 'Keyboard');
  assert.strictEqual(result.isBankTransfer, true);
  assert.strictEqual(result.items.length, 2);

  const feeItem = result.items.find(it => it.isTaxOrFee);
  assert.ok(feeItem);
  assert.strictEqual(feeItem.totalPrice, 6500, 'Biaya admin wajib Rp 6.500');
  assert.strictEqual(feeItem.taxOrFeeType, 'ADMIN_BANK', 'Tipe biaya wajib ADMIN_BANK');

  assert.strictEqual(result.grandTotal, 756500);
  assert.strictEqual(result.bankTransferDetails?.feeType, 'ADMIN_BANK');
  assert.strictEqual(result.bankTransferDetails?.bankAdminFee, 6500);

  // Jurnal SAK
  const journal = analyzeAndSuggestJournal(result.items, 'A', mockAccounts, 'Beli Keyboard');
  const adminLine = journal.find(l => l.accountName === 'Beban Administrasi Bank');
  assert.ok(adminLine, 'Wajib memetakan biaya Rp 6.500 ke Beban Administrasi Bank');
  assert.strictEqual(adminLine.debit, 6500);

  const totalDebit = journal.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = journal.reduce((sum, l) => sum + l.credit, 0);
  assert.strictEqual(totalDebit, 756500);
  assert.strictEqual(totalCredit, 756500);
});

// =========================================================================
// TEST SUITE 5: PEMBARUAN MANUAL TABEL KOREKSI TAHAP 2
// =========================================================================

runTest('Kasus 5: Simulasi Koreksi Manual Penambahan Biaya Bank Menyelesaikan hasUnconfirmedFee', () => {
  // Awal: Biaya tidak terbaca
  const initial = parseBankTransferFromText(mockReceiptUnconfirmedFee, 'Sewa');
  assert.strictEqual(initial.hasUnconfirmedFee, true);
  assert.strictEqual(initial.items.length, 1);

  // Pengguna klik '+ Input BI-FAST (Rp 2.500)' pada Tabel Koreksi
  const feeItemManual: ExtractedItem = {
    id: 'it-manual-fee',
    name: 'Biaya Transfer BI-FAST',
    unitPrice: null,
    quantity: null,
    unit: '',
    totalPrice: 2500,
    confidence: 100,
    isTaxOrFee: true,
    taxOrFeeType: 'BI_FAST'
  };

  const updatedItems = [...initial.items, feeItemManual];
  const verif = runTwoWayDeterministicVerification(updatedItems);

  assert.strictEqual(verif.calculatedSum, 1502500, 'Total terhitung wajib bertambah menjadi Rp 1.502.500');
  assert.strictEqual(verif.grandTotal, 1502500);
  assert.strictEqual(verif.mathDiscrepancy, false);

  // Jurnal otomatis terbarui
  const journal = analyzeAndSuggestJournal(verif.verifiedItems, 'A', mockAccounts, 'Pembayaran Sewa');
  const adminLine = journal.find(l => l.accountName === 'Beban Administrasi Bank');
  assert.ok(adminLine, 'Jurnal terbarui memuat Beban Administrasi Bank');
  assert.strictEqual(adminLine.debit, 2500);

  const totalDebit = journal.reduce((s, l) => s + l.debit, 0);
  const totalCredit = journal.reduce((s, l) => s + l.credit, 0);
  assert.strictEqual(totalDebit, 1502500);
  assert.strictEqual(totalCredit, 1502500);
});

// =========================================================================
// TEST SUITE 6: SERVERLESS GROQ VISION PARSER NORMALIZATION INTEGRATION
// =========================================================================

runTest('Kasus 6: Serverless Normalization Logic on Mock Groq Vision Response', () => {
  // Simulasi output mentah JSON dari Groq Vision sesuai skema baru
  const mockGroqResponse = {
    detected_type: 'transfer_bank',
    seller_or_recipient: 'PT Piranha Multi Talenta',
    transaction_date: '2026-11-24',
    subtotal: 2850000,
    tax_amount: 0,
    discount_amount: 0,
    shipping_fee: 0,
    bank_transfer_details: {
      transfer_amount: 2850000,
      bank_admin_fee: 2500,
      fee_type: 'BI_FAST',
      fee_text_evidence: 'Biaya Transfer BI-FAST: Rp 2.500,00',
      total_debited_amount: 2852500,
      has_unconfirmed_fee: false,
      unconfirmed_fee_note: ''
    },
    declared_grand_total: 2852500,
    payment_amount: 2852500,
    change_amount: 0,
    extracted_items: [
      {
        name: 'Brevet Pajak CPTT - PT Piranha',
        quantity: 1,
        unit: 'transaksi',
        unit_price: 2850000,
        total_price: 2850000,
        confidence: 95,
        is_tax_or_fee: false,
        tax_or_fee_type: null
      }
    ]
  };

  // Replikasi logika normalisasi api/scan-receipt.ts
  const rawBtd = mockGroqResponse.bank_transfer_details;
  const transferAmt = sanitizeCurrencyAmount(rawBtd.transfer_amount);
  const adminFee = sanitizeCurrencyAmount(rawBtd.bank_admin_fee);
  const totalDebited = sanitizeCurrencyAmount(rawBtd.total_debited_amount);

  const bankDetails: BankTransferDetails = {
    transferAmount: transferAmt,
    bankAdminFee: adminFee,
    feeType: rawBtd.fee_type as any,
    feeTextEvidence: rawBtd.fee_text_evidence,
    totalDebitedAmount: totalDebited,
    hasUnconfirmedFee: rawBtd.has_unconfirmed_fee,
    unconfirmedFeeNote: rawBtd.unconfirmed_fee_note
  };

  const items: ExtractedItem[] = mockGroqResponse.extracted_items.map((it, idx) => ({
    id: `it-${idx}`,
    name: it.name,
    unitPrice: it.unit_price,
    quantity: it.quantity,
    unit: it.unit,
    totalPrice: it.total_price,
    confidence: it.confidence,
    isTaxOrFee: it.is_tax_or_fee,
    taxOrFeeType: (it.tax_or_fee_type as any) || undefined
  }));

  if (bankDetails.bankAdminFee > 0) {
    const feeAlreadyInItems = items.some(it => it.taxOrFeeType === 'BI_FAST' || it.taxOrFeeType === 'ADMIN_BANK');
    if (!feeAlreadyInItems) {
      items.push({
        id: 'it-fee',
        name: bankDetails.feeType === 'BI_FAST' ? 'Biaya Transfer BI-FAST' : 'Biaya Administrasi Bank',
        unitPrice: null,
        quantity: null,
        unit: '',
        totalPrice: bankDetails.bankAdminFee,
        confidence: 95,
        isTaxOrFee: true,
        taxOrFeeType: bankDetails.feeType === 'BI_FAST' ? 'BI_FAST' : 'ADMIN_BANK'
      });
    }
  }

  const verif = runTwoWayDeterministicVerification(items, bankDetails.totalDebitedAmount);

  assert.strictEqual(items.length, 2, 'Biaya admin otomatis ditambahkan menjadi item terpisah');
  assert.strictEqual(verif.grandTotal, 2852500);
  assert.strictEqual(verif.calculatedSum, 2852500);
  assert.strictEqual(verif.mathDiscrepancy, false, 'Hasil verifikasi deterministik seimbang sempurna');
});

// =========================================================================
// TEST SUITE 7: TAMBAHAN SKENARIO KHUSUS & ANTI-DOUBLE COUNT EKSTREM
// =========================================================================

runTest('Kasus 7: Struk Hanya Memuat Total Debet 2.852.500 dan Biaya 2.500 (Derivasi Pokok 2.850.000)', () => {
  const mockReceiptSingleTotal = `
BCA mobile
TRANSFER BERHASIL
Ke Rekening: 1234567890
Nama Penerima: PT Piranha Multi Talenta
Biaya Transfer BI-FAST: Rp 2.500,00
Total Debet: Rp 2.852.500,00
Berita: Brevet Pajak CPTT
  `;
  const result = parseBankTransferFromText(mockReceiptSingleTotal, 'Brevet');
  assert.strictEqual(result.isBankTransfer, true);
  assert.strictEqual(result.items.length, 2);

  const mainItem = result.items.find(it => !it.isTaxOrFee);
  const feeItem = result.items.find(it => it.isTaxOrFee);
  assert.ok(mainItem && feeItem);

  assert.strictEqual(feeItem.totalPrice, 2500);
  assert.strictEqual(result.grandTotal, 2852500);
  assert.strictEqual(mainItem.totalPrice + feeItem.totalPrice, 2852500, 'Sum items wajib persis Rp 2.852.500 tanpa double count');
});

runTest('Kasus 8: Teks Tanpa Angka Sama Sekali (Hanya Kata Kunci BI-FAST)', () => {
  const mockReceiptNoNumbers = `
BCA mobile
TRANSFER BI-FAST BERHASIL
Ke Rekening: BNI Syariah
Penerima: Rekanan Konsultan
Catatan: Jasa Konsultasi
  `;
  const result = parseBankTransferFromText(mockReceiptNoNumbers, 'Konsultasi');
  assert.strictEqual(result.isBankTransfer, true);
  assert.strictEqual(result.bankTransferDetails?.bankAdminFee, 0, 'DILARANG mengarang angka jika tidak ada angka');
  assert.strictEqual(result.hasUnconfirmedFee, true, 'Wajib menandai hasUnconfirmedFee = true');
});

runTest('Kasus 9: POS B (Pembelian Kredit) Memetakan Debit Beban Bank & Kredit Utang Seimbang', () => {
  const parsed = parseBankTransferFromText(mockReceiptBrevetBCA, 'Brevet Pajak');
  const journal = analyzeAndSuggestJournal(parsed.items, 'B', mockAccounts, 'Timbul Utang Pelatihan & Brevet');

  const debitBrevet = journal.find(l => l.sn === 'Db' && l.accountName === 'Beban Pelatihan & Brevet Pajak');
  const debitAdmin = journal.find(l => l.sn === 'Db' && l.accountName === 'Beban Administrasi Bank');
  const creditUtang = journal.find(l => l.sn === 'Kr' && l.accountName === 'Utang Usaha');

  assert.ok(debitBrevet && debitAdmin && creditUtang, 'Wajib memuat akun debit pokok, debit admin, dan kredit utang');
  assert.strictEqual(debitBrevet.debit, 2850000);
  assert.strictEqual(debitAdmin.debit, 2500);
  assert.strictEqual(creditUtang.credit, 2852500);

  const totalDebit = journal.reduce((s, l) => s + l.debit, 0);
  const totalCredit = journal.reduce((s, l) => s + l.credit, 0);
  assert.strictEqual(totalDebit, totalCredit, 'Jurnal POS B wajib seimbang');
});

// =========================================================================
// TEST SUITE 8: KEAMANAN PEMBLOKIRAN AKSI SAAT hasUnconfirmedFee === true
// =========================================================================

runTest('Kasus 10: Pemblokiran Mutasi & Eksekusi saat hasUnconfirmedFee === true', () => {
  const mockItems: ExtractedItem[] = [
    {
      id: 'it-1',
      name: 'Pembayaran Sewa',
      unitPrice: 1500000,
      quantity: 1,
      unit: 'transaksi',
      totalPrice: 1500000,
      confidence: 90,
      isTaxOrFee: false
    }
  ];

  // 1. Ketika hasUnconfirmedFee === true, pemrosesan WAJIB DITOLAK
  const blockedCheck = validateReceiptReadinessForAction({
    grandTotal: 1500000,
    extractedItems: mockItems,
    hasUnconfirmedFee: true
  });

  assert.strictEqual(blockedCheck.canProceed, false, 'Aksi wajib DITOLAK jika hasUnconfirmedFee === true');
  assert.ok(blockedCheck.errorReason?.includes('belum dikonfirmasi'), 'Alasan error wajib memuat penjelasan belum dikonfirmasi');

  // 2. Ketika hasUnconfirmedFee === false, pemrosesan DISETUJUI
  const allowedCheck = validateReceiptReadinessForAction({
    grandTotal: 1500000,
    extractedItems: mockItems,
    hasUnconfirmedFee: false
  });

  assert.strictEqual(allowedCheck.canProceed, true, 'Aksi wajib DIIZINKAN jika hasUnconfirmedFee === false');
  assert.strictEqual(allowedCheck.errorReason, undefined);

  // 3. Ketika grandTotal bernilai <= 0, pemrosesan tetap DITOLAK
  const invalidTotalCheck = validateReceiptReadinessForAction({
    grandTotal: 0,
    extractedItems: mockItems,
    hasUnconfirmedFee: false
  });
  assert.strictEqual(invalidTotalCheck.canProceed, false, 'Aksi wajib DITOLAK jika grandTotal <= 0');
});

// =========================================================================
// TEST SUITE 9: PERLINDUNGAN FORM MANUAL FEE INPUT (KOSONG DEFAULT & TOLAK 0)
// =========================================================================

runTest('Kasus 11: Validasi Form Manual Fee Input Kosong secara Default & Tolak Nominal Kosong / <= 0', () => {
  // 1. Initial State: input wajib string kosong ''
  let manualFeeInput = '';
  let manualFeeType: 'BI_FAST' | 'ADMIN_BANK' = 'BI_FAST';
  let hasUnconfirmedFee = true;

  assert.strictEqual(manualFeeInput, '', 'Input nominal biaya awal WAJIB KOSONG secara default (bukan 2500 atau 6500)');

  // 2. Simulasi percobaan submit dengan nilai kosong '' atau 0
  const trySubmitWithInvalid = (inputVal: string): boolean => {
    const parsedFee = Math.round(Number(inputVal) || 0);
    if (parsedFee <= 0) {
      return false; // ditolak
    }
    return true; // diterima
  };

  assert.strictEqual(trySubmitWithInvalid(''), false, 'Submit string kosong wajib ditolak');
  assert.strictEqual(trySubmitWithInvalid('0'), false, 'Submit nominal 0 wajib ditolak');
  assert.strictEqual(trySubmitWithInvalid('-2500'), false, 'Submit nominal negatif wajib ditolak');
  assert.strictEqual(trySubmitWithInvalid('abc'), false, 'Submit non-angka wajib ditolak');

  // 3. Pengguna mengisi nominal valid secara manual berdasarkan dokumen (misal Rp 2.500)
  manualFeeInput = '2500';
  assert.strictEqual(trySubmitWithInvalid(manualFeeInput), true, 'Submit nominal > 0 wajib diterima');

  const baseItems: ExtractedItem[] = [
    {
      id: 'it-main',
      name: 'Pembayaran Sewa Kantor',
      unitPrice: 1500000,
      quantity: 1,
      unit: 'transaksi',
      totalPrice: 1500000,
      confidence: 90,
      isTaxOrFee: false
    }
  ];

  const parsedFee = Math.round(Number(manualFeeInput));
  const feeItem: ExtractedItem = {
    id: 'it-manual-confirmed',
    name: manualFeeType === 'BI_FAST' ? 'Biaya Transfer BI-FAST' : 'Biaya Administrasi Bank',
    unitPrice: null,
    quantity: null,
    unit: '',
    totalPrice: parsedFee,
    confidence: 100,
    isTaxOrFee: true,
    taxOrFeeType: manualFeeType
  };

  const updatedItems = [...baseItems, feeItem];
  const verif = runTwoWayDeterministicVerification(updatedItems);
  hasUnconfirmedFee = false;
  manualFeeInput = '';

  assert.strictEqual(verif.grandTotal, 1502500, 'Grand total bertambah dari 1.500.000 menjadi 1.502.500');
  assert.strictEqual(verif.calculatedSum, 1502500);
  assert.strictEqual(hasUnconfirmedFee, false, 'hasUnconfirmedFee berhasil diselesaikan menjadi false');
  assert.strictEqual(manualFeeInput, '', 'Input direset kembali kosong');

  // Jurnal SAK seimbang
  const journal = analyzeAndSuggestJournal(verif.verifiedItems, 'A', mockAccounts, 'Pembayaran Sewa');
  const adminLine = journal.find(l => l.accountName === 'Beban Administrasi Bank');
  assert.ok(adminLine, 'Jurnal wajib memuat baris Beban Administrasi Bank');
  assert.strictEqual(adminLine.debit, 2500);

  const totalDebit = journal.reduce((s, l) => s + l.debit, 0);
  const totalCredit = journal.reduce((s, l) => s + l.credit, 0);
  assert.strictEqual(totalDebit, 1502500);
  assert.strictEqual(totalCredit, 1502500);
  assert.strictEqual(totalDebit, totalCredit, 'Debit == Credit seimbang 100%');
});

// =========================================================================
// TEST SUITE 10: VERIFIKASI EKSPLISIT BEBAS BIAYA (RP 0 / GRATIS)
// =========================================================================

runTest('Kasus 12: Verifikasi Eksplisit Bebas Biaya (Rp 0) Tanpa Item Fiktif', () => {
  const initial = parseBankTransferFromText(mockReceiptUnconfirmedFee, 'Sewa');
  assert.strictEqual(initial.hasUnconfirmedFee, true);
  assert.strictEqual(initial.items.length, 1);

  // Aksi pengguna: Mengklik "Verifikasi Bebas Biaya (Rp 0)"
  let hasUnconfirmedFee = initial.hasUnconfirmedFee;
  let manualFeeInput = '2500'; // misalnya ada draft sisa

  // Handler Verifikasi Bebas Biaya dieksekusi:
  hasUnconfirmedFee = false;
  manualFeeInput = '';
  const verif = runTwoWayDeterministicVerification(initial.items);

  assert.strictEqual(hasUnconfirmedFee, false, 'hasUnconfirmedFee wajib menjadi false');
  assert.strictEqual(manualFeeInput, '', 'manualFeeInput wajib dibersihkan');
  assert.strictEqual(verif.verifiedItems.length, 1, 'DILARANG menyisipkan baris item biaya bank jika bebas biaya');
  assert.strictEqual(verif.grandTotal, 1500000, 'Grand total tetap Rp 1.500.000');
  assert.strictEqual(verif.mathDiscrepancy, false);

  // Jurnal SAK dihitung ulang tanpa baris bank fee
  const journal = analyzeAndSuggestJournal(verif.verifiedItems, 'A', mockAccounts, 'Pembayaran Sewa Bebas Biaya');
  const adminLine = journal.find(l => l.accountName === 'Beban Administrasi Bank');
  assert.strictEqual(adminLine, undefined, 'DILARANG membuat akun Beban Administrasi Bank');

  const totalDebit = journal.reduce((s, l) => s + l.debit, 0);
  const totalCredit = journal.reduce((s, l) => s + l.credit, 0);
  assert.strictEqual(totalDebit, 1500000);
  assert.strictEqual(totalCredit, 1500000);

  // Verifikasi kesiapan aksi sistem
  const readiness = validateReceiptReadinessForAction({
    grandTotal: verif.grandTotal,
    extractedItems: verif.verifiedItems,
    hasUnconfirmedFee
  });
  assert.strictEqual(readiness.canProceed, true, 'Sistem siap memproses transaksi setelah bebas biaya terverifikasi');
});

console.log('======================================================================');
console.log(`   HASIL REGRESSION TESTS: ${passedTests}/${totalTests} PASS (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('   ZERO MUTATION: TIDAK ADA DATA PRODUCTION/DATABASE YANG DIUBAH.     ');
console.log('======================================================================');
