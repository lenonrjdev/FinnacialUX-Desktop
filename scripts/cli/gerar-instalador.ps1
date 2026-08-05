param(
  [switch]$Local,
  [switch]$Offline,
  [switch]$Release
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
. (Join-Path (Split-Path -Parent $PSScriptRoot) "core\command-runner.ps1")
$Root = Get-FinnacialuxProjectRoot -StartPath $PSScriptRoot
Set-Location $Root

try {
  $Selected = @(@($Local, $Offline, $Release) | Where-Object { $_ }).Count
  if ($Selected -gt 1) { throw "Use somente um modo: -Local, -Offline ou -Release." }

  if ($Selected -eq 0) {
    Write-Host "FINNACIALUX DESKTOP - GERAR INSTALADOR" -ForegroundColor Cyan
    Write-Host "1. Instalador local de teste"
    Write-Host "2. Instalador offline"
    Write-Host "3. Instalador de release assinado"
    Write-Host "0. Cancelar"
    $Choice = Read-Host "Selecione uma opção"
    switch ($Choice) {
      "1" { $Local = $true }
      "2" { $Offline = $true }
      "3" { $Release = $true }
      "0" { Write-Host "Operação cancelada."; return }
      default { throw "Opção inválida." }
    }
  }

  if ($Release) {
    $Parameters = @{ ForceRebuild = $true }
    Invoke-FinnacialuxPowerShellScript `
      -ScriptPath (Join-Path $Root "scripts\cli\validar-e-preparar-atualizacao.ps1") `
      -Parameters $Parameters `
      -FailureMessage "Não foi possível gerar o instalador de release."
    return
  }

  Invoke-FinnacialuxPowerShellScript `
    -ScriptPath (Join-Path $Root "scripts\validation\validate-project.ps1") `
    -Parameters @{ PreBuild = $true; SkipReleaseArtifacts = $true } `
    -FailureMessage "A validação pré-build falhou."

  $BuildParameters = @{}
  if ($Offline) { $BuildParameters.Offline = $true }
  Invoke-FinnacialuxPowerShellScript `
    -ScriptPath (Join-Path $Root "scripts\installer\build-installer.ps1") `
    -Parameters $BuildParameters `
    -FailureMessage "Não foi possível gerar o instalador."
}
catch {
  Write-Host "`nFalha na geração do instalador: $($_.Exception.Message)" -ForegroundColor Red
  throw
}
