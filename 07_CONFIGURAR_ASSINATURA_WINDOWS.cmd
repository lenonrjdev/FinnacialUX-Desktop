@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\07_CONFIGURAR_ASSINATURA_WINDOWS.ps1"
if errorlevel 1 (
  echo.
  echo Falha ao configurar a assinatura de codigo do Windows.
  pause
  exit /b 1
)
echo.
pause
