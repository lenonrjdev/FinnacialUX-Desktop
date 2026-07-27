@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\01_CONFIGURAR_DESKTOP.ps1"
endlocal
