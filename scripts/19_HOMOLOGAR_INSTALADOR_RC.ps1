param(
  [switch]$Windows10,
  [switch]$Windows11,
  [switch]$CleanInstall,
  [switch]$UpgradeFrom017,
  [switch]$DataPreserved,
  [switch]$UninstallChecked,
  [switch]$RecoveryChecked,
  [switch]$NotificationsChecked,
  [switch]$UpdaterSignatureChecked
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Version = "0.18.0-rc.1"
$ReleaseDir = Join-Path $Root "releases\$Version"

node scripts\release-candidate.mjs verify-artifacts $Root "releases\$Version"
if ($LASTEXITCODE -ne 0) { throw "Os artefatos automáticos da RC ainda não foram aprovados." }

$checks = [ordered]@{
  windows10 = [bool]$Windows10
  windows11 = [bool]$Windows11
  cleanInstall = [bool]$CleanInstall
  upgradeFrom017 = [bool]$UpgradeFrom017
  dataPreserved = [bool]$DataPreserved
  uninstallChecked = [bool]$UninstallChecked
  recoveryChecked = [bool]$RecoveryChecked
  notificationsChecked = [bool]$NotificationsChecked
  updaterSignatureChecked = [bool]$UpdaterSignatureChecked
}
$complete = -not ($checks.Values -contains $false)
$report = [ordered]@{
  formatVersion = 1
  product = "FinnacialUX Desktop"
  version = $Version
  schemaVersion = 14
  recordedAt = (Get-Date).ToUniversalTime().ToString("o")
  machine = [ordered]@{ os = [Environment]::OSVersion.VersionString; architecture = $env:PROCESSOR_ARCHITECTURE }
  checks = $checks
  manualMatrixComplete = $complete
  status = if ($complete) { "approved-for-prerelease" } else { "manual-checks-pending" }
}
$path = Join-Path $ReleaseDir "RC_VALIDATION_REPORT.json"
[System.IO.File]::WriteAllText($path, (($report | ConvertTo-Json -Depth 6) + "`n"), [System.Text.Encoding]::UTF8)

if (-not $complete) {
  Write-Host "Homologação registrada com pendências em: $path" -ForegroundColor Yellow
  Write-Host "Marque todos os parâmetros somente depois de executar cada teste manual."
  exit 2
}
Write-Host "HOMOLOGAÇÃO MANUAL DA RC CONCLUÍDA" -ForegroundColor Green
Write-Host "Relatório: $path"
