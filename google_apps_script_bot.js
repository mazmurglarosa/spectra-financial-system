/**
 * =========================================================================================
 * SPECTRA AUTOMATION BOT - GOOGLE APPS SCRIPT
 * SINKRONISASI BUKTI TRANSAKSI KE SPREADSHEET (datasheet_bukti_transaksi)
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
 * PANDUAN PEMASANGAN (HANYA 1 MENIT):
 * 1. Buka file Google Spreadsheet Anda (datasheet_bukti_transaksi).
 * 2. Di menu atas, klik "Ekstensi" (Extensions) > "Apps Script".
 * 3. Hapus semua kode default di dalam editor (myFunction), lalu TEMPEL (PASTE) seluruh isi file ini.
 * 4. Klik ikon "Simpan" (Save / Ctrl+S).
 * 5. Klik tombol "Terapkan" (Deploy) di pojok kanan atas > pilih "Penerapan baru" (New deployment).
 * 6. Pada ikon gerigi "Pilih jenis", pilih "Aplikasi web" (Web app).
 * 7. Isi konfigurasi:
 *    - Deskripsi: SPECTRA Spreadsheet Bot
 *    - Jalankan sebagai (Execute as): Saya (email Anda)
 *    - Siapa yang memiliki akses (Who has access): Siapa saja (Anyone) -> SANGAT PENTING!
 * 8. Klik "Terapkan" (Deploy).
 * 9. Berikan izin akses Google (Klik Lanjutan / Advanced > Buka project (tidak aman) > Izinkan).
 * 10. Salin "URL Aplikasi Web" (akhiran /exec) dan simpan di aplikasi SPECTRA SIKEU2!
 * =========================================================================================
 */

// Konfigurasi Tabel Sesuai Format Resmi PT. Nirwana Bhumi Energy
var CONFIG = {
  TARGET_SHEET_NAME: 'main', // Nama Sheet / Tab yang dituju
  START_ROW: 6,              // Baris pertama pengisian data (A6 s.d. K6)
  START_COL: 1,              // Kolom A (Kolom ke-1)
  TOTAL_COLS: 11             // Kolom A s.d. K (11 kolom)
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
    .addItem('🗑️ Bersihkan Baris Data (Reset Baris 6+)', 'bersihkanBarisData')
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
      bot: 'SPECTRA Spreadsheet Automation Bot',
      sheetName: sheet.getName(),
      startRow: CONFIG.START_ROW,
      startCol: 'A (Kolom 1)',
      endCol: 'K (Kolom 11)',
      currentLastRow: lastRow,
      totalDataRows: dataCount,
      timestamp: new Date().toISOString(),
      message: 'Bot Google Apps Script aktif! Siap mengisi data transaksi mulai dari baris A6 s.d. K6 ke bawah.'
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

  // Fallback ke sheet pertama jika tab 'main' tidak ditemukan
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

  // Cek Kolom A (No) dan Kolom E (Nama Transaksi) dari baris 6 ke bawah
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

    // Kolom J (Kolom 10): Tautan berkas Google Drive
    var linkVal = linkBerkas;
    if (linkBerkas && (linkBerkas.startsWith('http://') || linkBerkas.startsWith('https://'))) {
      linkVal = '=HYPERLINK("' + linkBerkas + '"; "Lihat Berkas")';
    }

    // Urutan Kolom A s.d. K:
    // A: No
    // B: Tanggal
    // C: Bulan
    // D: Tahun
    // E: Nama Transaksi (apa yang dibeli/terjadi)
    // F: Harga satuan
    // G: kuantitas
    // H: Harga total
    // I: Nomor Berkas
    // J: Link Berkas
    // K: POS
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

  // Tulis ke range Kolom A s.d. K (Kolom 1 s.d. 11)
  var range = sheet.getRange(targetRow, CONFIG.START_COL, numRows, CONFIG.TOTAL_COLS);
  range.setValues(values);

  // Format & Styling tabel A6:K
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
  
  // Font & Warna Teks
  fullRange.setFontFamily('Arial');
  fullRange.setFontSize(10);
  fullRange.setFontColor('#000000');
  fullRange.setVerticalAlignment('middle');

  // Border kotak tipis hitam sesuai tabel fisik
  fullRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  // Format spesifik per kolom:
  // Kolom A (No) -> Center
  sheet.getRange(startRow, 1, numRows, 1).setHorizontalAlignment('center').setNumberFormat('0');
  
  // Kolom B, C, D (Tanggal, Bulan, Tahun) -> Center
  sheet.getRange(startRow, 2, numRows, 3).setHorizontalAlignment('center').setNumberFormat('0');
  
  // Kolom E (Nama Transaksi) -> Left & Wrap
  sheet.getRange(startRow, 5, numRows, 1).setHorizontalAlignment('left').setWrap(true);
  
  // Kolom F (Harga satuan) -> Right & Format Ribuan
  sheet.getRange(startRow, 6, numRows, 1).setHorizontalAlignment('right').setNumberFormat('#,##0');
  
  // Kolom G (kuantitas) -> Center
  sheet.getRange(startRow, 7, numRows, 1).setHorizontalAlignment('center').setNumberFormat('#,##0');
  
  // Kolom H (Harga total) -> Right & Format Ribuan
  sheet.getRange(startRow, 8, numRows, 1).setHorizontalAlignment('right').setNumberFormat('#,##0');
  
  // Kolom I (Nomor Berkas) -> Center & Text
  sheet.getRange(startRow, 9, numRows, 1).setHorizontalAlignment('center').setNumberFormat('@');
  
  // Kolom J (Link Berkas) -> Center
  sheet.getRange(startRow, 10, numRows, 1).setHorizontalAlignment('center');
  
  // Kolom K (POS) -> Center & Bold
  sheet.getRange(startRow, 11, numRows, 1).setHorizontalAlignment('center').setFontWeight('bold');
}

