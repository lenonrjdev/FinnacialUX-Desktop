@echo off
setlocal
cd /d "%~dp0"
echo FINNACIALUX DESKTOP - FASE 11 - INTELIGENCIA FINANCEIRA LOCAL
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\12_APLICAR_FASE_11.ps1"
if errorlevel 1 (
  echo.
  echo A FASE 11 NAO FOI APLICADA. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
echo.
echo FASE 11 APLICADA. EXECUTE 12_VALIDAR_FASE_11.cmd.
endlocal
