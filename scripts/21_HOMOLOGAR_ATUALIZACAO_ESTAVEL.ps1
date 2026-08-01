param(
  [switch]$Windows10,
  [switch]$Windows11,
  [switch]$CleanInstall,
  [switch]$UpgradeFrom100,
  [switch]$DataPreserved,
  [switch]$MaintenanceWindowChecked,
  [switch]$UpdateDeferralChecked,
  [switch]$JournalPrivacyChecked,
  [switch]$SignatureChecked,
  [switch]$BackupRestoreChecked,
  [switch]$LatestChannelChecked
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Version = "1.1.0"
$ReleaseDir = Join-Path $Root "releases\$Version"

node scripts\stable-release.mjs verify-artifacts $Root "releases\$Version"
if ($LASTEXITCODE -ne 0) { throw "Os artefatos automáticos da versão 1.1.0 ainda não foram aprovados." }

$buildManifestPath = Join-Path $ReleaseDir "STABLE_BUILD_MANIFEST.json"
if (-not (Test-Path $buildManifestPath)) { throw "Manifesto de build ausente: $buildManifestPath" }
$buildManifest = Get-Content $buildManifestPath -Raw | ConvertFrom-Json
$previousEvidenceAvailable = $buildManifest.promotionEvidence.available -eq $true
$upgradeFrom100Required = $previousEvidenceAvailable

$checks = [ordered]@{
  windows10 = [bool]$Windows10
  windows11 = [bool]$Windows11
  cleanInstall = [bool]$CleanInstall
  upgradeFrom100 = if ($upgradeFrom100Required) { [bool]$UpgradeFrom100 } else { $null }
  dataPreserved = [bool]$DataPreserved
  maintenanceWindowChecked = [bool]$MaintenanceWindowChecked
  updateDeferralChecked = [bool]$UpdateDeferralChecked
  journalPrivacyChecked = [bool]$JournalPrivacyChecked
  signatureChecked = [bool]$SignatureChecked
  backupRestoreChecked = [bool]$BackupRestoreChecked
  latestChannelChecked = [bool]$LatestChannelChecked
}

$requiredResults = @(
  [bool]$Windows10,
  [bool]$Windows11,
  [bool]$CleanInstall,
  [bool]$DataPreserved,
  [bool]$MaintenanceWindowChecked,
  [bool]$UpdateDeferralChecked,
  [bool]$JournalPrivacyChecked,
  [bool]$SignatureChecked,
  [bool]$BackupRestoreChecked,
  [bool]$LatestChannelChecked
)
if ($upgradeFrom100Required) { $requiredResults += [bool]$UpgradeFrom100 }
$complete = -not ($requiredResults -contains $false)

$installer = Join-Path $ReleaseDir "FinnacialUX-Desktop_1.1.0_x64-setup.exe"
$installerHash = (Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant()
$report = [ordered]@{
  formatVersion = 3
  product = "FinnacialUX Desktop"
  version = $Version
  schemaVersion = 14
  promotedFrom = "1.0.0"
  releaseMode = [string]$buildManifest.releaseMode
  previousReleaseEvidenceAvailable = $previousEvidenceAvailable
  upgradeFrom100Required = $upgradeFrom100Required
  recordedAt = (Get-Date).ToUniversalTime().ToString("o")
  installerSha256 = $installerHash
  checks = $checks
  manualMatrixComplete = $complete
  latestChannelConfirmed = [bool]$LatestChannelChecked
  status = if ($complete) { "approved-for-stable" } else { "manual-checks-pending" }
}
$path = Join-Path $ReleaseDir "STABLE_VALIDATION_REPORT.json"
[System.IO.File]::WriteAllText($path, (($report | ConvertTo-Json -Depth 7) + "`n"), [System.Text.Encoding]::UTF8)

if (-not $previousEvidenceAvailable) {
  Write-Host "A versão 1.0.0 não possui artefato oficial neste repositório." -ForegroundColor Yellow
  Write-Host "A versão 1.1.0 está sendo homologada como primeiro instalador estável completo." -ForegroundColor Yellow
  Write-Host "O teste -UpgradeFrom100 não é obrigatório neste modo." -ForegroundColor Yellow
}

if (-not $complete) {
  Write-Host "Homologação registrada com pendências em: $path" -ForegroundColor Yellow
  exit 2
}
Write-Host "HOMOLOGAÇÃO MANUAL DA ATUALIZAÇÃO 1.1.0 CONCLUÍDA" -ForegroundColor Green
Write-Host "Próximo passo: .\21_PUBLICAR_ATUALIZACAO_ESTAVEL.cmd"
