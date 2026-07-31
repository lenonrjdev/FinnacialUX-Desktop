@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo FINNACIALUX DESKTOP - FASE 15 - ROTINAS LOCAIS E NOTIFICACOES
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\16_APLICAR_FASE_15.ps1"
if errorlevel 1 (
  echo.
  echo A APLICACAO DA FASE 15 FALHOU. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
echo.
echo FASE 15 APLICADA. EXECUTE 16_VALIDAR_FASE_15.cmd.
endlocal
