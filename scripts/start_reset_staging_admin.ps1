# SPECTRA - Peluncur lokal reset password Administrator STAGING
# Khusus proyek: xaafjvmdjdlfqdrljjlr (JANGAN gunakan untuk Production)
# File ini TIDAK berisi API key maupun password.
# Perlu dijalankan secara sadar oleh pemilik akun dari Windows Explorer.

$ErrorActionPreference = 'Stop'
$stagingUrl = 'https://xaafjvmdjdlfqdrljjlr.supabase.co'
$stagingProject = 'xaafjvmdjdlfqdrljjlr'
$productionProject = 'drsqwxkkcfqvooqzoyvm'

try {
    Write-Host ''
    Write-Host '===============================================' -ForegroundColor Cyan
    Write-Host ' SPECTRA - RESET PASSWORD ADMIN STAGING' -ForegroundColor Cyan
    Write-Host '===============================================' -ForegroundColor Cyan
    Write-Host 'Database: xaafjvmdjdlfqdrljjlr.supabase.co'
    Write-Host 'Akun    : admin (usr-staging-admin-01)'
    Write-Host 'Production tidak boleh disentuh.' -ForegroundColor Yellow
    Write-Host ''

    $projectRoot = Split-Path -Parent $PSScriptRoot
    $resetScript = Join-Path $PSScriptRoot 'reset_staging_admin_password.mjs'
    $hashFile = Join-Path $projectRoot 'api\_lib\hash.ts'
    $depsFolder = Join-Path $projectRoot 'node_modules'

    if (-not (Test-Path -LiteralPath $resetScript -PathType Leaf)) {
        throw 'File reset_staging_admin_password.mjs tidak ditemukan. Simpan peluncur ini di folder SIKEU2\scripts.'
    }
    if (-not (Test-Path -LiteralPath $hashFile -PathType Leaf)) {
        throw 'File api\_lib\hash.ts tidak ditemukan. Folder tempat launcher disimpan bukan SIKEU2\scripts.'
    }
    if (-not (Test-Path -LiteralPath $depsFolder -PathType Container)) {
        throw 'Folder node_modules tidak ditemukan. Jangan jalankan reset sebelum dependencies proyek tersedia.'
    }

    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        throw 'Node.js tidak ditemukan. Buka dari PC dengan Node.js terpasang.'
    }
    $nodeVersion = (& node -p 'process.versions.node').Trim()
    $nodeMajor = [int]($nodeVersion.Split('.')[0])
    if ($nodeMajor -lt 24) {
        throw ('Node.js ' + $nodeVersion + ' terlalu lama untuk menjalankan import .ts pada utilitas. Perlu Node.js 24+; tidak ada perubahan database.')
    }

    # Check syntax only: no DB connection, no mutation
    & node --check $resetScript
    if ($LASTEXITCODE -ne 0) {
        throw 'Pemeriksaan sintaks skrip reset gagal. Database belum disentuh.'
    }

    # Guard for the most critical target markers before showing confirmation.
    # This is a sanity check, NOT a substitute for the user's code audit.
    $source = Get-Content -LiteralPath $resetScript -Raw -Encoding UTF8
    if (-not $source.Contains($stagingProject) -or -not $source.Contains('usr-staging-admin-01')) {
        throw 'Skrip reset tidak mengandung penanda Project ID / target admin yang diharapkan.'
    }
    if (-not $source.Contains('validateSupabaseUrl') -or -not $source.Contains('validateTargetAdminRecord')) {
        throw 'Skrip reset tidak mengandung fungsi validasi target yang diharapkan.'
    }
    if ($source.Contains(".from('rate_limits').delete(") -or $source.Contains('.from("rate_limits").delete(')) {
        throw 'Skrip reset terdeteksi memiliki operasi penghapusan rate_limits. Eksekusi dibatalkan.'
    }

    Write-Host ('[OK] Node.js v' + $nodeVersion + '; file dan sintaks ditemukan.') -ForegroundColor Green
    Write-Host '[PERINGATAN] Program akan mengubah SATU akun admin pada Supabase STAGING.' -ForegroundColor Yellow
    Write-Host ''
    $confirmation = Read-Host 'Untuk melanjutkan, ketik persis: RESET STAGING'
    if ($confirmation -cne 'RESET STAGING') {
        Write-Host '[DIBATALKAN] Tidak ada perubahan database.' -ForegroundColor Yellow
        return
    }

    Write-Host ''
    Write-Host 'Salin SECRET KEY dari Supabase STAGING, lalu tempel pada input berikut.'
    Write-Host 'Karakter tidak akan terlihat. Jangan memasukkannya ke chat.' -ForegroundColor Yellow
    $secureKey = Read-Host 'SUPABASE_SERVICE_ROLE_KEY (STAGING)' -AsSecureString
    $bstr = [IntPtr]::Zero
    try {
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
        $keyValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        if ($bstr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
    }
    if ([string]::IsNullOrWhiteSpace($keyValue)) {
        throw 'Secret Key kosong. Reset dibatalkan tanpa perubahan database.'
    }
    $env:SUPABASE_URL = $stagingUrl
    $env:SUPABASE_SERVICE_ROLE_KEY = $keyValue.Trim()
    $keyValue = $null
    if ($secureKey) { $secureKey.Dispose() }

    Write-Host ''
    Write-Host '[TARGET] Supabase STAGING dan akun admin saja.' -ForegroundColor Cyan
    Write-Host '[LANGKAH BERIKUT] Masukkan password BARU dan konfirmasi pada prompt Node.js.'
    Write-Host 'Password akan ditampilkan sebagai tanda bintang (*), bukan teks asli.'
    Write-Host ''

    # Direct console execution preserves Node.js TTY for hidden-password input.
    & node $resetScript
    if ($LASTEXITCODE -ne 0) {
        throw ('Skrip reset keluar dengan kode ' + $LASTEXITCODE + '. Periksa pesan error di atas.')
    }
    Write-Host ''
    Write-Host '[SELESAI] Periksa hasil reset di atas, kemudian uji login pada Preview terbaru.' -ForegroundColor Green
    Write-Host 'Jangan membagikan password, hash, atau API key.' -ForegroundColor Yellow
} catch {
    Write-Host ''
    Write-Host ('[BERHENTI] ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Jangan melakukan percobaan berulang sebelum kesalahan diperiksa.' -ForegroundColor Yellow
} finally {
    Remove-Item Env:\SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:\SUPABASE_URL -ErrorAction SilentlyContinue
}
