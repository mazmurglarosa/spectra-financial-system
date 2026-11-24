import ExcelJS from 'exceljs';
import path from 'path';

// Palette Colors (Professional Slate / Navy Corporate Theme)
const COLORS = {
  headerBg: 'FF1E293B',       // Slate 800
  headerText: 'FFFFFFFF',     // White
  subHeaderBg: 'FF334155',    // Slate 700
  accentBg: 'FF0EA5E9',       // Sky Blue 500
  zebraRow: 'FFF8FAFC',       // Slate 50
  whiteRow: 'FFFFFFFF',       // White
  borderGray: 'FFE2E8F0',     // Slate 200
  borderDark: 'FF94A3B8',     // Slate 400
  successBg: 'FFDCFCE7',      // Green 100
  successText: 'FF166534',    // Green 800
  warningBg: 'FFFEF3C7',      // Amber 100
  warningText: 'FF92400E',    // Amber 800
  infoBg: 'FFE0F2FE',         // Sky 100
  infoText: 'FF075985',       // Sky 800
  purpleBg: 'FFF3E8FF',       // Purple 100
  purpleText: 'FF6B21A8'      // Purple 800
};

// Helper for cell borders
const thinBorder = {
  top: { style: 'thin', color: { argb: COLORS.borderDark } },
  bottom: { style: 'thin', color: { argb: COLORS.borderDark } },
  left: { style: 'thin', color: { argb: COLORS.borderDark } },
  right: { style: 'thin', color: { argb: COLORS.borderDark } }
};

const doubleBottomBorder = {
  top: { style: 'thin', color: { argb: COLORS.borderDark } },
  bottom: { style: 'double', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: COLORS.borderDark } },
  right: { style: 'thin', color: { argb: COLORS.borderDark } }
};

