@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\19_VALIDAR_FASE_18.ps1"
if errorlevel 1 (
  echo.
  echo A VALIDACAO DA FASE 18 FALHOU. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
endlocal
