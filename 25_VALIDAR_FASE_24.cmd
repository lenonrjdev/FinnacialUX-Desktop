@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\25_VALIDAR_FASE_24.ps1" %*
if errorlevel 1 ( echo. & echo A VALIDACAO DA FASE 24 FALHOU. CONSULTE A MENSAGEM ACIMA. & exit /b 1 )
endlocal
