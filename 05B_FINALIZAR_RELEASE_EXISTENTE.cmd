@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado no PATH.
  echo Execute primeiro 01_CONFIGURAR_DESKTOP.cmd.
  endlocal & exit /b 1
)

node "%~dp0scripts\finalize-release.mjs"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo A finalizacao falhou. Os artefatos originais em src-tauri\target nao foram apagados.
)

endlocal & exit /b %EXIT_CODE%
