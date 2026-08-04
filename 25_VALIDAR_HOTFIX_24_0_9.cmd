@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\25_VALIDAR_HOTFIX_24_0_9.ps1"
if errorlevel 1 (
  echo.
  echo A VALIDACAO DO HOTFIX 24.0.9 FALHOU. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
endlocal
