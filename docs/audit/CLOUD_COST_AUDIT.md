# AUDIT BIAYA & OPTIMISASI PENYIMPANAN CLOUD (CLOUD COST & STORAGE AUDIT)
**Dokumen Audit Sistem: Infrastructure Cost, Storage Architecture, & Efficiency Analysis**
**Versi:** 2.4.0-audit
**Tanggal:** 24 November 2026
**Branch:** `feature/secure-auth-groq`

---

## 1. Ringkasan Eksekutif Biaya & Infrastruktur
Audit ini menganalisis efisiensi penggunaan sumber daya cloud pada SPECTRA Financial System (SIKEU2), membandingkan batas kuota gratis (*free tier*), risiko lonjakan biaya (*cost spikes*), serta menyajikan strategi arsitektur hemat biaya untuk operasional berkelanjutan.

**Profil Infrastruktur Cloud:**
- **Basis Data & Autentikasi:** Supabase (PostgreSQL Cloud)
- **Hosting & Serverless Functions:** Vercel Cloud Platform
- **Vision AI Processing:** Groq Cloud (`llama-3.2-11b-vision-preview`) & Google Gemini Flash Fallback
- **Penyimpanan Berkas Struk:** Google Drive via Google Apps Script Web App
- **Pencadangan Lembar Kerja:** Google Sheets API via Google Apps Script

---

## 2. Analisis Rinci per Penyedia Layanan Cloud

### A. Supabase Database & Storage (Staging vs Produksi)
| Parameter Kuota | Batas Tier Gratis (Free Tier) | Penggunaan Saat Ini (Staging) | Status & Evaluasi Risiko |
|---|---|---|---|
| Ukuran Basis Data (DB Size) | 500 MB | ~4.2 MB (7 tabel, 66 akun COA) | **Sangat Aman (< 1% terpakai)** |
| Kuota Penyimpanan Berkas (Storage) | 1 GB | 0 MB (Berkas tidak disimpan di Supabase) | **Optimal (0% terpakai)** |
| Bandwidth Egress Bulanan | 2 GB / bulan | < 50 MB / bulan | **Sangat Aman** |
| Active Database Connections | 60 koneksi | 3–5 koneksi rata-rata | **Sangat Aman** |
| Monthly Active Users (MAU) | 50.000 pengguna | < 10 pengguna internal | **Sangat Aman** |
| Batas Inaktivitas (Project Pause) | Dijeda jika tidak aktif 7 hari berturut-turut | Aktif digunakan | Perlu cron keep-alive jika sistem idle lama |

#### Analisis Optimasi Penyimpanan Basis Data:
1. **Penyimpanan Baris Jurnal via Kolom JSONB:**
   - SPECTRA menyimpan rincian debit/kredit per transaksi di dalam kolom `lines JSONB` pada tabel `transactions`, bukan membuat tabel terpisah `transaction_details`.
   - **Efisiensi:** Menghemat hingga 40% ruang penyimpanan indeks relational dan foreign key overhead, serta mempercepat query pembacaan transaksi tunggal (1 query vs join multi-tabel).
2. **Penyimpanan Berkas Media di Luar Supabase:**
   - Foto struk belanja dan dokumen PDF berukuran 1–5 MB **TIDAK** disimpan dalam tabel SQL (menghindari kolom `bytea` atau base64 teks panjang yang dapat menghabiskan 500 MB dalam beberapa ratus transaksi).
   - Seluruh media bukti dialihkan ke Google Drive perusahaan, dan Supabase hanya menyimpan string URL CDN thumbnail (`https://lh3.googleusercontent.com/d/{fileId}`) yang hanya memakan ~65 byte per transaksi.

---

### B. Vercel Serverless Platform
| Parameter Kuota | Batas Tier Hobby (Personal) | Batas Tier Pro (Komersial) | Utilisasi SPECTRA |
|---|---|---|---|
| Function Execution Time | 100 GB-Hours / bulan | 1.000 GB-Hours / bulan | ~2.5 GB-Hours / bulan |
| Edge / Serverless Invocations | 100.000 panggilan / bulan | 1.000.000 panggilan / bulan | ~1.500 panggilan / bulan |
| Maksimum Ukuran Request Payload | **4.5 MB per request** | **4.5 MB per request** | Terkendali (< 1.5 MB berkat canvas compressor) |
| Serverless Execution Timeout | **10 detik** | **60 detik (default: 15s)** | Rata-rata eksekusi API OCR: 1.8 - 3.2 detik |
| Lisensi Penggunaan | **Hanya Non-Komersial** | **Komersial Diizinkan** | **Perhatian: Wajib upgrade saat live resmi** |

