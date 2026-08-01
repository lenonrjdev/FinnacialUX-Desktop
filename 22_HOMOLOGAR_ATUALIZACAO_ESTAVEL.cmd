@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\22_HOMOLOGAR_ATUALIZACAO_ESTAVEL.ps1" %*
if errorlevel 1 ( echo. & echo O PROCESSO DA FASE 21 FALHOU. CONSULTE A MENSAGEM ACIMA. & exit /b 1 )
endlocal
