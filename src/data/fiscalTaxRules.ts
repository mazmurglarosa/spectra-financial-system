/**
 * Pustaka Aturan Koreksi & Rekonsiliasi Fiskal Perpajakan Indonesia
 *
 * Acuan Hukum Resmi:
 * 1. UU No. 7 Tahun 1983 tentang Pajak Penghasilan s.t.d.t.d. UU No. 7 Tahun 2021 (UU HPP)
 * 2. PMK No. 66 Tahun 2023 (Perlakuan PPh atas Penggantian/Imbalan dalam Bentuk Natura dan/atau Kenikmatan)
 * 3. PP No. 55 Tahun 2022 (Penyesuaian Pengaturan di Bidang PPh & PPh Final UMKM 0,5%)
 * 4. PER-11/PJ/2025 & Lampiran L1 Rekonsiliasi Laporan Keuangan Coretax DJP (FPO & FNE)
 * 5. Formulir 1771-I Lampiran I SPT Tahunan PPh Wajib Pajak Badan
 */

export type FiscalDirection = 'NONE' | 'FPO' | 'FNE';
export type DifferenceNature = 'NONE' | 'TETAP' | 'WAKTU';
export type TaxRegimeType = 'pasal31e' | 'pasal17' | 'umkm05';

export interface FiscalRuleCode {
  code: string;
  direction: 'FPO' | 'FNE';
  label: string;
  legalBasis: string;
  nature: 'TETAP' | 'WAKTU';
  form1771Ref: string;
  description: string;
  examples: string;
}

export interface OfficialTaxSource {
  id: string;
  title: string;
  publisher: string;
  regulationNumber: string;
  summary: string;
  url: string;
}

/**
 * Daftar Kode Penyesuaian Fiskal Positif (FPO) & Negatif (FNE)
 * Sesuai Lampiran L1 Coretax (PER-11/PJ/2025) & Formulir 1771-I Bagian B/C.
 */
