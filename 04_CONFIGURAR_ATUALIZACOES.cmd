@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\04_CONFIGURAR_ATUALIZACOES.ps1"
endlocal
