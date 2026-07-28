@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\06_PUBLICAR_RELEASE_GITHUB.ps1"
endlocal
