@echo off
setlocal
title SPECTRA - Administrator Staging Reset
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_reset_staging_admin.ps1"
echo.
echo Tekan tombol apa saja untuk menutup jendela ini...
pause >nul
endlocal