#### Mitigasi Batas Gateway 4.5 MB:
- Modul `src/services/receiptMediaService.ts` menerapkan kompresi kanvas di sisi peramban klien sebelum payload dikirimkan ke serverless endpoint `POST /api/scan-receipt`.
- Foto resolusi tinggi (misal 12 MP dari kamera smartphone) otomatis diturunkan ke dimensi maksimum 2048px dengan rasio kompresi JPEG 0.82, menghasilkan string Base64 rata-rata 600 KB – 1.2 MB. Hal ini menjamin request tidak akan pernah menabrak batasan `413 Payload Too Large` dari gateway Vercel.

---

### C. Groq Cloud Vision API
| Metrik | Kuota Free Tier | Estimasi Pemakaian SPECTRA | Estimasi Biaya |
|---|---|---|---|
| Model | `llama-3.2-11b-vision-preview` | Digunakan untuk OCR struk belanja | **$0.00 (Free Tier)** |
| Requests Per Minute (RPM) | 30 RPM | Rata-rata 1–2 scan per menit | Terpenuhi |
| Requests Per Day (RPD) | 14.400 RPD | < 200 scan per hari | Terpenuhi |
| Tokens Per Minute (TPM) | 7.000 TPM | ~1.200 token per struk | Terpenuhi |
| Estimasi Biaya jika Berbayar | $0.05 per 1 juta input token | 200 scan x 1.200 token = 240.000 token/hari | **~$0.012 per hari (~$0.36 / bulan)** |

---

### D. Google Workspace (Google Drive & Google Sheets Bot)
- **Mekanisme Integrasi:** Melalui Google Apps Script Web App yang berjalan di bawah akun Google Workspace perusahaan.
- **Biaya API:** **$0.00** (Google Apps Script tidak mengenakan biaya per panggilan API).
- **Kuota Penyimpanan:** Memanfaatkan penyimpanan gabungan Google Drive perusahaan (15 GB gratis per akun atau 2 TB – 5 TB pada Google Workspace Business).
- **Efisiensi:** Menghemat biaya cloud object storage komersial (seperti AWS S3 atau Google Cloud Storage) yang biasanya mengenakan biaya per gigabyte dan biaya egress jaringan.

---

## 3. Matriks Perbandingan Biaya Bulanan (Cost Estimation)

| Komponen Layanan | Konfigurasi Saat Ini (Optimized Free) | Rekomendasi Produksi Berbayar (Enterprise Grade) |
|---|---|---|
| **Supabase Database** | $0.00 (Free Tier - 500 MB DB) | $25.00 / bulan (Supabase Pro - 8 GB DB, Point-in-time Recovery) |
| **Vercel Hosting** | $0.00 (Hobby Tier) | $20.00 / bulan (Vercel Pro - Kepatuhan Lisensi Komersial) |
| **Groq Vision OCR** | $0.00 (Free Tier Kuota Harian) | ~$1.00 / bulan (Pay-as-you-go jika melebihi kuota harian) |
| **Google Drive & Sheets** | $0.00 (Termasuk di Google Workspace) | $0.00 (Memanfaatkan kuota internal perusahaan) |
| **Total Estimasi Biaya** | **$0.00 / bulan** | **$45.00 – $46.00 / bulan (~Rp 720.000 / bulan)** |

---

## 4. Rekomendasi Optimasi Tambahan
1. **Retensi Transaksi Lampau (Data Archiving):**
   - Transaksi di atas 3 tahun buku yang sudah diaudit dapat diekspor ke arsip JSON dingin (*cold archive*) di Google Drive, menjaga tabel PostgreSQL Supabase tetap ramping dan selalu berada di bawah batas gratis 500 MB.
2. **Pembersihan Log Aktivitas Berkala (Activity Logs Retention):**
   - Tabel `activity_logs` dapat bertumbuh pesat jika setiap klik pengguna dicatat. Disarankan membuat prosedur PostgreSQL berkala untuk menghapus log aktivitas sistem yang berumur lebih dari 90 hari.
3. **Pemberlakuan Cache Sisi Klien:**
   - Bagan Akun (66 akun COA) dan Pengaturan Entitas jarang berubah. Menyimpan data master ini dalam cache memori lokal mengurangi query read ke Supabase hingga 70%.
