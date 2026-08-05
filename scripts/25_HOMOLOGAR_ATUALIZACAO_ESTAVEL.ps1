param(
  [switch]$Windows10, [switch]$Windows11, [switch]$CleanInstall, [switch]$UpgradeFrom140, [switch]$DataPreserved,
  [switch]$BootstrapInstallValidated,
  [switch]$PublisherIdentityChecked, [switch]$ApplicationSignatureChecked, [switch]$InstallerSignatureChecked,
  [switch]$TimestampChecked, [switch]$Sha256DigestChecked, [switch]$UnsignedBuildRejected,
  [switch]$TamperedInstallerRejected, [switch]$CertificateExpiryReviewed, [switch]$SignatureChecked, [switch]$LatestChannelChecked
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Version = "1.5.0"
$ReleaseDir = Join-Path $Root "releases\$Version"
$BuildManifestPath = Join-Path $ReleaseDir "STABLE_BUILD_MANIFEST.json"

node scripts\stable-release.mjs verify-artifacts $Root "releases\$Version"
if ($LASTEXITCODE -ne 0) { throw "Os artefatos automaticos da versao 1.5.0 ainda nao foram aprovados." }
node scripts\windows-signing.mjs verify-report $Root "releases\$Version\WINDOWS_AUTHENTICODE_REPORT.json"
if ($LASTEXITCODE -ne 0) { throw "O relatorio Authenticode da versao 1.5.0 nao esta aprovado." }
if (-not (Test-Path $BuildManifestPath)) { throw "Manifesto de build ausente: $BuildManifestPath" }

$buildManifest = Get-Content $BuildManifestPath -Raw | ConvertFrom-Json
$releaseMode = [string]$buildManifest.releaseMode
$previousEvidenceAvailable = [bool]$buildManifest.promotionEvidence.available
if ($releaseMode -notin @("stable-update", "bootstrap-full-installer")) { throw "Modo de release desconhecido: $releaseMode" }
if ($releaseMode -eq "stable-update" -and -not $previousEvidenceAvailable) { throw "Release stable-update sem evidencia da versao anterior." }
if ($releaseMode -eq "bootstrap-full-installer" -and $previousEvidenceAvailable) { throw "Release bootstrap declarou evidencia anterior disponivel de forma inconsistente." }

$checks = [ordered]@{
  windows10=[bool]$Windows10
  windows11=[bool]$Windows11
  cleanInstall=[bool]$CleanInstall
}
if ($releaseMode -eq "stable-update") {
  $checks.upgradeFrom140 = [bool]$UpgradeFrom140
  $checks.dataPreserved = [bool]$DataPreserved
} else {
  $checks.bootstrapInstallValidated = [bool]$BootstrapInstallValidated
  $checks.previousReleaseUpgradeNotClaimed = $true
}
$checks.publisherIdentityChecked = [bool]$PublisherIdentityChecked
$checks.applicationSignatureChecked = [bool]$ApplicationSignatureChecked
$checks.installerSignatureChecked = [bool]$InstallerSignatureChecked
$checks.timestampChecked = [bool]$TimestampChecked
$checks.sha256DigestChecked = [bool]$Sha256DigestChecked
$checks.unsignedBuildRejected = [bool]$UnsignedBuildRejected
$checks.tamperedInstallerRejected = [bool]$TamperedInstallerRejected
$checks.certificateExpiryReviewed = [bool]$CertificateExpiryReviewed
$checks.signatureChecked = [bool]$SignatureChecked
$checks.latestChannelChecked = [bool]$LatestChannelChecked

$complete = -not (@($checks.Values) -contains $false)
$installer = Join-Path $ReleaseDir "FinnacialUX-Desktop_1.5.0_x64-setup.exe"
$authReport = Get-Content (Join-Path $ReleaseDir "WINDOWS_AUTHENTICODE_REPORT.json") -Raw | ConvertFrom-Json
$report = [ordered]@{
  formatVersion=5
  product="FinnacialUX Desktop"
  version=$Version
  schemaVersion=14
  promotedFrom="1.4.0"
  releaseMode=$releaseMode
  previousReleaseEvidenceAvailable=$previousEvidenceAvailable
  upgradeBaselineVerified=($releaseMode -eq "stable-update" -and $previousEvidenceAvailable)
  recordedAt=(Get-Date).ToUniversalTime().ToString("o")
  installerSha256=(Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant()
  authenticodeValidated=($authReport.status -eq "approved")
  publisher=[string]$authReport.expectedPublisher
  checks=$checks
  manualMatrixComplete=$complete
  latestChannelConfirmed=[bool]$LatestChannelChecked
  status=if($complete){"approved-for-stable"}else{"manual-checks-pending"}
}
$reportPath = Join-Path $ReleaseDir "STABLE_VALIDATION_REPORT.json"
[System.IO.File]::WriteAllText($reportPath, (($report | ConvertTo-Json -Depth 8) + "`n"), [System.Text.UTF8Encoding]::new($false))
if (-not $complete) {
  Write-Host "Homologacao registrada com pendencias em: $reportPath" -ForegroundColor Yellow
  if ($releaseMode -eq "bootstrap-full-installer") { Write-Host "Use -BootstrapInstallValidated somente depois de testar o instalador completo." -ForegroundColor Yellow }
  exit 2
}
Write-Host "HOMOLOGACAO MANUAL DA ATUALIZACAO 1.5.0 CONCLUIDA" -ForegroundColor Green
Write-Host "Modo: $releaseMode"
if ($releaseMode -eq "bootstrap-full-installer") { Write-Host "Nenhum upgrade 1.4.0 -> 1.5.0 foi declarado como homologado." }
Write-Host "Proximo passo: .\25_PUBLICAR_ATUALIZACAO_ESTAVEL.cmd"
