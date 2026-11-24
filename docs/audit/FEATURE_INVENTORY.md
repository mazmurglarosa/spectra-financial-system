# INVENTARISASI LENGKAP FITUR DAN KOMPONEN SPECTRA (SIKEU2)
**Dokumen Audit Sistem: Feature Inventory & Component Catalog**
**Versi:** 2.4.0-audit
**Tanggal:** 24 November 2026
**Branch:** `feature/secure-auth-groq`
**Status Audit:** READ-ONLY AUDIT & COMPONENT MAPPING

---

## 1. Ringkasan Eksekutif Komponen
Audit ini menginventarisasi seluruh elemen arsitektur antarmuka (UI), logika bisnis (Services), manajemen state (Context), dan endpoint backend (Serverless API) pada aplikasi SPECTRA Financial System (SIKEU2).

Total komponen yang teridentifikasi:
- **Views (Halaman Utama):** 28 komponen
- **Modals (Dialog Interaktif):** 7 komponen
- **Layouts & Navigasi:** 4 komponen
- **Services & Helpers:** 7 modul logika bisnis
- **Serverless API Endpoints:** 16 berkas endpoint (`/api/*`)
- **Tabel Basis Data Supabase:** 7 tabel utama

---

## 2. Inventarisasi Tampilan Utama (Views - 28 Komponen)

