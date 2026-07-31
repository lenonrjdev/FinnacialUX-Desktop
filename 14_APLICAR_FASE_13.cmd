@echo off
setlocal
cd /d "%~dp0"
echo FINNACIALUX DESKTOP - FASE 13 - CONCILIACAO E FECHAMENTO
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\14_APLICAR_FASE_13.ps1"
if errorlevel 1 (
  echo.
  echo A FASE 13 NAO FOI APLICADA. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
echo.
echo FASE 13 APLICADA. EXECUTE 14_VALIDAR_FASE_13.cmd.
endlocal
