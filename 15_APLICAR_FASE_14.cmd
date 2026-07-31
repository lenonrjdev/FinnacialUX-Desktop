@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo FINNACIALUX DESKTOP - FASE 14 - DESEMPENHO E GRANDES VOLUMES
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\15_APLICAR_FASE_14.ps1"
if errorlevel 1 (
  echo.
  echo A APLICACAO DA FASE 14 FALHOU. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
echo.
echo FASE 14 APLICADA. EXECUTE 15_VALIDAR_FASE_14.cmd.
endlocal