| No | Nama View | Path Berkas | Modul / Kategori | Deskripsi Fungsi | Input Data | Output / State | Ketergantungan (Context/Service) | Status | Keterangan / Isu |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `DashboardView` | `src/views/DashboardView.tsx` | Dasbor Utama | Ringkasan metrik keuangan, kas/bank, pendapatan/beban berjalan, dan transaksi terbaru. | State transaksi & akun dari context | Visualisasi KPI, widget saldo, tabel aktivitas terbaru | `AccountingContext` | Production | Stabil, membaca real-time dari memory state |
| 2 | `JournalView` | `src/views/JournalView.tsx` | Buku & Jurnal | Daftar jurnal umum dengan filter tanggal, pencarian nomor bukti/keterangan, dan pagination. | Transaksi dari context, input filter tanggal/POS | Filtered transactions list | `AccountingContext`, `exportService` | Production | Mendukung ekspor data dan pembukaan modal detail transaksi |
| 3 | `GeneralLedgerView` | `src/views/GeneralLedgerView.tsx` | Buku & Jurnal | Buku besar per akun akuntansi, menampilkan mutasi debit, kredit, dan saldo berjalan. | Pemilihan akun (dropdown), periode tanggal | Daftar mutasi baris per akun dengan saldo kumulatif | `AccountingContext` | Production | Menghitung saldo berjalan secara on-the-fly |
| 4 | `SubsidiaryLedgerView` | `src/views/SubsidiaryLedgerView.tsx` | Buku & Jurnal | Buku besar pembantu piutang dan utang per kontak/pelanggan/vendor. | Pemilihan kontak, rentang tanggal | Rekap saldo piutang/utang per entitas rekanan | `AccountingContext` | **Orphaned (Unrouted)** | **File ada di codebase tetapi tidak didaftarkan di App.tsx & Sidebar.tsx** |
| 5 | `TrialBalanceView` | `src/views/TrialBalanceView.tsx` | Laporan Keuangan | Neraca Saldo (Trial Balance) perbandingan total debit dan kredit seluruh akun untuk validasi balance. | Periode tanggal, filter level akun | Tabel neraca saldo terklasifikasi, indikator balance/unbalance | `AccountingContext` | Production | Menampilkan status validasi keseimbangan debit/kredit |
| 6 | `IncomeStatementView` | `src/views/IncomeStatementView.tsx` | Laporan Keuangan | Laporan Laba Rugi komprehensif (Pendapatan Operasional, HPP, Beban Operasional, Beban Lain-lain). | Periode tanggal laporan | Ringkasan laba kotor, laba operasional, laba bersih | `AccountingContext` | Production | Perhitungan formula otomatis berdasarkan kode akun 4xxx, 5xxx, 6xxx, 8xxx, 9xxx |
| 7 | `BalanceSheetView` | `src/views/BalanceSheetView.tsx` | Laporan Keuangan | Laporan Neraca (Posisi Keuangan) menampilkan Aset = Liabilitas + Ekuitas. | Tanggal per (as-of date) | Tabel posisi keuangan aktiva dan pasiva | `AccountingContext` | Production | Memverifikasi keseimbangan Aktiva = Pasiva |
| 8 | `CashFlowView` | `src/views/CashFlowView.tsx` | Laporan Keuangan | Laporan Arus Kas dengan metode langsung/tidak langsung (Operasi, Investasi, Pendanaan). | Periode tanggal | Aliran kas masuk/keluar per kelompok aktivitas | `AccountingContext` | Production | Klasifikasi otomatis berdasarkan akun kas & lawan |
| 9 | `EquityChangesView` | `src/views/EquityChangesView.tsx` | Laporan Keuangan | Laporan Perubahan Ekuitas (Modal awal, laba/rugi periode, prive/dividen, modal akhir). | Periode laporan | Mutasi saldo modal pemilik | `AccountingContext` | Production | Menghubungkan laba bersih dari laporan laba rugi |
| 10 | `AccountsView` | `src/views/AccountsView.tsx` | Master Data | Bagan Akun Standar (Chart of Accounts / COA) dengan hierarki grup, tipe akun, dan saldo normal. | Input form tambah/edit akun, filter tipe | CRUD akun ke AccountingContext | `AccountingContext` | Production | Menampilkan 66 akun default standar SAK Indonesia |
| 11 | `ContactsView` | `src/views/ContactsView.tsx` | Master Data | Manajemen kontak pelanggan, vendor/pemasok, karyawan, dan pihak ketiga. | Form kontak (nama, email, telepon, NPWP, alamat) | CRUD kontak ke AccountingContext | `AccountingContext` | Production | Digunakan untuk relasi piutang/utang dan e-Faktur |
| 12 | `AutoRecordView` | `src/views/AutoRecordView.tsx` | Otomasi Akuntansi | Perekaman bukti transaksi otomatis berbasis OCR Groq Vision, validasi tabel koreksi, dan posting jurnal. | File gambar/PDF struk, kamera HP, sampel resmi, pilihan POS A–F | JSON struk, baris koreksi, transaksi jurnal baru, sync Drive/Sheets | `autoRecordService`, `receiptMediaService`, `externalSyncGuard`, `AccountingContext` | **Production (Hardened)** | **Fitur unggulan. Telah di-upgrade dengan PDF.js multi-page batching dan fail-closed sync guard** |
| 13 | `AutoJournalView` | `src/views/AutoJournalView.tsx` | Otomasi Akuntansi | Mesin pembuat jurnal otomatis berbasis template transaksi rutin (penjualan kas, beban sewa, gaji). | Parameter template transaksi | Draft entri jurnal seimbang | `AccountingContext` | Production | Mempercepat pencatatan transaksi berulang |
| 14 | `ClosingJournalView` | `src/views/ClosingJournalView.tsx` | Buku & Jurnal | Jurnal penutup akhir periode (menutup akun nominal pendapatan & beban ke Ikhtisar Laba Rugi / Saldo Laba). | Periode tutup buku | Entri jurnal penutup otomatis | `AccountingContext` | **Orphaned (Unrouted)** | **File ada di codebase tetapi belum terhubung ke navigasi aktif** |
| 15 | `FinancialRatiosView` | `src/views/FinancialRatiosView.tsx` | Analisis Keuangan | Analisis rasio keuangan (Likuiditas: Current Ratio, Quick Ratio; Profitabilitas: ROA, ROE, NPM; Solvabilitas: DER). | Data neraca & laba rugi dari context | Skor rasio, grafik tren, interpretasi kesehatan | `AccountingContext` | Production | Kalkulasi otomatis metrik performa bisnis |
| 16 | `FixedAssetsView` | `src/views/FixedAssetsView.tsx` | Aset & Inventaris | Pengelolaan aset tetap, jadwal penyusutan (garis lurus/saldo menurun), dan jurnal depresiasi berkala. | Form aset (nama, nilai perolehan, umur ekonomis, metode) | Tabel depresiasi bulanan, jurnal penyusutan otomatis | `AccountingContext` | Production | Otomasi kalkulasi beban akumulasi penyusutan |
| 17 | `BudgetView` | `src/views/BudgetView.tsx` | Perencanaan | Penganggaran per departemen/akun dan analisis varians realisasi vs anggaran (favorable/unfavorable). | Input plafon anggaran bulanan per akun beban | Tabel varians persentase penyerapan anggaran | `AccountingContext` | Production | Memberikan visualisasi over-budget warning |
| 18 | `BankReconciliationView`| `src/views/BankReconciliationView.tsx` | Kas & Bank | Rekonsiliasi mutasi rekening koran bank dengan catatan kas/bank buku besar. | Upload file mutasi CSV / input manual saldo bank | Daftar transaksi matching & outstanding (cek beredar, setoran dalam perjalanan) | `AccountingContext` | Production | Menghitung saldo rekonsiliasi akhir |
| 19 | `TaxReportView` | `src/views/TaxReportView.tsx` | Pajak & Fiskal | Rekapitulasi pajak pertambahan nilai (PPN Masukan & Keluaran) dan PPh 21/23 untuk persiapan SPT Masa. | Transaksi dengan indikator pajak | Ringkasan PPN kurang/lebih bayar, rekap PPh | `AccountingContext` | Production | Memudahkan pelaporan kepatuhan pajak Indonesia |
| 20 | `CorporateTaxView` | `src/views/CorporateTaxView.tsx` | Pajak & Fiskal | Perhitungan Pajak Penghasilan Badan (PPh Badan Pasal 17 / PP 55 / UMKM 0.5%) dan koreksi fiskal positif/negatif. | Laba komersial sebelum pajak, pos koreksi fiskal | Laba fiskal dan estimasi pajak terutang | `AccountingContext` | Production | Menghasilkan lampiran simulasi SPT 1771 |
| 21 | `AuditTrailView` | `src/views/AuditTrailView.tsx` | Keamanan & Audit | Log jejak audit seluruh aktivitas sistem (login, tambah transaksi, edit akun, hapus kontak, sinkronisasi). | Log tersimpan di context & tabel `activity_logs` | Tabel kronologis riwayat kejadian beserta user & timestamp | `AccountingContext`, `Supabase` | Production | Mencatat akuntabilitas tindakan pengguna |
| 22 | `ActivityLogView` | `src/views/ActivityLogView.tsx` | Keamanan & Audit | Tampilan log sistem internal dan status sinkronisasi background. | Status event aplikasi | Tabel riwayat sinkronisasi dan event sistem | `AccountingContext` | Production | Saling melengkapi dengan Audit Trail |
| 23 | `CompanySettingsView` | `src/views/CompanySettingsView.tsx` | Pengaturan | Pengaturan profil entitas bisnis (nama perusahaan, NPWP, alamat, mata uang, periode fiskal aktif). | Form informasi perusahaan | Update konfigurasi global | `AccountingContext`, `Supabase` | Production | Disimpan di tabel `company_settings` Supabase |
| 24 | `TaxSettingsView` | `src/views/TaxSettingsView.tsx` | Pengaturan | Konfigurasi tarif pajak (PPN 11%/12%, PPh 21, PPh 23, PPh Final). | Nilai persentase tarif pajak | Parameter kalkulasi pajak di seluruh modul | `AccountingContext` | Production | Memastikan keakuratan perhitungan perpajakan |
| 25 | `DatabaseMaintenanceView`| `src/views/DatabaseMaintenanceView.tsx` | Utilitas Sistem | Alat pemeliharaan basis data: backup JSON lokal, restore data, reset transaksi demo, uji koneksi Supabase. | File backup JSON / trigger aksi | Status eksekusi pembersihan atau sinkronisasi | `AccountingContext`, `Supabase` | Production | Memiliki tombol darurat backup & reset demo |
| 26 | `FiscalClosingView` | `src/views/FiscalClosingView.tsx` | Pengaturan Buku | Prosedur tutup buku tahunan/bulanan, penguncian periode transaksi lampau agar tidak bisa diedit kembali. | Pemilihan tanggal batas kunci (lock date) | Status periode terkunci (locked period) | `AccountingContext` | Production | Mencegah kecurangan atau manipulasi tanggal lampau |
| 27 | `RecurringTransactionsView`| `src/views/RecurringTransactionsView.tsx` | Otomasi Akuntansi | Penjadwalan transaksi berulang otomatis (sewa bulanan, langganan software, cicilan pinjaman). | Form jadwal (frekuensi, tanggal jatuh tempo, template jurnal) | Eksekusi otomatis transaksi berkala | `AccountingContext` | Production | Otomasi penerbitan transaksi terjadwal |
| 28 | `CostCenterView` | `src/views/CostCenterView.tsx` | Akuntansi Biaya | Alokasi pendapatan dan biaya per pusat biaya / departemen / proyek (Divisi IT, Operasional, Pemasaran). | Pemilihan cost center pada transaksi | Laporan laba rugi tersegmentasi per cost center | `AccountingContext` | Production | Analisis efisiensi biaya per unit kerja |

