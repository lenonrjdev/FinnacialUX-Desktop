@echo off
setlocal
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\18_APLICAR_FASE_17.ps1"
if errorlevel 1 (
  echo.
  echo A FASE 17 NAO FOI APLICADA. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
echo.
echo FASE 17 APLICADA. EXECUTE 18_VALIDAR_FASE_17.cmd.
endlocal
