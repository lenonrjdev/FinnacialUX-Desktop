@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo FINNACIALUX DESKTOP - FASE 14 - VALIDACAO COMPLETA
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\15_VALIDAR_FASE_14.ps1"
if errorlevel 1 (
  echo.
  echo A VALIDACAO DA FASE 14 FALHOU. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
endlocal