---

## 3. Inventarisasi Dialog Interaktif (Modals - 7 Komponen)

| No | Nama Modal | Path Berkas | Fungsi Utama | State Terkait |
|---|---|---|---|---|
| 1 | `NewTransactionModal` | `src/components/modals/NewTransactionModal.tsx` | Formulir pencatatan transaksi manual lengkap dengan multi-baris debit & kredit seimbang, pemilihan kontak, POS, nomor referensi, dan lampiran bukti. | Mengirim transaksi baru ke `addTransaction()` di `AccountingContext`. |
| 2 | `TransactionDetailModal` | `src/components/modals/TransactionDetailModal.tsx` | Menampilkan rincian entri jurnal lengkap, bukti transaksi, metadata audit, serta opsi cetak voucher transaksi. | Menampilkan data transaksi tunggal dari riwayat jurnal. |
| 3 | `NewAccountModal` | `src/components/modals/NewAccountModal.tsx` | Dialog pembuatan akun baru dalam Chart of Accounts (Kode, Nama, Kategori, Saldo Normal). | Menjalankan `addAccount()` di `AccountingContext`. |
| 4 | `NewContactModal` | `src/components/modals/NewContactModal.tsx` | Dialog penambahan kontak baru (Pelanggan, Pemasok, Karyawan) beserta nomor NPWP dan rekening. | Menjalankan `addContact()` di `AccountingContext`. |
| 5 | `HelpModal` | `src/components/modals/HelpModal.tsx` | Panduan pengguna interaktif, dokumentasi alur kerja SPECTRA, dan daftar tombol pintas (shortcuts). | Menampilkan bantuan statis dan panduan operasional. |
| 6 | `ReceiptScannerModal` | `src/components/modals/ReceiptScannerModal.tsx` | Modal cepat pemindaian struk menggunakan kamera atau upload gambar langsung dari form transaksi. | Memanggil OCR engine dan meneruskan hasil ke form transaksi. |
| 7 | `ShortcutHelpModal` | `src/components/modals/ShortcutHelpModal.tsx` | Daftar tombol pintas keyboard (misal: `Ctrl+N` untuk transaksi baru, `Ctrl+K` untuk pencarian). | UI modal bantuan keyboard navigasi. |

