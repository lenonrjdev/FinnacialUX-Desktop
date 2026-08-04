@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\25_VALIDAR_HOTFIX_24_0_8.ps1" %*
if errorlevel 1 (
  echo.
  echo A VALIDACAO DO HOTFIX 24.0.8 FALHOU. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
endlocal
