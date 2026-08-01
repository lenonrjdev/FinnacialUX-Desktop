@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\22_VALIDAR_FASE_21.ps1"
if errorlevel 1 ( echo. & echo A VALIDACAO DA FASE 21 FALHOU. CONSULTE A MENSAGEM ACIMA. & exit /b 1 )
endlocal
