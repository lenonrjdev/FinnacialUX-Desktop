@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\25_CONFIGURAR_ASSINATURA_WINDOWS.ps1" %*
if errorlevel 1 ( echo. & echo A CONFIGURACAO DA ASSINATURA WINDOWS FALHOU. & exit /b 1 )
endlocal
