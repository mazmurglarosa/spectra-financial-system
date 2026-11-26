# SPECTRA - Peluncur Lokal Provisi Administrator PRODUCTION
# Khusus proyek: drsqwxkkcfqvooqzoyvm (Supabase PRODUCTION)
# File ini TIDAK berisi API key maupun password.
# Dijalankan langsung oleh pemilik sistem untuk menginput password secara tersembunyi.

$ErrorActionPreference = 'Stop'
$productionUrl = 'https://drsqwxkkcfqvooqzoyvm.supabase.co'
$productionProject = 'drsqwxkkcfqvooqzoyvm'
$forbiddenStaging = 'xaafjvmdjdlfqdrljjlr'

try {
    Write-Host ''
    Write-Host '===============================================================' -ForegroundColor Red
    Write-Host ' SPECTRA — PROVISI ADMINISTRATOR SUPABASE PRODUCTION' -ForegroundColor Yellow
    Write-Host '===============================================================' -ForegroundColor Red
    Write-Host 'Target Database : drsqwxkkcfqvooqzoyvm.supabase.co (PRODUCTION)' -ForegroundColor White
    Write-Host 'Target Akun     : admin (usr-prod-admin-01)' -ForegroundColor White
    Write-Host 'Kondisi Prasyarat: system_users WAJIB kosong (0 pengguna)' -ForegroundColor Yellow
    Write-Host ''

    $projectRoot = Split-Path -Parent $PSScriptRoot
    $provisionScript = Join-Path $PSScriptRoot 'provision_production_admin.mjs'
    $hashFile = Join-Path $projectRoot 'api\_lib\hash.ts'
    $depsFolder = Join-Path $projectRoot 'node_modules'

    if (-not (Test-Path -LiteralPath $provisionScript -PathType Leaf)) {
        throw 'File provision_production_admin.mjs tidak ditemukan di scripts.'
    }
    if (-not (Test-Path -LiteralPath $hashFile -PathType Leaf)) {
        throw 'File api\_lib\hash.ts tidak ditemukan.'
    }
    if (-not (Test-Path -LiteralPath $depsFolder -PathType Container)) {
        throw 'Folder node_modules tidak ditemukan.'
    }

    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        throw 'Node.js tidak ditemukan di PATH sistem.'
    }

    # Cek sintaks skrip secara non-destruktif
    & node --check $provisionScript
    if ($LASTEXITCODE -ne 0) {
        throw 'Pemeriksaan sintaks skrip provisi gagal.'
    }

    $source = Get-Content -LiteralPath $provisionScript -Raw -Encoding UTF8
    if (-not $source.Contains($productionProject)) {
        throw 'Skrip provisi tidak menargetkan Production Project ID yang sah.'
    }
    if ($source.Contains($forbiddenStaging) -and -not $source.Contains('FORBIDDEN_STAGING_HOSTNAME')) {
        throw 'Terdeteksi anomali Staging Project ID dalam skrip Production.'
    }

    Write-Host 'Semua safety checks lulus.' -ForegroundColor Green
    Write-Host 'Menjalankan skrip provisi terisolasi...' -ForegroundColor Cyan
    Write-Host ''

    Push-Location $projectRoot
    try {
        & node $provisionScript
    } finally {
        Pop-Location
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host ''
        Write-Host '===============================================================' -ForegroundColor Green
        Write-Host ' PROVISI ADMINISTRATOR PRODUCTION SELESAI' -ForegroundColor Green
        Write-Host ' Akun administrator "admin" siap digunakan di Production.' -ForegroundColor White
        Write-Host '===============================================================' -ForegroundColor Green

        # -------------------------------------------------------------
        # GENERATE FRESH SERVER_SESSION_SECRET LANGSUNG KE CLIPBOARD
        # (Zero chat exposure, zero git storage, zero log files)
        # -------------------------------------------------------------
        Write-Host ''
        Write-Host '---------------------------------------------------------------' -ForegroundColor Cyan
        Write-Host ' PANDUAN PENGISIAN 3 ENVIRONMENT VARIABLES DI VERCEL' -ForegroundColor Cyan
        Write-Host '---------------------------------------------------------------' -ForegroundColor Cyan

        $freshSecret = [System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
        Set-Clipboard -Value $freshSecret

        Write-Host '[1/3] SERVER_SESSION_SECRET (BARU & SEGAR):' -ForegroundColor Green
        Write-Host '      -> Nilai acak 64-karakter baru telah otomatis DISALIN KE CLIPBOARD Anda!' -ForegroundColor Yellow
        Write-Host '      -> Buka Vercel Dashboard > Project spectra-financial-system' -ForegroundColor White
        Write-Host '         Settings > Environment Variables > Add New' -ForegroundColor White
        Write-Host '         Key         : SERVER_SESSION_SECRET' -ForegroundColor White
        Write-Host '         Environment : [x] Production saja' -ForegroundColor White
        Write-Host '         Value       : Tekan Ctrl+V (Paste dari Clipboard)' -ForegroundColor White
        Write-Host ''

        Write-Host '[2/3] SUPABASE_SERVICE_ROLE_KEY:' -ForegroundColor Green
        Write-Host '      -> Buka Supabase Dashboard (https://supabase.com/dashboard/project/drsqwxkkcfqvooqzoyvm)' -ForegroundColor White
        Write-Host '         Project Settings > API > Project API keys > service_role (secret)' -ForegroundColor White
        Write-Host '      -> Tambah di Vercel: Key = SUPABASE_SERVICE_ROLE_KEY, centang [x] Production' -ForegroundColor White
        Write-Host ''

        Write-Host '[3/3] GROQ_API_KEY:' -ForegroundColor Green
        Write-Host '      -> Di Vercel Dashboard > Environment Variables, cari GROQ_API_KEY' -ForegroundColor White
        Write-Host '         Edit variabel tersebut dan centang kotak [x] Production, lalu Save.' -ForegroundColor White
        Write-Host ''
        Write-Host '---------------------------------------------------------------' -ForegroundColor Cyan
        Write-Host ' LANGKAH TERAKHIR: REDEPLOY 1 KALI' -ForegroundColor Cyan
        Write-Host ' Buka tab Deployments di Vercel > Klik (...) pada deployment 086fa0b' -ForegroundColor White
        Write-Host ' Pilih "Redeploy" (gunakan cache normal). Selesai!' -ForegroundColor White
        Write-Host '---------------------------------------------------------------' -ForegroundColor Cyan
    } else {
        throw ('Skrip provisi keluar dengan error code ' + $LASTEXITCODE)
    }

} catch {
    Write-Host ''
    Write-Host '---------------------------------------------------------------' -ForegroundColor Red
    Write-Host ('GAGAL: ' + $_) -ForegroundColor Red
    Write-Host '---------------------------------------------------------------' -ForegroundColor Red
    Write-Host 'Tidak ada data keuangan atau akun COA yang diubah.' -ForegroundColor Yellow
} finally {
    Write-Host ''
    Write-Host 'Tekan Enter untuk menutup jendela ini...' -NoNewline
    [void][System.Console]::ReadLine()
}
