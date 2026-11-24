# MATRIKS PENGUJIAN SISTEM (TEST MATRIX) SPECTRA
**Dokumen Audit Sistem: Test Suite, Execution Log, and Verification Results**
**Versi:** 2.4.0-audit
**Tanggal:** 24 November 2026
**Branch:** `feature/secure-auth-groq`

---

## 1. Ikhtisar Hasil Pengujian
Pengujian sistem SPECTRA Financial System (SIKEU2) dilakukan secara bertingkat mencakup pengujian unit (Unit Tests), integrasi API (API Integration Tests), regresi pipeline OCR Auto Record (Automated Regression Suite), pengujian keamanan basis data Supabase & RLS (Database & Security Tests), serta validasi antarmuka peramban (UI/UX Tests).

**Ringkasan Status Pengujian:**
- **Automated Regression Suite:** 13/13 LULUS (100%)
- **TypeScript & Build Check:** LULUS (0 Error, Build waktu 1.37 detik)
- **API Serverless Health:** LULUS (Endpoint aktif & terverifikasi)
- **Database RLS Hardening:** SEBAGIAN LULUS (Tabel `system_users` & `rate_limits` terproteksi, tabel baseline masih terbuka)

---

## 2. Matriks Pengujian Regresi Otomasi Auto Record (13 Kasus Uji)
Dijalankan secara otomatis melalui script: `scripts/test_auto_record_regression.mjs`.

