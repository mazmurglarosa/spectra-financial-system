/**
 * SPECTRA Google Spreadsheet Automation Bot Client
 * 
 * Bertugas mengirimkan baris-baris data transaksi dari Auto Record
 * langsung ke Google Spreadsheet datasheet_bukti_transaksi (Sheet: main, Baris A6 s.d. K6 ke bawah)
 * melalui Google Apps Script Webhook.
 */

import { SpreadsheetRowData } from './autoRecordService';

export const SPREADSHEET_WEBHOOK_STORAGE_KEY = 'spectra_spreadsheet_webhook_url';

export const GOOGLE_APPS_SCRIPT_BOT_CODE = `/**
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
 */

// Konfigurasi Tabel Sesuai Format Resmi PT. Nirwana Bhumi Energy
var CONFIG = {
  TARGET_SHEET_NAME: 'main', // Nama Sheet / Tab yang dituju
  START_ROW: 6,              // Baris pertama pengisian data (A6 s.d. K6)
  START_COL: 1,              // Kolom A (Kolom ke-1)
  TOTAL_COLS: 11             // Kolom A s.d. K (11 kolom)
};

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ SPECTRA Bot')
    .addItem('📥 Isi Contoh Transaksi Resmi (Mulai Baris A6)', 'isiContohTransaksiResmi')
    .addItem('🎨 Rapikan Format Tabel (A6:K)', 'rapikanFormatTabel')
    .addSeparator()
    .addItem('🗑️ Bersihkan Baris Data (Reset Baris 6+)', 'bersihkanBarisData')
    .addToUi();
}

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

function isiContohTransaksiResmi() {
  var sheet = getTargetSheet();
  var sampleRows = [
    {
      no: 1, tanggal: 26, bulan: 10, tahun: 2026,
      namaTransaksi: 'Baut Ukuran 12', hargaSatuan: 10000, kuantitas: 10, hargaTotal: 100000,
      nomorBerkas: 'BT/0001/26X26',
      linkBerkas: 'https://drive.google.com/drive/folders/1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn?usp=sharing',
      pos: 'A'
    },
    {
      no: 1, tanggal: 26, bulan: 10, tahun: 2026,
      namaTransaksi: 'Baut Ukuran 15', hargaSatuan: 15000, kuantitas: 20, hargaTotal: 300000,
      nomorBerkas: 'BT/0001/26X26',
      linkBerkas: 'https://drive.google.com/drive/folders/1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn?usp=sharing',
      pos: 'A'
    },
    {
      no: 1, tanggal: 26, bulan: 10, tahun: 2026,
      namaTransaksi: 'Pajak Pembelian PB1 (10%)', hargaSatuan: null, kuantitas: null, hargaTotal: 40000,
      nomorBerkas: 'BT/0001/26X26',
      linkBerkas: 'https://drive.google.com/drive/folders/1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn?usp=sharing',
      pos: 'A'
    }
  ];

  var res = insertTransactionRows(sheet, sampleRows);
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
