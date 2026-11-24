import fs from 'fs';
import path from 'path';
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  PageBreak,
  Packer,
  convertInchesToTwip,
  ShadingType,
  VerticalAlign
} from 'docx';

const FONT_FAMILY = 'Calibri';

// Helper for paragraphs
function createParagraph(text, options = {}) {
  const {
    bold = false,
    italics = false,
    size = 22, // 11pt default
    color = '000000',
    align = AlignmentType.LEFT,
    spaceBefore = 60,
    spaceAfter = 60,
    lineSpacing = 276 // 1.15 line spacing
  } = options;

  return new Paragraph({
    alignment: align,
    spacing: {
      before: spaceBefore,
      after: spaceAfter,
      line: lineSpacing
    },
    children: [
      new TextRun({
        text,
        font: FONT_FAMILY,
        bold,
        italics,
        size,
        color
      })
    ]
  });
}

// Multi-run paragraph
function createMultiTextParagraph(runs, options = {}) {
  const {
    align = AlignmentType.LEFT,
    spaceBefore = 60,
    spaceAfter = 60,
    lineSpacing = 276
  } = options;

  return new Paragraph({
    alignment: align,
    spacing: {
      before: spaceBefore,
      after: spaceAfter,
      line: lineSpacing
    },
    children: runs.map(r => new TextRun({
      text: r.text,
      font: FONT_FAMILY,
      bold: !!r.bold,
      italics: !!r.italics,
      size: r.size || 22,
      color: r.color || '000000'
    }))
  });
}

function createHeading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        font: FONT_FAMILY,
        bold: true,
        size: 28, // 14pt
        color: '000000'
      })
    ]
  });
}

function createHeading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({
        text,
        font: FONT_FAMILY,
        bold: true,
        size: 24, // 12pt
        color: '222222'
      })
    ]
  });
}

function createHeading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 120, after: 60 },
    children: [
      new TextRun({
        text,
        font: FONT_FAMILY,
        bold: true,
        italics: true,
        size: 22, // 11pt
        color: '333333'
      })
    ]
  });
}

function createBullet(text, boldPrefix = '', options = {}) {
  const children = [];
  if (boldPrefix) {
    children.push(new TextRun({
      text: boldPrefix + ' ',
      font: FONT_FAMILY,
      bold: true,
      size: 21,
      color: '000000'
    }));
  }
  children.push(new TextRun({
    text,
    font: FONT_FAMILY,
    size: 21,
    color: '111111'
  }));

  return new Paragraph({
    bullet: { level: options.level || 0 },
    spacing: { before: 30, after: 30, line: 260 },
    children
  });
}

function createCalloutBox(title, contentLines) {
  const cellChildren = [
    new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          font: FONT_FAMILY,
          bold: true,
          size: 21,
          color: '000000'
        })
      ]
    })
  ];

  for (const line of contentLines) {
    cellChildren.push(new Paragraph({
      spacing: { before: 20, after: 20 },
      children: [
        new TextRun({
          text: line,
          font: FONT_FAMILY,
          size: 20,
          color: '222222'
        })
      ]
    }));
  }

  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 8,
    color: '666666'
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: borderStyle,
      bottom: borderStyle,
      left: { style: BorderStyle.SINGLE, size: 24, color: '000000' }, // thick left bar
      right: borderStyle
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: 'F4F4F4', type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
            children: cellChildren
          })
        ]
      })
    ]
  });
}

function createStyledTable(headers, rowsData, columnWidthPercentages) {
  const borderThin = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: '888888'
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: columnWidthPercentages[i], type: WidthType.PERCENTAGE },
      shading: { fill: 'D9D9D9', type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
        left: borderThin,
        right: borderThin
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 20, after: 20 },
          children: [
            new TextRun({
              text: h,
              font: FONT_FAMILY,
              bold: true,
              size: 20, // 10pt
              color: '000000'
            })
          ]
        })
      ]
    }))
  });

  const tableRows = [headerRow];

  rowsData.forEach((row, rowIndex) => {
    const isEven = rowIndex % 2 === 1;
    const bgFill = isEven ? 'F8F8F8' : 'FFFFFF';

    const cells = row.map((cellText, colIndex) => {
      // align numbers or codes
      let align = AlignmentType.LEFT;
      if (colIndex === 0) align = AlignmentType.CENTER;
      if (colIndex === row.length - 1 && cellText.length < 15) align = AlignmentType.CENTER;

      return new TableCell({
        width: { size: columnWidthPercentages[colIndex], type: WidthType.PERCENTAGE },
        shading: { fill: bgFill, type: ShadingType.CLEAR },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        borders: {
          top: borderThin,
          bottom: borderThin,
          left: borderThin,
          right: borderThin
        },
        children: [
          new Paragraph({
            alignment: align,
            spacing: { before: 20, after: 20 },
            children: [
              new TextRun({
                text: cellText,
                font: FONT_FAMILY,
                size: 19, // 9.5pt
                color: '111111'
              })
            ]
          })
        ]
      });
    });

    tableRows.push(new TableRow({ children: cells }));
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows
  });
}

