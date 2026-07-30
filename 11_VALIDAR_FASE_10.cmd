@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\11_VALIDAR_FASE_10.ps1"
if errorlevel 1 (
  echo.
  echo A VALIDACAO DA FASE 10 FALHOU. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
