@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\10_VALIDAR_FASE_9.ps1"
if errorlevel 1 (
  echo.
  echo A VALIDACAO DA FASE 9 FALHOU. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
