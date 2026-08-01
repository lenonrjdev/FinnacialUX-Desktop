@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\22_APLICAR_FASE_21.ps1"
if errorlevel 1 ( echo. & echo A APLICACAO DA FASE 21 FALHOU. & exit /b 1 )
endlocal
