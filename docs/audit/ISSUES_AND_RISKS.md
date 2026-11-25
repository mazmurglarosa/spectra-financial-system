# DAFTAR TEMUAN MASALAH & ANALISIS RISIKO (ISSUES & RISKS)
**Dokumen Audit Sistem: Vulnerability Catalog, Risk Matrix, & Remediation Plan**
**Versi:** 2.4.0-audit
**Tanggal:** 24 November 2026
**Branch:** `feature/secure-auth-groq`

---

## 1. Matriks Klasifikasi Risiko (Risk Severity Matrix)

| Tingkat Keparahan | Definisi & Dampak Bisnis | Jumlah Temuan |
|---|---|---|
| **CRITICAL (Kritis)** | Kerentanan yang mengancam integritas data produksi secara langsung, berpotensi membocorkan data rahasia, atau menyebabkan kehilangan data massal. | **2 Temuan** |
| **HIGH (Tinggi)** | Celah keamanan atau bug logika yang dapat dieksploitasi pengguna tidak sah atau menyebabkan kesalahan fatal pada operasional akuntansi. | **2 Temuan** |
| **MEDIUM (Sedang)** | Anomali arsitektur, komponen tidak terhubung (orphaned), atau endpoint mock yang membingungkan alur operasional. | **2 Temuan** |
| **LOW (Rendah)** | Ketidakpatuhan lisensi cloud hosting atau perbaikan kosmetik tanpa dampak langsung ke integritas transaksi. | **1 Temuan** |

---

## 2. Rincian Temuan Masalah & Kerentanan Sistem

