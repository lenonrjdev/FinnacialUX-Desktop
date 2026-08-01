@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\24_VALIDAR_FASE_23.ps1" %*
if errorlevel 1 ( echo. & echo A VALIDACAO DA FASE 23 FALHOU. CONSULTE A MENSAGEM ACIMA. & exit /b 1 )
endlocal
