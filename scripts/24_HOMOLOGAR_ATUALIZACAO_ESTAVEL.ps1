param(
  [switch]$Windows10, [switch]$Windows11, [switch]$CleanInstall, [switch]$UpgradeFrom130, [switch]$DataPreserved,
  [switch]$SecondaryVolumeChecked, [switch]$SynchronizedFolderChecked, [switch]$DisconnectedMediaChecked,
  [switch]$AtomicCopyChecked, [switch]$Sha256SidecarChecked, [switch]$ExternalRetentionChecked,
  [switch]$UnencryptedPackageRejected, [switch]$ExternalRestoreChecked, [switch]$SignatureChecked, [switch]$LatestChannelChecked
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Version = "1.4.0"
$ReleaseDir = Join-Path $Root "releases\$Version"
node scripts\stable-release.mjs verify-artifacts $Root "releases\$Version"
if ($LASTEXITCODE -ne 0) { throw "Os artefatos automáticos da versão 1.4.0 ainda não foram aprovados." }
$checks = [ordered]@{ windows10=[bool]$Windows10; windows11=[bool]$Windows11; cleanInstall=[bool]$CleanInstall; upgradeFrom130=[bool]$UpgradeFrom130; dataPreserved=[bool]$DataPreserved; secondaryVolumeChecked=[bool]$SecondaryVolumeChecked; synchronizedFolderChecked=[bool]$SynchronizedFolderChecked; disconnectedMediaChecked=[bool]$DisconnectedMediaChecked; atomicCopyChecked=[bool]$AtomicCopyChecked; sha256SidecarChecked=[bool]$Sha256SidecarChecked; externalRetentionChecked=[bool]$ExternalRetentionChecked; unencryptedPackageRejected=[bool]$UnencryptedPackageRejected; externalRestoreChecked=[bool]$ExternalRestoreChecked; signatureChecked=[bool]$SignatureChecked; latestChannelChecked=[bool]$LatestChannelChecked }
$complete = -not (@($checks.Values) -contains $false)
$installer = Join-Path $ReleaseDir "FinnacialUX-Desktop_1.4.0_x64-setup.exe"
$report = [ordered]@{ formatVersion=3; product="FinnacialUX Desktop"; version=$Version; schemaVersion=14; promotedFrom="1.3.0"; releaseMode="stable-update"; previousReleaseEvidenceAvailable=$true; recordedAt=(Get-Date).ToUniversalTime().ToString("o"); installerSha256=(Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant(); checks=$checks; manualMatrixComplete=$complete; latestChannelConfirmed=[bool]$LatestChannelChecked; status=if($complete){"approved-for-stable"}else{"manual-checks-pending"} }
$path = Join-Path $ReleaseDir "STABLE_VALIDATION_REPORT.json"
[System.IO.File]::WriteAllText($path, (($report | ConvertTo-Json -Depth 7) + "`n"), [System.Text.Encoding]::UTF8)
if (-not $complete) { Write-Host "Homologação registrada com pendências em: $path" -ForegroundColor Yellow; exit 2 }
Write-Host "HOMOLOGAÇÃO MANUAL DA ATUALIZAÇÃO 1.4.0 CONCLUÍDA" -ForegroundColor Green
Write-Host "Próximo passo: .\24_PUBLICAR_ATUALIZACAO_ESTAVEL.cmd"
