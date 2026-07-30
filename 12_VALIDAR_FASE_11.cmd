@echo off
setlocal
cd /d "%~dp0"
echo FINNACIALUX DESKTOP - FASE 11 - VALIDACAO COMPLETA
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\12_VALIDAR_FASE_11.ps1"
if errorlevel 1 (
  echo.
  echo A VALIDACAO DA FASE 11 FALHOU. CONSULTE A MENSAGEM ACIMA.
  exit /b 1
)
echo.
echo FASE 11 VALIDADA COM SUCESSO.
endlocal
