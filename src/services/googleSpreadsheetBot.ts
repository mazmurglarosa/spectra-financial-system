/**
 * SPECTRA Google Spreadsheet Automation Bot Client
 *
 * Bertugas mengirimkan baris-baris data transaksi dari Auto Record
 * langsung ke Google Spreadsheet datasheet_bukti_transaksi (Sheet: main, Baris A6 s.d. K6 ke bawah)
 * melalui Google Apps Script Webhook.
 */

import { SpreadsheetRowData } from './autoRecordService.js';
import { isExternalSyncDisabledOnPreview, getExternalSyncStatus } from './externalSyncGuard.js';

export const SPREADSHEET_WEBHOOK_STORAGE_KEY = 'spectra_spreadsheet_webhook_url';
export const SPREADSHEET_SECRET_STORAGE_KEY = 'spectra_spreadsheet_bot_secret';

export const GOOGLE_APPS_SCRIPT_BOT_CODE = `/**
 * =========================================================================================
 * SPECTRA AUTOMATION BOT - GOOGLE APPS SCRIPT (HARDENED ENTERPRISE EDITION)
 * SINKRONISASI BUKTI TRANSAKSI KE SPREADSHEET (datasheet_bukti_transaksi)
 * & MANAJEMEN FOLDER GOOGLE DRIVE (Data Hasil Transaksi)
 * =========================================================================================
 *
 * Target Tabel:
 * PT. NIRWANA BHUMI ENERGY — INTEGRATED MANAGEMENT SYSTEMS (FINANCE MANAGEMENT)
 * Header Berada pada Baris 5 (Kolom A s.d. K)
 * Baris Pengisian Data: Tepat Mulai dari Sel A6 hingga K6 ke bawah (A6:K6, A7:K7, dst.)
 *
 * Kolom A (1) : No
 * Kolom B (2) : Tanggal
 * Kolom C (3) : Bulan
 * Kolom D (4) : Tahun
 * Kolom E (5) : Nama Transaksi (apa yang dibeli/terjadi)
 * Kolom F (6) : Harga satuan
 * Kolom G (7) : kuantitas
 * Kolom H (8) : Harga total
 * Kolom I (9) : Nomor Berkas
 * Kolom J (10): Link Berkas
 * Kolom K (11): POS
 *
 * KEAMANAN TERPADU:
 * 1. Seluruh operasi destruktif (resetSystem, wipeData, clearAll) DITOLAK via Webhook publik.
 * 2. Seluruh pemindahan massal (moveOldReceipts, migrateReceipts) DITOLAK via Webhook publik.
 * 3. Autentikasi server-to-server didukung via Script Properties (SPECTRA_BOT_SECRET).
 * 4. Anti-Replay: Verifikasi timestamp dan toleransi waktu request.
 * 5. Idempotency: Mencegah duplikasi baris transaksi yang sama pada network retry.
 * =========================================================================================
 */

var CONFIG = {
  TARGET_SHEET_NAME: 'main',
  START_ROW: 6,
  START_COL: 1,
  TOTAL_COLS: 11,
  TRANSACTIONS_FOLDER_ID: '1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9',
  WEB_DATA_FOLDER_ID: '1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn'
};

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ SPECTRA Bot')
    .addItem('📥 Isi Contoh Transaksi Resmi (Mulai Baris A6)', 'isiContohTransaksiResmi')
    .addItem('🎨 Rapikan Format Tabel (A6:K)', 'rapikanFormatTabel')
    .addSeparator()
    .addItem('📦 Pindahkan Berkas BT Lama ke Folder Data Hasil Transaksi', 'pindahkanBuktiTransaksiKeDataHasil')
    .addSeparator()
    .addItem('🗑️ Reset Total: Kosongkan Tabel (A6:K) & Folder Hasil Transaksi', 'eksekusiResetTotalDenganKonfirmasi')
    .addToUi();
}

function doGet(e) {
  try {
    var sheet = getTargetSheet();
    var lastRow = sheet.getLastRow();
    var dataCount = Math.max(0, lastRow - CONFIG.START_ROW + 1);

    var response = {
      status: 'online',
      bot: 'SPECTRA Spreadsheet & Drive Automation Bot (Hardened Edition)',
      sheetName: sheet.getName(),
      startRow: CONFIG.START_ROW,
      startCol: 'A (Kolom 1)',
      endCol: 'K (Kolom 11)',
      currentLastRow: lastRow,
      totalDataRows: dataCount,
      transactionsFolderId: CONFIG.TRANSACTIONS_FOLDER_ID,
      timestamp: new Date().toISOString(),
      message: 'Bot Google Apps Script aktif dan terproteksi.'
    };

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var rawContent = e.postData ? e.postData.contents : '';
    if (!rawContent) {
      throw new Error('Payload kosong / tidak ada data yang dikirim.');
    }

    var payload = JSON.parse(rawContent);

    // 1. BLOKIR MUTLAK: Seluruh Aksi Destruktif via Webhook Publik
    if (payload.action === 'resetSystem' || payload.action === 'wipeData' || payload.action === 'clearAll') {
      throw new Error('Aksi resetSystem via webhook publik telah dinonaktifkan permanen demi keamanan data perusahaan. Silakan gunakan menu resmi di dalam Google Sheets: ⚡ SPECTRA Bot -> 🗑️ Reset Total.');
    }

    // 2. BLOKIR MUTLAK: Pemindahan Berkas Massal via Webhook Publik
    if (payload.action === 'moveOldReceipts' || payload.action === 'migrateReceipts') {
      throw new Error('Aksi pemindahan berkas massal via webhook publik telah dinonaktifkan demi keamanan. Silakan gunakan menu resmi di dalam Google Sheets: ⚡ SPECTRA Bot -> 📦 Pindahkan Berkas.');
    }

    // 3. AUTENTIKASI SERVER-TO-SERVER MUTLAK (WAJIB)
    var scriptProps = PropertiesService.getScriptProperties();
    var expectedSecret = scriptProps.getProperty('SPECTRA_BOT_SECRET');
    if (!expectedSecret) {
      throw new Error('Autentikasi ditolak: SPECTRA_BOT_SECRET belum dikonfigurasi di Script Properties.');
    }
    if (!payload.secret || payload.secret !== expectedSecret) {
      throw new Error('Autentikasi ditolak: Secret key bot tidak valid.');
    }

    // 4. VALIDASI TIMESTAMP WAJIB (ANTI-REPLAY: Maksimal 5 Menit)
    if (!payload.timestamp) {
      throw new Error('Permintaan ditolak: Timestamp wajib disertakan.');
    }
    var reqTime = new Date(payload.timestamp).getTime();
    var nowTime = new Date().getTime();
    if (isNaN(reqTime) || Math.abs(nowTime - reqTime) > 300000) { // 5 menit
      throw new Error('Permintaan ditolak: Timestamp kadaluwarsa atau di luar toleransi 5 menit (Anti-Replay Protection).');
    }

    // 5. CONCURRENCY LOCK PERTAMA (Eliminasi Race Condition & Paralel Replay)
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      throw new Error('Server sibuk: Sedang memproses transaksi lain. Silakan coba kembali.');
    }

    try {
      // 6. ATOMIC NONCE VERIFICATION (ANTI-REPLAY VIA CACHESERVICE DI BAWAH LOCK)
      if (!payload.nonce || typeof payload.nonce !== 'string' || payload.nonce.length < 8) {
        throw new Error('Permintaan ditolak: Nonce wajib disertakan dan minimal 8 karakter.');
      }
      var cache = CacheService.getScriptCache();
      var nonceKey = 'nonce_' + payload.nonce;
      if (cache.get(nonceKey)) {
        throw new Error('Permintaan ditolak: Nonce telah digunakan sebelumnya (Replay Attack Terdeteksi).');
      }
      cache.put(nonceKey, '1', 600); // Kunci selama 10 menit

      // 7. INSERT ROWS TRANSAKSI (Dengan Pencegahan Duplikasi Presisi / Idempotency via _spectra_idempotency)
      var rows = payload.rows || (Array.isArray(payload) ? payload : [payload]);
      if (!rows || rows.length === 0) {
        throw new Error('Array baris transaksi (rows) kosong.');
      }

      var sheet = getTargetSheet();
      var insertResult = insertTransactionRowsIdempotent(sheet, rows);

      var response = {
        status: 'success',
        message: 'Berhasil menyinkronkan ' + insertResult.insertedCount + ' baris transaksi (diabaikan duplikat retry: ' + insertResult.skippedCount + ') ke Google Spreadsheet (A' + insertResult.startRow + ':K' + insertResult.endRow + ').',
        insertedCount: insertResult.insertedCount,
        skippedCount: insertResult.skippedCount,
        startRow: insertResult.startRow,
        endRow: insertResult.endRow,
        timestamp: new Date().toISOString()
      };

      return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    } finally {
      lock.releaseLock();
    }

  } catch (err) {
    var errorResponse = {
      status: 'error',
      message: 'Gagal memproses data: ' + err.toString(),
      timestamp: new Date().toISOString()
    };

    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getTargetSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.TARGET_SHEET_NAME);
  if (!sheet) {
    var allSheets = ss.getSheets();
    for (var i = 0; i < allSheets.length; i++) {
      if (allSheets[i].getName().toLowerCase() === CONFIG.TARGET_SHEET_NAME.toLowerCase()) {
        sheet = allSheets[i];
        break;
      }
    }
  }
  return sheet || ss.getSheets()[0];
}

function findNextEmptyRow(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.START_ROW) return CONFIG.START_ROW;

  var numRowsToCheck = lastRow - CONFIG.START_ROW + 1;
  var rangeA = sheet.getRange(CONFIG.START_ROW, 1, numRowsToCheck, 1).getValues();
  var rangeE = sheet.getRange(CONFIG.START_ROW, 5, numRowsToCheck, 1).getValues();

  for (var i = 0; i < numRowsToCheck; i++) {
    var valA = rangeA[i][0];
    var valE = rangeE[i][0];
    if ((valA === '' || valA === null) && (valE === '' || valE === null)) {
      return CONFIG.START_ROW + i;
    }
  }
  return lastRow + 1;
}

function getIdempotencySheet(ss) {
  var IDEMP_SHEET_NAME = '_spectra_idempotency';
  var idempSheet = ss.getSheetByName(IDEMP_SHEET_NAME);
  if (!idempSheet) {
    idempSheet = ss.insertSheet(IDEMP_SHEET_NAME);
    try {
      idempSheet.hideSheet();
    } catch (e) {}
    idempSheet.getRange(1, 1, 1, 6).setValues([
      ['line_key', 'nomor_berkas', 'line_index', 'nama_transaksi', 'harga_total', 'inserted_at']
    ]);
  }
  return idempSheet;
}

function insertTransactionRowsIdempotent(sheet, rows) {
  var targetRow = findNextEmptyRow(sheet);
  var ss = sheet.getParent();
  var idempSheet = getIdempotencySheet(ss);

  // Periksa line_key yang telah tercatat di sheet _spectra_idempotency
  var existingKeys = {};
  var lastIdempRow = idempSheet.getLastRow();
  if (lastIdempRow > 1) {
    var numKeys = lastIdempRow - 1;
    var keysRange = idempSheet.getRange(2, 1, numKeys, 1).getValues();
    for (var k = 0; k < keysRange.length; k++) {
      var keyVal = String(keysRange[k][0] || '').trim();
      if (keyVal) {
        existingKeys[keyVal] = true;
      }
    }
  }

  // Lacak indeks kemunculan baris untuk setiap nomor berkas di dalam batch saat ini
  var incomingBatchIndex = {};
  var valuesToInsert = [];
  var idempRowsToInsert = [];
  var skippedCount = 0;

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var nomorBerkas = String(r.nomorBerkas || '-').trim();

    // Tentukan nomor urut baris dalam berkas ini (1-based index)
    var currentLineIndex = (incomingBatchIndex[nomorBerkas] || 0) + 1;
    incomingBatchIndex[nomorBerkas] = currentLineIndex;

    // Line key unik komposit: nomorBerkas#L{index} (contoh: BT/0001/24XI26#L1, BT/0001/24XI26#L2)
    var lineKey = nomorBerkas + '#L' + currentLineIndex;

    // Jika lineKey sudah tercatat di _spectra_idempotency, ini retry network duplikat
    // Dua pesanan identik ("Baut 12") dalam nota yang sama TETAP TERCATAT karena memiliki #L1 dan #L2!
    if (existingKeys[lineKey]) {
      skippedCount++;
      continue;
    }

    var no = r.no !== undefined && r.no !== null ? Number(r.no) : (targetRow - CONFIG.START_ROW + valuesToInsert.length + 1);
    var tanggal = r.tanggal ? Number(r.tanggal) : new Date().getDate();
    var bulan = r.bulan ? Number(r.bulan) : (new Date().getMonth() + 1);
    var tahun = r.tahun ? Number(r.tahun) : new Date().getFullYear();
    var namaTransaksi = String(r.namaTransaksi || r.nama || '-').trim();
    var hargaSatuan = r.hargaSatuan !== null && r.hargaSatuan !== undefined && r.hargaSatuan !== '' ? Number(r.hargaSatuan) : '';
    var kuantitas = r.kuantitas !== null && r.kuantitas !== undefined && r.kuantitas !== '' ? Number(r.kuantitas) : '';
    var hargaTotal = Number(r.hargaTotal || r.totalPrice || 0);
    var linkBerkas = r.linkBerkas || '';
    var pos = r.pos || 'A';

    var linkVal = linkBerkas;
    if (linkBerkas && (linkBerkas.startsWith('http://') || linkBerkas.startsWith('https://'))) {
      linkVal = '=HYPERLINK("' + linkBerkas + '"; "Lihat Berkas")';
    }

    valuesToInsert.push([
      no, tanggal, bulan, tahun, namaTransaksi, hargaSatuan, kuantitas, hargaTotal, nomorBerkas, linkVal, pos
    ]);

    idempRowsToInsert.push([
      lineKey, nomorBerkas, currentLineIndex, namaTransaksi, hargaTotal, new Date().toISOString()
    ]);
    existingKeys[lineKey] = true;
  }

  if (valuesToInsert.length === 0) {
    return {
      startRow: targetRow,
      endRow: targetRow,
      insertedCount: 0,
      skippedCount: skippedCount
    };
  }

  var numRows = valuesToInsert.length;
  var range = sheet.getRange(targetRow, CONFIG.START_COL, numRows, CONFIG.TOTAL_COLS);
  range.setValues(valuesToInsert);
  formatTableRange(sheet, targetRow, numRows);

  // Catat baris baru ke sheet hidden _spectra_idempotency secara atomik
  if (idempRowsToInsert.length > 0) {
    var nextIdempRow = idempSheet.getLastRow() + 1;
    idempSheet.getRange(nextIdempRow, 1, idempRowsToInsert.length, 6).setValues(idempRowsToInsert);
  }

  return {
    startRow: targetRow,
    endRow: targetRow + numRows - 1,
    insertedCount: numRows,
    skippedCount: skippedCount
  };
}

function formatTableRange(sheet, startRow, numRows) {
  var fullRange = sheet.getRange(startRow, CONFIG.START_COL, numRows, CONFIG.TOTAL_COLS);
  fullRange.setFontFamily('Arial').setFontSize(10).setFontColor('#000000').setVerticalAlignment('middle');
  fullRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  sheet.getRange(startRow, 1, numRows, 1).setHorizontalAlignment('center').setNumberFormat('0');
  sheet.getRange(startRow, 2, numRows, 3).setHorizontalAlignment('center').setNumberFormat('0');
  sheet.getRange(startRow, 5, numRows, 1).setHorizontalAlignment('left').setWrap(true);
  sheet.getRange(startRow, 6, numRows, 1).setHorizontalAlignment('right').setNumberFormat('#,##0');
  sheet.getRange(startRow, 7, numRows, 1).setHorizontalAlignment('center').setNumberFormat('#,##0');
  sheet.getRange(startRow, 8, numRows, 1).setHorizontalAlignment('right').setNumberFormat('#,##0');
  sheet.getRange(startRow, 9, numRows, 1).setHorizontalAlignment('center').setNumberFormat('@');
  sheet.getRange(startRow, 10, numRows, 1).setHorizontalAlignment('center');
  sheet.getRange(startRow, 11, numRows, 1).setHorizontalAlignment('center').setFontWeight('bold');
}

function eksekusiResetTotal() {
  var sheet = getTargetSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow >= CONFIG.START_ROW) {
    sheet.getRange(CONFIG.START_ROW, CONFIG.START_COL, lastRow - CONFIG.START_ROW + 1, CONFIG.TOTAL_COLS).clearContent().clearFormat();
  }
  var deletedFilesCount = 0;
  try {
    var transFolder = DriveApp.getFolderById(CONFIG.TRANSACTIONS_FOLDER_ID);
    var transFiles = transFolder.getFiles();
    while (transFiles.hasNext()) {
      var f = transFiles.next();
      f.setTrashed(true);
      deletedFilesCount++;
    }
  } catch (e1) {
    Logger.log('Error cleaning trans folder: ' + e1);
  }
  return { success: true, deletedFilesCount: deletedFilesCount };
}

function eksekusiResetTotalDenganKonfirmasi() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    'Konfirmasi Reset Total',
    'PERINGATAN: Apakah Anda yakin ingin melakukan RESET TOTAL?\\n\\n' +
    '1. Seluruh data transaksi di tabel (A6 s.d. K) akan dikosongkan.\\n' +
    '2. Seluruh file bukti transaksi di folder "Data Hasil Transaksi" akan dihapus ke Sampah.\\n' +
    '3. Header resmi baris 1 s.d. 5 dan aset web di folder "data_web" akan tetap aman.',
    ui.ButtonSet.YES_NO
  );

  if (confirm === ui.Button.YES) {
    var res = eksekusiResetTotal();
    ui.alert(
      'Reset Total Selesai',
      'Tabel Spreadsheet telah dikosongkan mulai dari baris A6, dan ' + res.deletedFilesCount + ' berkas transaksi di Google Drive telah dihapus bersih ke Sampah.',
      ui.ButtonSet.OK
    );
  }
}

function pindahkanBuktiTransaksiKeDataHasilInternal() {
  var webFolder = DriveApp.getFolderById(CONFIG.WEB_DATA_FOLDER_ID);
  var transFolder = DriveApp.getFolderById(CONFIG.TRANSACTIONS_FOLDER_ID);
  var files = webFolder.getFiles();
  var movedCount = 0;
  var movedNames = [];

  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    var isTransactionFile = name.indexOf('BT') !== -1 || name.indexOf('Bukti Transfer') !== -1;
    var isWebAsset = name.indexOf('SPECTRA-') !== -1 || name.indexOf('background') !== -1 || name.indexOf('booting') !== -1 || name.indexOf('login') !== -1;

    if (isTransactionFile && !isWebAsset) {
      file.moveTo(transFolder);
      movedCount++;
      movedNames.push(name);
    }
  }
  return { movedCount: movedCount, movedNames: movedNames };
}

function pindahkanBuktiTransaksiKeDataHasil() {
  var res = pindahkanBuktiTransaksiKeDataHasilInternal();
  var ui = SpreadsheetApp.getUi();
  var msg = 'Berhasil memindahkan ' + res.movedCount + ' berkas bukti transaksi ke folder "Data Hasil Transaksi"!\\n\\nBerkas web tetap aman di folder data_web.';
  ui.alert('Sukses Migrasi Berkas', msg, ui.ButtonSet.OK);
}

function isiContohTransaksiResmi() {
  var sheet = getTargetSheet();
  var sampleRows = [
    { no: 1, tanggal: 26, bulan: 10, tahun: 2026, namaTransaksi: 'Baut Ukuran 12', hargaSatuan: 10000, kuantitas: 10, hargaTotal: 100000, nomorBerkas: 'BT/0001/26X26', linkBerkas: '', pos: 'A' },
    { no: 1, tanggal: 26, bulan: 10, tahun: 2026, namaTransaksi: 'Baut Ukuran 15', hargaSatuan: 15000, kuantitas: 20, hargaTotal: 300000, nomorBerkas: 'BT/0001/26X26', linkBerkas: '', pos: 'A' },
    { no: 1, tanggal: 26, bulan: 10, tahun: 2026, namaTransaksi: 'Pajak Pembelian PB1 (10%)', hargaSatuan: null, kuantitas: null, hargaTotal: 40000, nomorBerkas: 'BT/0001/26X26', linkBerkas: '', pos: 'A' }
  ];
  var res = insertTransactionRowsIdempotent(sheet, sampleRows);
  SpreadsheetApp.getUi().alert('Sukses! 3 baris contoh transaksi resmi dimasukkan pada sel A' + res.startRow + ' s.d. K' + res.endRow + '.');
}

function rapikanFormatTabel() {
  var sheet = getTargetSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow >= CONFIG.START_ROW) {
    formatTableRange(sheet, CONFIG.START_ROW, lastRow - CONFIG.START_ROW + 1);
    SpreadsheetApp.getUi().alert('Format tabel (A6:K' + lastRow + ') berhasil dirapikan!');
  } else {
    SpreadsheetApp.getUi().alert('Belum ada data pada baris 6 ke bawah.');
  }
}
`;

