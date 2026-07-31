@echo off
setlocal
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\18_VALIDAR_FASE_17.ps1"
if errorlevel 1 (
  echo.
  echo A VALIDACAO DA FASE 17 FALHOU. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
endlocal
