@echo off
setlocal
cd /d "%~dp0"
echo FINNACIALUX DESKTOP - FASE 10 - AUTOMACOES FINANCEIRAS LOCAIS
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\11_APLICAR_FASE_10.ps1"
if errorlevel 1 (
  echo.
  echo A FASE 10 NAO FOI APLICADA. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
echo.
echo FASE 10 APLICADA. EXECUTE 11_VALIDAR_FASE_10.cmd.
