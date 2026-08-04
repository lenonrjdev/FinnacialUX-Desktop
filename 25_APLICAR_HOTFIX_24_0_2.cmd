@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\25_APLICAR_HOTFIX_24_0_2.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo O HOTFIX 24.0.2 FALHOU. CONSULTE A MENSAGEM ACIMA.
  exit /b %EXIT_CODE%
)
echo.
echo HOTFIX 24.0.2 APLICADO COM SUCESSO.
exit /b 0
