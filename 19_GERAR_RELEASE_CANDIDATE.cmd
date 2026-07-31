@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\19_GERAR_RELEASE_CANDIDATE.ps1" %*
if errorlevel 1 exit /b 1
endlocal