export const FISCAL_RULE_CODES: FiscalRuleCode[] = [
  // KOREKSI FISKAL POSITIF (FPO) — Menambah Penghasilan Neto Fiskal
  {
    code: 'FPO-01',
    direction: 'FPO',
    label: 'Biaya Kepentingan Pribadi Pemegang Saham/Pemilik',
    legalBasis: 'UU PPh Pasal 9 ayat (1) huruf b & i',
    nature: 'TETAP',
    form1771Ref: '1771-I Bag. B No. 5a',
    description: 'Biaya yang dibebankan atau dikeluarkan untuk kepentingan pribadi pemegang saham, sekutu, anggota, atau Wajib Pajak dan tanggungannya.',
    examples: 'Biaya liburan keluarga direksi, perawatan rumah pribadi pemilik, atau cicilan kendaraan pribadi non-operasional.'
  },
  {
    code: 'FPO-02',
    direction: 'FPO',
    label: 'Premi Asuransi Kesehatan, Jiwa, Dwiguna & Beasiswa',
    legalBasis: 'UU PPh Pasal 9 ayat (1) huruf d',
    nature: 'TETAP',
    form1771Ref: '1771-I Bag. B No. 5c',
    description: 'Premi asuransi yang dibayar oleh Wajib Pajak orang pribadi atau yang tidak termasuk objek tunjangan pajak pegawai.',
    examples: 'Premi asuransi jiwa pemegang saham yang tidak berkaitan dengan penggantian penghasilan karyawan (bukan objek PPh 21).'
  },
  {
    code: 'FPO-03',
    direction: 'FPO',
    label: 'Natura atau Kenikmatan Non-Deductible (PMK 66/2023)',
    legalBasis: 'UU HPP Pasal 9 ayat (1) huruf e jo. PMK 66/2023',
    nature: 'TETAP',
    form1771Ref: '1771-I Bag. B No. 5d',
    description: 'Pemberian natura/kenikmatan yang tidak berkaitan dengan biaya 3M (Mendapatkan, Menagih, Memelihara penghasilan) atau diberikan khusus kepada pemegang saham.',
    examples: 'Bingkisan/fasilitas khusus pemegang saham atau pengeluaran hiburan keluarga tanpa kaitan usaha 3M.'
  },
  {
    code: 'FPO-04',
    direction: 'FPO',
    label: 'Imbalan Melebihi Kewajaran (Hubungan Istimewa)',
    legalBasis: 'UU PPh Pasal 9 ayat (1) huruf f',
    nature: 'TETAP',
    form1771Ref: '1771-I Bag. B No. 5e',
    description: 'Jumlah yang melebihi kewajaran yang dibayarkan kepada pemegang saham atau pihak yang mempunyai hubungan istimewa sebagai imbalan sehubungan dengan pekerjaan.',
    examples: 'Gaji atau bonus tidak wajar yang dibayarkan kepada komisaris/kerabat pemilik jauh di atas harga pasar jabatan sejenis.'
  },
  {
    code: 'FPO-05',
    direction: 'FPO',
    label: 'Harta yang Dihibahkan, Bantuan, atau Sumbangan',
    legalBasis: 'UU PPh Pasal 9 ayat (1) huruf g',
    nature: 'TETAP',
    form1771Ref: '1771-I Bag. B No. 5f',
    description: 'Sumbangan atau bantuan yang tidak memenuhi pengecualian khusus (bukan penanggulangan bencana nasional, litbang, infrastruktur sosial, pendidikan, atau zakat lembaga resmi).',
    examples: 'Sumbangan perayaan lingkungan/ormas tanpa dasar peraturan pemerintah.'
  },
  {
    code: 'FPO-06',
    direction: 'FPO',
    label: 'Pajak Penghasilan (PPh) yang Dibebankan Perusahaan',
    legalBasis: 'UU PPh Pasal 9 ayat (1) huruf h',
    nature: 'TETAP',
    form1771Ref: '1771-I Bag. B No. 5g',
    description: 'Pajak Penghasilan (PPh Pasal 21 ditanggung perusahaan non-tunjangan, PPh Pasal 25/29 Badan, PPh Final) yang dicatat sebagai biaya usaha.',
    examples: 'Akun Beban Pajak Penghasilan (50018), angsuran PPh 25 yang dibiayakan, atau PPh 21 karyawan yang ditanggung tanpa gross-up.'
  },
  {
    code: 'FPO-07',
    direction: 'FPO',
    label: 'Gaji yang Dibayarkan kepada Pemilik (CV / Firma)',
    legalBasis: 'UU PPh Pasal 9 ayat (1) huruf j',
    nature: 'TETAP',
    form1771Ref: '1771-I Bag. B No. 5h',
    description: 'Gaji yang dibayarkan kepada anggota persekutuan, firma, atau perseroan komanditer (CV) yang modalnya tidak terbagi atas saham.',
    examples: 'Pengambilan rutin bulanan sekutu aktif pada CV/Firma yang dicatat sebagai beban gaji.'
  },
  {
    code: 'FPO-08',
    direction: 'FPO',
    label: 'Sanksi Administrasi & Denda Perpajakan',
    legalBasis: 'UU PPh Pasal 9 ayat (1) huruf k',
    nature: 'TETAP',
    form1771Ref: '1771-I Bag. B No. 5i',
    description: 'Sanksi administrasi berupa bunga, denda, dan kenaikan serta sanksi pidana berupa denda yang berkenaan dengan pelaksanaan perundang-undangan perpajakan.',
    examples: 'Denda keterlambatan lapor SPT, bunga STP/SKPKB DJP.'
  },
  {
    code: 'FPO-09',
    direction: 'FPO',
    label: 'Selisih Penyusutan Komersial > Penyusutan Fiskal',
    legalBasis: 'UU PPh Pasal 11 jo. PMK 72/2023',
    nature: 'WAKTU',
    form1771Ref: '1771-I Bag. B No. 5j',
    description: 'Selisih lebih beban penyusutan aset berwujud secara komersial (SAK) dibandingkan batas tarif dan masa manfaat kelompok aset fiskal.',
    examples: 'Perusahaan menyusutkan mesin 4 tahun (25%/th), sedangkan kelompok 2 fiskal menetapkan 8 tahun (12,5%/th).'
  },
  {
    code: 'FPO-10',
    direction: 'FPO',
    label: 'Selisih Amortisasi Komersial > Amortisasi Fiskal',
    legalBasis: 'UU PPh Pasal 11A',
    nature: 'WAKTU',
    form1771Ref: '1771-I Bag. B No. 5k',
    description: 'Selisih lebih beban amortisasi aset tak berwujud secara komersial dibandingkan ketentuan perpajakan.',
    examples: 'Amortisasi lisensi software komersial lebih cepat dari masa manfaat kelompok fiskalnya.'
  },
  {
    code: 'FPO-11',
    direction: 'FPO',
    label: 'Biaya untuk Penghasilan PPh Final & Non-Objek Pajak',
    legalBasis: 'PP No. 94 Tahun 2010 Pasal 13 / Pasal 6',
    nature: 'TETAP',
    form1771Ref: '1771-I Bag. B No. 5l',
    description: 'Biaya yang dikeluarkan untuk mendapatkan, menagih, dan memelihara penghasilan yang dikenakan PPh bersifat final atau bukan objek pajak.',
    examples: 'Biaya pemeliharaan gedung yang disewakan (objek PPh Final Ps. 4(2)) atau biaya administrasi bunga deposito.'
  },
  {
    code: 'FPO-12',
    direction: 'FPO',
    label: 'Penyesuaian Fiskal Positif Lainnya (Cadangan / Biaya Non-3M)',
    legalBasis: 'UU PPh Pasal 9 ayat (1) huruf a, c & Pasal 6',
    nature: 'WAKTU',
    form1771Ref: '1771-I Bag. B No. 5m',
    description: 'Pembentukan dana cadangan (kecuali bank/asuransi), pembagian laba/dividen yang dibebankan, atau biaya tanpa daftar nominatif promosi/entertainment.',
    examples: 'Cadangan penyisihan piutang tak tertagih non-bank (50005), biaya entertainment tanpa daftar nominatif.'
  },

  // KOREKSI FISKAL NEGATIF (FNE) — Mengurangi Penghasilan Neto Fiskal
  {
    code: 'FNE-01',
    direction: 'FNE',
    label: 'Penghasilan Dikenakan PPh Final / Bukan Objek Pajak',
    legalBasis: 'UU PPh Pasal 4 ayat (2) & Pasal 4 ayat (3)',
    nature: 'TETAP',
    form1771Ref: '1771-I Bag. A No. 4 / Bag. C',
    description: 'Penghasilan yang tercatat di Laba Rugi Komersial tetapi secara fiskal sudah dikenakan PPh Final (bunga bank, sewa gedung, jasa konstruksi final) atau dikecualikan dari objek pajak.',
    examples: 'Pendapatan Bunga Bank/Deposito (41001), Pendapatan Sewa Tanah/Bangunan, atau Dividen Dalam Negeri sesuai syarat UU HPP.'
  },
  {
    code: 'FNE-02',
    direction: 'FNE',
    label: 'Selisih Penyusutan Komersial < Penyusutan Fiskal',
    legalBasis: 'UU PPh Pasal 6 ayat (1) huruf b & Pasal 11',
    nature: 'WAKTU',
    form1771Ref: '1771-I Bag. C No. 6a',
    description: 'Selisih kurang penyusutan komersial apabila metode atau masa manfaat fiskal menghasilkan beban penyusutan yang lebih besar di tahun berjalan.',
    examples: 'Perusahaan memakai metode garis lurus 10 tahun, sedangkan fiskal menggunakan saldo menurun kelompok 2 (8 tahun).'
  },
  {
    code: 'FNE-03',
    direction: 'FNE',
    label: 'Selisih Amortisasi Komersial < Amortisasi Fiskal',
    legalBasis: 'UU PPh Pasal 6 ayat (1) huruf b & Pasal 11A',
    nature: 'WAKTU',
    form1771Ref: '1771-I Bag. C No. 6b',
    description: 'Selisih kurang amortisasi komersial apabila tarif amortisasi fiskal aset tak berwujud lebih tinggi dari pembukuan akuntansi.',
    examples: 'Hak paten disusutkan lebih besar secara fiskal dengan metode saldo menurun.'
  },
  {
    code: 'FNE-04',
    direction: 'FNE',
    label: 'Penyesuaian Fiskal Negatif Lainnya',
    legalBasis: 'UU PPh Pasal 6 & Ketentuan Pelaksanaan DJP',
    nature: 'WAKTU',
    form1771Ref: '1771-I Bag. C No. 6c',
    description: 'Penurunan pendapatan neto fiskal lainnya seperti pembalikan beda waktu cadangan atau pengurangan biaya fiskal periode berjalan.',
    examples: 'Penghapusan nyata piutang tak tertagih yang memenuhi syarat Pasal 6(1)h UU PPh setelah sebelumnya dicadangkan.'
  }
];

