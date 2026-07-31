@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\19_HOMOLOGAR_INSTALADOR_RC.ps1" %*
if errorlevel 1 exit /b 1
endlocal