// List of all commits mapped chronologically to logbook entries
const logEntries = [
  {
    id: 'LOG-001',
    hash: 'f638663',
    date: '2026-10-04',
    phase: 'Fase 1: Fondasi SIKEU',
    category: 'Fitur Baru',
    module: 'Sistem Inti',
    title: 'Inisialisasi SPECTRA Financial System (Accurate Standard)',
    description: 'Inisiasi arsitektur dasar sistem pembukuan keuangan modern berbasis Vite, React, dan TypeScript yang mereplikasi standar SIKEU Accurate.',
    impact: 'Fondasi awal aplikasi akuntansi double-entry terkomputerisasi.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-002',
    hash: 'cf16dbd',
    date: '2026-10-04',
    phase: 'Fase 1: Fondasi SIKEU',
    category: 'Konfigurasi',
    module: 'Deployment',
    title: 'Konfigurasi Base Path Vite untuk Deployment Universal',
    description: 'Penyesuaian konfigurasi vite.config.ts agar aplikasi dapat di-deploy secara portabel pada root maupun subpath hosting.',
    impact: 'Memastikan aset static (CSS, JS, images) dapat dimuat dengan lancar di berbagai platform.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-003',
    hash: '64a7669',
    date: '2026-10-04',
    phase: 'Fase 1: Fondasi SIKEU',
    category: 'Fitur Baru',
    module: 'Voucher & Modul',
    title: 'Replikasi Alur Transaksi Voucher SIKEU & Sistem Otentikasi',
    description: 'Pembangunan modul voucher transaksi (Kas Masuk, Kas Keluar, Jurnal Umum, Pembelian, Penjualan) serta flow login pengguna.',
    impact: 'Pengguna dapat mencatat transaksi akuntansi dengan format voucher standar industri.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-004',
    hash: '645997d',
    date: '2026-10-04',
    phase: 'Fase 1: Fondasi SIKEU',
    category: 'Perbaikan Bug',
    module: 'Stabilitas Sistem',
    title: 'Penanganan White Screen & Implementasi ErrorBoundary',
    description: 'Menambahkan data normalizers, validasi ketat array baris transaksi, komponen ErrorBoundary, dan mekanisme self-healing darurat.',
    impact: 'Mencegah terjadinya aplikasi crash/layar putih akibat data korup atau struktur baris tidak lengkap.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-005',
    hash: '71991a6',
    date: '2026-10-04',
    phase: 'Fase 1: Fondasi SIKEU',
    category: 'Fitur Baru',
    module: 'Cloud Backend',
    title: 'Skema Backend Convex & Konfigurasi Cloudflare Pages / Vercel',
    description: 'Penambahan konfigurasi serverless, schema backend Convex, serta routing Vercel dan Cloudflare Pages.',
    impact: 'Fleksibilitas multi-backend hosting untuk mendukung ketersediaan tinggi.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-006',
    hash: 'ad1ec00',
    date: '2026-10-04',
    phase: 'Fase 1: Fondasi SIKEU',
    category: 'Deployment',
    module: 'Domain Resmi',
    title: 'Penetapan URL Resmi Produksi Vercel',
    description: 'Penyelarasan konfigurasi domain produksi resmi ke https://spectra-financial-system.vercel.app/ dan indikator status cloud online.',
    impact: 'Aplikasi dapat diakses oleh manajemen dari mana saja secara online.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-007',
    hash: '44d83b2',
    date: '2026-10-04',
    phase: 'Fase 1: Fondasi SIKEU',
    category: 'Fitur Baru',
    module: 'PWA Mobile',
    title: 'Implementasi Dukungan Progressive Web App (PWA)',
    description: 'Penyediaan banner install PWA, modal panduan instalasi, file webmanifest, dan service worker untuk instalasi di smartphone/desktop.',
    impact: 'Sistem dapat di-install layaknya aplikasi native pada ponsel Android/iOS dan laptop.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-008',
    hash: 'ae3cd77',
    date: '2026-10-04',
    phase: 'Fase 1: Fondasi SIKEU',
    category: 'Fitur Baru',
    module: 'REST API',
    title: 'Penyediaan Endpoint REST API & Playground Dokumentasi',
    description: 'Pembangunan API serverless untuk integrasi data keuangan serta modal dokumentasi interaktif untuk pengujian developer.',
    impact: 'Membuka gerbang integrasi data keuangan dengan sistem eksternal perusahaan.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-009',
    hash: '8a94bec',
    date: '2026-10-04',
    phase: 'Fase 1: Fondasi SIKEU',
    category: 'UI/UX',
    module: 'Pengaturan',
    title: 'Relokasi Banner PWA & Integrasi API ke Tab Pengaturan',
    description: 'Merelokasi banner PWA dan API documentation ke dalam halaman Pengaturan Perusahaan agar dashboard utama tetap bersih.',
    impact: 'Tampilan antarmuka dashboard menjadi lebih fokus pada data keuangan.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-010',
    hash: '893a7c4',
    date: '2026-10-04',
    phase: 'Fase 1: Fondasi SIKEU',
    category: 'Tata Kelola',
    module: 'Laporan Resmi',
    title: 'Standardisasi Jabatan Direktur Keuangan pada Lembar Tanda Tangan',
    description: 'Memperbarui default jabatan penandatangan laporan dari Akuntan menjadi Direktur Keuangan atas nama Mazmur Gusti Agung L.',
    impact: 'Legitimasi formal dokumen keuangan PT Nirwana Bhumi Energy di mata auditor & bank.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-011',
    hash: '7d964b8',
    date: '2026-10-04',
    phase: 'Fase 1: Fondasi SIKEU',
    category: 'Fitur Baru',
    module: 'Laporan PSAK',
    title: 'Implementasi Laporan Resmi PSAK Bilingual (ID/EN) & Ekspor Excel',
    description: 'Penyusunan modul Laporan Posisi Keuangan, Laba Rugi Komprehensif, Perubahan Ekuitas, Arus Kas, dan CALK standar emiten publik bilingual.',
    impact: 'Perusahaan dapat menerbitkan laporan keuangan terstandardisasi untuk pihak ketiga/auditor.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-012',
    hash: '150a7c5',
    date: '2026-10-04',
    phase: 'Fase 1: Fondasi SIKEU',
    category: 'Fitur Baru',
    module: 'Pengaturan Data',
    title: 'Kustomisasi Nama Direktur Utama, Direktur Keuangan, & Live Preview',
    description: 'Menyediakan form pengaturan nama pejabat (Sudono Salim & Mazmur Gusti Agung L) yang tersinkronisasi otomatis ke seluruh laporan.',
    impact: 'Kemudahan personalisasi entitas tanpa perlu mengubah baris kode program.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-013',
    hash: '4098028',
    date: '2026-10-04',
    phase: 'Fase 1: Fondasi SIKEU',
    category: 'Fitur Baru',
    module: 'Administrator',
    title: 'Fitur Reset Sistem Pengosongan 0 Transaksi & Saldo Awal',
    description: 'Penyediaan fungsi reset komprehensif untuk mengembalikan pembukuan ke titik nol pada awal periode akuntansi.',
    impact: 'Memudahkan penutupan buku dan migrasi saldo awal baru.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-014',
    hash: '4db9bbc',
    date: '2026-10-15',
    phase: 'Fase 2: Cloud Enterprise',
    category: 'Integrasi Cloud',
    module: 'Database Cloud',
    title: 'Integrasi Cloud Database Supabase PostgreSQL & MCP Server',
    description: 'Penghubungan aplikasi ke database PostgreSQL terkelola di Supabase untuk sinkronisasi relasional real-time.',
    impact: 'Penyimpanan data keuangan menjadi persisten di awan dengan keamanan tingkat enterprise.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-015',
    hash: '04bba1a',
    date: '2026-10-15',
    phase: 'Fase 2: Cloud Enterprise',
    category: 'Keamanan',
    module: 'Database Cloud',
    title: 'Konfigurasi Token Otorisasi Aman Database Supabase',
    description: 'Pengamanan komunikasi client-server dengan access token dan kebijakan Row Level Security (RLS).',
    impact: 'Melindungi data sensitif perusahaan dari akses pihak luar yang tidak memiliki wewenang.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-016',
    hash: 'd90663f',
    date: '2026-10-15',
    phase: 'Fase 2: Cloud Enterprise',
    category: 'Integrasi Cloud',
    module: 'Database Cloud',
    title: 'Default Kredensial Supabase pada Frontend Client',
    description: 'Penyediaan fallback kredensial otomatis agar pengguna dapat langsung terhubung ke database cloud tanpa konfigurasi manual.',
    impact: 'Proses onboarding dan inisialisasi aplikasi berjalan seketika (zero config).',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-017',
    hash: 'dcaafe1',
    date: '2026-10-15',
    phase: 'Fase 2: Cloud Enterprise',
    category: 'Fitur Baru',
    module: 'Sinkronisasi',
    title: 'Otomatisasi Sinkronisasi Supabase on Mount & Responsive Mobile Drawer',
    description: 'Sinkronisasi instan saat pertama kali aplikasi dibuka serta penambahan drawer navigasi yang adaptif untuk layar sentuh/ponsel.',
    impact: 'Data selalu mutakhir saat dibuka dari perangkat mana pun.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-018',
    hash: '0122357',
    date: '2026-10-15',
    phase: 'Fase 2: Cloud Enterprise',
    category: 'Refactoring',
    module: 'UI/UX & Kode',
    title: 'Audit Anti-Slop 001: Peningkatan Aksesibilitas UI & Kebersihan Kode',
    description: 'Menghilangkan kode redundant, memperbaiki kontras warna teks, dan standardisasi penamaan variabel.',
    impact: 'Meningkatkan performa rendering dan keterbacaan antarmuka pengguna.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-019',
    hash: 'deae4ae',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'UI/UX',
    module: 'Laporan Sederhana',
    title: 'Penggabungan 6 Laporan Keuangan ke Menu Laporan Sederhana',
    description: 'Menyatukan Laba Rugi, Posisi Keuangan, Perubahan Ekuitas, dan Arus Kas ke dalam satu tab bar horizontal yang kompak.',
    impact: 'Mereduksi jumlah item menu samping sehingga navigasi menjadi lebih ringkas.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-020',
    hash: 'e11aa15',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'UI/UX',
    module: 'Quick Report',
    title: 'Pembangunan Menu Terpadu Quick Report',
    description: 'Konsolidasi modul Kas & Bank, Penjualan & Piutang, serta Pembelian & Utang ke dalam satu slidebar Quick Report.',
    impact: 'Pemeriksaan operasional harian kas dan buku pembantu dapat dilakukan dalam 1 klik.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-021',
    hash: '82bc569',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Desain Visual',
    module: 'Tema Sistem',
    title: 'Penyelarasan Color Palette ke Tema Light Enterprise NBE',
    description: 'Mengubah tema visual dari gelap ke nuansa terang berwibawa (Light Corporate Enterprise) khas industri energi.',
    impact: 'Tampilan lebih segar, formal, dan nyaman digunakan untuk inspeksi angka.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-022',
    hash: 'd528f76',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Fitur Baru',
    module: 'Administrator',
    title: 'Pemindahan Tab REST API & Reset ke Panel Administrator',
    description: 'Mengisolasi fungsi-fungsi teknis berisiko tinggi ke dalam panel khusus yang memerlukan hak akses administratif.',
    impact: 'Mencegah eksekusi reset yang tidak disengaja oleh operator umum.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-023',
    hash: '7200523',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Perbaikan Bug',
    module: 'Periode Akuntansi',
    title: 'Sinkronisasi Tahun Buku 2026 & MonthYearPicker Tanpa Tanggal',
    description: 'Menyelaraskan tahun buku operasional ke 2026 dan mengganti picker tanggal menjadi pemilih Bulan & Tahun akuntansi.',
    impact: 'Sesuai dengan siklus pembukuan bulanan perusahaan.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-024',
    hash: '3b291d7',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'UI/UX',
    module: 'Header & Navigasi',
    title: 'Trigger Modal Sync pada Enterprise Cloud Active & Logo Navigasi',
    description: 'Menjadikan badge Enterprise Cloud Active sebagai trigger info koneksi dan logo NBE sebagai tombol beranda.',
    impact: 'Interaksi pengguna menjadi lebih intuitif dan modern.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-025',
    hash: 'a45aa71',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'UI/UX',
    module: 'Dashboard',
    title: 'Penyusunan Ulang Dashboard: Total Transaksi Memanjang & 5 Kolom Metrik',
    description: 'Merestrukturisasi kartu metrik dashboard menjadi 5 pilar seimbang: Aset, Liabilitas, Ekuitas, Pendapatan, dan Beban.',
    impact: 'Sekilas pandang (at a glance) kesehatan keuangan perusahaan tersaji jelas.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-026',
    hash: '15a6c03',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Perbaikan Akuntansi',
    module: 'COA & Laporan',
    title: 'Koreksi Saldo Normal Akun Utang & Navigasi Laporan Resmi',
    description: 'Menetapkan saldo normal kredit pada akun golongan utang dan memperbaiki tautan navigasi Laporan Resmi.',
    impact: 'Memastikan kalkulasi matematis neraca tidak mengalami anomali saldo minus.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-027',
    hash: 'dbe2db7',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Fitur Baru',
    module: 'Dashboard Grafik',
    title: 'Penambahan Grafik Tren 5 Pilar Keuangan Real-Time',
    description: 'Membangun visualisasi grafik area/batang interaktif yang membandingkan tren 5 komponen neraca dan laba rugi.',
    impact: 'Manajemen dapat membaca arah pertumbuhan keuangan perusahaan secara visual.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-028',
    hash: 'a75833e',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Desain Visual',
    module: 'Halaman Login',
    title: 'Pembaruan Halaman Login Modern & Tab Kontrol Tampilan Web',
    description: 'Mengubah tampilan gerbang masuk sistem dengan gaya korporat modern, gambar representatif industri, dan quote kepemimpinan.',
    impact: 'Meningkatkan citra profesional sistem di hadapan jajaran eksekutif.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-029',
    hash: '3630961',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Tata Kelola',
    module: 'Administrator',
    title: 'Pemindahan Tab Kontrol Tampilan Web ke Administrator',
    description: 'Menempatkan kendali penggantian logo, background, dan rasio tampilan ke dalam wewenang Administrator.',
    impact: 'Konsistensi identitas visual sistem tetap terjaga dari pengubahan sembarang orang.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-030',
    hash: '7173b9d',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Fitur Baru',
    module: 'Booting & Login',
    title: 'Rasio Login 65:35, Waktu Booting 5 Detik, & Kontrol Crop Gambar',
    description: 'Menyediakan slider posisi X/Y, zoom gambar, filter kegelapan, dan animasi booting 5 detik yang mulus.',
    impact: 'Pengguna dapat menyesuaikan wallpaper layar tanpa merusak estetika antarmuka.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-031',
    hash: '232b108',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Perbaikan Akuntansi',
    module: 'COA Master',
    title: 'Auto-Sorting Daftar Akun COA dari Kode 1 Sampai 5',
    description: 'Mengurutkan secara ketat daftar akun mulai dari Harta, Utang, Modal, Pendapatan, hingga Beban secara otomatis.',
    impact: 'Mempermudah pencarian nomor akun dalam pencatatan voucher.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-032',
    hash: 'e6dc97a',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Integrasi Cloud',
    module: 'Supabase Database',
    title: 'Auto-Save Saldo Akun & Background ke Supabase & Kompresi HD',
    description: 'Menyimpan konfigurasi visual dan saldo akun secara otomatis ke database cloud serta kompresi cerdas file gambar.',
    impact: 'Mencegah hilangnya data konfigurasi saat pengguna memuat ulang (refresh) peramban.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-033',
    hash: '35e4d63',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Fitur Baru',
    module: 'Diagnostik Sistem',
    title: 'Realtime Connection Diagnostics & Penghapusan Teks Logo NBE',
    description: 'Membangun modal diagnostik kesehatan sistem (Supabase, Bot, Drive, Local) dan merapikan grafis logo.',
    impact: 'Transparansi status jaringan dan koneksi server bagi administrator.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-034',
    hash: '23f9f68',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Integrasi Cloud',
    module: 'Google Drive Bot',
    title: 'Integrasi Google Drive Storage Bot untuk Berkas Berat',
    description: 'Menghubungkan sistem ke bot Google Drive untuk meng-offload gambar bukti transaksi demi menjaga kuota Supabase.',
    impact: 'Efisiensi biaya dan perlindungan kuota basis data relasional.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-035',
    hash: '22cc440',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'UI/UX',
    module: 'Dashboard',
    title: 'Pembersihan Badge Pills Dekoratif yang Berlebihan',
    description: 'Menghilangkan badge-badge mengambang yang tidak memiliki interaksi fungsional.',
    impact: 'Antarmuka lebih lapang, bersih, dan mematuhi kaidah anti-slop.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-036',
    hash: '5dcc208',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'UI/UX',
    module: 'Pembersihan UI',
    title: 'Penghapusan Banner Pemberitahuan Statis & Audit Anti-Slop Enterprise',
    description: 'Menghapus banner statis informasi dan menggantinya dengan dialog kontekstual saat dibutuhkan saja.',
    impact: 'Memaksimalkan ruang kerja tabel akuntansi di layar pengguna.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-037',
    hash: '8dd6d80',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Integritas Data',
    module: 'Data Awal',
    title: 'Pembersihan Data Dummy Transaksi Bawaan & Saldo Bersih Nol',
    description: 'Mengosongkan contoh transaksi buatan pabrik sehingga sistem siap diisi data riil PT Nirwana Bhumi Energy.',
    impact: 'Mencegah tercampurnya data uji coba dengan pembukuan resmi.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-038',
    hash: 'de903e1',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Desain Visual',
    module: 'Dashboard',
    title: 'Pembaruan Layout Dashboard Simpel & Minimalis Sesuai Wireframe',
    description: 'Menyusun tata letak dashboard yang seimbang, presisi, dan proporsional sesuai wireframe yang disepakati.',
    impact: 'Tampilan kelas enterprise yang meningkatkan produktivitas staf akuntansi.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-039',
    hash: '6648cf9',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'UI/UX',
    module: 'Dashboard Grafik',
    title: 'Penyelarasan Tinggi Grafik & Penamaan Wadah "KONDISI REAL TIME"',
    description: 'Menyamakan tinggi kontainer grafik tren dengan kartu metrik di sampingnya agar estetika visual simetris.',
    impact: 'Kerapian tata letak bebas distorsi visual.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-040',
    hash: '60ed11f',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'UI/UX',
    module: 'Dashboard',
    title: 'Penyatuan 7 Kartu Metrik & Grafik Tren dalam 1 Grup Kesatuan',
    description: 'Membungkus 7 ringkasan keuangan dan grafik dalam satu bingkai bergaris tegas yang kokoh.',
    impact: 'Mempertegas hierarki informasi utama sistem.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-041',
    hash: '28d62ee',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Desain Visual',
    module: 'Header & Booting',
    title: 'Implementasi Desain Prom UI: Header Banner, Foto Profil, & Booting',
    description: 'Menerapkan arahan Prom UI dengan banner latar belakang di header dashboard dan foto profil pengguna.',
    impact: 'Pengalaman visual yang personal dan berkelas korporat tinggi.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-042',
    hash: '7e6ed36',
    date: '2026-10-24',
    phase: 'Fase 3: Modernisasi UI/UX',
    category: 'Fitur Baru',
    module: 'Backup & Restore',
    title: 'Standardisasi File Trial Spectra.json untuk Fitur Pulihkan Data',
    description: 'Menciptakan berkas JSON standar trial yang memuat master COA dan transaksi berimbang untuk pengujian instan.',
    impact: 'Sistem dapat dipulihkan kapan saja ke kondisi demonstrasi yang sempurna.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-043',
    hash: '94d1609',
    date: '2026-10-26',
    phase: 'Fase 4: Auto Record & OCR',
    category: 'Fitur Baru',
    module: 'Auto Record',
    title: 'Implementasi Modul Auto Record & Pipeline OCR/HTR (Updatesistem1)',
    description: 'Membangun pipeline penerimaan berkas bukti transaksi, pemindaian teks cetak dan tulisan tangan, serta parsing akuntansi.',
    impact: 'Revolusi otomasi pencatatan dari foto kuitansi/struk langsung menjadi draf jurnal.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-044',
    hash: 'd0e305a',
    date: '2026-10-26',
    phase: 'Fase 4: Auto Record & OCR',
    category: 'Perbaikan Fitur',
    module: 'Auto Record',
    title: 'Eksekusi Pembuatan Akun Baru COA Seketika Tanpa Saran Tertunda',
    description: 'Mengubah flow konfirmasi COA baru agar langsung mengeksekusi penambahan akun ke database secara otomatis.',
    impact: 'Menghilangkan hambatan klik berulang saat memproses nota yang memuat pos biaya baru.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-045',
    hash: 'fb8c9d3',
    date: '2026-10-26',
    phase: 'Fase 4: Auto Record & OCR',
    category: 'Perbaikan Bug',
    module: 'Auto Record',
    title: 'Auto-Create Missing Tax Account & Fallback Dropdown ke Kas',
    description: 'Memperbaiki logika pembuatan akun pajak bila belum ada serta memastikan akun lawan default mengarah ke Kas.',
    impact: 'Menjamin jurnal transaksi selalu memiliki pasangan akun yang seimbang dan valid.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-046',
    hash: '5a1508a',
    date: '2026-10-27',
    phase: 'Fase 4: Auto Record & OCR',
    category: 'Integrasi AI',
    module: 'AI Vision Engine',
    title: 'Integrasi Gemini Multimodal Vision API & Fallback Tesseract OCR',
    description: 'Menghilangkan data simulasi dan menghubungkan sistem langsung ke Gemini Vision untuk ekstraksi struk multi-resolusi.',
    impact: 'Akurasi pembacaan karakter fisik meningkat tajam hingga di atas 98%.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-047',
    hash: 'a32efee',
    date: '2026-10-27',
    phase: 'Fase 4: Auto Record & OCR',
    category: 'Perbaikan Bug',
    module: 'Sanitasi Angka',
    title: 'Sanitasi Angka Nominal Rupiah & Eliminasi Desimal Sen Ganda (.00 / ,00)',
    description: 'Membangun algoritma pembersih angka yang membedakan titik ribuan dengan koma sen agar tidak menghasilkan angka jutaan semu.',
    impact: 'Mencegah penggelembungan nilai transaksi akibat kesalahan baca tanda baca struk.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-048',
    hash: '4d488cc',
    date: '2026-10-27',
    phase: 'Fase 4: Auto Record & OCR',
    category: 'Fitur Baru',
    module: 'Auto Record',
    title: 'Tampilan Riwayat Transaksi Terekam (History Tab View)',
    description: 'Menyediakan tabel riwayat seluruh transaksi yang telah diproses oleh Auto Record lengkap dengan link bukti foto.',
    impact: 'Pengawasan arsip digital bukti belanja menjadi mudah ditelusuri.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-049',
    hash: '7b5bf76',
    date: '2026-11-05',
    phase: 'Fase 4: Auto Record & OCR',
    category: 'Fitur Baru',
    module: 'Spreadsheet Bot',
    title: 'Pemisahan Jurnal Otomatis & Sinkronisasi Google Apps Script Bot (A6:K)',
    description: 'Membuat bot Apps Script untuk append baris otomatis mulai dari A6 pada Google Sheet dan memisahkan menu Jurnal Otomatis.',
    impact: 'Data transaksi tersinkronisasi ke Google Spreadsheet tanpa merusak kop surat perusahaan.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-050',
    hash: 'c67bb4b',
    date: '2026-11-05',
    phase: 'Fase 4: Auto Record & OCR',
    category: 'Fitur Baru',
    module: 'Reset 4-Lapis',
    title: 'Reset Transaksi 4-Lapis: Supabase, Sheet A6:K, & Google Drive Trash',
    description: 'Membangun fungsi pembersihan menyeluruh saat web di-reset: kosongkan transaksi, hapus isi spreadsheet A6:K, dan hapus berkas fisik di Drive.',
    impact: 'Audit sistem menyeluruh dan kemampuan mengulang penomoran bukti dari nol secara bersih.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-051',
    hash: '701f3cd',
    date: '2026-11-05',
    phase: 'Fase 4: Auto Record & OCR',
    category: 'Fitur Baru',
    module: 'Auto Record',
    title: 'Tombol Khusus "Reset ke 1" pada Badge Nomor Berkas Auto Record',
    description: 'Menyematkan tombol putar Reset ke 1 langsung pada badge nomor berkas berikutnya dengan modal konfirmasi protektif.',
    impact: 'Operator dapat me-reset nomor berkas kembali ke BT/0001 tanpa harus membuka panel admin.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-052',
    hash: '30d71c1',
    date: '2026-11-05',
    phase: 'Fase 4: Auto Record & OCR',
    category: 'UI/UX',
    module: 'Auto Record UI',
    title: 'Penyelarasan Warna, Ketinggian, & Layout Header Kontrol Auto Record',
    description: 'Merampingkan tombol Jurnal Otomatis, status AI Vision, Bot Sheet, dan badge nomor berkas agar simetris dan elegan.',
    impact: 'Kenyamanan visual staf akuntansi saat mengoperasikan perekaman struk.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-053',
    hash: '98464bc',
    date: '2026-11-11',
    phase: 'Fase 5: Perpajakan Fiskal',
    category: 'Fitur Baru',
    module: 'Koreksi Fiskal',
    title: 'Pembangunan Modul Koreksi Fiskal Pajak (1771-I & Coretax L1)',
    description: 'Menyusun kalkulator dan lembar kerja koreksi fiskal positif (12 FPO) dan negatif (4 FNE) sesuai PER-11/PJ/2025 dan UU HPP.',
    impact: 'Otomasi penjembatan laba komersial menuju Penghasilan Kena Pajak (PKP) badan.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-054',
    hash: '5632b1f',
    date: '2026-11-11',
    phase: 'Fase 5: Perpajakan Fiskal',
    category: 'Fitur Baru',
    module: 'Lap. Keuangan Fiskal',
    title: 'Interkoneksi Laba Komersial & Sidebar Baru Laporan Keuangan Fiskal',
    description: 'Menghubungkan Laba Bersih SAK 100% ke lembar fiskal (selisih Rp 0) dan membuat slidebar baru untuk menampilkan laporan resmi versi fiskal.',
    impact: 'Manajemen dapat mencetak laporan keuangan resmi versi fiskal pasca rekonsiliasi dalam 1 klik.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-055',
    hash: 'DOC-DOCX',
    date: '2026-11-21',
    phase: 'Fase 6: Dokumentasi',
    category: 'Dokumentasi',
    module: 'Laporan Word',
    title: 'Penerbitan Laporan Rekapitulasi Eksekutif Formal Word (.docx)',
    description: 'Penyusunan dokumen resmi hitam-putih formal 10 bab lengkap dengan lembar pengesahan Direktur Keuangan & Direktur Utama.',
    impact: 'Arsip pertanggungjawaban legal dan audit formal pengembangan SPECTRA.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  },
  {
    id: 'LOG-056',
    hash: 'DOC-XLSX',
    date: '2026-11-21',
    phase: 'Fase 6: Dokumentasi',
    category: 'Dokumentasi',
    module: 'Logbook Excel',
    title: 'Penerbitan Buku Kerja Logbook Detail Seluruh Perubahan Sistem (.xlsx)',
    description: 'Penyusunan file Excel 5 sheet memuat rekapitulasi metrik, logbook 56 revisi, katalog 75 akun COA, dan matriks koreksi fiskal.',
    impact: 'Auditabilitas penuh atas riwayat modifikasi sistem dari awal hingga versi produksi terkini.',
    pic: 'Mazmur Gusti Agung L',
    status: 'PRODUCTION'
  }
];

// Raw COA Data
const coaAccounts = [
  { code: '10000', name: 'Harta Lancar', cat: 'Harta Lancar', pos: 'Neraca', sn: 'Debet', isHeader: 'Header' },
  { code: '10001', name: 'Kas', cat: 'Harta Lancar', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '10002', name: 'Persediaan Barang Dagang', cat: 'Harta Lancar', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '10003', name: 'Piutang Usaha', cat: 'Harta Lancar', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '10004', name: 'Piutang Pendapatan', cat: 'Harta Lancar', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '10005', name: 'Wesel Tagih', cat: 'Harta Lancar', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '10006', name: 'Perlengkapan Kantor', cat: 'Harta Lancar', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '10007', name: 'Perlengkapan Toko', cat: 'Harta Lancar', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '10008', name: 'Iklan Dibayar Dimuka', cat: 'Harta Lancar', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '10009', name: 'Sewa Dibayar Dimuka', cat: 'Harta Lancar', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '10010', name: 'Asuransi Dibayar Dimuka', cat: 'Harta Lancar', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '11000', name: 'Harta Tetap', cat: 'Harta Tetap', pos: 'Neraca', sn: 'Debet', isHeader: 'Header' },
  { code: '11001', name: 'Peralatan Kantor', cat: 'Harta Tetap', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '11002', name: 'Akumulasi Penyusutan Peralatan Kantor', cat: 'Harta Tetap', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '11003', name: 'Kendaraan', cat: 'Harta Tetap', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '11004', name: 'Akumulasi Penyusutan Peralatanan Kendaraan', cat: 'Harta Tetap', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '11005', name: 'Gedung', cat: 'Harta Tetap', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '11006', name: 'Akumulasi Penyusutan Gedung', cat: 'Harta Tetap', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '11007', name: 'Mesin', cat: 'Harta Tetap', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '11008', name: 'Akumulasi Penyusutan Mesin', cat: 'Harta Tetap', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '11009', name: 'Peralatan Toko', cat: 'Harta Tetap', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '11010', name: 'Akumulasi Penyusutan Peralatan Toko', cat: 'Harta Tetap', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '11011', name: 'Tanah', cat: 'Harta Tetap', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '20000', name: 'Utang / Kewajiban Lancar', cat: 'Utang Lancar', pos: 'Neraca', sn: 'Kredit', isHeader: 'Header' },
  { code: '20001', name: 'Utang Usaha/Dagang', cat: 'Utang Lancar', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '20002', name: 'Utang Wesel', cat: 'Utang Lancar', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '20003', name: 'Utang Gaji', cat: 'Utang Lancar', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '20004', name: 'Utang Pajak Penghasilan', cat: 'Utang Lancar', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '20005', name: 'Utang Hipotek', cat: 'Utang Lancar', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '20006', name: 'Utang Obligasi', cat: 'Utang Lancar', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '20007', name: 'Pendapatan Diterima Dimuka', cat: 'Utang Lancar', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '20008', name: 'Utang Utilitas', cat: 'Utang Lancar', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '21000', name: 'Utang Non Operasional', cat: 'Utang Jangka Panjang', pos: 'Neraca', sn: 'Kredit', isHeader: 'Header' },
  { code: '21001', name: 'Utang Sewa', cat: 'Utang Jangka Panjang', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '21002', name: 'Utang Bank', cat: 'Utang Jangka Panjang', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '21003', name: 'Utang Bunga', cat: 'Utang Jangka Panjang', pos: 'Neraca', sn: 'Kredit', isHeader: 'Detail' },
  { code: '30000', name: 'Modal/Ekuitas', cat: 'Modal / Ekuitas', pos: 'Neraca', sn: 'Kredit', isHeader: 'Header' },
  { code: '30001', name: 'Prive', cat: 'Modal / Ekuitas', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '30002', name: 'Ikhtisar Laba Rugi', cat: 'Modal / Ekuitas', pos: 'Neraca', sn: 'Debet', isHeader: 'Detail' },
  { code: '40000', name: 'Pendapatan Operasional', cat: 'Pendapatan Operasional', pos: 'Laba Rugi', sn: 'Kredit', isHeader: 'Header' },
  { code: '40001', name: 'Pendapatan Jasa / Usaha', cat: 'Pendapatan Operasional', pos: 'Laba Rugi', sn: 'Kredit', isHeader: 'Detail' },
  { code: '40002', name: 'Retur Penjualan', cat: 'Pendapatan Operasional', pos: 'Laba Rugi', sn: 'Kredit', isHeader: 'Detail' },
  { code: '40003', name: 'Potongan Penjualan', cat: 'Pendapatan Operasional', pos: 'Laba Rugi', sn: 'Kredit', isHeader: 'Detail' },
  { code: '40004', name: 'Pembelian', cat: 'Pendapatan Operasional', pos: 'Laba Rugi', sn: 'Kredit', isHeader: 'Detail' },
  { code: '40005', name: 'Retur Pembelian', cat: 'Pendapatan Operasional', pos: 'Laba Rugi', sn: 'Kredit', isHeader: 'Detail' },
  { code: '40006', name: 'Beban Angkut Pembelian', cat: 'Pendapatan Operasional', pos: 'Laba Rugi', sn: 'Kredit', isHeader: 'Detail' },
  { code: '40007', name: 'IRL', cat: 'Pendapatan Operasional', pos: 'Laba Rugi', sn: 'Kredit', isHeader: 'Detail' },
  { code: '40008', name: 'Potongan Pembelian', cat: 'Pendapatan Operasional', pos: 'Laba Rugi', sn: 'Kredit', isHeader: 'Detail' },
  { code: '41000', name: 'Pendapatan Non Operasional', cat: 'Pendapatan Non Operasional', pos: 'Laba Rugi', sn: 'Kredit', isHeader: 'Header' },
  { code: '41001', name: 'Pendapatan Bunga', cat: 'Pendapatan Non Operasional', pos: 'Laba Rugi', sn: 'Kredit', isHeader: 'Detail' },
  { code: '50000', name: 'Beban Operasional', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Header' },
  { code: '50001', name: 'Beban Gaji Toko', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50002', name: 'Beban Gaji Kantor', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50003', name: 'Beban Sewa Lahan', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50004', name: 'Beban Asuransi', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50005', name: 'Beban Penyesuaian Piutang', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50006', name: 'Beban Perlengkapan Kantor', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50007', name: 'Beban Perlengkapan Toko', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50008', name: 'Beban Iklan', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50009', name: 'Beban Penyusutan Peralatan kantor', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50010', name: 'Beban Penyusutan Gedung', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50011', name: 'Beban Bunga', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50012', name: 'Beban Listrik Dan Telepon', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50013', name: 'Beban Penyusutan Mesin', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50014', name: 'Beban Lain-Lain', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50015', name: 'Beban Penyusutan Kendaraan', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50016', name: 'Potongan Pembelian', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50017', name: 'Beban Penjualan', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50018', name: 'Pajak Penghasilan', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50019', name: 'Beban Penyusutan Peralatan toko', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50020', name: 'Beban Service', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' },
  { code: '50021', name: 'Beban Akibat Bencana Alam', cat: 'Beban Operasional', pos: 'Laba Rugi', sn: 'Debet', isHeader: 'Detail' }
];

// Fiscal Tax Rules
const fiscalRules = [
  { code: 'FPO-01', dir: 'Positif', label: 'Biaya Kepentingan Pribadi Pemegang Saham/Pemilik', basis: 'UU PPh Pasal 9 ayat (1) huruf b & i', nature: 'Beda Tetap', ref: '1771-I Bag. B No. 5a', desc: 'Biaya pribadi pemegang saham, sekutu, anggota atau keluarga' },
  { code: 'FPO-02', dir: 'Positif', label: 'Premi Asuransi Kesehatan/Jiwa Pemilik', basis: 'UU PPh Pasal 9 ayat (1) huruf d', nature: 'Beda Tetap', ref: '1771-I Bag. B No. 5c', desc: 'Premi asuransi yang tidak menjadi objek PPh 21 pegawai' },
  { code: 'FPO-03', dir: 'Positif', label: 'Natura/Kenikmatan Non-Deductible (PMK 66/2023)', basis: 'UU HPP Ps 9 (1) e jo PMK 66/2023', nature: 'Beda Tetap', ref: '1771-I Bag. B No. 5d', desc: 'Pemberian fasilitas non-3M atau fasilitas khusus pemegang saham' },
  { code: 'FPO-04', dir: 'Positif', label: 'Imbalan Melebihi Kewajaran Hubungan Istimewa', basis: 'UU PPh Pasal 9 ayat (1) huruf f', nature: 'Beda Tetap', ref: '1771-I Bag. B No. 5e', desc: 'Gaji/bonus berlebih di atas harga pasar kepada pihak istimewa' },
  { code: 'FPO-05', dir: 'Positif', label: 'Harta yang Dihibahkan/Sumbangan Non-Deductible', basis: 'UU PPh Pasal 9 ayat (1) huruf g', nature: 'Beda Tetap', ref: '1771-I Bag. B No. 5f', desc: 'Sumbangan di luar ketentuan PP bencana/pendidikan/infrastruktur' },
  { code: 'FPO-06', dir: 'Positif', label: 'Pajak Penghasilan (PPh) yang Dibebankan', basis: 'UU PPh Pasal 9 ayat (1) huruf h', nature: 'Beda Tetap', ref: '1771-I Bag. B No. 5g', desc: 'PPh 21 ditanggung perusahaan, PPh 25/29, atau PPh Final yang dibiayakan' },
  { code: 'FPO-07', dir: 'Positif', label: 'Gaji Anggota CV/Firma Modal Tidak Terbagi Saham', basis: 'UU PPh Pasal 9 ayat (1) huruf j', nature: 'Beda Tetap', ref: '1771-I Bag. B No. 5i', desc: 'Gaji kepada sekutu aktif CV/Firma' },
  { code: 'FPO-08', dir: 'Positif', label: 'Sanksi Administrasi/Denda/Bunga Pajak', basis: 'UU PPh Pasal 9 ayat (1) huruf k', nature: 'Beda Tetap', ref: '1771-I Bag. B No. 5j', desc: 'Sanksi STP, bunga keterlambatan, atau denda perpajakan' },
  { code: 'FPO-09', dir: 'Positif', label: 'Penyusutan Komersial Di Atas Fiskal', basis: 'UU PPh Pasal 11', nature: 'Beda Waktu', ref: '1771-I Bag. B No. 5k', desc: 'Masa manfaat atau tarif penyusutan komersial lebih cepat dari fiskal' },
  { code: 'FPO-10', dir: 'Positif', label: 'Amortisasi Komersial Di Atas Fiskal', basis: 'UU PPh Pasal 11A', nature: 'Beda Waktu', ref: '1771-I Bag. B No. 5l', desc: 'Amortisasi aset tak berwujud komersial melebihi ketentuan fiskal' },
  { code: 'FPO-11', dir: 'Positif', label: 'Biaya Menghasilkan Penghasilan Bukan Objek Pajak', basis: 'UU PPh Ps 9 (1) jo Ps 4 (3)', nature: 'Beda Tetap', ref: '1771-I Bag. B No. 5m', desc: 'Biaya untuk mendapatkan dividen non-objek atau hibah' },
  { code: 'FPO-12', dir: 'Positif', label: 'Penyesuaian Fiskal Positif Lainnya', basis: 'PER-11/PJ/2025 Lampiran 1 (Coretax)', nature: 'Beda Tetap', ref: '1771-I Bag. B No. 5n', desc: 'Koreksi positif lain yang tidak tertampung pada pos di atas' },
  { code: 'FNE-01', dir: 'Negatif', label: 'Penghasilan Dikenakan PPh Bersifat Final', basis: 'UU PPh Ps 4 (2) & PP 55/2022', nature: 'Beda Tetap', ref: '1771-I Bag. C No. 6a', desc: 'Bunga deposito, sewa tanah/bangunan, atau omzet PP 55 0,5%' },
  { code: 'FNE-02', dir: 'Negatif', label: 'Penghasilan Bukan Objek Pajak (Non-Objek)', basis: 'UU PPh Pasal 4 ayat (3)', nature: 'Beda Tetap', ref: '1771-I Bag. C No. 6b', desc: 'Dividen dalam negeri, bantuan/sumbangan keagamaan' },
  { code: 'FNE-03', dir: 'Negatif', label: 'Penyusutan/Amortisasi Fiskal Di Atas Komersial', basis: 'UU PPh Pasal 11 & 11A', nature: 'Beda Waktu', ref: '1771-I Bag. C No. 6c', desc: 'Penyusutan fiskal lebih besar karena metode saldo menurun ganda' },
  { code: 'FNE-04', dir: 'Negatif', label: 'Penyesuaian Fiskal Negatif Lainnya', basis: 'PER-11/PJ/2025 Lampiran 1 (Coretax)', nature: 'Beda Tetap', ref: '1771-I Bag. C No. 6d', desc: 'Koreksi negatif lain yang belum tercakup' }
];

async function createLogbookExcel() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Mazmur Gusti Agung Larosa';
  workbook.lastModifiedBy = 'Mazmur Gusti Agung Larosa';
  workbook.created = new Date('2026-11-21T03:15:00');
  workbook.modified = new Date('2026-11-21T03:15:00');

  // ==========================================
  // SHEET 1: RINGKASAN & METRIK EKSEKUTIF
  // ==========================================
  const wsSummary = workbook.addWorksheet('Ringkasan & Metrik', {
    views: [{ showGridLines: true }]
  });

  // Title Banner
  wsSummary.mergeCells('B2:H2');
  const titleCell = wsSummary.getCell('B2');
  titleCell.value = 'PT NIRWANA BHUMI ENERGY';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(2).height = 30;

  wsSummary.mergeCells('B3:H3');
  const subTitleCell = wsSummary.getCell('B3');
  subTitleCell.value = 'LOGBOOK REKAPITULASI RIWAYAT PERUBAHAN & ARSITEKTUR SISTEM SPECTRA';
  subTitleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  subTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subHeaderBg } };
  subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(3).height = 24;

  wsSummary.mergeCells('B4:H4');
  const metaCell = wsSummary.getCell('B4');
  metaCell.value = 'Penanggung Jawab: Mazmur Gusti Agung Larosa (Direktur Keuangan)  |  Pimpinan: Sudono Salim (Direktur Utama)  |  Periode: 2026';
  metaCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF334155' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  wsSummary.getRow(4).height = 20;

  // Key KPI Cards (Row 6 & 7)
  const kpis = [
    { col: 'B', label: 'TOTAL ENTRI PERUBAHAN', val: '56 Revisi' },
    { col: 'C', label: 'TOTAL MODUL UTAMA', val: '12 Modul' },
    { col: 'D', label: 'STANDAR COA SAK', val: '75 Akun' },
    { col: 'E', label: 'AKURASI KESEIMBANGAN', val: '100% Seimbang' },
    { col: 'F', label: 'STATUS SISTEM', val: 'LIVE VERCEL' },
    { col: 'G', label: 'KODE BERKAS AUTO RECORD', val: 'BT/0001/...' }
  ];

  kpis.forEach(k => {
    const lblCell = wsSummary.getCell(`${k.col}6`);
    lblCell.value = k.label;
    lblCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subHeaderBg } };
    lblCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    const valCell = wsSummary.getCell(`${k.col}7`);
    valCell.value = k.val;
    valCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF0F172A' } };
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    valCell.alignment = { horizontal: 'center', vertical: 'middle' };
    valCell.border = thinBorder;
    lblCell.border = thinBorder;
  });
  wsSummary.getRow(6).height = 22;
  wsSummary.getRow(7).height = 28;

  // Breakdown by Phase Table (Row 9)
  wsSummary.getCell('B9').value = 'REKAPITULASI IMPLEMENTASI PER FASE PENGEMBANGAN';
  wsSummary.getCell('B9').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };

  const phaseHeaders = ['Fase Pengembangan', 'Periode', 'Jumlah Pembaruan', 'Fokus Utama Implementasi', 'Status Verifikasi'];
  const phaseCols = ['B', 'C', 'D', 'E', 'F'];
  phaseHeaders.forEach((h, idx) => {
    const cell = wsSummary.getCell(`${phaseCols[idx]}10`);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  const phaseData = [
    ['Fase 1: Fondasi SIKEU', '04 Okt 2026', '13 Komitmen', 'Replikasi Accurate UI, 6 Voucher, PSAK bilingual, PWA, REST API', '100% PRODUKSI'],
    ['Fase 2: Cloud Enterprise', '15 Okt 2026', '5 Komitmen', 'Database Supabase PostgreSQL, MCP server, RLS token, responsive drawer', '100% PRODUKSI'],
    ['Fase 3: Modernisasi UI/UX', '24 Okt 2026', '24 Komitmen', 'Anti-slop cleanup, Quick Report, login 65:35, booting 5s, dashboard minimalis', '100% PRODUKSI'],
    ['Fase 4: Auto Record & OCR', '26 Okt - 05 Nov 2026', '10 Komitmen', 'Gemini AI Vision, HTR, Apps Script bot (A6:K), reset 4-lapis, BT/0001 badge', '100% PRODUKSI'],
    ['Fase 5: Perpajakan Fiskal', '11 Nov 2026', '2 Komitmen', 'Koreksi Fiskal 1771-I, 12 FPO & 4 FNE Coretax, interkoneksi laba rugi, lap. fiskal', '100% PRODUKSI'],
    ['Fase 6: Dokumentasi Eksekutif', '21 Nov 2026', '2 Komitmen', 'Laporan Resmi Word (.docx) formal hitam-putih dan Buku Kerja Excel (.xlsx)', '100% PRODUKSI']
  ];

  phaseData.forEach((row, rIdx) => {
    const rNum = 11 + rIdx;
    row.forEach((val, cIdx) => {
      const cell = wsSummary.getCell(`${phaseCols[cIdx]}${rNum}`);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rIdx % 2 === 1 ? COLORS.zebraRow : COLORS.whiteRow } };
      cell.border = thinBorder;
      if (cIdx === 1 || cIdx === 2 || cIdx === 4) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (cIdx === 4) {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.successText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.successBg } };
      }
    });
  });

  // Distribution by Category Table (Row 19)
  wsSummary.getCell('B19').value = 'DISTRIBUSI KATEGORI REVISI SISTEM';
  wsSummary.getCell('B19').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };

  const catHeaders = ['Kategori', 'Total Item', 'Persentase', 'Deskripsi Lingkup Pekerjaan'];
  const catCols = ['B', 'C', 'D', 'E'];
  catHeaders.forEach((h, idx) => {
    const cell = wsSummary.getCell(`${catCols[idx]}20`);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  const catData = [
    ['Fitur Baru (New Feature)', 32, '57.1%', 'Pengembangan modul akuntansi, auto record, rekonsiliasi fiskal, bot spreadsheet'],
    ['Perbaikan Bug (Bug Fixes)', 11, '19.6%', 'Pembersihan sen rupiah ganda, white-screen handler, sinkronisasi periode, auto-create COA'],
    ['Antarmuka & UI/UX (Design)', 6, '10.7%', 'Layout dashboard minimalis, booting screen kustom, pembersihan visual anti-slop'],
    ['Integrasi Cloud & Database', 4, '7.1%', 'Koneksi Supabase PostgreSQL, Google Drive storage bot, Google Apps Script Webhook'],
    ['Dokumentasi & Regulasi', 3, '5.4%', 'Laporan Word formal eksekutif, buku kerja Excel logbook, standardisasi trial JSON']
  ];

  catData.forEach((row, rIdx) => {
    const rNum = 21 + rIdx;
    row.forEach((val, cIdx) => {
      const cell = wsSummary.getCell(`${catCols[cIdx]}${rNum}`);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rIdx % 2 === 1 ? COLORS.zebraRow : COLORS.whiteRow } };
      cell.border = thinBorder;
      if (cIdx === 1 || cIdx === 2) cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  // Set Widths for Sheet 1
  wsSummary.getColumn('A').width = 4;
  wsSummary.getColumn('B').width = 28;
  wsSummary.getColumn('C').width = 18;
  wsSummary.getColumn('D').width = 18;
  wsSummary.getColumn('E').width = 45;
  wsSummary.getColumn('F').width = 20;
  wsSummary.getColumn('G').width = 25;
  wsSummary.getColumn('H').width = 15;


  // ==========================================
  // SHEET 2: LOGBOOK PERUBAHAN DETAIL (FULL)
  // ==========================================
  const wsLog = workbook.addWorksheet('Logbook Perubahan Detail', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4, showGridLines: true }]
  });

  // Title Row
  wsLog.mergeCells('A1:K1');
  const logTitle = wsLog.getCell('A1');
  logTitle.value = 'PT NIRWANA BHUMI ENERGY — LOGBOOK DETAIL PERUBAHAN & PEMBARUAN SISTEM SPECTRA';
  logTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  logTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
  logTitle.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  wsLog.getRow(1).height = 26;

  wsLog.mergeCells('A2:K2');
  const logSub = wsLog.getCell('A2');
  logSub.value = 'Dokumen Audit Perubahan Kode Sumber, Fitur, Perbaikan, & Regulasi Perpajakan (Penanggung Jawab: Mazmur Gusti Agung Larosa)';
  logSub.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  logSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  logSub.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  wsLog.getRow(2).height = 18;

  // Header Row (Row 4)
  const logHeaders = [
    'No',
    'ID Log',
    'Hash / Ref',
    'Tanggal',
    'Fase Proyek',
    'Kategori',
    'Modul Terdampak',
    'Ringkasan Perubahan',
    'Detail Teknis & Rincian Implementasi',
    'Dampak Operasional & Bisnis',
    'Status'
  ];

  logHeaders.forEach((h, idx) => {
    const colLetter = String.fromCharCode(65 + idx);
    const cell = wsLog.getCell(`${colLetter}4`);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subHeaderBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });
  wsLog.getRow(4).height = 24;

  // Populate Log Entries
  logEntries.forEach((item, idx) => {
    const rowNum = 5 + idx;
    const isEven = idx % 2 === 1;
    const bgFill = isEven ? COLORS.zebraRow : COLORS.whiteRow;

    const rowValues = [
      idx + 1,
      item.id,
      item.hash,
      item.date,
      item.phase,
      item.category,
      item.module,
      item.title,
      item.description,
      item.impact,
      item.status
    ];

    rowValues.forEach((val, cIdx) => {
      const colLetter = String.fromCharCode(65 + cIdx);
      const cell = wsLog.getCell(`${colLetter}${rowNum}`);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgFill } };
      cell.border = thinBorder;

      if (cIdx === 0 || cIdx === 1 || cIdx === 2 || cIdx === 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (cIdx === 5 || cIdx === 6 || cIdx === 10) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      }

      // Highlight status badge
      if (cIdx === 10) {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.successText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.successBg } };
      }
    });
    wsLog.getRow(rowNum).height = 36;
  });

  // Set Widths for Sheet 2
  wsLog.getColumn('A').width = 6;   // No
  wsLog.getColumn('B').width = 11;  // ID Log
  wsLog.getColumn('C').width = 12;  // Hash
  wsLog.getColumn('D').width = 13;  // Tanggal
  wsLog.getColumn('E').width = 22;  // Fase
  wsLog.getColumn('F').width = 18;  // Kategori
  wsLog.getColumn('G').width = 18;  // Modul
  wsLog.getColumn('H').width = 38;  // Ringkasan
  wsLog.getColumn('I').width = 52;  // Detail Teknis
  wsLog.getColumn('J').width = 40;  // Dampak Bisnis
  wsLog.getColumn('K').width = 14;  // Status


  // ==========================================
  // SHEET 3: MASTER 75 AKUN COA SAK
  // ==========================================
  const wsCoa = workbook.addWorksheet('Master 75 Akun COA', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3, showGridLines: true }]
  });

  wsCoa.mergeCells('A1:G1');
  const coaTitle = wsCoa.getCell('A1');
  coaTitle.value = 'PT NIRWANA BHUMI ENERGY — STANDARDISASI BAGAN AKUN (CHART OF ACCOUNTS) SAK';
  coaTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  coaTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
  coaTitle.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  wsCoa.getRow(1).height = 24;

  const coaHeaders = ['No', 'Kode Akun', 'Nama Akun', 'Golongan Akun', 'Pos Laporan', 'Saldo Normal', 'Tipe Akun'];
  coaHeaders.forEach((h, idx) => {
    const colLetter = String.fromCharCode(65 + idx);
    const cell = wsCoa.getCell(`${colLetter}3`);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subHeaderBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });
  wsCoa.getRow(3).height = 22;

  coaAccounts.forEach((acc, idx) => {
    const rowNum = 4 + idx;
    const isHeader = acc.isHeader === 'Header';
    const bgFill = isHeader ? 'FFE2E8F0' : (idx % 2 === 1 ? COLORS.zebraRow : COLORS.whiteRow);
    const textBold = isHeader;

    const rowVals = [
      idx + 1,
      acc.code,
      acc.name,
      acc.cat,
      acc.pos,
      acc.sn,
      acc.isHeader
    ];

    rowVals.forEach((val, cIdx) => {
      const colLetter = String.fromCharCode(65 + cIdx);
      const cell = wsCoa.getCell(`${colLetter}${rowNum}`);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 9.5, bold: textBold, color: { argb: isHeader ? 'FF0F172A' : 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgFill } };
      cell.border = thinBorder;

      if (cIdx === 0 || cIdx === 1 || cIdx === 4 || cIdx === 5 || cIdx === 6) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: isHeader ? 0 : 1 };
      }
    });
    wsCoa.getRow(rowNum).height = 20;
  });

  wsCoa.getColumn('A').width = 6;
  wsCoa.getColumn('B').width = 14;
  wsCoa.getColumn('C').width = 38;
  wsCoa.getColumn('D').width = 26;
  wsCoa.getColumn('E').width = 16;
  wsCoa.getColumn('F').width = 16;
  wsCoa.getColumn('G').width = 14;


  // ==========================================
  // SHEET 4: KOREKSI FISKAL CORETAX
  // ==========================================
  const wsTax = workbook.addWorksheet('Koreksi Fiskal Coretax', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3, showGridLines: true }]
  });

  wsTax.mergeCells('A1:G1');
  const taxTitle = wsTax.getCell('A1');
  taxTitle.value = 'KATALOG KOREKSI FISKAL PERPAJAKAN FORMULIR 1771-I & CORETAX L1 (PER-11/PJ/2025)';
  taxTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  taxTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
  taxTitle.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  wsTax.getRow(1).height = 24;

  const taxHeaders = ['Kode', 'Arah Koreksi', 'Nama Penyesuaian Fiskal', 'Dasar Hukum Regulasi', 'Sifat Beda', 'Ref. 1771-I', 'Deskripsi Ketentuan Pajak'];
  taxHeaders.forEach((h, idx) => {
    const colLetter = String.fromCharCode(65 + idx);
    const cell = wsTax.getCell(`${colLetter}3`);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subHeaderBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });
  wsTax.getRow(3).height = 22;

  fiscalRules.forEach((rule, idx) => {
    const rowNum = 4 + idx;
    const isFpo = rule.dir === 'Positif';
    const bgFill = idx % 2 === 1 ? COLORS.zebraRow : COLORS.whiteRow;

    const rowVals = [
      rule.code,
      rule.dir,
      rule.label,
      rule.basis,
      rule.nature,
      rule.ref,
      rule.desc
    ];

    rowVals.forEach((val, cIdx) => {
      const colLetter = String.fromCharCode(65 + cIdx);
      const cell = wsTax.getCell(`${colLetter}${rowNum}`);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgFill } };
      cell.border = thinBorder;

      if (cIdx === 0 || cIdx === 1 || cIdx === 4 || cIdx === 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }

      if (cIdx === 1) {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: isFpo ? 'FF991B1B' : 'FF166534' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isFpo ? 'FFFEE2E2' : COLORS.successBg } };
      }
    });
    wsTax.getRow(rowNum).height = 28;
  });

  wsTax.getColumn('A').width = 12;
  wsTax.getColumn('B').width = 14;
  wsTax.getColumn('C').width = 38;
  wsTax.getColumn('D').width = 34;
  wsTax.getColumn('E').width = 15;
  wsTax.getColumn('F').width = 20;
  wsTax.getColumn('G').width = 50;


  // ==========================================
  // SHEET 5: INTEGRASI CLOUD & WORKSPACE
  // ==========================================
  const wsCloud = workbook.addWorksheet('Integrasi Cloud & Workspace', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3, showGridLines: true }]
  });

  wsCloud.mergeCells('A1:F1');
  const cloudTitle = wsCloud.getCell('A1');
  cloudTitle.value = 'SPESIFIKASI ARSITEKTUR INTEGRASI CLOUD & WORKSPACE SPECTRA';
  cloudTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cloudTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
  cloudTitle.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  wsCloud.getRow(1).height = 24;

  const cloudHeaders = ['No', 'Layanan Cloud', 'Nama Resource / ID / URL', 'Hak Akses & Lingkup Data', 'Metode Integrasi', 'Status Proteksi'];
  cloudHeaders.forEach((h, idx) => {
    const colLetter = String.fromCharCode(65 + idx);
    const cell = wsCloud.getCell(`${colLetter}3`);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subHeaderBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });
  wsCloud.getRow(3).height = 22;

  const cloudIntegrations = [
    [
      1,
      'Google Spreadsheet',
      'datasheet_bukti_transaksi\n(ID: 1fMya8YADudN3benjdxMX5ws-mKXv7MEu4YXlkE1-IKY)',
      'Sheet "main", baris A6:K untuk rekaman transaksi otomatis. Baris 1-5 dilindungi sebagai kop surat perusahaan.',
      'Google Apps Script Webhook REST (google_apps_script_bot.js)',
      'Baris 1-5 Permanen dilindungi'
    ],
    [
      2,
      'Google Drive: data_web',
      'Folder data_web\n(ID: 1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn)',
      'Menyimpan aset web permanen: logo resmi NBE, background booting screen, background login, dan foto profil pengguna.',
      'Google Drive REST API / Bot Storage',
      'Permanen, tidak terhapus saat reset'
    ],
    [
      3,
      'Google Drive: Hasil Transaksi',
      'Folder Data Hasil Transaksi\n(ID: 1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9)',
      'Menyimpan seluruh foto nota, kuitansi fisik, dan struk thermal hasil ekstraksi fitur Auto Record (BT/XXXX/DDMYY).',
      'Google Drive Bot Upload & Sync',
      'Dibersihkan ke Trash saat Reset ke 1'
    ],
    [
      4,
      'Supabase PostgreSQL Cloud',
      'Tabel: transactions, accounts, company_settings, audit_logs',
      'Relasional database utama untuk persistensi saldo akun, jurnal memorial, konfigurasi perusahaan, dan log aktivitas.',
      'Supabase Client SDK (PostgreSQL Realtime REST)',
      'Terenkripsi SSL & RLS Token'
    ],
    [
      5,
      'Vercel Hosting CI/CD',
      'https://spectra-financial-system.vercel.app/',
      'Lingkungan produksi frontend web yang terhubung otomatis ke branch main repositori GitHub.',
      'Automated Git Webhook Deployment',
      'Live Production Enterprise'
    ],
    [
      6,
      'GitHub Enterprise Repository',
      'https://github.com/mazmurglarosa/spectra-financial-system',
      'Version control utama untuk melacak seluruh histori 56+ commit dan audit jejak kode sumber.',
      'Git Version Control System',
      'Branch Protection on main'
    ]
  ];

  cloudIntegrations.forEach((item, idx) => {
    const rowNum = 4 + idx;
    const bgFill = idx % 2 === 1 ? COLORS.zebraRow : COLORS.whiteRow;

    item.forEach((val, cIdx) => {
      const colLetter = String.fromCharCode(65 + cIdx);
      const cell = wsCloud.getCell(`${colLetter}${rowNum}`);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgFill } };
      cell.border = thinBorder;

      if (cIdx === 0 || cIdx === 1 || cIdx === 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }

      if (cIdx === 5) {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.infoText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.infoBg } };
      }
    });
    wsCloud.getRow(rowNum).height = 42;
  });

  wsCloud.getColumn('A').width = 6;
  wsCloud.getColumn('B').width = 24;
  wsCloud.getColumn('C').width = 38;
  wsCloud.getColumn('D').width = 50;
  wsCloud.getColumn('E').width = 35;
  wsCloud.getColumn('F').width = 24;

  // Save the workbook
  const outputPath = path.resolve('c:/Users/Mazmur Gusti Agung L/Documents/SIKEU2/Logbook_Perubahan_Sistem_SPECTRA.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Excel Logbook successfully written to: ${outputPath}`);
}

createLogbookExcel().catch(err => {
  console.error("Error creating Excel Logbook:", err);
  process.exit(1);
});

