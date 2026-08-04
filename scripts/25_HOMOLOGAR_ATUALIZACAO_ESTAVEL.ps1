param(
  [switch]$Windows10, [switch]$Windows11, [switch]$CleanInstall, [switch]$UpgradeFrom140, [switch]$DataPreserved,
  [switch]$PublisherIdentityChecked, [switch]$ApplicationSignatureChecked, [switch]$InstallerSignatureChecked,
  [switch]$TimestampChecked, [switch]$Sha256DigestChecked, [switch]$UnsignedBuildRejected,
  [switch]$TamperedInstallerRejected, [switch]$CertificateExpiryReviewed, [switch]$SignatureChecked, [switch]$LatestChannelChecked
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Version = "1.5.0"
$ReleaseDir = Join-Path $Root "releases\$Version"
node scripts\stable-release.mjs verify-artifacts $Root "releases\$Version"
if ($LASTEXITCODE -ne 0) { throw "Os artefatos automáticos da versão 1.5.0 ainda não foram aprovados." }
node scripts\windows-signing.mjs verify-report $Root "releases\$Version\WINDOWS_AUTHENTICODE_REPORT.json"
if ($LASTEXITCODE -ne 0) { throw "O relatório Authenticode da versão 1.5.0 não está aprovado." }
$checks = [ordered]@{ windows10=[bool]$Windows10; windows11=[bool]$Windows11; cleanInstall=[bool]$CleanInstall; upgradeFrom140=[bool]$UpgradeFrom140; dataPreserved=[bool]$DataPreserved; publisherIdentityChecked=[bool]$PublisherIdentityChecked; applicationSignatureChecked=[bool]$ApplicationSignatureChecked; installerSignatureChecked=[bool]$InstallerSignatureChecked; timestampChecked=[bool]$TimestampChecked; sha256DigestChecked=[bool]$Sha256DigestChecked; unsignedBuildRejected=[bool]$UnsignedBuildRejected; tamperedInstallerRejected=[bool]$TamperedInstallerRejected; certificateExpiryReviewed=[bool]$CertificateExpiryReviewed; signatureChecked=[bool]$SignatureChecked; latestChannelChecked=[bool]$LatestChannelChecked }
$complete = -not (@($checks.Values) -contains $false)
$installer = Join-Path $ReleaseDir "FinnacialUX-Desktop_1.5.0_x64-setup.exe"
$authReport = Get-Content (Join-Path $ReleaseDir "WINDOWS_AUTHENTICODE_REPORT.json") -Raw | ConvertFrom-Json
$report = [ordered]@{ formatVersion=4; product="FinnacialUX Desktop"; version=$Version; schemaVersion=14; promotedFrom="1.4.0"; releaseMode="stable-update"; previousReleaseEvidenceAvailable=$true; recordedAt=(Get-Date).ToUniversalTime().ToString("o"); installerSha256=(Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant(); authenticodeValidated=($authReport.status -eq "approved"); publisher=[string]$authReport.expectedPublisher; checks=$checks; manualMatrixComplete=$complete; latestChannelConfirmed=[bool]$LatestChannelChecked; status=if($complete){"approved-for-stable"}else{"manual-checks-pending"} }
$path = Join-Path $ReleaseDir "STABLE_VALIDATION_REPORT.json"
[System.IO.File]::WriteAllText($path, (($report | ConvertTo-Json -Depth 8) + "`n"), [System.Text.UTF8Encoding]::new($false))
if (-not $complete) { Write-Host "Homologação registrada com pendências em: $path" -ForegroundColor Yellow; exit 2 }
Write-Host "HOMOLOGAÇÃO MANUAL DA ATUALIZAÇÃO 1.5.0 CONCLUÍDA" -ForegroundColor Green
Write-Host "Próximo passo: .\25_PUBLICAR_ATUALIZACAO_ESTAVEL.cmd"
