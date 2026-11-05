/**
 * SPECTRA Google Spreadsheet Automation Bot Client
 * 
 * Bertugas mengirimkan baris-baris data transaksi dari Auto Record
 * langsung ke Google Spreadsheet datasheet_bukti_transaksi (Sheet: main, Baris A6 s.d. K6 ke bawah)
 * melalui Google Apps Script Webhook.
 */

import { SpreadsheetRowData } from './autoRecordService';

export const SPREADSHEET_WEBHOOK_STORAGE_KEY = 'spectra_spreadsheet_webhook_url';

export const GOOGLE_APPS_SCRIPT_BOT_CODE = "/**\n * =========================================================================================\n * SPECTRA AUTOMATION BOT - GOOGLE APPS SCRIPT\n * SINKRONISASI BUKTI TRANSAKSI KE SPREADSHEET (datasheet_bukti_transaksi)\n * & MANAJEMEN FOLDER GOOGLE DRIVE (Data Hasil Transaksi)\n * =========================================================================================\n * \n * Target Tabel:\n * PT. NIRWANA BHUMI ENERGY — INTEGRATED MANAGEMENT SYSTEMS (FINANCE MANAGEMENT)\n * Header Berada pada Baris 5 (Kolom A s.d. K)\n * Baris Pengisian Data: Tepat Mulai dari Sel A6 hingga K6 ke bawah (A6:K6, A7:K7, dst.)\n * \n * Kolom A (1) : No\n * Kolom B (2) : Tanggal\n * Kolom C (3) : Bulan\n * Kolom D (4) : Tahun\n * Kolom E (5) : Nama Transaksi (apa yang dibeli/terjadi)\n * Kolom F (6) : Harga satuan\n * Kolom G (7) : kuantitas\n * Kolom H (8) : Harga total\n * Kolom I (9) : Nomor Berkas\n * Kolom J (10): Link Berkas\n * Kolom K (11): POS\n * \n * PEMISAHAN FOLDER GOOGLE DRIVE:\n * 1. Folder \"data_web\" (1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn):\n *    KHUSUS untuk aset web, foto background, logo perusahaan, settings.\n * 2. Folder \"Data Hasil Transaksi\" (1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9):\n *    KHUSUS untuk seluruh berkas fisik bukti transaksi (BT/...) dari Auto Record.\n * =========================================================================================\n */\n\n// Konfigurasi Tabel Sesuai Format Resmi PT. Nirwana Bhumi Energy\nvar CONFIG = {\n  TARGET_SHEET_NAME: 'main',                                            // Nama Sheet / Tab yang dituju\n  START_ROW: 6,                                                         // Baris pertama pengisian data (A6 s.d. K6)\n  START_COL: 1,                                                         // Kolom A (Kolom ke-1)\n  TOTAL_COLS: 11,                                                       // Kolom A s.d. K (11 kolom)\n  TRANSACTIONS_FOLDER_ID: '1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9',         // Folder Data Hasil Transaksi\n  WEB_DATA_FOLDER_ID: '1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn'              // Folder data_web (khusus web assets)\n};\n\n/**\n * Menu Kustom di Google Spreadsheet saat file dibuka\n */\nfunction onOpen() {\n  var ui = SpreadsheetApp.getUi();\n  ui.createMenu('⚡ SPECTRA Bot')\n    .addItem('📥 Isi Contoh Transaksi Resmi (Mulai Baris A6)', 'isiContohTransaksiResmi')\n    .addItem('🎨 Rapikan Format Tabel (A6:K)', 'rapikanFormatTabel')\n    .addSeparator()\n    .addItem('📦 Pindahkan Berkas BT Lama ke Folder Data Hasil Transaksi', 'pindahkanBuktiTransaksiKeDataHasil')\n    .addSeparator()\n    .addItem('🗑️ Reset Total: Kosongkan Tabel (A6:K) & Folder Hasil Transaksi', 'eksekusiResetTotalDenganKonfirmasi')\n    .addToUi();\n}\n\n/**\n * Endpoint HTTP GET (Untuk cek status bot & uji koneksi)\n */\nfunction doGet(e) {\n  try {\n    var sheet = getTargetSheet();\n    var lastRow = sheet.getLastRow();\n    var dataCount = Math.max(0, lastRow - CONFIG.START_ROW + 1);\n\n    var response = {\n      status: 'online',\n      bot: 'SPECTRA Spreadsheet & Drive Automation Bot',\n      sheetName: sheet.getName(),\n      startRow: CONFIG.START_ROW,\n      startCol: 'A (Kolom 1)',\n      endCol: 'K (Kolom 11)',\n      currentLastRow: lastRow,\n      totalDataRows: dataCount,\n      transactionsFolderId: CONFIG.TRANSACTIONS_FOLDER_ID,\n      timestamp: new Date().toISOString(),\n      message: 'Bot Google Apps Script aktif! Siap mengisi data transaksi (A6:K) dan mengelola Google Drive Data Hasil Transaksi.'\n    };\n\n    return ContentService.createTextOutput(JSON.stringify(response))\n      .setMimeType(ContentService.MimeType.JSON);\n  } catch (err) {\n    return ContentService.createTextOutput(JSON.stringify({\n      status: 'error',\n      message: err.toString()\n    })).setMimeType(ContentService.MimeType.JSON);\n  }\n}\n\n/**\n * Endpoint HTTP POST (Menerima data JSON dari SPECTRA SIKEU2)\n */\nfunction doPost(e) {\n  try {\n    var rawContent = e.postData ? e.postData.contents : '';\n    if (!rawContent) {\n      throw new Error('Payload kosong / tidak ada data yang dikirim.');\n    }\n\n    var payload = JSON.parse(rawContent);\n\n    // =========================================================================\n    // ACTION: Reset Total Sistem (Administrator Reset)\n    // =========================================================================\n    if (payload.action === 'resetSystem' || payload.action === 'wipeData' || payload.action === 'clearAll') {\n      var resetResult = eksekusiResetTotal();\n      var resetResponse = {\n        status: 'success',\n        message: 'SUKSES RESET: Tabel Spreadsheet (A6:K) telah dikosongkan dan ' + resetResult.deletedFilesCount + ' berkas transaksi di Google Drive telah dibersihkan.',\n        deletedFilesCount: resetResult.deletedFilesCount,\n        timestamp: new Date().toISOString()\n      };\n      return ContentService.createTextOutput(JSON.stringify(resetResponse))\n        .setMimeType(ContentService.MimeType.JSON);\n    }\n\n    // =========================================================================\n    // ACTION: Migrasi / Pindahkan Berkas Transaksi Lama ke Data Hasil Transaksi\n    // =========================================================================\n    if (payload.action === 'moveOldReceipts' || payload.action === 'migrateReceipts') {\n      var moveResult = pindahkanBuktiTransaksiKeDataHasilInternal();\n      return ContentService.createTextOutput(JSON.stringify({\n        status: 'success',\n        message: 'Berhasil memindahkan ' + moveResult.movedCount + ' berkas ke folder Data Hasil Transaksi.',\n        movedCount: moveResult.movedCount,\n        files: moveResult.movedNames,\n        timestamp: new Date().toISOString()\n      })).setMimeType(ContentService.MimeType.JSON);\n    }\n\n    // =========================================================================\n    // ACTION DEFAULT: Append Rows Transaksi\n    // =========================================================================\n    var rows = payload.rows || (Array.isArray(payload) ? payload : [payload]);\n\n    if (!rows || rows.length === 0) {\n      throw new Error('Array baris transaksi (rows) kosong.');\n    }\n\n    var sheet = getTargetSheet();\n    var insertResult = insertTransactionRows(sheet, rows);\n\n    var response = {\n      status: 'success',\n      message: 'Berhasil menyinkronkan ' + rows.length + ' baris transaksi ke Google Spreadsheet mulai dari baris A' + insertResult.startRow + ' hingga K' + insertResult.endRow + '!',\n      insertedCount: rows.length,\n      startRow: insertResult.startRow,\n      endRow: insertResult.endRow,\n      cellRange: 'A' + insertResult.startRow + ':K' + insertResult.endRow,\n      timestamp: new Date().toISOString()\n    };\n\n    return ContentService.createTextOutput(JSON.stringify(response))\n      .setMimeType(ContentService.MimeType.JSON);\n\n  } catch (err) {\n    var errorResponse = {\n      status: 'error',\n      message: 'Gagal memproses data: ' + err.toString(),\n      timestamp: new Date().toISOString()\n    };\n\n    return ContentService.createTextOutput(JSON.stringify(errorResponse))\n      .setMimeType(ContentService.MimeType.JSON);\n  }\n}\n\n/**\n * Mengambil sheet target 'main' atau sheet pertama yang berisi tabel\n */\nfunction getTargetSheet() {\n  var ss = SpreadsheetApp.getActiveSpreadsheet();\n  var sheet = ss.getSheetByName(CONFIG.TARGET_SHEET_NAME);\n  \n  if (!sheet) {\n    var allSheets = ss.getSheets();\n    for (var i = 0; i < allSheets.length; i++) {\n      if (allSheets[i].getName().toLowerCase() === CONFIG.TARGET_SHEET_NAME.toLowerCase()) {\n        sheet = allSheets[i];\n        break;\n      }\n    }\n  }\n\n  if (!sheet) {\n    sheet = ss.getSheets()[0];\n  }\n\n  return sheet;\n}\n\n/**\n * Mencari baris kosong berikutnya di bawah header (mulai baris 6)\n */\nfunction findNextEmptyRow(sheet) {\n  var lastRow = sheet.getLastRow();\n  if (lastRow < CONFIG.START_ROW) {\n    return CONFIG.START_ROW;\n  }\n\n  var numRowsToCheck = lastRow - CONFIG.START_ROW + 1;\n  var rangeA = sheet.getRange(CONFIG.START_ROW, 1, numRowsToCheck, 1).getValues();\n  var rangeE = sheet.getRange(CONFIG.START_ROW, 5, numRowsToCheck, 1).getValues();\n\n  for (var i = 0; i < numRowsToCheck; i++) {\n    var valA = rangeA[i][0];\n    var valE = rangeE[i][0];\n    if ((valA === '' || valA === null || valA === undefined) &&\n        (valE === '' || valE === null || valE === undefined)) {\n      return CONFIG.START_ROW + i;\n    }\n  }\n\n  return lastRow + 1;\n}\n\n/**\n * Memasukkan baris transaksi ke dalam tabel sheet mulai Kolom A s.d. K\n */\nfunction insertTransactionRows(sheet, rows) {\n  var targetRow = findNextEmptyRow(sheet);\n  var numRows = rows.length;\n  var values = [];\n\n  for (var i = 0; i < numRows; i++) {\n    var r = rows[i];\n\n    var no = r.no !== undefined && r.no !== null ? Number(r.no) : (targetRow - CONFIG.START_ROW + i + 1);\n    var tanggal = r.tanggal ? Number(r.tanggal) : new Date().getDate();\n    var bulan = r.bulan ? Number(r.bulan) : (new Date().getMonth() + 1);\n    var tahun = r.tahun ? Number(r.tahun) : new Date().getFullYear();\n    var namaTransaksi = r.namaTransaksi || r.nama || '-';\n    var hargaSatuan = r.hargaSatuan !== null && r.hargaSatuan !== undefined && r.hargaSatuan !== '' ? Number(r.hargaSatuan) : '';\n    var kuantitas = r.kuantitas !== null && r.kuantitas !== undefined && r.kuantitas !== '' ? Number(r.kuantitas) : '';\n    var hargaTotal = Number(r.hargaTotal || r.totalPrice || 0);\n    var nomorBerkas = r.nomorBerkas || '-';\n    var linkBerkas = r.linkBerkas || '';\n    var pos = r.pos || 'A';\n\n    var linkVal = linkBerkas;\n    if (linkBerkas && (linkBerkas.startsWith('http://') || linkBerkas.startsWith('https://'))) {\n      linkVal = '=HYPERLINK(\"' + linkBerkas + '\"; \"Lihat Berkas\")';\n    }\n\n    values.push([\n      no,\n      tanggal,\n      bulan,\n      tahun,\n      namaTransaksi,\n      hargaSatuan,\n      kuantitas,\n      hargaTotal,\n      nomorBerkas,\n      linkVal,\n      pos\n    ]);\n  }\n\n  var range = sheet.getRange(targetRow, CONFIG.START_COL, numRows, CONFIG.TOTAL_COLS);\n  range.setValues(values);\n\n  formatTableRange(sheet, targetRow, numRows);\n\n  return {\n    startRow: targetRow,\n    endRow: targetRow + numRows - 1\n  };\n}\n\n/**\n * Styling dan format angka agar rapi persis sesuai template resmi\n */\nfunction formatTableRange(sheet, startRow, numRows) {\n  var fullRange = sheet.getRange(startRow, CONFIG.START_COL, numRows, CONFIG.TOTAL_COLS);\n  \n  fullRange.setFontFamily('Arial');\n  fullRange.setFontSize(10);\n  fullRange.setFontColor('#000000');\n  fullRange.setVerticalAlignment('middle');\n  fullRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);\n\n  // Kolom A (No) -> Center\n  sheet.getRange(startRow, 1, numRows, 1).setHorizontalAlignment('center').setNumberFormat('0');\n  // Kolom B, C, D (Tanggal, Bulan, Tahun) -> Center\n  sheet.getRange(startRow, 2, numRows, 3).setHorizontalAlignment('center').setNumberFormat('0');\n  // Kolom E (Nama Transaksi) -> Left & Wrap\n  sheet.getRange(startRow, 5, numRows, 1).setHorizontalAlignment('left').setWrap(true);\n  // Kolom F (Harga satuan) -> Right & Ribuan\n  sheet.getRange(startRow, 6, numRows, 1).setHorizontalAlignment('right').setNumberFormat('#,##0');\n  // Kolom G (kuantitas) -> Center\n  sheet.getRange(startRow, 7, numRows, 1).setHorizontalAlignment('center').setNumberFormat('#,##0');\n  // Kolom H (Harga total) -> Right & Ribuan\n  sheet.getRange(startRow, 8, numRows, 1).setHorizontalAlignment('right').setNumberFormat('#,##0');\n  // Kolom I (Nomor Berkas) -> Center & Text\n  sheet.getRange(startRow, 9, numRows, 1).setHorizontalAlignment('center').setNumberFormat('@');\n  // Kolom J (Link Berkas) -> Center\n  sheet.getRange(startRow, 10, numRows, 1).setHorizontalAlignment('center');\n  // Kolom K (POS) -> Center & Bold\n  sheet.getRange(startRow, 11, numRows, 1).setHorizontalAlignment('center').setFontWeight('bold');\n}\n\n/**\n * FUNGSI INTI: Eksekusi Reset Total (Tabel A6:K & Folder Google Drive)\n */\nfunction eksekusiResetTotal() {\n  var sheet = getTargetSheet();\n  var lastRow = sheet.getLastRow();\n  \n  // 1. Kosongkan tabel Spreadsheet mulai dari baris A6 ke bawah\n  if (lastRow >= CONFIG.START_ROW) {\n    sheet.getRange(CONFIG.START_ROW, CONFIG.START_COL, lastRow - CONFIG.START_ROW + 1, CONFIG.TOTAL_COLS).clearContent().clearFormat();\n  }\n\n  var deletedFilesCount = 0;\n\n  // 2. Kosongkan semua berkas di folder \"Data Hasil Transaksi\"\n  try {\n    var transFolder = DriveApp.getFolderById(CONFIG.TRANSACTIONS_FOLDER_ID);\n    var transFiles = transFolder.getFiles();\n    while (transFiles.hasNext()) {\n      var f = transFiles.next();\n      f.setTrashed(true);\n      deletedFilesCount++;\n    }\n  } catch (e1) {\n    Logger.log('Error cleaning trans folder: ' + e1);\n  }\n\n  // 3. Bersihkan berkas transaksi (BT/...) yang tersisa di folder \"data_web\"\n  // Berkas web (background, logo, settings) TETAP AMAN tidak dihapus!\n  try {\n    var webFolder = DriveApp.getFolderById(CONFIG.WEB_DATA_FOLDER_ID);\n    var webFiles = webFolder.getFiles();\n    while (webFiles.hasNext()) {\n      var wf = webFiles.next();\n      var name = wf.getName();\n      var isTransactionFile = name.indexOf('BT') !== -1 || \n                              name.indexOf('Bukti Transfer') !== -1 ||\n                              name.indexOf('Nota') !== -1 ||\n                              name.indexOf('Struk') !== -1;\n      \n      var isWebAsset = name.indexOf('SPECTRA-SETTINGS') !== -1 || \n                       name.indexOf('SPECTRA-STORAGE') !== -1 || \n                       name.indexOf('SPECTRA-OFFLOAD-TEST') !== -1 ||\n                       name.indexOf('spectra_test_sync') !== -1 ||\n                       name.indexOf('background') !== -1 ||\n                       name.indexOf('corporate') !== -1 ||\n                       name.indexOf('booting') !== -1 ||\n                       name.indexOf('login') !== -1;\n\n      if (isTransactionFile && !isWebAsset) {\n        wf.setTrashed(true);\n        deletedFilesCount++;\n      }\n    }\n  } catch (e2) {\n    Logger.log('Error cleaning misplaced files in web folder: ' + e2);\n  }\n\n  return { success: true, deletedFilesCount: deletedFilesCount };\n}\n\n/**\n * FUNGSI MENU: Eksekusi Reset Total dengan Konfirmasi Dialog\n */\nfunction eksekusiResetTotalDenganKonfirmasi() {\n  var ui = SpreadsheetApp.getUi();\n  var confirm = ui.alert(\n    'Konfirmasi Reset Total',\n    'PERINGATAN: Apakah Anda yakin ingin melakukan RESET TOTAL?\\n\\n' +\n    '1. Seluruh data transaksi di tabel (A6 s.d. K) akan dikosongkan.\\n' +\n    '2. Seluruh file bukti transaksi di folder \"Data Hasil Transaksi\" akan dihapus ke Sampah.\\n' +\n    '3. Header resmi baris 1 s.d. 5 dan aset web di folder \"data_web\" akan tetap aman.',\n    ui.ButtonSet.YES_NO\n  );\n\n  if (confirm === ui.Button.YES) {\n    var res = eksekusiResetTotal();\n    ui.alert(\n      'Reset Total Selesai',\n      'Tabel Spreadsheet telah dikosongkan mulai dari baris A6, dan ' + res.deletedFilesCount + ' berkas transaksi di Google Drive telah dihapus bersih ke Sampah.',\n      ui.ButtonSet.OK\n    );\n  }\n}\n\n/**\n * FUNGSI PEMINDAHAN: Pindahkan berkas transaksi lama dari data_web ke Data Hasil Transaksi\n */\nfunction pindahkanBuktiTransaksiKeDataHasilInternal() {\n  var webFolder = DriveApp.getFolderById(CONFIG.WEB_DATA_FOLDER_ID);\n  var transFolder = DriveApp.getFolderById(CONFIG.TRANSACTIONS_FOLDER_ID);\n  \n  var files = webFolder.getFiles();\n  var movedCount = 0;\n  var movedNames = [];\n\n  while (files.hasNext()) {\n    var file = files.next();\n    var name = file.getName();\n    \n    var isTransactionFile = name.indexOf('BT') !== -1 || \n                            name.indexOf('Bukti Transfer') !== -1;\n    var isWebAsset = name.indexOf('SPECTRA-SETTINGS') !== -1 || \n                     name.indexOf('SPECTRA-STORAGE') !== -1 || \n                     name.indexOf('SPECTRA-OFFLOAD-TEST') !== -1 ||\n                     name.indexOf('spectra_test_sync') !== -1 ||\n                     name.indexOf('background') !== -1 ||\n                     name.indexOf('corporate') !== -1 ||\n                     name.indexOf('booting') !== -1 ||\n                     name.indexOf('login') !== -1;\n\n    if (isTransactionFile && !isWebAsset) {\n      file.moveTo(transFolder);\n      movedCount++;\n      movedNames.push(name);\n    }\n  }\n\n  return { movedCount: movedCount, movedNames: movedNames };\n}\n\nfunction pindahkanBuktiTransaksiKeDataHasil() {\n  var res = pindahkanBuktiTransaksiKeDataHasilInternal();\n  var ui = SpreadsheetApp.getUi();\n  var msg = 'Berhasil memindahkan ' + res.movedCount + ' berkas bukti transaksi ke folder \"Data Hasil Transaksi\"!\\n\\nBerkas web (gambar 2) tetap aman di folder data_web.';\n  if (res.movedNames.length > 0) {\n    msg += '\\n\\nDaftar berkas yang dipindahkan:\\n- ' + res.movedNames.slice(0, 5).join('\\n- ');\n    if (res.movedNames.length > 5) msg += '\\n... dan ' + (res.movedNames.length - 5) + ' lainnya.';\n  }\n  ui.alert('Sukses Migrasi Berkas', msg, ui.ButtonSet.OK);\n}\n\n/**\n * FUNGSI MENU: Isi contoh transaksi resmi mulai A6:K6\n */\nfunction isiContohTransaksiResmi() {\n  var sheet = getTargetSheet();\n  var sampleRows = [\n    {\n      no: 1, tanggal: 26, bulan: 10, tahun: 2026,\n      namaTransaksi: 'Baut Ukuran 12', hargaSatuan: 10000, kuantitas: 10, hargaTotal: 100000,\n      nomorBerkas: 'BT/0001/26X26',\n      linkBerkas: 'https://drive.google.com/drive/folders/1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9?usp=sharing',\n      pos: 'A'\n    },\n    {\n      no: 1, tanggal: 26, bulan: 10, tahun: 2026,\n      namaTransaksi: 'Baut Ukuran 15', hargaSatuan: 15000, kuantitas: 20, hargaTotal: 300000,\n      nomorBerkas: 'BT/0001/26X26',\n      linkBerkas: 'https://drive.google.com/drive/folders/1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9?usp=sharing',\n      pos: 'A'\n    },\n    {\n      no: 1, tanggal: 26, bulan: 10, tahun: 2026,\n      namaTransaksi: 'Pajak Pembelian PB1 (10%)', hargaSatuan: null, kuantitas: null, hargaTotal: 40000,\n      nomorBerkas: 'BT/0001/26X26',\n      linkBerkas: 'https://drive.google.com/drive/folders/1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9?usp=sharing',\n      pos: 'A'\n    }\n  ];\n\n  var res = insertTransactionRows(sheet, sampleRows);\n  SpreadsheetApp.getUi().alert('Sukses! 3 baris contoh transaksi resmi dimasukkan pada sel A' + res.startRow + ' s.d. K' + res.endRow + '.');\n}\n\n/**\n * FUNGSI MENU: Rapikan format tabel A6:K\n */\nfunction rapikanFormatTabel() {\n  var sheet = getTargetSheet();\n  var lastRow = sheet.getLastRow();\n  if (lastRow >= CONFIG.START_ROW) {\n    formatTableRange(sheet, CONFIG.START_ROW, lastRow - CONFIG.START_ROW + 1);\n    SpreadsheetApp.getUi().alert('Format tabel (A6:K' + lastRow + ') berhasil dirapikan!');\n  } else {\n    SpreadsheetApp.getUi().alert('Belum ada data pada baris 6 ke bawah.');\n  }\n}\n";
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
): Promise<{ success: boolean; message: string; insertedCount?: number; data?: any }> {
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

  try {
    const payload = {
      action: 'appendRows',
      timestamp: new Date().toISOString(),
      rows: rows.map(r => ({
        no: r.no,
        tanggal: r.tanggal,
        bulan: r.bulan,
        tahun: r.tahun,
        namaTransaksi: r.namaTransaksi,
        hargaSatuan: r.hargaSatuan,
        kuantitas: r.kuantitas,
        hargaTotal: r.hargaTotal,
        nomorBerkas: r.nomorBerkas,
        linkBerkas: r.linkBerkas,
        pos: r.pos
      }))
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeoutId);

    const result = await response.json().catch(() => null);

    if (result && (result.status === 'success' || result.success)) {
      return {
        success: true,
        message: result.message || `Berhasil mengisi ${rows.length} baris ke Google Spreadsheet mulai dari baris A6!`,
        insertedCount: rows.length,
        data: result
      };
    } else {
      return {
        success: false,
        message: result?.message || 'Bot Google Apps Script merespon gagal saat memasukkan data.'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal mengirim data ke Google Spreadsheet: ${err?.message || err}`
    };
  }
}

/**
 * Mengirim perintah Reset Total ke Bot Google Apps Script:
 * 1. Mengosongkan tabel Spreadsheet mulai dari baris A6 ke bawah.
 * 2. Menghapus seluruh berkas bukti transaksi di folder "Data Hasil Transaksi".
 */
export async function resetExternalSpreadsheetAndDrive(
  webhookUrl?: string
): Promise<{ success: boolean; message: string; deletedFilesCount?: number }> {
  const targetUrl = webhookUrl || getSpreadsheetWebhookUrl();
  if (!targetUrl) {
    return {
      success: false,
      message: 'URL Webhook Google Apps Script belum disetel.'
    };
  }

  try {
    const payload = {
      action: 'resetSystem',
      timestamp: new Date().toISOString()
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeoutId);

    const result = await res.json().catch(() => null);
    if (result && (result.status === 'success' || result.success)) {
      return {
        success: true,
        message: result.message || 'Tabel Spreadsheet A6:K dan Folder Data Hasil Transaksi berhasil dibersihkan total.',
        deletedFilesCount: result.deletedFilesCount
      };
    }
    return {
      success: false,
      message: result?.message || 'Bot Apps Script merespon gagal saat melakukan reset.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal mengirim sinyal reset ke Google Spreadsheet Bot: ${err?.message || err}`
    };
  }
}