---

## 4. Inventarisasi Tata Letak & Navigasi (Layouts - 4 Komponen)

| No | Komponen | Path Berkas | Deskripsi & Peran Arsitektur |
|---|---|---|---|
| 1 | `Sidebar` | `src/components/Sidebar.tsx` | Menu navigasi sisi kiri yang mengelompokkan 26 menu aktif ke dalam kategori logis: Dasbor, Transaksi, Laporan, Master Data, Pajak, dan Pengaturan. Memiliki indikator status koneksi Supabase & Google Drive. |
| 2 | `Header` | `src/components/Header.tsx` | Bagian atas aplikasi yang memuat info profil pengguna aktif, nama entitas bisnis, tombol cepat aksi (Tambah Transaksi, Scan Struk), notifikasi sistem, dan tombol logout. |
| 3 | `SyncIndicator` | `src/components/SyncIndicator.tsx` | Indikator visual status sinkronisasi data real-time: Tersinkronisasi (Hijau), Menyinkronkan (Kuning berputar), atau Offline/Gagal (Merah). |
| 4 | `AppLayout` / Shell | `src/App.tsx` | Komponen induk yang membungkus seluruh hierarki tampilan dengan `AccountingProvider`, mengelola router state, dan memeriksa status autentikasi pengguna. |

