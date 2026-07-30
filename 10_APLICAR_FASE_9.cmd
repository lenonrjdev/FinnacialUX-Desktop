@echo off
setlocal
cd /d "%~dp0"
echo FINNACIALUX DESKTOP - FASE 9 - CONTINUIDADE E RECUPERACAO
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\10_APLICAR_FASE_9.ps1"
if errorlevel 1 (
  echo.
  echo A FASE 9 NAO FOI APLICADA. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
echo.
echo FASE 9 APLICADA. EXECUTE 10_VALIDAR_FASE_9.cmd.
