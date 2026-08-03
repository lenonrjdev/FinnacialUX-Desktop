@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\25_APLICAR_HOTFIX_24_0_6.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" echo.&echo O HOTFIX 24.0.6 FALHOU. CONSULTE A MENSAGEM ACIMA.
exit /b %EXIT_CODE%
