@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo FINNACIALUX DESKTOP - FASE 16 - DIAGNOSTICO E SUPORTE LOCAL
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\17_APLICAR_FASE_16.ps1"
if errorlevel 1 (
  echo.
  echo A APLICACAO DA FASE 16 FALHOU. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
echo.
echo FASE 16 APLICADA. EXECUTE 17_VALIDAR_FASE_16.cmd.
endlocal
