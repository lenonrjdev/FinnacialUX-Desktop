@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\03_GERAR_INSTALADOR.ps1"
endlocal
