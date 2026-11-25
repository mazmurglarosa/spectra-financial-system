# PETA ALUR KERJA SISTEM (WORKFLOW MAP) SPECTRA
**Dokumen Audit Sistem: End-to-End Workflow & Business Process Mapping**
**Versi:** 2.4.0-audit
**Tanggal:** 24 November 2026
**Branch:** `feature/secure-auth-groq`

---

## 1. Ikhtisar Alur Kerja Sistem
SPECTRA Financial System dirancang untuk mengotomasi siklus akuntansi standar entitas bisnis secara menyeluruh dengan mengintegrasikan antarmuka web modern, pemrosesan kecerdasan buatan (Vision AI), sinkronisasi cloud real-time, dan pelaporan keuangan kepatuhan fiskal Indonesia.

Dokumen ini memetakan lima alur kerja (workflow) inti SPECTRA:
1. **Workflow 1:** Siklus Autentikasi dan Manajemen Sesi Pengguna
2. **Workflow 2:** Siklus Akuntansi Penuh (Accounting Cycle)
3. **Workflow 3:** Perekaman Otomatis Bukti Transaksi (Auto Record Pipeline)
4. **Workflow 4:** Sinkronisasi Eksternal & Pencadangan Otomatis (Google Drive & Sheets)
5. **Workflow 5:** Pelaporan Keuangan, Perpajakan, dan Analisis Fiskal

---

## 2. Workflow 1: Siklus Autentikasi & Manajemen Sesi

```mermaid
sequenceDiagram
    autonumber
    actor Pengguna as Pengguna / Akuntan
    participant UI as Antarmuka SPECTRA (React)
    participant AuthContext as Auth/Session Context
    participant Serverless as Vercel API (/api/login)
    participant Supabase as Supabase DB (system_users)

    Pengguna->>UI: Input Email & Password di Form Login
    UI->>Serverless: POST /api/login (JSON payload)
    Serverless->>Supabase: Query user berdasarkan email
    Supabase-->>Serverless: Kembalikan hash password & role
    Serverless->>Serverless: Verifikasi bcrypt/HMAC hash
    alt Kredensial Valid
        Serverless->>Serverless: Terbitkan Signed Session Token (HMAC-SHA256)
        Serverless-->>UI: 200 OK + Token + Data Profil (Nama, Role, Expiry)
        UI->>AuthContext: Simpan sesi (Memory & localStorage)
        UI->>UI: Redirect ke Dashboard / Halaman Utama
    else Kredensial Salah / Terkunci
        Serverless-->>UI: 401 Unauthorized / 429 Rate Limited
        UI->>Pengguna: Tampilkan pesan kesalahan autentikasi
    end

    loop Setiap Panggilan API Terproteksi
        UI->>Serverless: Request + Header 'Authorization: Bearer <token>'
        Serverless->>Serverless: Verifikasi tanda tangan token & waktu kedaluwarsa
    end

    Pengguna->>UI: Klik Tombol Logout
    UI->>AuthContext: Hapus token dari memory & localStorage
    UI->>UI: Redirect kembali ke halaman login
```

### Rincian Alur Autentikasi:
1. **Penerbitan Sesi:** Autentikasi diproses secara aman di backend serverless (`/api/login`), tidak membocorkan hash password ke klien browser.
2. **Penyimpanan Token:** Klien menyimpan token sesi di `localStorage` (`spectra_session_token`) untuk menjaga persistensi sesi saat reload halaman.
3. **Pemeriksaan Hak Akses (RBAC):** Sistem membedakan hak akses berdasarkan tiga tingkat peran:
   - `superadmin`: Akses penuh konfigurasi sistem, manajemen pengguna, dan reset database.
   - `admin`: Pengelolaan transaksi harian, edit master akun, dan ekspor laporan.
   - `auditor` / `viewer`: Akses read-only untuk pemeriksaan pembukuan dan audit trail.

---

## 3. Workflow 2: Siklus Akuntansi Penuh (The Accounting Cycle)

```mermaid
flowchart TD
    A["1. Master Data Setup<br/>(Bagan Akun/COA, Kontak, Setting Perusahaan)"] --> B["2. Perekaman Bukti Transaksi<br/>(Auto Record OCR / Form Input Manual)"]
    B --> C["3. Validasi & Buku Jurnal Umum<br/>(Verifikasi Keseimbangan Debit = Kredit)"]
    C --> D["4. Posting ke Buku Besar<br/>(General Ledger & Buku Besar Pembantu)"]
    D --> E["5. Neraca Saldo<br/>(Trial Balance Validasi Saldo Normal)"]
    E --> F["6. Jurnal Penyesuaian<br/>(Depresiasi Aset Tetap, Akrual, Beban Dibayar di Muka)"]
    F --> G["7. Neraca Saldo Setelah Penyesuaian<br/>(Adjusted Trial Balance)"]
    G --> H["8. Penyusunan Laporan Keuangan<br/>(Laba Rugi, Posisi Keuangan/Neraca, Arus Kas, Perubahan Modal)"]
    H --> I["9. Jurnal Penutup & Tutup Buku<br/>(Closing Journal & Fiscal Closing Lock)"]

    style A fill:#e1f5fe,stroke:#0288d1
    style B fill:#e8f5e9,stroke:#388e3c
    style C fill:#fff3e0,stroke:#f57c00
    style H fill:#f3e5f5,stroke:#7b1fa2
    style I fill:#ffebee,stroke:#d32f2f
```

