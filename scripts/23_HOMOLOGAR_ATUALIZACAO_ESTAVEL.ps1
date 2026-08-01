param(
  [switch]$Windows10,
  [switch]$Windows11,
  [switch]$CleanInstall,
  [switch]$UpgradeFrom120,
  [switch]$DataPreserved,
  [switch]$AutomaticDrillChecked,
  [switch]$CorruptedBackupRejected,
  [switch]$RpoRtoChecked,
  [switch]$StrongholdPreviewChecked,
  [switch]$DisasterPlanChecked,
  [switch]$BackupRestoreChecked,
  [switch]$SignatureChecked,
  [switch]$LatestChannelChecked
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Version = "1.3.0"
$ReleaseDir = Join-Path $Root "releases\$Version"
node scripts\stable-release.mjs verify-artifacts $Root "releases\$Version"
if ($LASTEXITCODE -ne 0) { throw "Os artefatos automáticos da versão 1.3.0 ainda não foram aprovados." }
$checks = [ordered]@{ windows10=[bool]$Windows10; windows11=[bool]$Windows11; cleanInstall=[bool]$CleanInstall; upgradeFrom120=[bool]$UpgradeFrom120; dataPreserved=[bool]$DataPreserved; automaticDrillChecked=[bool]$AutomaticDrillChecked; corruptedBackupRejected=[bool]$CorruptedBackupRejected; rpoRtoChecked=[bool]$RpoRtoChecked; strongholdPreviewChecked=[bool]$StrongholdPreviewChecked; disasterPlanChecked=[bool]$DisasterPlanChecked; backupRestoreChecked=[bool]$BackupRestoreChecked; signatureChecked=[bool]$SignatureChecked; latestChannelChecked=[bool]$LatestChannelChecked }
$complete = -not (@($checks.Values) -contains $false)
$installer = Join-Path $ReleaseDir "FinnacialUX-Desktop_1.3.0_x64-setup.exe"
$report = [ordered]@{ formatVersion=3; product="FinnacialUX Desktop"; version=$Version; schemaVersion=14; promotedFrom="1.2.0"; releaseMode="stable-update"; previousReleaseEvidenceAvailable=$true; recordedAt=(Get-Date).ToUniversalTime().ToString("o"); installerSha256=(Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant(); checks=$checks; manualMatrixComplete=$complete; latestChannelConfirmed=[bool]$LatestChannelChecked; status=if($complete){"approved-for-stable"}else{"manual-checks-pending"} }
$path = Join-Path $ReleaseDir "STABLE_VALIDATION_REPORT.json"
[System.IO.File]::WriteAllText($path, (($report | ConvertTo-Json -Depth 7) + "`n"), [System.Text.Encoding]::UTF8)
if (-not $complete) { Write-Host "Homologação registrada com pendências em: $path" -ForegroundColor Yellow; exit 2 }
Write-Host "HOMOLOGAÇÃO MANUAL DA ATUALIZAÇÃO 1.3.0 CONCLUÍDA" -ForegroundColor Green
Write-Host "Próximo passo: .\23_PUBLICAR_ATUALIZACAO_ESTAVEL.cmd"
