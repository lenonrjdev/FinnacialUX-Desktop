@echo off
setlocal
cd /d "%~dp0"
echo FINNACIALUX DESKTOP - FASE 12 - PLANEJAMENTO FINANCEIRO
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\13_APLICAR_FASE_12.ps1"
if errorlevel 1 (
  echo.
  echo A FASE 12 NAO FOI APLICADA. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
echo.
echo FASE 12 APLICADA. EXECUTE 13_VALIDAR_FASE_12.cmd.
endlocal