### Tahapan Operasional Siklus:
1. **Master Data:** Menyiapkan 66 akun default standar SAK Indonesia yang diklasifikasikan ke dalam 5 kategori besar (Aset, Liabilitas, Ekuitas, Pendapatan, Beban).
2. **Transaksi & Jurnal:** Setiap transaksi dicatat secara berpasangan ganda (*double-entry bookkeeping*). Sistem secara otomatis menolak transaksi jika `Total Debit != Total Kredit`.
3. **Buku Besar:** Mutasi transaksi dikelompokkan per kode akun akuntansi, menghitung saldo berjalan secara real-time.
4. **Neraca Saldo:** Memeriksa kesetaraan total saldo debit dan kredit seluruh akun sebelum laporan disusun.
5. **Penyesuaian:** Mengkalkulasi penyusutan aset tetap secara berkala berdasarkan metode garis lurus (*straight-line depreciation*).
6. **Laporan Keuangan:** Menyajikan Laba Rugi komprehensif, Neraca Posisi Keuangan, Laporan Arus Kas (Metode Langsung & Tidak Langsung), serta Laporan Perubahan Ekuitas.
7. **Tutup Buku:** Mengunci periode pembukuan lampau agar tidak dapat dimutasi atau dimanipulasi (*lock date enforcement*).

---

## 4. Workflow 3: Perekaman Otomatis Bukti Transaksi (Auto Record Pipeline)

```mermaid
flowchart TD
    Input["Input Pengguna:<br/>PDF / Gambar Struk / Kamera HP / Sampel Resmi"] --> Preprocess["receiptMediaService.ts<br/>- Konversi Multi-halaman PDF.js<br/>- Downscaling Canvas Pintar<br/>- Kompresi Aspek Rasio Struk Panjang"]
    Preprocess --> PayloadCheck{"Ukuran Base64<br/>< 1.5MB?"}
    PayloadCheck -- Ya --> APICall["POST /api/scan-receipt<br/>Groq Vision (llama-3.2-11b-vision-preview)"]
    PayloadCheck -- Tidak --> CompressMore["Kompresi Ulang Canvas<br/>Resize ke Max 2048px"] --> APICall

    APICall --> APIResponse{"Groq Vision Berhasil?"}
    APIResponse -- Ya --> ParseJSON["Parsing & Pembersihan JSON Struk<br/>(Item, Subtotal, Pajak, Grand Total)"]
    APIResponse -- Gagal / 429 --> FallbackGemini["Fallback: POST /api/gemini-ocr"]
    FallbackGemini --> GeminiResp{"Gemini Berhasil?"}
    GeminiResp -- Ya --> ParseJSON
    GeminiResp -- Gagal --> FallbackTesseract["Fallback: Tesseract.js (Client OCR)"]
    FallbackTesseract --> ParseJSON

    ParseJSON --> Tahap2["Tahap 2: Pengisian Otomatis Tabel Koreksi<br/>- Verifikasi Akurasi Nominal<br/>- Pemilihan Aturan POS A–F<br/>- Rekomendasi Akun Debit/Kredit"]
    Tahap2 --> UserReview{"Pengguna Meninjau & Koreksi"}
    UserReview -- Setuju & Posting --> PostJournal["Posting Jurnal ke AccountingContext & Supabase"]
    PostJournal --> ExternalGuard["Pemeriksaan externalSyncGuard.ts"]
    ExternalGuard -- Lingkungan Staging/Preview --> MockSync["Mock Eksternal: Tidak Menembus GDrive/Sheets Prod"]
    ExternalGuard -- Lingkungan Produksi Asli --> LiveSync["Unggah Bukti ke GDrive & Catat ke GSheets"]

    style Input fill:#e3f2fd,stroke:#1976d2
    style Preprocess fill:#ede7f6,stroke:#512da8
    style APICall fill:#fff8e1,stroke:#fbc02d
    style Tahap2 fill:#e8f5e9,stroke:#388e3c
    style ExternalGuard fill:#fbe9e7,stroke:#d84315
```

### Detail Teknis Pipeline Auto Record:
1. **Multi-page Batch Processing:** Dokumen PDF diproses per halaman menggunakan `pdfjs-dist/build/pdf.worker.min.mjs` secara asinkron.
2. **Deduplikasi Cerdas:** Menghindari penghitungan ganda atas subtotal/total yang tercetak di beberapa halaman struk faktur yang panjang.
3. **Mesin Rekomendasi Jurnal (POS Engine):**
   - **POS A (Penjualan Tunai):** Debit Kas/Bank, Kredit Pendapatan Penjualan, Kredit Utang PPN.
   - **POS B (Pembelian Barang Dagang):** Debit Persediaan, Debit PPN Masukan, Kredit Kas/Utang Usaha.
   - **POS C (Beban Operasional):** Debit Beban Terkait (Listrik/Air/Internet), Kredit Kas/Bank.
   - **POS D (Beban Administrasi & Umum):** Debit Beban ATK/Transport, Kredit Kas Kecil.
   - **POS E (Perolehan Aset Tetap):** Debit Peralatan/Kendaraan, Kredit Kas/Utang.
   - **POS F (Pengeluaran Lain-lain):** Debit Beban Lain-lain, Kredit Kas.

