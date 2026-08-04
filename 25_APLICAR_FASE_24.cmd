@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\25_APLICAR_FASE_24.ps1" %*
if errorlevel 1 ( echo. & echo A APLICACAO DA FASE 24 FALHOU. & exit /b 1 )
endlocal
