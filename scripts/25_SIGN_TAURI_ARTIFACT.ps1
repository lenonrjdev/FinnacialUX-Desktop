param([Parameter(Mandatory=$true)][string]$ArtifactPath, [string]$ConfigPath = "")
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
. (Join-Path $PSScriptRoot "windows-signing.ps1")
if ($env:FINNACIALUX_OFFICIAL_RELEASE -ne "1") {
  Write-Host "Build não oficial: assinatura Authenticode não executada para $([System.IO.Path]::GetFileName($ArtifactPath))." -ForegroundColor Yellow
  exit 0
}
$record = Invoke-FinnacialuxSignArtifact $ArtifactPath $ConfigPath
if ($record.signatureStatus -ne "Valid" -or $record.timestampPresent -ne $true -or $record.publisherMatch -ne $true) {
  throw "O artefato foi assinado, mas não passou pela política de publisher e timestamp."
}
Write-Host "Authenticode válido: $($record.fileName)" -ForegroundColor Green