---

## 5. Inventarisasi Layanan & Utilitas Bisnis (Services - 7 Modul)

| No | Modul Service | Path Berkas | Peran Utama | Ketergantungan Eksternal |
|---|---|---|---|---|
| 1 | `autoRecordService.ts` | `src/services/autoRecordService.ts` | Logika ekstraksi teks struk menggunakan Groq Vision (prioritas 1), Gemini OCR (fallback 2), Tesseract.js (fallback 3). Pembersih JSON, mesin klasifikasi akun debit/kredit berdasarkan POS A–F, dan posting otomatis. | `/api/scan-receipt`, Tesseract.js |
| 2 | `receiptMediaService.ts` | `src/services/receiptMediaService.ts` | Pipeline optimasi berkas media bukti transaksi: konversi multi-halaman PDF via PDF.js worker, rendering canvas beresolusi optimal, downscaling cerdas gambar resolusi tinggi (thermal receipt aspect ratio handling). | `pdfjs-dist` |
| 3 | `externalSyncGuard.ts` | `src/services/externalSyncGuard.ts` | Sistem pertahanan fail-closed yang memblokir panggilan API eksternal sensitif (Google Drive Bot & Spreadsheet Bot) saat sistem berjalan di lingkungan Staging atau Vercel Preview. | Konfigurasi runtime & Vercel env |
| 4 | `googleDriveBot.ts` | `src/services/googleDriveBot.ts` | Mengunggah salinan file struk bukti transaksi ke folder Google Drive perusahaan via Apps Script Web App, mengembalikan ID berkas dan link CDN thumbnail. | Google Apps Script Web App |
| 5 | `googleSpreadsheetBot.ts`| `src/services/googleSpreadsheetBot.ts`| Menyinkronkan baris rekapitulasi transaksi harian ke Google Sheets secara otomatis sebagai live backup operasional. | Google Apps Script Web App |
| 6 | `exportService.ts` | `src/services/exportService.ts` | Mesin ekspor laporan keuangan dan daftar jurnal ke format Excel (`.xlsx`), CSV, dan PDF siap cetak. | `xlsx`, `jspdf`, `jspdf-autotable` |
| 7 | `supabase.ts` | `src/lib/supabase.ts` | Inisialisasi klien Supabase, listener perubahan data real-time, fungsi fetch awal, dan mekanisme sinkronisasi data lokal ke cloud. | `@supabase/supabase-js` |

---

## 6. Inventarisasi Endpoint Serverless API (Vercel Backend - 16 Berkas)

