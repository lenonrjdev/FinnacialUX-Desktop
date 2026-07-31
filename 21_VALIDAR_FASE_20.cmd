@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\21_VALIDAR_FASE_20.ps1"
if errorlevel 1 ( echo. & echo A VALIDACAO DA FASE 20 FALHOU. CONSULTE A MENSAGEM ACIMA. & exit /b 1 )
endlocal
