@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\05_GERAR_RELEASE.ps1"
endlocal