| ID Uji | Skenario Pengujian | Input & Kondisi | Kriteria Kelulusan | Hasil Eksekusi | Status |
|---|---|---|---|---|---|
| REG-01 | Pemrosesan Gambar Struk Tunggal (JPEG/PNG) | File struk standar toko retail format JPEG/PNG (< 2MB) | Berhasil dikompresi, aspek rasio terjaga, base64 valid dikirim ke API | Base64 < 1.5MB, aspect ratio preserved | **PASS** |
| REG-02 | Konversi Multi-halaman Dokumen PDF Standar | Dokumen PDF 2 halaman faktur belanja | PDF.js merender setiap halaman, batching diproses tanpa memory leak | 2 kanvas terender berurutan, payload digabung | **PASS** |
| REG-03 | Penanganan PDF Multi-halaman Berlebih (> 10 Halaman) | File PDF 12 halaman faktur konsolidasi | Memproses dalam chunk aman, tidak crash, menolak atau membimbing pengguna secara transparan | Batching diproses per-halaman aman tanpa OOM | **PASS** |
| REG-04 | Penolakan Berkas PDF Korup / Tidak Valid | File non-PDF yang di-rename menjadi `.pdf` atau biner rusak | Sistem menangkap exception secara graceful, menampilkan pesan error informatif | Error ditangkap graceful: "Format PDF tidak valid" | **PASS** |
| REG-05 | Downscaling Kanvas Gambar Resolusi Tinggi (4K+) | Foto kamera HP resolusi tinggi (4032x3024px, 8MB) | Dimensi maksimum diturunkan ke 2048px, ukuran base64 < 1.5MB (di bawah batas Vercel 4.5MB) | Resized ke 2048px, base64 890KB (<1.5MB) | **PASS** |
| REG-06 | Penanganan Aspek Rasio Ekstrem (Struk Kasir Termal Panjang) | Gambar struk belanja vertikal panjang rasio > 1:4 (contoh: 800x4200px) | Tidak merusak teks, downscaling menjaga keterbacaan baris kasir | Aspect ratio lock aktif, teks tetap tajam | **PASS** |
| REG-07 | Parsing & Pembersihan JSON Hasil AI Vision | String respons mentah AI yang dibungkus blok markdown triple backtick (\`\`\`json ... \`\`\`) | Regex parser membuang markdown wrapper, memperbaiki trailing comma, mengembalikan object valid | Objek JSON terekstraksi bersih tanpa syntax error | **PASS** |
| REG-08 | Pengisian Otomatis Tabel Koreksi Tahap 2 | Data JSON struk valid (nama toko, tanggal, item, subtotal, pajak, grand total) | Tabel Koreksi Tahap 2 terisi otomatis, field editable untuk koreksi akuntan | Seluruh kolom terisi presisi dan dapat diedit | **PASS** |
| REG-09 | Pemetaan Aturan POS A–F dan Rekomendasi Jurnal | Pemilihan POS B (Pembelian Barang Dagang) atau POS C (Beban Operasional) | Menghasilkan baris debit/kredit berpasangan seimbang sesuai Bagan Akun (COA) | Jurnal berpasangan ganda seimbang (Debit = Kredit) | **PASS** |
| REG-10 | Penanganan Error Groq Vision & Fallback API | Simulasi Groq Vision 429 (Rate Limit) atau 500 (Server Error) | Sistem otomatis mengalihkan permintaan ke Gemini Flash OCR atau Tesseract.js | Fallback sequence terpanggil otomatis tanpa crash | **PASS** |
| REG-11 | Penguncian Sinkronisasi Eksternal Lingkungan Staging | Eksekusi transaksi di Staging (`xaafjvmdjdlfqdrljjlr`) / Vercel Preview | `externalSyncGuard.ts` memblokir upload ke GDrive/Sheets produksi asli (fail-closed) | Sync terblokir, mengembalikan mock aman | **PASS** |
| REG-12 | Izin Sinkronisasi Eksternal Lingkungan Produksi Asli | Eksekusi transaksi di Produksi (`drsqwxkkcfqvooqzoyvm`) & domain resmi | `externalSyncGuard.ts` mengizinkan pengunggahan berkas bukti ke Google Drive resmi | Guard mengizinkan koneksi resmi live | **PASS** |
| REG-13 | Proteksi Concurrency & Penolakan Double-Click Posting | Pengguna mengklik tombol "Posting Transaksi" berkali-kali secara cepat | Flag state `isSubmitting` mengunci form, mencegah transaksi duplikat di basis data | Tombol terkunci, hanya 1 transaksi tercatat | **PASS** |

---

## 3. Matriks Pengujian Unit & Logika Akuntansi (Accounting Engine Tests)

| ID Uji | Modul / Fungsi | Skenario Pengujian | Hasil yang Diharapkan | Status |
|---|---|---|---|---|
| ACT-01 | `AccountingContext.addTransaction` | Transaksi dengan Total Debit == Total Kredit (Contoh: Rp 500.000 = Rp 500.000) | Transaksi diterima dan dimasukkan ke dalam state jurnal | **PASS** |
| ACT-02 | `AccountingContext.addTransaction` | Transaksi tidak seimbang (Contoh: Debit Rp 500.000, Kredit Rp 450.000) | Sistem menolak transaksi dan menampilkan notifikasi unbalance | **PASS** |
| ACT-03 | `GeneralLedgerView` | Perhitungan saldo berjalan akun Kas (1101) dengan mutasi bertahap | Saldo bertambah pada mutasi debit, berkurang pada mutasi kredit | **PASS** |
| ACT-04 | `TrialBalanceView` | Penjumlahan total debit dan kredit dari seluruh 66 akun aktif | Kolom total neraca saldo menunjukkan `Total Debit == Total Kredit` | **PASS** |
| ACT-05 | `IncomeStatementView` | Kalkulasi Laba Bersih = (Pendapatan - HPP - Beban Operasional + Pendapatan Lain - Beban Lain) | Nilai laba bersih konsisten dengan perubahan modal pemilik | **PASS** |
| ACT-06 | `BalanceSheetView` | Verifikasi persamaan dasar akuntansi: `Aset == Liabilitas + Ekuitas` | Neraca menunjukkan status SEIMBANG (Difference = 0) | **PASS** |
| ACT-07 | `FixedAssetsView` | Kalkulasi penyusutan aset tetap metode garis lurus per bulan | Nilai beban depresiasi bulanan terhitung tepat sesuai rumus | **PASS** |
| ACT-08 | `FiscalClosingView` | Penguncian tanggal buku lampau (*closing lock date*) | Transaksi dengan tanggal sebelum tanggal kunci ditolak untuk diedit | **PASS** |

---

## 4. Matriks Pengujian Keamanan & Basis Data Supabase (Security & Database Tests)

| ID Uji | Target / Komponen | Skenario Pengujian | Hasil Pengujian Aktual | Status | Risiko |
|---|---|---|---|---|---|
| SEC-01 | Tabel `system_users` | Akses SELECT/INSERT/UPDATE via Supabase Anonymous Key (Anon Key) | Akses DITOLAK oleh PostgreSQL RLS (`Permission Denied`) | **PASS** | Tidak Ada |
| SEC-02 | Tabel `rate_limits` | Akses SELECT/INSERT via Supabase Anonymous Key | Akses DITOLAK oleh PostgreSQL RLS | **PASS** | Tidak Ada |
| SEC-03 | Tabel `accounts` | Akses SELECT/INSERT/DELETE via Anonymous Key | Akses DITERIMA karena policy `Allow public all` masih aktif | **FAIL** | **TINGGI** |
| SEC-04 | Tabel `transactions` | Akses SELECT/INSERT/DELETE via Anonymous Key | Akses DITERIMA karena policy `Allow public all` masih aktif | **FAIL** | **KRITIS** |
| SEC-05 | Tabel `contacts` | Akses SELECT/INSERT/DELETE via Anonymous Key | Akses DITERIMA karena policy `Allow public all` masih aktif | **FAIL** | **TINGGI** |
| SEC-06 | `src/lib/supabase.ts` (L11-12) | Pemeriksaan fallback URL jika environment variable tidak terisi | Fallback mengarah ke Project ID Produksi (`drsqwxkkcfqvooqzoyvm`) | **FAIL** | **KRITIS** |
| SEC-07 | `src/lib/supabase.ts` (L212) | Pengiriman array transaksi kosong (`payload.transactions = []`) | Sistem menjalankan query DELETE seluruh data transaksi basis data | **FAIL** | **TINGGI** |
| SEC-08 | `localStorage` Override | Penulisan key `spectra_supabase_url` di browser console pengguna | Override lokal menimpa environment variable Vercel Preview/Staging | **FAIL** | **TINGGI** |
| SEC-09 | Secret Leakage di Git | Pemeriksaan riwayat commit dan staging git terhadap API key/password | Tidak ditemukan API key Groq, Supabase Service Key, atau password plaintext | **PASS** | Bersih |

---

## 5. Matriks Pengujian Integrasi Serverless API Vercel

| ID Uji | Endpoint | Skenario Pengujian | Respons HTTP | Status |
|---|---|---|---|---|
| API-01 | `POST /api/login` | Login dengan email dan password yang benar | 200 OK + Signed Token + Profil Pengguna | **PASS** |
| API-02 | `POST /api/login` | Login dengan password salah | 401 Unauthorized ("Email atau password salah") | **PASS** |
| API-03 | `POST /api/login` | Percobaan login berulang kali (Brute force > 10x) | 429 Too Many Requests | **PASS** |
| API-04 | `POST /api/scan-receipt` | Upload payload base64 struk belanja normal (< 2MB) | 200 OK + JSON terstruktur data struk | **PASS** |
| API-05 | `POST /api/scan-receipt` | Upload payload melebihi batas Vercel Gateway (> 4.5MB) | 413 Payload Too Large (Ditangani oleh pre-compressor) | **PASS** |
| API-06 | `GET /api/verify-session` | Request dengan Bearer token yang valid | 200 OK + Session Active | **PASS** |
| API-07 | `GET /api/verify-session` | Request tanpa Authorization header atau token palsu | 401 Unauthorized | **PASS** |
| API-08 | `GET /api/system-status` | Pemeriksaan kesehatan sistem (Health check) | 200 OK + Status Koneksi DB & Engine | **PASS** |
| API-09 | `POST /api/sync` | Panggilan sinkronisasi ke mock endpoint | 200 OK (Respons mock, tidak menyentuh database) | **WARNING (MOCK)** |
| API-10 | `GET /api/data` | Pengambilan data statis demo | 200 OK (Data statis hardcoded) | **WARNING (MOCK)** |

---

## 6. Rekomendasi Tindak Lanjut Pengujian
1. **Remediasi RLS Tabel Transaksi:** Seluruh tabel transaksi, akun, kontak, dan pengaturan wajib dilindungi dengan RLS authenticated-only sebelum kode di-merge ke branch `main`.
2. **Pembersihan Fallback URL:** Menghapus string hardcoded Project ID Produksi di `src/lib/supabase.ts` dan menggantinya dengan exception throwing jika env var kosong.
3. **Penyambungan Automated Test ke CI/CD:** Menambahkan eksekusi `scripts/test_auto_record_regression.mjs` ke dalam pipeline GitHub Actions agar setiap pull request diuji otomatis.
