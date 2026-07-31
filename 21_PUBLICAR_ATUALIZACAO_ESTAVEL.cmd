@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\21_PUBLICAR_ATUALIZACAO_ESTAVEL.ps1" %*
if errorlevel 1 exit /b 1
endlocal
