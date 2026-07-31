@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\19_APLICAR_FASE_18.ps1"
if errorlevel 1 (
  echo.
  echo A FASE 18 NAO FOI APLICADA. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
echo.
echo FASE 18 APLICADA. EXECUTE 19_VALIDAR_FASE_18.cmd.
endlocal
