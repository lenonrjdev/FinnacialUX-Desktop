$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path (Split-Path -Parent $PSScriptRoot) "core\command-runner.ps1")
$Root = Get-FinnacialuxProjectRoot -StartPath $PSScriptRoot
Set-Location $Root
. (Join-Path $Root "scripts\core\libsodium-cache.ps1")
. (Join-Path $Root "scripts\development\prepare-environment.ps1")

try {
  Write-Host "FINNACIALUX DESKTOP - DESENVOLVIMENTO" -ForegroundColor Cyan
  Initialize-FinnacialuxDevelopmentEnvironment -Root $Root -InstallIfMissing

  $RunningApp = Get-Process -Name "finnacialux-desktop" -ErrorAction SilentlyContinue
  if ($RunningApp) {
    Write-Host "O FinnacialUX Desktop já está aberto. Use a janela existente." -ForegroundColor Yellow
    return
  }

  $PortInUse = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ($PortInUse) {
    throw "A porta 3000 já está em uso. Encerre a execução anterior antes de continuar."
  }

  Write-Host "`nA janela do terminal deve permanecer aberta durante o desenvolvimento." -ForegroundColor Yellow
  Write-Host "Pressione Ctrl+C para encerrar de forma controlada.`n"
  $Npm = Get-FinnacialuxCommandPath "npm.cmd"
  Invoke-FinnacialuxNativeCommand $Npm @("run", "desktop:dev") "Não foi possível iniciar o FinnacialUX Desktop."
}
catch {
  Write-Host "`nFalha ao iniciar o projeto: $($_.Exception.Message)" -ForegroundColor Red
  throw
}
