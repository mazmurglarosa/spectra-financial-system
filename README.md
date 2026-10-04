# SPECTRA-Financial System
> Sistem Pencatatan & Pembuatan Laporan Keuangan Otomatis Berbasis Web (Accurate Standard)

SPECTRA-Financial System adalah sistem akuntansi dan keuangan enterprise modern yang mentransformasikan model pembukuan spreadsheet Excel (**SIKEU PT BARU.xlsx**) menjadi aplikasi web akuntansi otomatis berkinerja tinggi, interaktif, dan selalu tersinkronisasi secara real-time tanpa risiko kehilangan data (*Zero Data Loss*).

---

## 🌟 Fitur Utama (Accurate Accounting Core)

1. **Dashboard Eksekutif & Health Check Akuntansi**
   - Ringkasan KPI: Total Aset, Total Liabilitas, Total Ekuitas, dan Laba Bersih.
   - Indikator Keseimbangan Akuntansi Otomatis: `Aset = Liabilitas + Ekuitas`.
   - Ringkasan posisi likuiditas kas, piutang, dan utang usaha secara seketika.

2. **Bagan Akun / Chart of Accounts (COA)**
   - Pre-loaded dengan **73 akun standar** dari berkas *SIKEU PT BARU.xlsx*.
   - Klasifikasi lengkap: Harta Lancar, Harta Tetap, Utang Lancar, Utang Jangka Panjang, Ekuitas, Pendapatan Usaha/Lain, dan Beban Usaha/Lain.
   - Pos Laporan (Neraca / Laba Rugi) dan Saldo Normal (Debet / Kredit).
   - CRUD lengkap (Tambah, Edit, Hapus dengan validasi integritas transaksi).

3. **Jurnal Umum (General Journal / Transaksi Berpasangan)**
   - Sistem pencatatan berpasangan (*Double-Entry Bookkeeping*) multi-baris.
   - Validasi keseimbangan Debit = Kredit secara interaktif sebelum posting.
   - Pengelompokan nomor bukti (BKK, BKM, JU), tanggal, pihak terkait, dan memo baris.

4. **Buku Besar (General Ledger)**
   - Filter interaktif per akun perkiraan dan rentang tanggal.
   - Perhitungan saldo awal, mutasi debit/kredit, dan **Saldo Berjalan (Running Balance)** otomatis.

5. **Neraca Saldo (Trial Balance)**
   - Kompilasi saldo akhir seluruh akun aktif.
   - Pembuktian keseimbangan total debit dan kredit (Ʃ Balance).

6. **Neraca Lajur 10-Kolom (Worksheet)**
   - Format standar kertas kerja akuntansi:
     - Kolom 1-2: Neraca Saldo (Debit & Kredit)
     - Kolom 3-4: Penyesuaian (Debit & Kredit)
     - Kolom 5-6: Neraca Saldo Disesuaikan (Debit & Kredit)
     - Kolom 7-8: Laba Rugi (Debit & Kredit)
     - Kolom 9-10: Neraca (Debit & Kredit)
   - Baris penyeimbang Laba Bersih otomatis.

7. **Laporan Laba Rugi (Income Statement / Profit & Loss)**
   - Rincian Pendapatan Operasional vs Beban Operasional.
   - Laba Kotor, Laba Operasi, Pendapatan/Beban Non-Operasional, dan Laba Bersih.
   - Siap cetak formal dengan kolom tanda tangan akuntan dan direktur.

8. **Laporan Posisi Keuangan (Neraca / Balance Sheet)**
   - Aset Lancar & Aset Tetap (dikurangi akumulasi penyusutan).
   - Kewajiban Lancar & Jangka Panjang.
   - Ekuitas Pemilik & Laba Periode Berjalan.
   - Validasi persamaan aktiva = pasiva.

9. **Laporan Perubahan Modal (Statement of Changes in Equity)**
   - Pergerakan modal awal, penambahan laba bersih, penarikan prive, dan modal akhir.

10. **Laporan Arus Kas (Cash Flow - Metode Langsung)**
    - Arus kas dari Aktivitas Operasi, Aktivitas Investasi, dan Aktivitas Pendanaan.
    - Rekonsiliasi kenaikan kas dengan saldo kas awal dan kas akhir.

11. **Buku Pembantu Piutang & Hutang (Subsidiary Ledgers)**
    - Pemantauan tagihan piutang per pelanggan (AR).
    - Pemantauan kewajiban utang per pemasok (AP).

12. **Analisis Rasio Keuangan**
    - Rasio Likuiditas: Current Ratio, Quick Ratio.
    - Rasio Solvabilitas: Debt to Asset Ratio (DAR), Debt to Equity Ratio (DER).
    - Rasio Profitabilitas: Net Profit Margin (NPM), Return on Assets (ROA), Return on Equity (ROE).

13. **Jurnal Penutup (Closing Entries)**
    - Pembuatan ayat jurnal penutup otomatis untuk akun nominal ke Ikhtisar Laba Rugi dan Modal.

14. **Export Excel Multi-Sheet & Cadangan Data**
    - Export langsung setiap tabel laporan ke berkas Microsoft Excel (`.xlsx`).
    - Unduh seluruh buku akuntansi lengkap dalam 1 berkas Excel multi-sheet.
    - Fitur Backup JSON dan Restore JSON kapan saja.

---

## ⚡ Teknologi & Sinkronisasi Real-Time

- **Frontend**: React 19 + TypeScript + Vite.
- **Styling**: Modern Enterprise Dark Slate Design System dengan responsivitas penuh & gaya ramah cetak (`@media print`).
- **Database & Real-time Sync**:
  1. **Dual-Layer Persistence**: Penyimpanan lokal persisten dengan sinkronisasi instan antar-tab (`BroadcastChannel`) sehingga perubahan di satu tab langsung muncul di semua tab lain secara seketika tanpa refresh.
  2. **Convex Database**: Folder backend `/convex` lengkap dengan schema dan mutasi untuk integrasi cloud real-time.
- **Deployment Ready**:
  - Konfigurasi **Vercel** (`vercel.json`)
  - Konfigurasi **Cloudflare Pages** (`wrangler.toml` dan `public/_redirects`)

---

## 🚀 Menjalankan Secara Lokal

```bash
# Install dependensi
npm install

# Jalankan server pengembangan
npm run dev

# Bangun versi produksi
npm run build
```

---

## ☁️ Menghubungkan ke Convex Database

1. Inisialisasi Convex di proyek:
   ```bash
   npx convex dev
   ```
2. Set variabel lingkungan di `.env`:
   ```env
   VITE_CONVEX_URL=https://your-convex-deployment.convex.cloud
   ```

---

## 🌐 Deployment ke Vercel & Cloudflare

### Vercel:
1. Hubungkan repositori GitHub ke [Vercel](https://vercel.com).
2. Framework preset: **Vite**.
3. Build command: `npm run build`, Output directory: `dist`.
4. Deploy!

### Cloudflare Pages:
1. Buka dashboard Cloudflare Pages.
2. Hubungkan repositori GitHub.
3. Build command: `npm run build`, Output directory: `dist`.
4. Deploy!

---
Dikembangkan khusus untuk **SPECTRA-Financial System** berdasarkan berkas kerja akuntansi *SIKEU PT BARU.xlsx*.
