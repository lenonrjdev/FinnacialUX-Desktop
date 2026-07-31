@echo off
setlocal
cd /d "%~dp0"
echo FINNACIALUX DESKTOP - FASE 13 - VALIDACAO COMPLETA
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\14_VALIDAR_FASE_13.ps1"
if errorlevel 1 (
  echo.
  echo A VALIDACAO DA FASE 13 FALHOU. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
echo.
echo FASE 13 VALIDADA COM SUCESSO.
endlocal