### [CRITICAL-01] Hardcoded Supabase Production Project ID sebagai Default Fallback
- **ID Temuan:** `SEC-001`
- **Kategori:** Keamanan & Konfigurasi Lingkungan (Environment Isolation)
- **Tingkat Keparahan:** **CRITICAL**
- **Lokasi Kode:** [src/lib/supabase.ts](file:///c:/Users/Mazmur%20Gusti%20Agung%20L/Documents/SIKEU2/src/lib/supabase.ts#L11-L12)
  ```typescript
  const DEFAULT_SUPABASE_URL = 'https://drsqwxkkcfqvooqzoyvm.supabase.co';
  const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  ```
- **Akar Masalah (Root Cause):** Pengembang menyematkan kredensial default yang langsung mengarah ke Project ID Produksi (`drsqwxkkcfqvooqzoyvm`) sebagai fallback ketika `import.meta.env.VITE_SUPABASE_URL` tidak didefinisikan (misalnya saat pengujian lokal atau pratinjau yang belum terkonfigurasi sempurna).
- **Langkah Reproduksi:**
  1. Hapus atau kosongkan variabel `.env.local` di lingkungan pengembangan lokal.
  2. Jalankan aplikasi via `npm run dev`.
  3. Aplikasi secara otomatis menyambungkan koneksi browser ke basis data **PRODUKSI**, bukan Staging.
- **Dampak Bisnis:** Uji coba pengembang atau testing otomatis dapat secara tidak sengaja membaca, mengubah, atau merusak data pembukuan resmi di basis data Produksi.
- **Rencana Remediasi:**
  - Hapus konstanta `DEFAULT_SUPABASE_URL` dan `DEFAULT_SUPABASE_ANON_KEY`.
  - Ubah inisialisasi agar *fail-closed*: jika `VITE_SUPABASE_URL` tidak disetel, lemparkan error eksplisit: `"FATAL: Konfigurasi Supabase URL tidak ditemukan. Harap isi environment variable."`

---

### [CRITICAL-02] Akses Publik Langsung ke Tabel Baseline Supabase via Client Browser
- **ID Temuan:** `SEC-002`
- **Kategori:** Keamanan Basis Data & Otorisasi Row Level Security (RLS)
- **Tingkat Keparahan:** **CRITICAL**
- **Lokasi Kode:** `supabase/migrations/000_baseline_schema.sql` (Line 124–160)
  ```sql
  CREATE POLICY "Allow public all" ON accounts FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "Allow public all" ON transactions FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "Allow public all" ON contacts FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "Allow public all" ON company_settings FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "Allow public all" ON activity_logs FOR ALL USING (true) WITH CHECK (true);
  ```
- **Akar Masalah (Root Cause):** Kebijakan RLS baseline dibuat dengan aturan terbuka (`FOR ALL USING (true)`), memungkinkan siapapun yang memegang `anonKey` (yang bersifat publik di browser bundle) untuk melakukan operasi `SELECT`, `INSERT`, `UPDATE`, dan `DELETE` langsung ke tabel-tabel keuangan tanpa melalui backend API.
- **Langkah Reproduksi:**
  1. Buka peramban di halaman aplikasi SPECTRA.
  2. Buka DevTools Console (`F12`).
  3. Jalankan perintah JavaScript Supabase client:
     ```javascript
     supabase.from('transactions').delete().neq('id', '0');
     ```
  4. Seluruh baris transaksi dalam basis data terhapus seketika tanpa memerlukan login superadmin.
- **Dampak Bisnis:** Risiko sabotase data keuangan, penghapusan jurnal akuntansi oleh pihak eksternal, atau pembocoran informasi finansial sensitif perusahaan.
- **Rencana Remediasi:**
  - Cabut policy `"Allow public all"` pada seluruh tabel baseline.
  - Terapkan migrasi penguncian RLS: Hanya izinkan operasi tulis (INSERT/UPDATE/DELETE) melalui Service Role di backend Serverless API atau pengguna terotentikasi Supabase Auth (`TO authenticated`).

---

### [HIGH-01] Bahaya Blank Sync Menghapus Seluruh Transaksi Basis Data
- **ID Temuan:** `DAT-001`
- **Kategori:** Integritas Data & Logika Sinkronisasi
- **Tingkat Keparahan:** **HIGH**
- **Lokasi Kode:** [src/lib/supabase.ts](file:///c:/Users/Mazmur%20Gusti%20Agung%20L/Documents/SIKEU2/src/lib/supabase.ts#L209-L215)
  ```typescript
  if (payload.transactions && payload.transactions.length === 0) {
    // Delete all transactions if array is empty
    const { error: delErr } = await supabase.from('transactions').delete().neq('id', 'dummy-id');
    if (delErr) throw delErr;
  }
  ```
- **Akar Masalah (Root Cause):** Fungsi sinkronisasi cloud mengasumsikan jika array transaksi lokal bernilai kosong (`length === 0`), maka pengguna berniat mengosongkan seluruh basis data di cloud.
- **Langkah Reproduksi:**
  1. Pengguna membuka SPECTRA di peramban baru dengan cache lokal/localStorage kosong.
  2. State awal aplikasi memuat array kosong (`transactions: []`).
  3. Sinkronisasi background otomatis terpicu (`syncLocalToCloud`).
  4. Query `delete().neq('id', 'dummy-id')` tereksekusi, menghapus seluruh riwayat transaksi di cloud Supabase.
- **Dampak Bisnis:** Kehilangan seluruh histori pembukuan perusahaan (*data loss*) hanya karena anomali inisialisasi state di peramban klien.
- **Rencana Remediasi:**
  - Hapus logika pembersihan otomatis berbasis array kosong.
  - Pengosongan data hanya boleh dilakukan melalui konfirmasi eksplisit di menu `DatabaseMaintenanceView` dengan validasi kata sandi superadmin.

---

### [HIGH-02] Prioritas LocalStorage Mengalahkan Environment Variables Hosting
- **ID Temuan:** `SEC-003`
- **Kategori:** Tata Kelola Konfigurasi Klien
- **Tingkat Keparahan:** **HIGH**
- **Lokasi Kode:** [src/lib/supabase.ts](file:///c:/Users/Mazmur%20Gusti%20Agung%20L/Documents/SIKEU2/src/lib/supabase.ts#L17-L22)
  ```typescript
  const savedUrl = typeof window !== 'undefined' ? localStorage.getItem('spectra_supabase_url') : null;
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const supabaseUrl = savedUrl || envUrl || DEFAULT_SUPABASE_URL;
  ```
- **Akar Masalah (Root Cause):** Sistem memprioritaskan nilai dari `localStorage` (`savedUrl`) di atas variabel lingkungan hosting (`envUrl`).
- **Langkah Reproduksi:**
  1. Pengguna pernah menguji koneksi staging di laptopnya, sehingga browser menyimpan `spectra_supabase_url = 'https://xaafjvmdjdlfqdrljjlr.supabase.co'`.
  2. Aplikasi dideploy ke domain produksi resmi Vercel.
  3. Saat pengguna membuka domain produksi, browser tetap memuat URL staging dari `localStorage`, menyebabkan transaksi tercatat di staging alih-alih produksi.
- **Dampak Bisnis:** Ketidaksinkronan data operasional antara apa yang dilihat staf akuntansi dan basis data produksi resmi.
- **Rencana Remediasi:**
  - Utamakan `envUrl`. Nilai `localStorage` hanya boleh digunakan jika secara eksplisit berada dalam mode pengujian lokal (`import.meta.env.DEV === true`).

---

### [MEDIUM-01] Komponen View Yatim (Orphaned / Unrouted Views)
- **ID Temuan:** `ARC-001`
- **Kategori:** Arsitektur Navigasi Kode
- **Tingkat Keparahan:** **MEDIUM**
- **Lokasi Kode:** `src/views/ClosingJournalView.tsx` dan `src/views/SubsidiaryLedgerView.tsx`
- **Akar Masalah (Root Cause):** Berkas view telah ditulis lengkap dengan fungsionalitas akuntansi, namun tidak didaftarkan pada perutean `App.tsx` dan tidak muncul pada navigasi `Sidebar.tsx`.
- **Dampak Bisnis:** Fitur buku besar pembantu dan jurnal penutup akhir periode tidak dapat diakses oleh staf akuntansi melalui navigasi resmi.
- **Rencana Remediasi:** Daftarkan kedua modul ke dalam konfigurasi navigasi aplikasi setelah validasi audit selesai.

---

### [MEDIUM-02] Endpoint Mock Serverless API Tidak Berfungsi Nyata
- **ID Temuan:** `API-001`
- **Kategori:** Konsistensi Backend API
- **Tingkat Keparahan:** **MEDIUM**
- **Lokasi Kode:** `api/data.js` dan `api/sync.js`
- **Akar Masalah (Root Cause):** Berkas `api/data.js` mengembalikan objek JSON demo statis yang tidak pernah diperbarui, sementara `api/sync.js` mengembalikan respons `success: true` tanpa menulis data apapun ke Supabase.
- **Dampak Bisnis:** Pengembang atau sistem eksternal yang mencoba mengintegrasikan data melalui endpoint tersebut akan menerima data palsu atau transaksi hilang.
- **Rencana Remediasi:** Tandai endpoint sebagai *deprecated* atau sambungkan ke tabel Supabase yang sebenarnya menggunakan `SUPABASE_SERVICE_ROLE_KEY`.

---

### [LOW-01] Batasan Lisensi Vercel Hobby Plan untuk Penggunaan Komersial
- **ID Temuan:** `LIC-001`
- **Kategori:** Kepatuhan Lisensi Cloud
- **Tingkat Keparahan:** **LOW**
- **Akar Masalah (Root Cause):** SPECTRA dideploy menggunakan akun Vercel tier **Hobby (Free)**. Ketentuan layanan Vercel menyatakan bahwa tier Hobby hanya ditujukan untuk keperluan personal/non-komersial.
- **Dampak Bisnis:** Potensi penangguhan (*account suspension*) oleh Vercel jika sistem digunakan untuk aktivitas operasional komersial perusahaan berskala besar.
- **Rencana Remediasi:** Upgrade proyek Vercel ke paket **Pro ($20/bulan)** saat sistem dipindahkan ke lingkungan produksi resmi.
