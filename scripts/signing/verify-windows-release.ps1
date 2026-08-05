param([string]$Version = "1.5.0", [string]$ConfigPath = "")
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root
. (Join-Path $PSScriptRoot "windows-signing.ps1")
$loaded = Read-FinnacialuxSigningConfig $ConfigPath
$config = $loaded.Value
$releaseDir = Join-Path $Root "releases\$Version"
$app = Join-Path $Root "src-tauri\target\release\finnacialux-desktop.exe"
$installer = Join-Path $releaseDir "FinnacialUX-Desktop_${Version}_x64-setup.exe"
foreach ($path in @($app, $installer)) { if (-not (Test-Path $path -PathType Leaf)) { throw "Artefato Windows ausente: $path" } }
$appRecord = Get-FinnacialuxAuthenticodeRecord $app $config
$appRecord | Add-Member -MemberType NoteProperty -Name role -Value "application"
$installerRecord = Get-FinnacialuxAuthenticodeRecord $installer $config
$installerRecord | Add-Member -MemberType NoteProperty -Name role -Value "installer"
$artifacts = @($appRecord, $installerRecord)
$allValid = -not (@($artifacts | Where-Object { $_.signatureStatus -ne "Valid" }).Count)
$timestampComplete = -not (@($artifacts | Where-Object { $_.timestampPresent -ne $true }).Count)
$publisherMatch = -not (@($artifacts | Where-Object { $_.publisherMatch -ne $true }).Count)
$report = [ordered]@{
  formatVersion = 1
  product = "FinnacialUX Desktop"
  version = $Version
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  provider = [string]$config.provider
  expectedPublisher = [string]$config.expectedPublisher
  fileDigestAlgorithm = "SHA256"
  timestampDigestAlgorithm = "SHA256"
  allValid = $allValid
  timestampComplete = $timestampComplete
  publisherMatch = $publisherMatch
  artifacts = $artifacts
  status = if ($allValid -and $timestampComplete -and $publisherMatch) { "approved" } else { "rejected" }
}
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
$path = Join-Path $releaseDir "WINDOWS_AUTHENTICODE_REPORT.json"
[System.IO.File]::WriteAllText($path, (($report | ConvertTo-Json -Depth 8) + "`n"), [System.Text.UTF8Encoding]::new($false))
Copy-Item (Join-Path $Root "release\windows-signing-policy.json") (Join-Path $releaseDir "WINDOWS_SIGNING_POLICY.json") -Force
if ($report.status -ne "approved") { throw "A release Windows não passou pela política Authenticode." }
Write-Host "EXECUTÁVEL E INSTALADOR AUTHENTICODE VALIDADOS" -ForegroundColor Green
Write-Host "Relatório: $path"