export function getSpreadsheetWebhookUrl(): string {
  try {
    return localStorage.getItem(SPREADSHEET_WEBHOOK_STORAGE_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function saveSpreadsheetWebhookUrl(url: string): void {
  try {
    if (url) {
      localStorage.setItem(SPREADSHEET_WEBHOOK_STORAGE_KEY, url.trim());
    } else {
      localStorage.removeItem(SPREADSHEET_WEBHOOK_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to save spreadsheet webhook url:', e);
  }
}

// Helper CSRF Double-Submit Token
function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)spectra_csrf=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  return sessionStorage.getItem('spectra_csrf') || localStorage.getItem('spectra_csrf') || '';
}

/**
 * Pengambilan secret bot via localStorage dinonaktifkan permanen demi keamanan enterprise.
 * Secret SPECTRA_BOT_SECRET dikelola secara aman pada environment backend serverless.
 */
export function getSpreadsheetBotSecret(): string {
  try {
    localStorage.removeItem(SPREADSHEET_SECRET_STORAGE_KEY);
  } catch (e) {}
  return '';
}

export function saveSpreadsheetBotSecret(_secret: string): void {
  try {
    localStorage.removeItem(SPREADSHEET_SECRET_STORAGE_KEY);
  } catch (e) {}
}

export async function testSpreadsheetWebhook(
  url: string
): Promise<{ success: boolean; message: string; data?: any }> {
  if (!url || !url.trim()) {
    return {
      success: false,
      message: 'URL Webhook Google Apps Script tidak boleh kosong.'
    };
  }

  const cleanUrl = url.trim();
  if (!cleanUrl.startsWith('https://script.google.com/macros/s/')) {
    return {
      success: false,
      message: 'Format URL Webhook tidak valid. URL harus dimulai dengan: https://script.google.com/macros/s/.../exec'
    };
  }

  if (isExternalSyncDisabledOnPreview()) {
    return {
      success: true,
      message: '[Simulasi Preview] Webhook divalidasi dalam mode isolasi pengujian aman.'
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(cleanUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.status === 'online') {
        return {
          success: true,
          message: `Koneksi Berhasil! Bot aktif di Sheet: "${json.sheetName || 'main'}" (Target: Kolom ${json.startCol || 'A'} s.d. ${json.endCol || 'K'}, Mulai Baris ${json.startRow || 6}).`,
          data: json
        };
      }
      return {
        success: true,
        message: 'Koneksi Berhasil! Google Apps Script Webhook aktif merespon.',
        data: json
      };
    }

    return {
      success: false,
      message: `Server merespon dengan status HTTP ${res.status}. Pastikan deployment disetel ke "Anyone" (Siapa saja).`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menghubungi bot: ${err?.message || err}. Pastikan URL Webhook valid dan memiliki akses publik.`
    };
  }
}

export async function syncRowsToGoogleSpreadsheet(
  rows: SpreadsheetRowData[],
  webhookUrl?: string
): Promise<{ success: boolean; message: string; insertedCount?: number; skippedCount?: number; data?: any }> {
  // 1. FAIL-CLOSED ENVIRONMENT GUARD
  if (isExternalSyncDisabledOnPreview()) {
    const status = getExternalSyncStatus();
    console.info(`[ISOLASI ${status.environmentName.toUpperCase()}] syncRowsToGoogleSpreadsheet ditangguhkan (Mock Mode). Alasan: ${status.reason}`);
    return {
      success: false,
      insertedCount: 0,
      skippedCount: 0,
      message: `[Simulasi Preview - Data Perusahaan Aman] Pengiriman ke Google Spreadsheet dinonaktifkan pada lingkungan ${status.environmentName.toUpperCase()}.`,
      data: { isMocked: true, rowsCount: rows.length, environment: status.environmentName }
    };
  }

  const targetUrl = webhookUrl || getSpreadsheetWebhookUrl();
  if (!targetUrl) {
    return {
      success: false,
      message: 'URL Webhook Google Apps Script belum disetel. Silakan atur Webhook terlebih dahulu.'
    };
  }

  if (!rows || rows.length === 0) {
    return {
      success: false,
      message: 'Tidak ada baris transaksi untuk dikirim ke spreadsheet.'
    };
  }

  // 2. Bersihkan secret dari localStorage browser jika masih tersisa
  try {
    localStorage.removeItem(SPREADSHEET_SECRET_STORAGE_KEY);
  } catch (e) {}

  // 3. Panggil Serverless Gateway Proxy (/api/financial/spreadsheet-sync)
  // Secret server (SPECTRA_BOT_SECRET), nonce anti-replay, dan timestamp diterbitkan secara aman di server
  try {
    const csrf = getCsrfToken();
    const proxyRes = await fetch('/api/financial/spreadsheet-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      credentials: 'include',
      body: JSON.stringify({
        rows
      })
    });

    const result = await proxyRes.json().catch(() => null);

    if (proxyRes.ok && result && (result.success || result.status === 'success')) {
      return {
        success: true,
        message: result.message || `Berhasil mengisi ${rows.length} baris ke Google Spreadsheet mulai dari baris A6!`,
        insertedCount: result.insertedCount !== undefined ? result.insertedCount : rows.length,
        skippedCount: result.skippedCount || 0,
        data: result
      };
    }

    return {
      success: false,
      message: result?.error || result?.message || `Gagal menyinkronkan data via gateway proxy (HTTP ${proxyRes.status}).`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal mengirim data melalui server proxy: ${err?.message || err}`
    };
  }
}

export async function resetExternalSpreadsheetAndDrive(
  _webhookUrl?: string
): Promise<{ success: boolean; message: string; deletedFilesCount?: number; isMockMode?: boolean }> {
  console.warn('[GoogleSpreadsheetBot] Reset eksternal via webhook telah dinonaktifkan demi perlindungan data perusahaan.');
  return {
    success: false,
    isMockMode: true,
    message: 'Perintah reset total via webhook eksternal telah dinonaktifkan permanen demi perlindungan keamanan data perusahaan. Jika perlu melakukan reset, silakan gunakan menu resmi di dalam Google Sheets: "⚡ SPECTRA Bot -> Reset Total".',
    deletedFilesCount: 0
  };
}