async function generateReportDocx() {
  const doc = new Document({
    creator: 'Mazmur Gusti Agung Larosa',
    title: 'Laporan Rekapitulasi Pekerjaan dan Pencapaian Sistem SPECTRA',
    description: 'Dokumentasi Eksekutif Formal Hitam Putih Pengembangan Sistem Keuangan SPECTRA PT Nirwana Bhumi Energy',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1)
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 100 },
                children: [
                  new TextRun({
                    text: 'PT NIRWANA BHUMI ENERGY  |  DOKUMEN REKAPITULASI RESMI SISTEM SPECTRA',
                    font: FONT_FAMILY,
                    size: 16,
                    color: '555555',
                    italics: true
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 100 },
                children: [
                  new TextRun({
                    text: 'Halaman ',
                    font: FONT_FAMILY,
                    size: 18,
                    color: '555555'
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT_FAMILY,
                    size: 18,
                    bold: true,
                    color: '333333'
                  }),
                  new TextRun({
                    text: ' dari ',
                    font: FONT_FAMILY,
                    size: 18,
                    color: '555555'
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: FONT_FAMILY,
                    size: 18,
                    bold: true,
                    color: '333333'
                  }),
                  new TextRun({
                    text: '  —  Dokumen Internal & Rahasia Perusahaan (Strictly Confidential)',
                    font: FONT_FAMILY,
                    size: 16,
                    color: '777777',
                    italics: true
                  })
                ]
              })
            ]
          })
        },
        children: [
          // KOP RESMI
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({
                text: 'PT NIRWANA BHUMI ENERGY',
                font: FONT_FAMILY,
                bold: true,
                size: 32, // 16pt
                color: '000000'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 20 },
            children: [
              new TextRun({
                text: 'DIREKTORAT KEUANGAN & DIVISI SISTEM INFORMASI AKUNTANSI',
                font: FONT_FAMILY,
                bold: true,
                size: 22,
                color: '222222'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 120 },
            children: [
              new TextRun({
                text: 'Kantor Pusat: Gedung Perkantoran Energi Prima, Lantai 8, Jakarta Selatan | Telp: (021) 789-2026 | Web: https://spectra-financial-system.vercel.app/',
                font: FONT_FAMILY,
                size: 17,
                color: '444444'
              })
            ]
          }),

          // Horizontal divider line
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 200 },
            children: [
              new TextRun({
                text: '________________________________________________________________________________________________',
                font: FONT_FAMILY,
                bold: true,
                size: 18,
                color: '000000'
              })
            ]
          }),

          // DOCUMENT TITLE
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 60 },
            children: [
              new TextRun({
                text: 'LAPORAN REKAPITULASI PENGEMBANGAN DAN PENCAPAIAN',
                font: FONT_FAMILY,
                bold: true,
                size: 28, // 14pt
                color: '000000'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({
                text: 'SISTEM INFORMASI KEUANGAN PERUSAHAAN (SPECTRA FINANCIAL SYSTEM)',
                font: FONT_FAMILY,
                bold: true,
                size: 26,
                color: '000000'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 240 },
            children: [
              new TextRun({
                text: 'Smart Precise Enterprise Cloud-Integrated Financial & Tax System — SIKEU2',
                font: FONT_FAMILY,
                italics: true,
                size: 22,
                color: '333333'
              })
            ]
          }),

          // METADATA BOX / TABLE
          createStyledTable(
            ['Parameter Dokumen', 'Keterangan Resmi'],
            [
              ['Nomor Dokumen', 'DOC/NBE-SPECTRA/XI/2026/001-REV-FINAL'],
              ['Entitas Pelapor', 'PT NIRWANA BHUMI ENERGY'],
              ['Penanggung Jawab Utama', 'Mazmur Gusti Agung Larosa (Direktur Keuangan / Penanggung Jawab Sistem)'],
              ['Pimpinan Tertinggi', 'Sudono Salim (Direktur Utama)'],
              ['Periode Pengembangan', 'Agustus 2026 s.d. November 2026'],
              ['Klasifikasi Akses', 'Dokumen Internal / Laporan Pertanggungjawaban Eksekutif'],
              ['Status Rilis Sistem', 'Tahap Produksi Penuh (Live Production on Vercel & GitHub Enterprise)']
            ],
            [30, 70]
          ),

          new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

          // BAB I
          createHeading1('BAB I. RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)'),
          createParagraph(
            'Laporan ini disusun secara formal sebagai bentuk dokumentasi menyeluruh atas seluruh pencapaian, rekayasa arsitektur sistem, inovasi algoritma, serta penyempurnaan fungsional yang telah dikerjakan oleh Tim Keuangan di bawah pimpinan Mazmur Gusti Agung Larosa dalam mewujudkan SPECTRA Financial System (SIKEU2). Sistem ini dirancang untuk menggantikan kelemahan sistem pencatatan spreadsheet konvensional dan software akuntansi yang kaku, beralih menuju ekosistem Enterprise Cloud Financial System terpadu yang mematuhi Standar Akuntansi Keuangan (SAK) Indonesia dan Regulasi Perpajakan Nasional Coretax PER-11/PJ/2025.'
          ),
          createParagraph(
            'Selama periode pengembangan intensif ini, sistem telah berhasil melalui proses transformasi digital bertahap yang mencakup 9 (sembilan) pilar arsitektur fundamental:'
          ),
          createBullet('Standardisasi Bagan Akun (Chart of Accounts / COA) sebanyak 75 akun 5-digit lengkap dengan pemetaan hierarki, saldo normal, dan penempatan pos laporan keuangan.', '1. Tata Kelola Master Data:'),
          createBullet('Digitalisasi voucher transaksi multi-tipe (Jurnal Umum, Kas Masuk, Kas Keluar, Penjualan, Pembelian, Jurnal Penyesuaian/AJP, Jurnal Penutup) dengan validasi matematis keseimbangan debit-kredit.', '2. Siklus Pembukuan Penuh:'),
          createBullet('Pembangunan modul mutakhir ekstraksi struk/nota/invoice berbasis AI Multimodal Vision (Gemini) dan Tesseract OCR yang mampu membaca tulisan tangan (HTR) dengan uji akurasi dua arah.', '3. Otomasi Rekaman Bukti (Auto Record):'),
          createBullet('Formulasi cerdas penyusunan jurnal akuntansi otomatis, pemisahan akun pajak (PB1/PPN) dan biaya transfer BI-FAST, serta fitur instant auto-create account COA.', '4. Jurnal Otomatis Berbasis AI:'),
          createBullet('Integrasi webhook Google Apps Script bot ke Google Spreadsheet (A6:K) serta isolasi dua folder Google Drive (Aset Web vs Berkas Transaksi) dan database realtime Supabase.', '5. Ekosistem Cloud Terpadu:'),
          createBullet('Penyusunan laporan Laba Rugi, Posisi Keuangan, Perubahan Ekuitas, dan Arus Kas Metode Langsung secara otomatis dan instan.', '6. Pelaporan Keuangan Sederhana:'),
          createBullet('Implementasi standar pelaporan emiten publik bilingual (Bahasa Indonesia & English) lengkap dengan Catatan Atas Laporan Keuangan (CALK) dan ekspor PDF/Excel.', '7. Laporan Resmi Standar Publik (PSAK):'),
          createBullet('Penyusunan kertas kerja rekonsiliasi fiskal formulir 1771-I dan Coretax L1 (12 FPO dan 4 FNE), komparasi tarif PPh Badan (Pasal 31E, Pasal 17, PP 55/2022), serta penerbitan Laporan Keuangan Pasca-Koreksi Fiskal.', '8. Rekonsiliasi & Perpajakan Fiskal:'),
          createBullet('Penerapan otorisasi PIN Direktur Keuangan, jejak audit (Activity Logs) permanen, standarisasi JSON trial data, serta penyelarasan estetika UI sesuai filosofi Anti-Slop.', '9. Keamanan & Craftsmanship:'),

          new Paragraph({ spacing: { before: 140, after: 0 }, children: [] }),

          // BAB II
          createHeading1('BAB II. MASTER DATA & TATA KELOLA BAGAN AKUN (COA)'),
          createParagraph(
            'Langkah paling mendasar yang berhasil dibangun adalah penataan kembali struktur akun perusahaan PT Nirwana Bhumi Energy. Seluruh akun yang sebelumnya tersebar secara tidak teratur telah dikonsolidasikan ke dalam 75 Bagan Akun (Chart of Accounts) standar 5-digit dengan aturan pembukuan ganda (double-entry bookkeeping) yang sangat ketat.'
          ),
          createHeading2('2.1. Klasifikasi 5 Golongan Akun Utama'),
          createBullet('Kode Akun 10001 s.d. 10022. Meliputi Kas Kecil, Kas di Bank Mandiri, Kas di Bank BCA, Piutang Usaha, Piutang Karyawan, Persediaan Barang Dagang, Perlengkapan Kantor, Sewa Dibayar Dimuka, Asuransi Dibayar Dimuka, PPN Masukan, PPh Pasal 22/23 Dibayar Dimuka, serta Aset Tetap (Peralatan Kantor, Kendaraan Operasional, Mesin Proyek, Akumulasi Penyusutan). Saldo Normal: DEBET.', 'Golongan 1 (Aset / Aktiva):'),
          createBullet('Kode Akun 20001 s.d. 20015. Meliputi Utang Usaha, Utang Gaji, Utang Sewa, Utang Bunga, Utang Pajak PPh 21, PPh 23, PPh 25/29, PPN Keluaran, Beban yang Masih Harus Dibayar, Pendapatan Diterima Dimuka, serta Utang Bank Jangka Panjang. Saldo Normal: KREDIT.', 'Golongan 2 (Liabilitas / Utang):'),
          createBullet('Kode Akun 30001 s.d. 30005. Meliputi Modal Saham Disetor (Sudono Salim & Mazmur Gusti Agung Larosa), Tambahan Modal Disetor (Agio Saham), Saldo Laba Ditahan (Retained Earnings), Saldo Laba Tahun Berjalan, dan Prive. Saldo Normal: KREDIT.', 'Golongan 3 (Ekuitas / Modal):'),
          createBullet('Kode Akun 40001 s.d. 41005. Meliputi Pendapatan Jasa / Usaha Pokok, Pendapatan Kontrak Energi, Pendapatan Penjualan, Retur Penjualan, Potongan Penjualan, serta Pendapatan Lain-lain / Non-Operasional (Pendapatan Bunga Bank, Laba Selisih Kurs, Dividen). Saldo Normal: KREDIT.', 'Golongan 4 (Pendapatan / Revenue):'),
          createBullet('Kode Akun 50001 s.d. 50021. Meliputi Harga Pokok Penjualan (HPP), Beban Gaji & Upah, Beban Listrik, Air & Telepon, Beban Sewa Kantor, Beban Penyusutan Peralatan & Kendaraan, Beban Pemasaran & Representasi, Beban Perjalanan Dinas, Beban Jamuan & Entertainment (Natura), Beban Administrasi Bank, Biaya Pajak Daerah (PB1), Beban Denda & Sanksi Pajak, serta Beban Lain-lain. Saldo Normal: DEBET.', 'Golongan 5 (Beban / Expense):'),

          createHeading2('2.2. Validasi Sistematis pada COA'),
          createBullet('Sistem secara otomatis mengurutkan COA secara hierarkis dari golongan 1 hingga 5, sehingga memudahkan navigasi dan pencarian.', 'Auto-Sorting Hierarkis:'),
          createBullet('Setiap akun memiliki penanda tegas kategori laporan (Neraca atau Laba Rugi). Kesalahan klasifikasi akun akan dicegah oleh filter validasi sistem.', 'Penetapan Pos Laporan Otomatis:'),
          createBullet('Fitur pencarian instan berdasarkan kode akun 5-digit maupun nama akun dengan respon di bawah 50 milidetik.', 'Pencarian & Filtering Real-time:'),

          new Paragraph({ spacing: { before: 140, after: 0 }, children: [] }),

          // BAB III
          createHeading1('BAB III. SIKLUS PENCATATAN TRANSAKSI & JURNAL LENGKAP'),
          createParagraph(
            'Untuk mengakomodasi fleksibilitas operasional bisnis PT Nirwana Bhumi Energy, sistem SPECTRA menyediakan modul pencatatan transaksi yang menyeluruh dengan mekanisme validasi keseimbangan (balance control) di setiap level entri.'
          ),
          createHeading2('3.1. Enam Modul Entri Transaksi (Voucher System)'),
          createStyledTable(
            ['No', 'Tipe Voucher', 'Kode Sistem', 'Peruntukan Operasional'],
            [
              ['1', 'Jurnal Umum', 'general', 'Mencatat transaksi memorial, barter, reklasifikasi akun, dan pemindahbukuan antar rekening.'],
              ['2', 'Kas Masuk', 'cash_in', 'Penerimaan dana tunai atau transfer bank dari modal, pelunasan piutang, dan penerimaan lain.'],
              ['3', 'Kas Keluar', 'cash_out', 'Pengeluaran operasional rutin, pembayaran biaya vendor, dan pembelian tunai.'],
              ['4', 'Penjualan', 'sales', 'Faktur penjualan jasa/barang dagang baik tunai maupun kredit (pembentukan piutang usaha).'],
              ['5', 'Pembelian', 'purchase', 'Pengadaan bahan baku, perlengkapan, atau aset tetap dengan termin tunai/tempo (utang usaha).'],
              ['6', 'Jurnal Penyesuaian', 'adjustment', 'Pencatatan penyesuaian akhir periode (akrual, penyusutan aset, amortisasi, perlengkapan).']
            ],
            [8, 22, 20, 50]
          ),

          createHeading2('3.2. Buku Besar, Neraca Saldo, & Kertas Kerja 10 Kolom'),
          createBullet('Menyajikan rincian mutasi debit, kredit, dan saldo berjalan (running balance) untuk masing-masing dari 75 akun secara kronologis dan terperinci.', 'Buku Besar Utama (General Ledger):'),
          createBullet('Menyediakan kartu pengawasan piutang per pelanggan (Customer Ledger) dan kartu utang per pemasok (Vendor Ledger).', 'Buku Pembantu (Subsidiary Ledger):'),
          createBullet('Merekap seluruh saldo akhir akun debit dan kredit secara matematis dengan indikator real-time: status "Neraca Seimbang (Selisih Rp 0)".', 'Neraca Saldo (Trial Balance):'),
          createBullet('Kertas kerja akuntansi komprehensif yang memadukan Neraca Saldo, Penyesuaian, Neraca Saldo Setelah Penyesuaian (NSSP), Laba Rugi, dan Neraca dalam satu tampilan matriks yang presisi.', 'Neraca Lajur 10 Kolom (Worksheet):'),
          createBullet('Modul pelaporan cepat yang mengonsolidasikan posisi Kas & Bank, Penjualan & Piutang, serta Pembelian & Utang ke dalam satu navigasi tab horizontal yang elegan dan responsif.', 'Quick Report Konsolidasi:'),

          new Paragraph({ spacing: { before: 140, after: 0 }, children: [] }),

          // BAB IV
          createHeading1('BAB IV. INOVASI TEKNOLOGI SPECTRA AUTO RECORD (INTELLIGENT OCR/HTR)'),
          createParagraph(
            'Salah satu terobosan teknologi terbesar yang diinisiasi dan dikerjakan dalam proyek SPECTRA adalah Modul Auto Record. Fitur ini mengeliminasi pekerjaan input data manual (data entry) yang memakan waktu dan rawan salah ketik (human error) dengan memanfaatkan kecerdasan buatan visi multimodal (AI Multimodal Vision).'
          ),
          createHeading2('4.1. Pipeline Pemrosesan Bukti Transaksi'),
          createBullet('Sistem menerima berkas foto/scan bukti transaksi berupa struk thermal POS, nota bon kontan, faktur pajak, bukti transfer m-banking (BCA, Mandiri, BI-FAST), serta kuitansi tulisan tangan.', '1. Penerimaan Multi-Format:'),
          createBullet('Sistem memanggil Gemini Vision API yang dioptimalkan untuk karakter Indonesia, didukung fallback Tesseract OCR untuk kondisi jaringan lokal terbatas. Berkas diproses dalam hitungan detik.', '2. Ekstraksi AI & HTR:'),
          createBullet('Sistem membedah informasi nomor nota, tanggal, vendor/toko, nama barang/jasa per baris, kuantitas, harga satuan, subtotal, pungutan pajak (PB1/PPN), biaya admin perbankan, dan grand total.', '3. Parsing Struktur Akuntansi:'),

          createHeading2('4.2. Uji Akurasi Dua Arah & Deteksi Kesalahan Kasir (Seller Math Discrepancy)'),
          createParagraph(
            'SPECTRA Auto Record tidak hanya sekadar membaca teks, melainkan melakukan audit matematis independen terhadap angka yang tertera di struk:'
          ),
          createBullet('Memverifikasi bahwa: Harga Satuan × Kuantitas = Total Baris untuk setiap item yang terdeteksi.', 'A. Uji Horizontal Baris (Row-Level Check):'),
          createBullet('Memverifikasi bahwa: Jumlah Subtotal Seluruh Baris + Pajak + Biaya Layanan = Grand Total Transaksi.', 'B. Uji Vertikal (Grand Total Check):'),
          createBullet('Jika kasir atau penjual membuat nota manual yang salah hitung (misal salah jumlah pada kuitansi manual), SPECTRA secara otomatis memberikan notifikasi "Peringatan Selisih Hitung Penjual" dan menawarkan koreksi otomatis agar neraca akuntansi tetap presisi 100%.', 'C. Deteksi Anomali Hitung Kasir:'),

          createHeading2('4.3. Standardisasi Format Kode Berkas: BT/XXXX/DDMYY'),
          createParagraph(
            'Setiap transaksi yang berhasil direkam diberikan nomor urut berkas resmi terstandardisasi, misalnya BT/0001/05XI26, di mana BT adalah Bukti Transaksi, 0001 adalah nomor urut 4-digit yang terus meningkat, 05 adalah tanggal, XI adalah bulan Romawi, dan 26 adalah dua digit tahun buku.'
          ),

          createHeading2('4.4. Klasifikasi POS A s.d. F dan Custom POS Builder'),
          createStyledTable(
            ['Kode POS', 'Jenis Alur Kas / Transaksi', 'Karakteristik & Akun Lawan Otomatis'],
            [
              ['POS A', 'Pengeluaran Kas Kecil / Operasional', 'Mengkredit Kas Kecil (10001) untuk belanja ATK, konsumsi, transportasi, dan perbaikan.'],
              ['POS B', 'Transfer Bank / Rekening Operasional', 'Mengkredit Bank Mandiri (10002) atau Bank BCA (10003) untuk pembayaran vendor & sewa.'],
              ['POS C', 'Pembelian Tempo / Utang Usaha', 'Mengkredit Utang Usaha (20001) atas faktur pembelian barang dagang atau bahan bakar.'],
              ['POS D', 'Penerimaan Penjualan Tunai', 'Mendebet Kas/Bank dan mengkredit Pendapatan Usaha (40001) atas penjualan jasa/energi.'],
              ['POS E', 'Penjualan Tempo / Piutang Usaha', 'Mendebet Piutang Usaha (10004) atas tagihan proyek energi yang belum tertagih.'],
              ['POS F', 'Pajak Daerah & Retribusi (PB1 / PBJT)', 'Menguraikan pajak restoran/hotel 10% ke akun Biaya Pajak Daerah (50018).']
            ],
            [12, 38, 50]
          ),

          createHeading2('4.5. Tombol Reset Ke 1 & Sinkronisasi 4 Lapisan Data'),
          createParagraph(
            'Atas instruksi khusus mengenai tata kelola pengujian sistem, telah dibuatkan tombol khusus "Reset ke 1" pada badge nomor berkas Auto Record dengan modal konfirmasi keamanan. Ketika reset dieksekusi, sistem melakukan pembersihan 4-lapis secara serentak:'
          ),
          createBullet('Menghapus seluruh daftar transaksi tersimpan di memory lokal browser.', '1. Layer 1 (Local Storage):'),
          createBullet('Menghapus seluruh record transaksi pada tabel transactions di cloud PostgreSQL Supabase.', '2. Layer 2 (Supabase Cloud Database):'),
          createBullet('Menghapus baris data A6:K pada sheet "main" di Google Spreadsheet tanpa merusak baris header 1-5 (Kop PT Nirwana Bhumi Energy).', '3. Layer 3 (Google Spreadsheet):'),
          createBullet('Memindahkan seluruh berkas gambar bukti transaksi pada folder "Data Hasil Transaksi" Google Drive ke Sampah (Trash).', '4. Layer 4 (Google Drive Storage):'),
          createBullet('Mengembalikan nomor berkas selanjutnya tepat ke BT/0001/DDMYY.', 'Hasil Akhir Reset:'),

          new Paragraph({ spacing: { before: 140, after: 0 }, children: [] }),

          // BAB V
          createHeading1('BAB V. MODUL JURNAL OTOMATIS BERBASIS AI (AUTO JOURNAL)'),
          createParagraph(
            'Sebagai pelengkap dan pemisah tanggung jawab fungsional dari Auto Record, dibangunlah modul terpisah "Jurnal Otomatis (Auto Journal)". Modul ini berfokus pada penyusunan struktur ayat jurnal akuntansi yang taat asas Standar Akuntansi Keuangan (SAK).'
          ),
          createHeading2('5.1. Pemisahan Komponen Transaksi Kompleks'),
          createBullet('Ketika bukti transaksi restoran memuat makanan Rp 100.000 dan PB1 Rp 10.000, sistem secara otomatis memecah menjadi 2 baris debit: Beban Operasional Rp 100.000 dan Biaya Pajak Daerah (PB1) Rp 10.000, dengan kredit Kas Rp 110.000.', 'Otomasi Pemisahan Pajak Daerah:'),
          createBullet('Ketika bukti transfer bank memuat tagihan Rp 2.800.000 dan biaya BI-FAST Rp 2.500, sistem secara otomatis menjurnal beban pokok Rp 2.800.000 dan Beban Administrasi Bank Rp 2.500.', 'Otomasi Biaya Transfer BI-FAST:'),
          createBullet('Jika dalam nota belanja terdeteksi pos belanja baru yang belum ada di COA, sistem secara instan membuat akun baru di database tanpa memerlukan persetujuan manual bertahap.', 'Instant Auto-Create Account COA:'),

          new Paragraph({ spacing: { before: 140, after: 0 }, children: [] }),

          // BAB VI
          createHeading1('BAB VI. ARSITEKTUR INTEGRASI CLOUD & WORKSPACE EKOSISTEM'),
          createParagraph(
            'Sistem SPECTRA telah dikembangkan dengan arsitektur cloud enterprise multi-tier yang tangguh, menjamin ketersediaan data (high availability), isolasi keamanan berkas, serta kecepatan akses.'
          ),
          createHeading2('6.1. Google Apps Script Webhook Bot (google_apps_script_bot.js)'),
          createBullet('Menyediakan endpoint RESTful Webhook yang menerima payload transaksi dari antarmuka web SPECTRA dan langsung memasukkannya ke Google Spreadsheet "datasheet_bukti_transaksi" (ID: 1fMya8YADudN3benjdxMX5ws-mKXv7MEu4YXlkE1-IKY).', 'Endpoint Webhook:'),
          createBullet('Data transaksi diisikan secara berurutan mulai dari kolom A hingga K pada baris ke-6 (A6:K). Baris 1 sampai 5 dilindungi secara permanen untuk memuat Kop Perusahaan, Logo, Periode, dan Nama Kolom.', 'Proteksi Template Sheet:'),
          createBullet('Menyediakan handler resetSystem yang membersihkan range A6:K secara instan saat tombol reset ditekan oleh administrator berwenang.', 'Handler Reset Otomatis:'),

          createHeading2('6.2. Isolasi Ketat Dual-Folder Google Drive'),
          createStyledTable(
            ['Nama Folder Google Drive', 'Folder ID / URL', 'Hak Akses & Isi Dokumen'],
            [
              [
                'data_web',
                '1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn',
                'KHUSUS ASET SISTEM WEB: Menyimpan file logo resmi NBE, wallpaper background booting screen, background login, dan foto profil pengguna. Bersifat permanen dan tidak terhapus saat transaksi di-reset.'
              ],
              [
                'Data Hasil Transaksi',
                '1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9',
                'KHUSUS BERKAS FISIK BUKTI TRANSAKSI: Menyimpan foto nota, kuitansi, struk thermal hasil upload fitur Auto Record dengan format penamaan BT_XXXX_DDMYY_NamaFile.jpg. Berkas di folder ini dibersihkan saat reset transaksi dilakukan.'
              ]
            ],
            [25, 30, 45]
          ),

          createHeading2('6.3. Cloud Database Supabase PostgreSQL'),
          createBullet('Menyimpan 75 akun COA beserta saldo awal, saldo berjalan, dan riwayat mutasi debit/kredit secara terenkripsi.', 'Tabel accounts:'),
          createBullet('Menyimpan seluruh baris transaksi voucher lengkap dengan relasi akun dan link berkas bukti di Google Drive.', 'Tabel transactions:'),
          createBullet('Menyimpan identitas perusahaan, nama direktur utama, nama direktur keuangan, rasio tampilan login, preferensi tema, dan status cloud bot.', 'Tabel company_settings:'),
          createBullet('Pencatatan real-time audit trail untuk setiap aksi login, penambahan transaksi, pengeditan COA, dan reset sistem.', 'Tabel audit_logs:'),

          createHeading2('6.4. Deployment CI/CD Vercel & GitHub'),
          createBullet('Seluruh kode sumber tersimpan aman di repositori GitHub mazmurglarosa/spectra-financial-system pada branch main.', 'Version Control:'),
          createBullet('Pipeline Vercel otomatis melakukan kompilasi Vite/TypeScript dan mendeploy pembaruan sistem ke alamat resmi https://spectra-financial-system.vercel.app/ tanpa downtime.', 'Automated CI/CD:'),

          new Paragraph({ spacing: { before: 140, after: 0 }, children: [] }),

          // BAB VII
          createHeading1('BAB VII. SISTEM PELAPORAN KEUANGAN KOMERSIAL'),
          createParagraph(
            'Sistem SPECTRA menyajikan dua tingkat pelaporan keuangan komersial: Laporan Sederhana untuk kebutuhan manajerial harian, dan Laporan Resmi Standar Publik (PSAK) untuk keperluan audit, perbankan, dan pemegang saham.'
          ),
          createHeading2('7.1. Empat Laporan Keuangan Sederhana'),
          createBullet('Menyajikan rincian Penjualan Bersih, Harga Pokok Penjualan (HPP), Laba Kotor, Beban Operasional, Laba Operasi, Pendapatan/Beban Non-Operasional, dan Laba Bersih Tahun Berjalan.', '1. Laporan Laba Rugi (Income Statement):'),
          createBullet('Menyajikan posisi Aset Lancar, Aset Tetap, Liabilitas Lancar, Liabilitas Jangka Panjang, dan Ekuitas dengan jaminan keseimbangan matematis.', '2. Laporan Posisi Keuangan (Neraca / Balance Sheet):'),
          createBullet('Menyajikan saldo awal modal saham, laba ditahan, penambahan laba tahun berjalan, prive, dan saldo akhir ekuitas.', '3. Laporan Perubahan Ekuitas / Modal (Capital Statement):'),
          createBullet('Menyajikan arus masuk dan keluar kas dari aktivitas operasi, aktivitas investasi, dan aktivitas pendanaan dengan metode langsung.', '4. Laporan Arus Kas (Cash Flow Statement):'),

          createHeading2('7.2. Laporan Keuangan Resmi Standar Publik (PSAK Bilingual ID/EN)'),
          createParagraph(
            'Sistem dilengkapi modul penyusunan laporan keuangan formal standar emiten publik (audited report) yang dapat dicetak langsung ke PDF atau diekspor ke format Excel (.xlsx):'
          ),
          createBullet('Laporan Posisi Keuangan Konsolidasian (Consolidated Statement of Financial Position).', 'A.'),
          createBullet('Laporan Laba Rugi dan Penghasilan Komprehensif Lain Konsolidasian (Consolidated Statement of Profit or Loss and Other Comprehensive Income).', 'B.'),
          createBullet('Laporan Perubahan Ekuitas Konsolidasian (Consolidated Statement of Changes in Equity).', 'C.'),
          createBullet('Laporan Arus Kas Konsolidasian (Consolidated Statement of Cash Flows).', 'D.'),
          createBullet('Catatan Atas Laporan Keuangan (Notes to the Consolidated Financial Statements) yang memuat gambaran umum perusahaan, ikhtisar kebijakan akuntansi penting, rincian per pos neraca, dan lembar pengesahan tanda tangan Direksi.', 'E.'),

          new Paragraph({ spacing: { before: 140, after: 0 }, children: [] }),

          // BAB VIII
          createHeading1('BAB VIII. REKONSILIASI FISKAL & LAPORAN KEUANGAN PERPAJAKAN'),
          createParagraph(
            'Sebagai penyempurnaan mutakhir dari sistem SPECTRA, telah dibangun modul perpajakan tingkat lanjut yang mengotomatisasi penyusunan Rekonsiliasi Fiskal (Koreksi Fiskal Positif & Negatif) untuk keperluan SPT Tahunan PPh Badan Formulir 1771-I dan implementasi Coretax System nasional berdasarkan PER-11/PJ/2025.'
          ),
          createHeading2('8.1. Integrasi Penuh Laba Rugi Komersial ke Fiskal (Selisih Rp 0)'),
          createParagraph(
            'Sistem memastikan bahwa angka Laba Bersih Komersial Sebelum Pajak yang ditarik ke dalam Lembar Rekonsiliasi Fiskal bersumber langsung dari Laporan Laba Rugi Komersial SAK dengan validasi selisih Rp 0. Tidak ada perbedaan perhitungan antara modul sederhana, modul PSAK, dan modul fiskal.'
          ),

          createHeading2('8.2. Katalog Lengkap 12 Koreksi Fiskal Positif (FPO-01 s.d. FPO-12)'),
          createStyledTable(
            ['Kode', 'Uraian Koreksi Fiskal Positif', 'Dasar Hukum Regulasi Pajak'],
            [
              ['FPO-01', 'Biaya untuk kepentingan pribadi pemegang saham, sekutu, atau anggota', 'Pasal 9 ayat (1) huruf a UU PPh sttd UU HPP'],
              ['FPO-02', 'Pembentukan atau pemupukan dana cadangan yang tidak diperbolehkan', 'Pasal 9 ayat (1) huruf c UU PPh sttd UU HPP'],
              ['FPO-03', 'Penggantian/imbalan berupa natura & kenikmatan non-deductible', 'Pasal 9 ayat (1) huruf e UU PPh sttd PMK 66/2023'],
              ['FPO-04', 'Jumlah yang melebihi kewajaran dibayarkan kepada pihak istimewa', 'Pasal 9 ayat (1) huruf f UU PPh sttd UU HPP'],
              ['FPO-05', 'Harta yang dihibahkan, bantuan, atau sumbangan non-deductible', 'Pasal 9 ayat (1) huruf g UU PPh sttd UU HPP'],
              ['FPO-06', 'Pajak Penghasilan (PPh yang dibayar/terutang oleh perusahaan)', 'Pasal 9 ayat (1) huruf h UU PPh sttd UU HPP'],
              ['FPO-07', 'Gaji yang dibayarkan kepada anggota persekutuan/CV modal tidak terbagi saham', 'Pasal 9 ayat (1) huruf j UU PPh sttd UU HPP'],
              ['FPO-08', 'Sanksi administrasi berupa bunga, denda, dan kenaikan pajak', 'Pasal 9 ayat (1) huruf k UU PPh sttd UU HPP'],
              ['FPO-09', 'Penyusutan komersial yang melebihi penyusutan fiskal', 'Pasal 11 UU PPh sttd UU HPP'],
              ['FPO-10', 'Amortisasi komersial yang melebihi amortisasi fiskal', 'Pasal 11A UU PPh sttd UU HPP'],
              ['FPO-11', 'Biaya untuk mendapatkan penghasilan bukan objek pajak', 'Pasal 9 ayat (1) jo Pasal 4 ayat (3) UU PPh'],
              ['FPO-12', 'Penyesuaian fiskal positif lainnya / beban tidak dapat dikurangkan', 'PER-11/PJ/2025 Lampiran 1 (Coretax)']
            ],
            [12, 53, 35]
          ),

          createHeading2('8.3. Katalog 4 Koreksi Fiskal Negatif (FNE-01 s.d. FNE-04)'),
          createStyledTable(
            ['Kode', 'Uraian Koreksi Fiskal Negatif', 'Dasar Hukum Regulasi Pajak'],
            [
              ['FNE-01', 'Penghasilan yang dikenakan PPh Bersifat Final (Pasal 4 ayat 2)', 'Pasal 4 ayat (2) UU PPh & PP 55/2022'],
              ['FNE-02', 'Penghasilan yang tidak termasuk objek pajak (Non-Objek Pajak)', 'Pasal 4 ayat (3) UU PPh sttd UU HPP'],
              ['FNE-03', 'Penyusutan/amortisasi fiskal yang lebih besar dari komersial', 'Pasal 11 & Pasal 11A UU PPh sttd UU HPP'],
              ['FNE-04', 'Penyesuaian fiskal negatif lainnya', 'PER-11/PJ/2025 Lampiran 1 (Coretax)']
            ],
            [12, 53, 35]
          ),

          createHeading2('8.4. Simulasi & Komparasi 3 Skema Tarif PPh Badan'),
          createBullet('Bagi perusahaan dengan omzet bruto sampai dengan Rp 50 Miliar, mendapatkan fasilitas pengurangan tarif 50% (tarif efektif 11%) atas Penghasilan Kena Pajak dari porsi omzet sampai dengan Rp 4,8 Miliar.', '1. Fasilitas Pasal 31E ayat (1) UU PPh:'),
          createBullet('Dikenakan tarif flat 22% terhadap seluruh Penghasilan Kena Pajak tanpa fasilitas.', '2. Tarif Umum Pasal 17 UU PPh (22%):'),
          createBullet('Dikenakan tarif 0,5% dari peredaran bruto bagi Wajib Pajak Badan yang memenuhi syarat omzet di bawah Rp 4,8 Miliar setahun.', '3. PPh Final PP 55/2022 (0,5%):'),

          createHeading2('8.5. Sidebar Menu Baru: Laporan Keuangan Fiskal (Pasca-Koreksi)'),
          createParagraph(
            'Telah ditambahkan slide bar navigasi baru pada sistem yang secara langsung menyajikan Laporan Keuangan Resmi Versi Pasca Rekonsiliasi Fiskal. Dengan fitur ini, manajemen dapat langsung mencetak Laba Rugi Fiskal, Posisi Keuangan Fiskal, Perubahan Ekuitas Fiskal, dan Arus Kas Fiskal serta mengunduh Buku Kerja Excel Rekonsiliasi 1771-I dalam satu klik.'
          ),

          new Paragraph({ spacing: { before: 140, after: 0 }, children: [] }),

          // BAB IX
          createHeading1('BAB IX. TATA KELOLA KEAMANAN, AUDIT TRAIL, & CRAFTSMANSHIP UI/UX'),
          createParagraph(
            'Untuk memastikan keandalan jangka panjang, sistem SPECTRA dirancang dengan standar keamanan dan kebersihan kode yang tinggi serta tampilan antarmuka yang profesional.'
          ),
          createHeading2('9.1. Otorisasi Keamanan Tingkat Tinggi (Direktur Keuangan PIN)'),
          createBullet('Tindakan kritis seperti reset data transaksi, penghapusan jurnal, dan pengosongan cloud storage diwajibkan memasukkan PIN otorisasi Direktur Keuangan. Aksi tanpa otorisasi akan ditolak seketika.', 'Proteksi PIN Eksekutif:'),
          createBullet('Setiap aksi pengguna, mulai dari entri voucher, pengeditan akun, persetujuan Auto Record, hingga reset sistem dicatat secara otomatis dalam tabel audit_logs dengan timestamp milidetik dan alamat IP pengguna.', 'Jejak Audit Permanen (Activity Log):'),
          createBullet('Tersedia fitur pencadangan penuh sistem ke dalam berkas JSON (Trial_SPECTRA_2026.json) yang dapat dipulihkan kapan saja dengan konsistensi data 100%.', 'Backup & Restore Mandiri:'),

          createHeading2('9.2. Kustomisasi Tampilan Visual & Branding Perusahaan'),
          createBullet('Pengguna dapat mengatur rasio kolom formulir login (standar 65:35), mengatur background kustom, serta menyesuaikan kontras teks agar selalu terbaca jelas.', 'Halaman Login Terpersonalisasi:'),
          createBullet('Waktu animasi pemuatan sistem diatur 5 detik dengan latar belakang korporat NBE, filter kegelapan (darkness slider), dan kontrol posisi crop gambar yang presisi.', 'Booting Screen Profesional:'),
          createBullet('Penyatuan 7 kartu metrik utama dan grafik tren 5 pilar keuangan dalam satu kontainer visual terpadu bertajuk "KONDISI REAL TIME" yang selaras tinggi dan lebarnya.', 'Dashboard Minimalis:'),

          createHeading2('9.3. Audit Kualitas Tampilan Sesuai Standar Anti-Slop'),
          createBullet('Seluruh elemen antarmuka telah diaudit dari elemen AI-slop (gradien ungu/pink generik yang tidak perlu, bayangan berlebihan, dan tombol animasi tanpa fungsi).', 'Pembersihan Slop UI:'),
          createBullet('Semua teks dan label memenuhi rasio kontras WCAG AA/AAA (kontras hitam/putih tinggi) untuk kenyamanan mata pengguna dalam jam kerja panjang.', 'Aksesibilitas Kontras Tinggi:'),
          createBullet('Seluruh angka nominal rupiah diformat menggunakan font monospaced angka yang rata kanan, mempermudah perbandingan digit antar baris transaksi.', 'Tipografi Akuntansi Khusus:'),

          new Paragraph({ spacing: { before: 140, after: 0 }, children: [] }),

          // BAB X
          createHeading1('BAB X. MATRIKS REKAPITULASI PENCAPAIAN SISTEM (DETAILED FEATURE MATRIX)'),
          createParagraph(
            'Tabel berikut menyajikan rekapitulasi 25 fitur dan komponen utama yang telah diselesaikan secara tuntas dan telah diverifikasi beroperasi di lingkungan produksi Vercel:'
          ),
          createStyledTable(
            ['No', 'Komponen / Fitur', 'Deskripsi Hasil Pekerjaan', 'Status'],
            [
              ['1', 'Master Data COA', 'Standardisasi 75 akun 5-digit, normal balance debit/kredit, dan pos laporan.', '100% Selesai'],
              ['2', 'Voucher Jurnal Umum', 'Pencatatan memorial, barter, reklasifikasi dengan uji balance Rp 0.', '100% Selesai'],
              ['3', 'Voucher Kas Masuk/Keluar', 'Pencatatan kas kecil, transfer bank, dan biaya operasional rutin.', '100% Selesai'],
              ['4', 'Modul Penjualan & Piutang', 'Pencatatan faktur penjualan tunai/kredit dan buku pembantu piutang.', '100% Selesai'],
              ['5', 'Modul Pembelian & Utang', 'Pencatatan faktur pengadaan tunai/tempo dan buku pembantu utang.', '100% Selesai'],
              ['6', 'Buku Besar Interaktif', 'Buku besar per akun dengan saldo berjalan real-time dan filter periode.', '100% Selesai'],
              ['7', 'Neraca Saldo Otomatis', 'Agregasi seluruh saldo akhir akun dengan deteksi selisih keseimbangan.', '100% Selesai'],
              ['8', 'Neraca Lajur 10 Kolom', 'Kertas kerja akuntansi komprehensif (Saldo, Penyesuaian, NSSP, L/R, Neraca).', '100% Selesai'],
              ['9', 'Quick Report Terpadu', 'Konsolidasi Kas-Bank, Penjualan-Piutang, Pembelian-Hutang dalam tab bar.', '100% Selesai'],
              ['10', 'SPECTRA Auto Record', 'Ekstraksi struk thermal, nota fisik, dan nota tulis tangan dengan Gemini AI.', '100% Selesai'],
              ['11', 'Penomoran BT/XXXX/DDMYY', 'Standardisasi penomoran bukti transaksi otomatis yang sinkron ke database.', '100% Selesai'],
              ['12', 'Uji Aritmatika 2-Arah', 'Verifikasi otomatis perkalian baris item & penjumlahan vertikal grand total.', '100% Selesai'],
              ['13', 'Deteksi Selisih Kasir', 'Pemberitahuan anomali kesalahan hitung pada nota fisik toko penjual.', '100% Selesai'],
              ['14', 'Aturan POS A s.d. F', 'Pemetaan otomatis alur kas operasional, bank, utang, dan pajak daerah.', '100% Selesai'],
              ['15', 'Reset Transaksi 4-Lapis', 'Pembersihan serentak data lokal, Supabase, Google Sheet, dan Drive Trash.', '100% Selesai'],
              ['16', 'Jurnal Otomatis AI', 'Pemisahan modul pencatatan berkas dan formulasi jurnal akuntansi SAK.', '100% Selesai'],
              ['17', 'Auto-Create Account COA', 'Pembuatan otomatis akun baru di database saat transaksi baru terdeteksi.', '100% Selesai'],
              ['18', 'Google Apps Script Bot', 'Webhook otomatis pengisian baris A6:K pada sheet datasheet_bukti_transaksi.', '100% Selesai'],
              ['19', 'Dual Google Drive Isolation', 'Pemisahan folder data_web (aset web) dan Data Hasil Transaksi (bukti fisik).', '100% Selesai'],
              ['20', 'Database Supabase Cloud', 'Integrasi realtime cloud database PostgreSQL dengan persistensi otomatis.', '100% Selesai'],
              ['21', 'Laporan Keuangan Sederhana', 'Otomasi Laba Rugi, Posisi Keuangan, Perubahan Modal, dan Arus Kas Langsung.', '100% Selesai'],
              ['22', 'Laporan Resmi PSAK Bilingual', 'Laporan standar publik bilingual ID/EN lengkap CALK, ekspor PDF & Excel.', '100% Selesai'],
              ['23', 'Rekonsiliasi Fiskal 1771-I', 'Kertas kerja koreksi fiskal 12 FPO dan 4 FNE Coretax PER-11/PJ/2025.', '100% Selesai'],
              ['24', 'Laporan Keuangan Fiskal', 'Sidebar menu baru menyajikan laporan resmi pasca rekonsiliasi perpajakan.', '100% Selesai'],
              ['25', 'Audit UI/UX Anti-Slop', 'Optimalisasi dashboard, rasio kontras tinggi WCAG, dan booting screen.', '100% Selesai']
            ],
            [6, 26, 53, 15]
          ),

          new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

          // LEMBAR PENGESAHAN
          createHeading1('LEMBAR PENGESAHAN LAPORAN EKSEKUTIF'),
          createParagraph(
            'Dokumen Rekapitulasi Pengembangan dan Pencapaian Sistem Keuangan SPECTRA (SIKEU2) ini telah diperiksa, diverifikasi secara menyeluruh, dan disahkan oleh Direksi PT Nirwana Bhumi Energy pada tanggal yang tertera di bawah ini.'
          ),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 120, after: 120 },
            children: [
              new TextRun({
                text: 'Jakarta Selatan, 21 November 2026',
                font: FONT_FAMILY,
                bold: true,
                size: 21,
                color: '000000'
              })
            ]
          }),

          // Tanda Tangan Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    margins: { top: 60, bottom: 60, left: 60, right: 60 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'Disiapkan & Dilaporkan Oleh:', font: FONT_FAMILY, size: 20 }),
                        ]
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'DIREKTUR KEUANGAN / PENANGGUNG JAWAB', font: FONT_FAMILY, bold: true, size: 20 })
                        ]
                      }),
                      new Paragraph({ spacing: { before: 800, after: 0 }, children: [] }), // space for signature
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'MAZMUR GUSTI AGUNG LAROSA', font: FONT_FAMILY, bold: true, underline: {}, size: 21 })
                        ]
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'Direktur Keuangan PT Nirwana Bhumi Energy', font: FONT_FAMILY, size: 19, italics: true })
                        ]
                      })
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    margins: { top: 60, bottom: 60, left: 60, right: 60 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'Disetujui & Disahkan Oleh:', font: FONT_FAMILY, size: 20 }),
                        ]
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'DIREKTUR UTAMA', font: FONT_FAMILY, bold: true, size: 20 })
                        ]
                      }),
                      new Paragraph({ spacing: { before: 800, after: 0 }, children: [] }), // space for signature
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'SUDONO SALIM', font: FONT_FAMILY, bold: true, underline: {}, size: 21 })
                        ]
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'Direktur Utama PT Nirwana Bhumi Energy', font: FONT_FAMILY, size: 19, italics: true })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }
    ]
  });

  const outputPath = path.resolve('c:/Users/Mazmur Gusti Agung L/Documents/SIKEU2/Daftar_Pencapaian_Dan_Pekerjaan_SPECTRA.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document successfully generated at: ${outputPath}`);
  console.log(`File size: ${(buffer.length / 1024).toFixed(2)} KB`);
}

generateReportDocx().catch(err => {
  console.error("Error generating document:", err);
  process.exit(1);
});