export const OFFICIAL_TAX_SOURCES: OfficialTaxSource[] = [
  {
    id: 'src-djp-hpp',
    title: 'UU No. 7 Tahun 2021 tentang Harmonisasi Peraturan Perpajakan (UU HPP)',
    publisher: 'Direktorat Jenderal Pajak (pajak.go.id)',
    regulationNumber: 'UU HPP — Klaster PPh Badan 22% & Natura',
    summary: 'Menetapkan tarif umum PPh Badan sebesar 22%, penyesuaian lapisan penghasilan, serta perluasan objek & pembebanan imbalan natura/kenikmatan.',
    url: 'https://www.pajak.go.id/id/undang-undang-nomor-7-tahun-2021'
  },
  {
    id: 'src-pmk-66',
    title: 'PMK Nomor 66 Tahun 2023 tentang Perlakuan PPh atas Natura dan/atau Kenikmatan',
    publisher: 'Kementerian Keuangan RI / JDIH Kemenkeu',
    regulationNumber: 'PMK 66/PMK.03/2023',
    summary: 'Mengatur batasan fasilitas makanan/minuman, fasilitas kerja (laptop/seragam/safety), daerah tertentu, serta kriteria deductible vs non-deductible atas biaya natura.',
    url: 'https://jdih.kemenkeu.go.id/'
  },
  {
    id: 'src-per-11',
    title: 'PER-11/PJ/2025 — Tata Cara Pelaporan SPT Tahunan PPh Badan di Coretax (Lampiran L1)',
    publisher: 'Direktorat Jenderal Pajak (PER-11/PJ/2025)',
    regulationNumber: 'PER-11/PJ/2025 (FPO-01..12 & FNE-01..04)',
    summary: 'Standardisasi pengisian rekonsiliasi laporan keuangan komersial-fiskal per akun Laba Rugi menggunakan Kode Penyesuaian Fiskal Positif (FPO) dan Negatif (FNE).',
    url: 'https://www.pajak.go.id/'
  },
  {
    id: 'src-ortax-1771',
    title: 'Panduan Rekonsiliasi Fiskal Formulir 1771-I & Fasilitas Tarif Pasal 31E UU PPh',
    publisher: 'Ortax / Pajakku / DDTC News',
    regulationNumber: 'UU PPh Pasal 4, 6, 9, 17 & Pasal 31E ayat (1)',
    summary: 'Rumus tarif efektif 11% (pengurangan 50% dari tarif 22%) untuk peredaran bruto sampai Rp 4,8 Miliar dan proporsi hingga Rp 50 Miliar.',
    url: 'https://datacenter.ortax.org/'
  }
];

