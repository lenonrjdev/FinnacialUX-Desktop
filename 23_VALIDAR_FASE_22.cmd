@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\23_VALIDAR_FASE_22.ps1" %*
if errorlevel 1 ( echo. & echo A VALIDACAO DA FASE 22 FALHOU. CONSULTE A MENSAGEM ACIMA. & exit /b 1 )
endlocal
