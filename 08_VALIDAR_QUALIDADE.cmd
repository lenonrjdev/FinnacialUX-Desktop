@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\08_VALIDAR_QUALIDADE.ps1"
set EXIT_CODE=%ERRORLEVEL%
if not "%EXIT_CODE%"=="0" (
  echo.
  echo A validacao da Fase 8 falhou. Consulte a mensagem acima.
)
exit /b %EXIT_CODE%
