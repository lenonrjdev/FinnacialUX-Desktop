@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\23_APLICAR_FASE_22.ps1" %*
if errorlevel 1 ( echo. & echo A APLICACAO DA FASE 22 FALHOU. & exit /b 1 )
endlocal