| No | Endpoint | Path Berkas | Metode | Deskripsi & Logika Backend | Status Keamanan & Auth |
|---|---|---|---|---|---|
| 1 | `/api/login` | `api/login.js` | `POST` | Autentikasi pengguna berbasis email & password hash, menerbitkan signed session token berbasis HMAC SHA-256. | Terproteksi rate limit, verifikasi hash bcrypt/sha256 |
| 2 | `/api/scan-receipt` | `api/scan-receipt.js` | `POST` | Proxy aman penerjemahan gambar bukti transaksi ke Groq Vision API (`llama-3.2-11b-vision-preview`), mengembalikan JSON terstruktur. | Memeriksa ukuran payload (<4.5MB), proteksi API Key di server |
| 3 | `/api/verify-session` | `api/verify-session.js` | `GET` | Memvalidasi integritas token sesi pengguna di header Authorization Bearer. | Verifikasi signature token |
| 4 | `/api/system-status` | `api/system-status.js` | `GET` | Memeriksa ketersediaan koneksi basis data Supabase dan konfigurasi environment backend. | Publik (Health Check) |
| 5 | `/api/auth` | `api/auth.js` | `POST` | Handler autentikasi alternatif / legacy handler. | Terproteksi |
| 6 | `/api/auth-status` | `api/auth-status.js` | `GET` | Memeriksa status konfigurasi auth server. | Publik |
| 7 | `/api/create-user` | `api/create-user.js` | `POST` | Pembuatan pengguna baru oleh Superadmin. | Wajib Authorization Header Superadmin |
| 8 | `/api/drive-upload` | `api/drive-upload.js` | `POST` | Proxy upload file ke Google Drive menghindari CORS browser. | Terproteksi session |
| 9 | `/api/gemini-ocr` | `api/gemini-ocr.js` | `POST` | Fallback OCR menggunakan Google Gemini Flash API jika Groq mengalami rate limit. | Memeriksa API Key Gemini |
| 10 | `/api/gemini-scan` | `api/gemini-scan.js` | `POST` | Varian scanner Gemini dengan prompt akuntansi terstruktur. | Memeriksa API Key Gemini |
| 11 | `/api/groq-receipt-scan`| `api/groq-receipt-scan.js`| `POST` | Varian standalone parser struk berbasis Groq Vision. | Memeriksa API Key Groq |
| 12 | `/api/proxy-sheet` | `api/proxy-sheet.js` | `POST` | Proxy pengiriman baris jurnal ke Google Sheets via Apps Script. | Terproteksi session |
| 13 | `/api/sheets-sync` | `api/sheets-sync.js` | `POST` | Sinkronisasi batch transaksi ke Google Sheets. | Terproteksi session |
| 14 | `/api/users` | `api/users.js` | `GET/POST` | Manajemen daftar pengguna sistem (Admin / Operator / Auditor). | Wajib role Superadmin |
| 15 | `/api/sync` | `api/sync.js` | `POST` | Endpoint sinkronisasi data mock / legacy bridge. | **Mock (Tidak terhubung ke DB produksi)** |
| 16 | `/api/data` | `api/data.js` | `GET` | Penyedia data statis demo. | **Mock / Static Data** |

---

## 7. Temuan & Status Anomali Komponen
1. **Dua Komponen View Yatim (Orphaned / Unrouted Views):**
   - `ClosingJournalView.tsx` dan `SubsidiaryLedgerView.tsx` telah dibangun dengan logika komprehensif, namun belum didaftarkan di router `App.tsx` maupun menu `Sidebar.tsx`.
   - *Rekomendasi:* Sambungkan kedua view ini ke menu sidebar pada pembaruan rilis berikutnya setelah pengujian alur kerja penutupan buku tervalidasi.
2. **Ketergantungan Supabase Client Browser pada RLS:**
   - Komponen frontend memanggil operasi CRUD langsung ke Supabase melalui `src/lib/supabase.ts` dengan memanfaatkan browser `anonKey`.
   - Hal ini memerlukan kepastian bahwa tabel data transaksi, akun, dan kontak memiliki kontrol otorisasi yang ketat agar tidak terbuka terhadap eksploitasi browser umum.
