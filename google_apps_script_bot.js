/**
 * =========================================================================================
 * SPECTRA AUTOMATION BOT - GOOGLE APPS SCRIPT
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
 * PEMISAHAN FOLDER GOOGLE DRIVE:
 * 1. Folder "data_web" (1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn):
 *    KHUSUS untuk aset web, foto background, logo perusahaan, settings.
 * 2. Folder "Data Hasil Transaksi" (1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9):
 *    KHUSUS untuk seluruh berkas fisik bukti transaksi (BT/...) dari Auto Record.
 * =========================================================================================
 */

// Konfigurasi Tabel Sesuai Format Resmi PT. Nirwana Bhumi Energy
var CONFIG = {
  TARGET_SHEET_NAME: 'main',                                            // Nama Sheet / Tab yang dituju
  START_ROW: 6,                                                         // Baris pertama pengisian data (A6 s.d. K6)
  START_COL: 1,                                                         // Kolom A (Kolom ke-1)
  TOTAL_COLS: 11,                                                       // Kolom A s.d. K (11 kolom)
  TRANSACTIONS_FOLDER_ID: '1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9',         // Folder Data Hasil Transaksi
  WEB_DATA_FOLDER_ID: '1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn'              // Folder data_web (khusus web assets)
};

/**
 * Menu Kustom di Google Spreadsheet saat file dibuka
 */
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

/**
 * Endpoint HTTP GET (Untuk cek status bot & uji koneksi)
 */
