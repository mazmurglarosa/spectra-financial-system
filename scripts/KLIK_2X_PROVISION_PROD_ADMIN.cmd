@echo off
setlocal
title SPECTRA - Provisi Administrator Production
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_provision_production_admin.ps1"
endlocal