---

## 5. Workflow 4: Sinkronisasi Eksternal & Pencadangan Otomatis

```mermaid
flowchart LR
    A["Transaksi Berhasil Diposting"] --> B{"externalSyncGuard.ts<br/>Evaluasi Lingkungan"}
    B -- "Staging (xaafjvmdjdlfqdrljjlr)<br/>atau Vercel Preview" --> C["Fail-Closed Staging Mode<br/>- Blokir panggilan Apps Script<br/>- Mock ID Berkas & Link Thumbnail<br/>- Lindungi Folder GDrive Produksi"]
    B -- "Produksi (drsqwxkkcfqvooqzoyvm)<br/>dan Domain spectra.my.id" --> D["Production Mode<br/>Panggil Google Apps Script Web App"]

    D --> E["Google Drive Bot<br/>Upload Bukti Struk ke Folder 1W4Z..."]
    D --> F["Google Spreadsheet Bot<br/>Tambah Baris Transaksi ke Sheet"]
    E --> G["Kembalikan Thumbnail URL CDN<br/>(lh3.googleusercontent.com/d/...)"]
    F --> H["Kembalikan Status Sync Sheet Sukses"]

    style A fill:#e8eaf6,stroke:#3f51b5
    style B fill:#fff9c4,stroke:#fbc02d
    style C fill:#ffcdd2,stroke:#c62828
    style D fill:#c8e6c9,stroke:#2e7d32
```

### Mekanisme Pengamanan Sinkronisasi:
- **Pencegahan Kontaminasi Staging:** Mengingat ID folder Google Drive (`1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9`) adalah repositori arsip produksi, sistem secara ketat memutus koneksi upload saat dijalankan di staging atau pratinjau Vercel.
- **Fail-Closed Strategy:** Jika penentuan lingkungan ambigu, sistem memilih untuk tidak menyinkronkan data eksternal (*fail-closed*) guna mencegah kebocoran data staging ke lembar kerja resmi perusahaan.

---

## 6. Workflow 5: Pelaporan Keuangan, Perpajakan, dan Analisis Fiskal

```mermaid
flowchart TD
    DataJurnal["Data Jurnal Terposting (AccountingContext)"] --> FilterPeriod["Filter Periode Buku & Klasifikasi Akun"]

    FilterPeriod --> LapKomersial["Laporan Keuangan Komersial"]
    FilterPeriod --> LapFiskal["Laporan Kepatuhan Perpajakan"]
    FilterPeriod --> LapRasio["Analisis Rasio Keuangan"]

    LapKomersial --> LR["Laba Rugi (Pendapatan - HPP - Beban)"]
    LapKomersial --> Neraca["Neraca (Aset = Liabilitas + Ekuitas)"]
    LapKomersial --> ArusKas["Arus Kas (Operasi, Investasi, Pendanaan)"]
    LapKomersial --> Ekuitas["Perubahan Modal (Modal Awal + Laba - Prive)"]

    LapFiskal --> PPN["Rekap PPN (PPN Keluaran - PPN Masukan)"]
    LapFiskal --> PPhBadan["PPh Badan (Koreksi Fiskal Positif/Negatif & Tarif Pasal 17/PP 55)"]

    LapRasio --> Likuiditas["Likuiditas (Current Ratio, Quick Ratio)"]
    LapRasio --> Profitabilitas["Profitabilitas (ROA, ROE, NPM, GPM)"]
    LapRasio --> Solvabilitas["Solvabilitas (Debt to Equity Ratio)"]

    LR & Neraca & ArusKas & PPN & PPhBadan --> ExportEngine["exportService.ts<br/>Export ke Excel (.xlsx) / Cetak PDF / CSV"]

    style DataJurnal fill:#e1f5fe,stroke:#0288d1
    style LapKomersial fill:#e8f5e9,stroke:#388e3c
    style LapFiskal fill:#fff3e0,stroke:#f57c00
    style LapRasio fill:#f3e5f5,stroke:#7b1fa2
    style ExportEngine fill:#ede7f6,stroke:#512da8
```

### Integrasi Pelaporan:
- **Koreksi Fiskal Otomatis:** Memisahkan beban non-deductible expense (biaya representasi tanpa daftar nominatif, sumbangan, sanksi administrasi pajak) untuk menghitung Penghasilan Kena Pajak (PhKP) sesuai UU HPP.
- **Ekspor Format Siap Audit:** Menyediakan format cetak standar akuntansi yang kompatibel dengan format kertas kerja auditor publik (KAP) dan konsultan pajak.
