@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\21_APLICAR_FASE_20.ps1"
if errorlevel 1 ( echo. & echo A APLICACAO DA FASE 20 FALHOU. & exit /b 1 )
endlocal
