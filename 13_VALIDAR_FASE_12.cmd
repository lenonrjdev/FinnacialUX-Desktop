@echo off
setlocal
cd /d "%~dp0"
echo FINNACIALUX DESKTOP - FASE 12 - VALIDACAO COMPLETA
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\13_VALIDAR_FASE_12.ps1"
if errorlevel 1 (
  echo.
  echo A VALIDACAO DA FASE 12 FALHOU. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
echo.
echo FASE 12 VALIDADA COM SUCESSO.
endlocal