/**
 * FUNGSI MENU: Isi contoh transaksi resmi (Baut 12, Baut 15, Pajak PB1) mulai A6:K6
 */
function isiContohTransaksiResmi() {
  var sheet = getTargetSheet();
  
  var sampleRows = [
    {
      no: 1,
      tanggal: 26,
      bulan: 10,
      tahun: 2026,
      namaTransaksi: 'Baut Ukuran 12',
      hargaSatuan: 10000,
      kuantitas: 10,
      hargaTotal: 100000,
      nomorBerkas: 'BT/0001/26X26',
      linkBerkas: 'https://drive.google.com/drive/folders/1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn?usp=sharing',
      pos: 'A'
    },
    {
      no: 1,
      tanggal: 26,
      bulan: 10,
      tahun: 2026,
      namaTransaksi: 'Baut Ukuran 15',
      hargaSatuan: 15000,
      kuantitas: 20,
      hargaTotal: 300000,
      nomorBerkas: 'BT/0001/26X26',
      linkBerkas: 'https://drive.google.com/drive/folders/1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn?usp=sharing',
      pos: 'A'
    },
    {
      no: 1,
      tanggal: 26,
      bulan: 10,
      tahun: 2026,
      namaTransaksi: 'Pajak Pembelian PB1 (10%)',
      hargaSatuan: null,
      kuantitas: null,
      hargaTotal: 40000,
      nomorBerkas: 'BT/0001/26X26',
      linkBerkas: 'https://drive.google.com/drive/folders/1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn?usp=sharing',
      pos: 'A'
    }
  ];

  var res = insertTransactionRows(sheet, sampleRows);
  SpreadsheetApp.getUi().alert('Sukses! 3 baris contoh transaksi resmi berhasil dimasukkan pada sel A' + res.startRow + ' s.d. K' + res.endRow + '.');
}

/**
 * FUNGSI MENU: Rapikan format seluruh tabel mulai baris A6
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

/**
 * FUNGSI MENU: Bersihkan data transaksi (Baris 6 ke bawah, Header Baris 1-5 Aman)
 */
function bersihkanBarisData() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert('Konfirmasi Reset', 'Apakah Anda yakin ingin menghapus seluruh baris data dari baris A6 ke bawah? Header resmi baris 1 s.d. 5 akan tetap aman.', ui.ButtonSet.YES_NO);
  
  if (confirm === ui.Button.YES) {
    var sheet = getTargetSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow >= CONFIG.START_ROW) {
      sheet.getRange(CONFIG.START_ROW, CONFIG.START_COL, lastRow - CONFIG.START_ROW + 1, CONFIG.TOTAL_COLS).clearContent().clearFormat();
      ui.alert('Seluruh data transaksi pada baris A6 ke bawah berhasil dibersihkan.');
    } else {
      ui.alert('Tabel sudah dalam keadaan kosong mulai dari baris 6.');
    }
  }
}