export interface AutoFiscalSuggestion {
  ruleCode: string;
  direction: FiscalDirection;
  nature: DifferenceNature;
  positiveAmount: number;
  negativeAmount: number;
  reason: string;
}

/**
 * Menganalisis akun Laba Rugi (Lr) secara deterministik untuk mendeteksi
 * kemungkinan koreksi fiskal awal berdasarkan kode akun & nama akun COA SPECTRA.
 */
export function detectAutoFiscalSuggestion(
  accountCode: string,
  accountName: string,
  category: string,
  commercialAmount: number
): AutoFiscalSuggestion {
  const lower = accountName.toLowerCase();
  const absAmount = Math.max(0, Math.round(commercialAmount));

  // 1. Beban Pajak Penghasilan (50018 atau mengandung "pajak penghasilan" / "pph") -> FPO-06 Full Positive
  if (
    accountCode === '50018' ||
    lower.includes('pajak penghasilan') ||
    lower.includes('beban pph')
  ) {
    return {
      ruleCode: 'FPO-06',
      direction: 'FPO',
      nature: 'TETAP',
      positiveAmount: absAmount,
      negativeAmount: 0,
      reason: 'Deteksi Otomatis (Ps. 9(1)h UU PPh): Pajak Penghasilan yang dibebankan di Laba Rugi tidak boleh menjadi pengurang laba fiskal.'
    };
  }

  // 2. Pendapatan Bunga Bank / Deposito / Jasa Giro (41001) -> FNE-01 Full Negative (PPh Final Pasal 4(2))
  if (
    accountCode === '41001' ||
    (category === 'PENDAPATAN_NON_OPERASIONAL' && lower.includes('bunga'))
  ) {
    return {
      ruleCode: 'FNE-01',
      direction: 'FNE',
      nature: 'TETAP',
      positiveAmount: 0,
      negativeAmount: absAmount,
      reason: 'Deteksi Otomatis (Ps. 4(2) UU PPh): Pendapatan bunga bank/deposito dikenakan PPh Final sehingga dikeluarkan dari PKP umum.'
    };
  }

  // 3. Denda / Sanksi Pajak eksplisit -> FPO-08 Full Positive
  if (lower.includes('sanksi') || lower.includes('denda pajak')) {
    return {
      ruleCode: 'FPO-08',
      direction: 'FPO',
      nature: 'TETAP',
      positiveAmount: absAmount,
      negativeAmount: 0,
      reason: 'Deteksi Otomatis (Ps. 9(1)k UU PPh): Sanksi administrasi & denda pajak merupakan Non-Deductible Expense.'
    };
  }

  // 4. Sumbangan / Hibah -> FPO-05 Full Positive
  if (lower.includes('sumbangan') || lower.includes('hibah')) {
    return {
      ruleCode: 'FPO-05',
      direction: 'FPO',
      nature: 'TETAP',
      positiveAmount: absAmount,
      negativeAmount: 0,
      reason: 'Deteksi Otomatis (Ps. 9(1)g UU PPh): Sumbangan non-resmi dikoreksi positif.'
    };
  }

  // 5. Cadangan / Penyesuaian Piutang (50005) -> Flag FPO-12 Beda Waktu (Default full correction jika berupa pencadangan)
  if (accountCode === '50005' || lower.includes('penyisihan piutang') || lower.includes('cadangan piutang')) {
    return {
      ruleCode: 'FPO-12',
      direction: 'FPO',
      nature: 'WAKTU',
      positiveAmount: absAmount,
      negativeAmount: 0,
      reason: 'Deteksi Otomatis (Ps. 9(1)c UU PPh): Pencadangan piutang tidak deductible (kecuali penghapusan nyata memenuhi Ps. 6(1)h); dapat disesuaikan.'
    };
  }

  // Default: Deductible / Taxable (Tidak ada koreksi, nilai penyesuaian = 0)
  return {
    ruleCode: '',
    direction: 'NONE',
    nature: 'NONE',
    positiveAmount: 0,
    negativeAmount: 0,
    reason: ''
  };
}
