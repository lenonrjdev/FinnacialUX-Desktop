@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\VALIDAR_PROJETO.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo A VALIDACAO DO PROJETO FALHOU. CONSULTE A ETAPA ACIMA.
)
exit /b %EXIT_CODE%
