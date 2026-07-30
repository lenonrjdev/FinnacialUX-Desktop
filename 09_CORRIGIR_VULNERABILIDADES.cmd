@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\09_CORRIGIR_VULNERABILIDADES.ps1"
if errorlevel 1 (
  echo.
  echo O HOTFIX 8.0.6 NAO FOI CONSOLIDADO. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
echo.
echo HOTFIX 8.0.6 APLICADO. EXECUTE 08_VALIDAR_QUALIDADE.cmd.
endlocal
