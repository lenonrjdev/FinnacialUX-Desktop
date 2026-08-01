@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\24_APLICAR_FASE_23.ps1" %*
if errorlevel 1 ( echo. & echo A APLICACAO DA FASE 23 FALHOU. & exit /b 1 )
endlocal
