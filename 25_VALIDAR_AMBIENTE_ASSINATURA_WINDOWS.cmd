@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\25_VALIDAR_AMBIENTE_ASSINATURA_WINDOWS.ps1" %*
if errorlevel 1 ( echo. & echo O AMBIENTE DE ASSINATURA WINDOWS NAO FOI APROVADO. & exit /b 1 )
endlocal
