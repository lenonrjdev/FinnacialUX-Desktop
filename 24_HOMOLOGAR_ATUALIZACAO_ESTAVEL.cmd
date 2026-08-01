@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\24_HOMOLOGAR_ATUALIZACAO_ESTAVEL.ps1" %*
if errorlevel 1 ( echo. & echo A HOMOLOGACAO DA FASE 23 FALHOU. CONSULTE A MENSAGEM ACIMA. & exit /b 1 )
endlocal
