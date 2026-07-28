@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\03_GERAR_INSTALADOR.ps1" -Offline
endlocal