function doGet(e) {
  try {
    var sheet = getTargetSheet();
    var lastRow = sheet.getLastRow();
    var dataCount = Math.max(0, lastRow - CONFIG.START_ROW + 1);

    var response = {
      status: 'online',
      bot: 'SPECTRA Spreadsheet & Drive Automation Bot',
      sheetName: sheet.getName(),
      startRow: CONFIG.START_ROW,
      startCol: 'A (Kolom 1)',
      endCol: 'K (Kolom 11)',
      currentLastRow: lastRow,
      totalDataRows: dataCount,
      transactionsFolderId: CONFIG.TRANSACTIONS_FOLDER_ID,
      timestamp: new Date().toISOString(),
      message: 'Bot Google Apps Script aktif! Siap mengisi data transaksi (A6:K) dan mengelola Google Drive Data Hasil Transaksi.'
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

/**
 * Endpoint HTTP POST (Menerima data JSON dari SPECTRA SIKEU2)
 */
function doPost(e) {
  try {
    var rawContent = e.postData ? e.postData.contents : '';
    if (!rawContent) {
      throw new Error('Payload kosong / tidak ada data yang dikirim.');
    }

    var payload = JSON.parse(rawContent);

    // =========================================================================
    // ACTION: Reset Total Sistem (Administrator Reset)
    // =========================================================================
    if (payload.action === 'resetSystem' || payload.action === 'wipeData' || payload.action === 'clearAll') {
      var resetResult = eksekusiResetTotal();
      var resetResponse = {
        status: 'success',
        message: 'SUKSES RESET: Tabel Spreadsheet (A6:K) telah dikosongkan dan ' + resetResult.deletedFilesCount + ' berkas transaksi di Google Drive telah dibersihkan.',
        deletedFilesCount: resetResult.deletedFilesCount,
        timestamp: new Date().toISOString()
      };
      return ContentService.createTextOutput(JSON.stringify(resetResponse))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // ACTION: Migrasi / Pindahkan Berkas Transaksi Lama ke Data Hasil Transaksi
    // =========================================================================
    if (payload.action === 'moveOldReceipts' || payload.action === 'migrateReceipts') {
      var moveResult = pindahkanBuktiTransaksiKeDataHasilInternal();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Berhasil memindahkan ' + moveResult.movedCount + ' berkas ke folder Data Hasil Transaksi.',
        movedCount: moveResult.movedCount,
        files: moveResult.movedNames,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // ACTION DEFAULT: Append Rows Transaksi
    // =========================================================================
    var rows = payload.rows || (Array.isArray(payload) ? payload : [payload]);

    if (!rows || rows.length === 0) {
      throw new Error('Array baris transaksi (rows) kosong.');
    }

    var sheet = getTargetSheet();
    var insertResult = insertTransactionRows(sheet, rows);

    var response = {
      status: 'success',
      message: 'Berhasil menyinkronkan ' + rows.length + ' baris transaksi ke Google Spreadsheet mulai dari baris A' + insertResult.startRow + ' hingga K' + insertResult.endRow + '!',
      insertedCount: rows.length,
      startRow: insertResult.startRow,
      endRow: insertResult.endRow,
      cellRange: 'A' + insertResult.startRow + ':K' + insertResult.endRow,
      timestamp: new Date().toISOString()
    };

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

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

/**
 * Mengambil sheet target 'main' atau sheet pertama yang berisi tabel
 */
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

  if (!sheet) {
    sheet = ss.getSheets()[0];
  }

  return sheet;
}

/**
 * Mencari baris kosong berikutnya di bawah header (mulai baris 6)
 */
function findNextEmptyRow(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.START_ROW) {
    return CONFIG.START_ROW;
  }

  var numRowsToCheck = lastRow - CONFIG.START_ROW + 1;
  var rangeA = sheet.getRange(CONFIG.START_ROW, 1, numRowsToCheck, 1).getValues();
  var rangeE = sheet.getRange(CONFIG.START_ROW, 5, numRowsToCheck, 1).getValues();

  for (var i = 0; i < numRowsToCheck; i++) {
    var valA = rangeA[i][0];
    var valE = rangeE[i][0];
    if ((valA === '' || valA === null || valA === undefined) &&
        (valE === '' || valE === null || valE === undefined)) {
      return CONFIG.START_ROW + i;
    }
  }

  return lastRow + 1;
}

/**
 * Memasukkan baris transaksi ke dalam tabel sheet mulai Kolom A s.d. K
 */
function insertTransactionRows(sheet, rows) {
  var targetRow = findNextEmptyRow(sheet);
  var numRows = rows.length;
  var values = [];

  for (var i = 0; i < numRows; i++) {
    var r = rows[i];

    var no = r.no !== undefined && r.no !== null ? Number(r.no) : (targetRow - CONFIG.START_ROW + i + 1);
    var tanggal = r.tanggal ? Number(r.tanggal) : new Date().getDate();
    var bulan = r.bulan ? Number(r.bulan) : (new Date().getMonth() + 1);
    var tahun = r.tahun ? Number(r.tahun) : new Date().getFullYear();
    var namaTransaksi = r.namaTransaksi || r.nama || '-';
    var hargaSatuan = r.hargaSatuan !== null && r.hargaSatuan !== undefined && r.hargaSatuan !== '' ? Number(r.hargaSatuan) : '';
    var kuantitas = r.kuantitas !== null && r.kuantitas !== undefined && r.kuantitas !== '' ? Number(r.kuantitas) : '';
    var hargaTotal = Number(r.hargaTotal || r.totalPrice || 0);
    var nomorBerkas = r.nomorBerkas || '-';
    var linkBerkas = r.linkBerkas || '';
    var pos = r.pos || 'A';

    var linkVal = linkBerkas;
    if (linkBerkas && (linkBerkas.startsWith('http://') || linkBerkas.startsWith('https://'))) {
      linkVal = '=HYPERLINK("' + linkBerkas + '"; "Lihat Berkas")';
    }

    values.push([
      no,
      tanggal,
      bulan,
      tahun,
      namaTransaksi,
      hargaSatuan,
      kuantitas,
      hargaTotal,
      nomorBerkas,
      linkVal,
      pos
    ]);
  }

  var range = sheet.getRange(targetRow, CONFIG.START_COL, numRows, CONFIG.TOTAL_COLS);
  range.setValues(values);

  formatTableRange(sheet, targetRow, numRows);

  return {
    startRow: targetRow,
    endRow: targetRow + numRows - 1
  };
}

/**
 * Styling dan format angka agar rapi persis sesuai template resmi
 */
function formatTableRange(sheet, startRow, numRows) {
  var fullRange = sheet.getRange(startRow, CONFIG.START_COL, numRows, CONFIG.TOTAL_COLS);
  
  fullRange.setFontFamily('Arial');
  fullRange.setFontSize(10);
  fullRange.setFontColor('#000000');
  fullRange.setVerticalAlignment('middle');
  fullRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  // Kolom A (No) -> Center
  sheet.getRange(startRow, 1, numRows, 1).setHorizontalAlignment('center').setNumberFormat('0');
  // Kolom B, C, D (Tanggal, Bulan, Tahun) -> Center
  sheet.getRange(startRow, 2, numRows, 3).setHorizontalAlignment('center').setNumberFormat('0');
  // Kolom E (Nama Transaksi) -> Left & Wrap
  sheet.getRange(startRow, 5, numRows, 1).setHorizontalAlignment('left').setWrap(true);
  // Kolom F (Harga satuan) -> Right & Ribuan
  sheet.getRange(startRow, 6, numRows, 1).setHorizontalAlignment('right').setNumberFormat('#,##0');
  // Kolom G (kuantitas) -> Center
  sheet.getRange(startRow, 7, numRows, 1).setHorizontalAlignment('center').setNumberFormat('#,##0');
  // Kolom H (Harga total) -> Right & Ribuan
  sheet.getRange(startRow, 8, numRows, 1).setHorizontalAlignment('right').setNumberFormat('#,##0');
  // Kolom I (Nomor Berkas) -> Center & Text
  sheet.getRange(startRow, 9, numRows, 1).setHorizontalAlignment('center').setNumberFormat('@');
  // Kolom J (Link Berkas) -> Center
  sheet.getRange(startRow, 10, numRows, 1).setHorizontalAlignment('center');
  // Kolom K (POS) -> Center & Bold
  sheet.getRange(startRow, 11, numRows, 1).setHorizontalAlignment('center').setFontWeight('bold');
}

/**
 * FUNGSI INTI: Eksekusi Reset Total (Tabel A6:K & Folder Google Drive)
 */
function eksekusiResetTotal() {
  var sheet = getTargetSheet();
  var lastRow = sheet.getLastRow();
  
  // 1. Kosongkan tabel Spreadsheet mulai dari baris A6 ke bawah
  if (lastRow >= CONFIG.START_ROW) {
    sheet.getRange(CONFIG.START_ROW, CONFIG.START_COL, lastRow - CONFIG.START_ROW + 1, CONFIG.TOTAL_COLS).clearContent().clearFormat();
  }

  var deletedFilesCount = 0;

  // 2. Kosongkan semua berkas di folder "Data Hasil Transaksi"
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

  // 3. Bersihkan berkas transaksi (BT/...) yang tersisa di folder "data_web"
  // Berkas web (background, logo, settings) TETAP AMAN tidak dihapus!
  try {
    var webFolder = DriveApp.getFolderById(CONFIG.WEB_DATA_FOLDER_ID);
    var webFiles = webFolder.getFiles();
    while (webFiles.hasNext()) {
      var wf = webFiles.next();
      var name = wf.getName();
      var isTransactionFile = name.indexOf('BT') !== -1 || 
                              name.indexOf('Bukti Transfer') !== -1 ||
                              name.indexOf('Nota') !== -1 ||
                              name.indexOf('Struk') !== -1;
      
      var isWebAsset = name.indexOf('SPECTRA-SETTINGS') !== -1 || 
                       name.indexOf('SPECTRA-STORAGE') !== -1 || 
                       name.indexOf('SPECTRA-OFFLOAD-TEST') !== -1 ||
                       name.indexOf('spectra_test_sync') !== -1 ||
                       name.indexOf('background') !== -1 ||
                       name.indexOf('corporate') !== -1 ||
                       name.indexOf('booting') !== -1 ||
                       name.indexOf('login') !== -1;

      if (isTransactionFile && !isWebAsset) {
        wf.setTrashed(true);
        deletedFilesCount++;
      }
    }
  } catch (e2) {
    Logger.log('Error cleaning misplaced files in web folder: ' + e2);
  }

  return { success: true, deletedFilesCount: deletedFilesCount };
}

/**
 * FUNGSI MENU: Eksekusi Reset Total dengan Konfirmasi Dialog
 */
function eksekusiResetTotalDenganKonfirmasi() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    'Konfirmasi Reset Total',
    'PERINGATAN: Apakah Anda yakin ingin melakukan RESET TOTAL?\n\n' +
    '1. Seluruh data transaksi di tabel (A6 s.d. K) akan dikosongkan.\n' +
    '2. Seluruh file bukti transaksi di folder "Data Hasil Transaksi" akan dihapus ke Sampah.\n' +
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

/**
 * FUNGSI PEMINDAHAN: Pindahkan berkas transaksi lama dari data_web ke Data Hasil Transaksi
 */
function pindahkanBuktiTransaksiKeDataHasilInternal() {
  var webFolder = DriveApp.getFolderById(CONFIG.WEB_DATA_FOLDER_ID);
  var transFolder = DriveApp.getFolderById(CONFIG.TRANSACTIONS_FOLDER_ID);
  
  var files = webFolder.getFiles();
  var movedCount = 0;
  var movedNames = [];

  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    
    var isTransactionFile = name.indexOf('BT') !== -1 || 
                            name.indexOf('Bukti Transfer') !== -1;
    var isWebAsset = name.indexOf('SPECTRA-SETTINGS') !== -1 || 
                     name.indexOf('SPECTRA-STORAGE') !== -1 || 
                     name.indexOf('SPECTRA-OFFLOAD-TEST') !== -1 ||
                     name.indexOf('spectra_test_sync') !== -1 ||
                     name.indexOf('background') !== -1 ||
                     name.indexOf('corporate') !== -1 ||
                     name.indexOf('booting') !== -1 ||
                     name.indexOf('login') !== -1;

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
  var msg = 'Berhasil memindahkan ' + res.movedCount + ' berkas bukti transaksi ke folder "Data Hasil Transaksi"!\n\nBerkas web (gambar 2) tetap aman di folder data_web.';
  if (res.movedNames.length > 0) {
    msg += '\n\nDaftar berkas yang dipindahkan:\n- ' + res.movedNames.slice(0, 5).join('\n- ');
    if (res.movedNames.length > 5) msg += '\n... dan ' + (res.movedNames.length - 5) + ' lainnya.';
  }
  ui.alert('Sukses Migrasi Berkas', msg, ui.ButtonSet.OK);
}

/**
 * FUNGSI MENU: Isi contoh transaksi resmi mulai A6:K6
 */
function isiContohTransaksiResmi() {
  var sheet = getTargetSheet();
  var sampleRows = [
    {
      no: 1, tanggal: 26, bulan: 10, tahun: 2026,
      namaTransaksi: 'Baut Ukuran 12', hargaSatuan: 10000, kuantitas: 10, hargaTotal: 100000,
      nomorBerkas: 'BT/0001/26X26',
      linkBerkas: 'https://drive.google.com/drive/folders/1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9?usp=sharing',
      pos: 'A'
    },
    {
      no: 1, tanggal: 26, bulan: 10, tahun: 2026,
      namaTransaksi: 'Baut Ukuran 15', hargaSatuan: 15000, kuantitas: 20, hargaTotal: 300000,
      nomorBerkas: 'BT/0001/26X26',
      linkBerkas: 'https://drive.google.com/drive/folders/1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9?usp=sharing',
      pos: 'A'
    },
    {
      no: 1, tanggal: 26, bulan: 10, tahun: 2026,
      namaTransaksi: 'Pajak Pembelian PB1 (10%)', hargaSatuan: null, kuantitas: null, hargaTotal: 40000,
      nomorBerkas: 'BT/0001/26X26',
      linkBerkas: 'https://drive.google.com/drive/folders/1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9?usp=sharing',
      pos: 'A'
    }
  ];

  var res = insertTransactionRows(sheet, sampleRows);
  SpreadsheetApp.getUi().alert('Sukses! 3 baris contoh transaksi resmi dimasukkan pada sel A' + res.startRow + ' s.d. K' + res.endRow + '.');
}

/**
 * FUNGSI MENU: Rapikan format tabel A6:K
 */
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
