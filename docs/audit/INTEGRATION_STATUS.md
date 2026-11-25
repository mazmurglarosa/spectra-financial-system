# STATUS INTEGRASI SISTEM (INTEGRATION STATUS) SPECTRA
**Dokumen Audit Sistem: External Services, Environment Topology, & Third-Party Gateways**
**Versi:** 2.4.0-audit
**Tanggal:** 24 November 2026
**Branch:** `feature/secure-auth-groq`

---

## 1. Topologi Lingkungan Sistem (Environment Topology)

```mermaid
graph TD
    subgraph Klien / Peramban Web
        App["SPECTRA SPA (Vite/React)<br/>Branch: feature/secure-auth-groq"]
    end

    subgraph Hosting & Backend Vercel
        VercelEdge["Vercel Preview Deployment<br/>spectra-financial-system-git-feature...vercel.app"]
        API_Scan["/api/scan-receipt"]
        API_Login["/api/login"]
        API_Status["/api/system-status"]
    end

    subgraph Supabase Database
        StagingDB["Supabase STAGING<br/>ID: xaafjvmdjdlfqdrljjlr<br/>(Target Migrasi & Audit)"]
        ProdDB["Supabase PRODUKSI<br/>ID: drsqwxkkcfqvooqzoyvm<br/>(DILARANG DIUBAH - READ ONLY)"]
    end

    subgraph Vision & AI Services
        Groq["Groq Cloud Vision API<br/>llama-3.2-11b-vision-preview"]
        Gemini["Google Gemini Flash 1.5 API<br/>(Fallback Primer)"]
        Tesseract["Tesseract.js OCR<br/>(Fallback Lokal Klien)"]
    end

    subgraph Google Workspace Cloud
        AppsScript["Google Apps Script Web App"]
        GDrive["Google Drive Folder Bukti<br/>ID: 1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9"]
        GSheets["Google Spreadsheet Transaksi"]
    end

    App --> VercelEdge
    VercelEdge --> API_Scan
    VercelEdge --> API_Login
    VercelEdge --> API_Status

    API_Login --> StagingDB
    API_Scan --> Groq
    Groq -.->|Fallback 1| Gemini
    App -.->|Fallback 2| Tesseract

    App --> StagingDB

    App -.->|Guard Check: FAIL-CLOSED| AppsScript
    AppsScript --> GDrive
    AppsScript --> GSheets

    style StagingDB fill:#e8f5e9,stroke:#2e7d32
    style ProdDB fill:#ffebee,stroke:#c62828
    style Groq fill:#fff8e1,stroke:#fbc02d
    style AppsScript fill:#e3f2fd,stroke:#1565c0
```

---

## 2. Status Integrasi Layanan Eksternal

| Layanan Eksternal | Peran dalam Sistem | Lingkungan Staging (`xaafjvmd...`) | Lingkungan Produksi (`drsqwx...`) | Status Audit |
|---|---|---|---|---|
| **Supabase PostgreSQL** | Basis data utama transaksi, akun, kontak, pengguna | **TERHUBUNG & TERVERIFIKASI** (7 tabel aktif, 66 akun COA) | **DILINDUNGI** (Read-only, dilarang mutasi) | **HIJAU (Terisolasi)** |
| **Vercel Serverless Platform** | Hosting SPA & API backend serverless | **TERDEPLOY (Preview Mode)** Deployment Protection Aktif | Dikonfigurasi terpisah pada branch `main` | **HIJAU (Stabil)** |
| **Groq Cloud Vision API** | Ekstraksi teks struk belanja & faktur via vision AI | Model: `llama-3.2-11b-vision-preview` aktif via API key preview | Dikonfigurasi terpisah | **HIJAU (Teruji 13/13)** |
| **Google Gemini Flash API** | Mesin cadangan (fallback) OCR jika Groq rate limit | Endpoint `/api/gemini-ocr` aktif | Dikonfigurasi terpisah | **KUNING (Standby)** |
| **Google Drive Bot** | Pengarsipan foto struk bukti transaksi | **DIBLOKIR SECARA AMAN** oleh `externalSyncGuard.ts` | Aktif mengunggah ke folder `1W4Z...` | **HIJAU (Terlindungi)** |
| **Google Spreadsheet Bot** | Pencadangan baris jurnal ke lembar kerja | **DIBLOKIR SECARA AMAN** oleh `externalSyncGuard.ts` | Aktif mencatat transaksi harian | **HIJAU (Terlindungi)** |
| **Tesseract.js OCR** | Fallback lokal klien jika kedua API AI offline | Terpasang di bundle browser | Terpasang di bundle browser | **HIJAU (Siap Pakai)** |

---

## 3. Validasi Sistem Pengamanan `externalSyncGuard.ts`

Sistem mengimplementasikan pengamanan tingkat tinggi untuk mencegah kebocoran data staging ke repositori arsip produksi:

```typescript
// Logika Evaluasi Lingkungan di src/services/externalSyncGuard.ts
export function shouldPerformExternalSync(): { allowSync: boolean; reason: string } {
  const currentSupabaseUrl = getActiveSupabaseUrl();

  // 1. Blokir mutlak jika tersambung ke Project ID Staging
  if (currentSupabaseUrl.includes('xaafjvmdjdlfqdrljjlr')) {
    return {
      allowSync: false,
      reason: 'Staging Database detected (xaafjvmdjdlfqdrljjlr). External sync blocked to prevent production data pollution.'
    };
  }

  // 2. Blokir jika berjalan di Vercel Preview Deployment
  if (isVercelPreviewHostname(window.location.hostname)) {
    return {
      allowSync: false,
      reason: 'Vercel Preview environment detected. External sync blocked.'
    };
  }

  // 3. Hanya izinkan jika terbukti lingkungan Produksi resmi
  if (currentSupabaseUrl.includes('drsqwxkkcfqvooqzoyvm') && isProductionDomain(window.location.hostname)) {
    return {
      allowSync: true,
      reason: 'Production environment verified.'
    };
  }

  // Fail-closed default
  return {
    allowSync: false,
    reason: 'Fail-closed: Environment could not be strictly verified as production.'
  };
}
```

**Hasil Uji Pengamanan:**
- Pengujian di Staging & Vercel Preview mengembalikan status `success: false` dengan flag `isMocked: true` dan pesan transparan ke pengguna bahwa pengunggahan eksternal dinonaktifkan di staging. Folder Google Drive produksi (`1W4Z0NCD_UhCbopryM4li2V0LgqDe_oE9`) dan Google Sheets resmi perusahaan **100% terlindungi dari kontaminasi data uji coba**.
