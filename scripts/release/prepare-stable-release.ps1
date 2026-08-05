param(
  [switch]$SkipQuality,
  [string]$PreviousReleaseDirectory = "releases\1.4.0",
  [string]$SigningConfigPath = "release\windows-signing.local.json",
  [switch]$ForceRebuild,
  [switch]$RequireReuse,
  [switch]$Offline
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
. (Join-Path (Split-Path -Parent $PSScriptRoot) "core\command-runner.ps1")
$Root = Get-FinnacialuxProjectRoot -StartPath $PSScriptRoot
Set-Location $Root
$Version = "1.5.0"
$Notes = ".\release\RELEASE_NOTES_1_5_0.md"
$Node = Get-FinnacialuxCommandPath "node.exe"
$StableReleaseScript = "scripts\release\stable-release.mjs"
$SigningPolicyScript = "scripts\signing\windows-signing.mjs"

if ($ForceRebuild -and $RequireReuse) {
  throw "-ForceRebuild e -RequireReuse são mutuamente exclusivos."
}

function Invoke-ReleaseNode {
  param([string[]]$Arguments, [string]$FailureMessage)
  Invoke-FinnacialuxNativeCommand $Node $Arguments $FailureMessage
}

function Ensure-FinnacialuxLooseApplicationAuthenticode {
  param([string]$ConfigPath)
  . (Join-Path $Root "scripts\signing\windows-signing.ps1")
  $ApplicationPath = Join-Path $Root "src-tauri\target\release\finnacialux-desktop.exe"
  if (-not (Test-Path $ApplicationPath -PathType Leaf)) {
    throw "Executável solto ausente depois do bundle: $ApplicationPath"
  }
  $LoadedSigning = Read-FinnacialuxSigningConfig $ConfigPath
  $SigningConfig = $LoadedSigning.Value
  $Signature = Get-AuthenticodeSignature -FilePath $ApplicationPath
  $SignerSubject = if ($Signature.SignerCertificate) { [string]$Signature.SignerCertificate.Subject } else { "" }
  $ExpectedPublisher = [string]$SigningConfig.expectedPublisher
  $PublisherMatches = -not [string]::IsNullOrWhiteSpace($SignerSubject) -and $SignerSubject.IndexOf($ExpectedPublisher, [StringComparison]::OrdinalIgnoreCase) -ge 0
  $NeedsSigning = [string]$Signature.Status -ne "Valid" -or $null -eq $Signature.TimeStamperCertificate -or -not $PublisherMatches
  if ($NeedsSigning) {
    Write-Host "`n==> Reassinando o executável solto restaurado pelo bundle NSIS" -ForegroundColor Cyan
    $Record = Invoke-FinnacialuxSignArtifact $ApplicationPath $ConfigPath
    if ([string]$Record.signatureStatus -ne "Valid" -or $Record.timestampPresent -ne $true -or $Record.publisherMatch -ne $true) {
      throw "O executável solto não passou pela reassinatura pós-bundle."
    }
  }
  Write-Host "Executável solto Authenticode confirmado após o bundle." -ForegroundColor Green
}

$Package = Get-Content ".\package.json" -Raw | ConvertFrom-Json
if ([string]$Package.version -ne $Version) { throw "A versão atual precisa ser $Version." }

Invoke-ReleaseNode @($StableReleaseScript, "verify-source", $Root) "A fonte da versão $Version não passou pela validação."
Invoke-ReleaseNode @($StableReleaseScript, "inspect-promotion", $Root, $PreviousReleaseDirectory) "Não foi possível inspecionar a evidência da versão anterior."

if (-not $SkipQuality) {
  Invoke-FinnacialuxPowerShellScript `
    -ScriptPath (Join-Path $Root "scripts\validation\validate-project.ps1") `
    -Parameters @{ SkipReleaseArtifacts = $true } `
    -FailureMessage "A validação consolidada do projeto falhou."
}

$SigningParameters = @{ ConfigPath = $SigningConfigPath; RequireReady = $true; Quiet = $true }
Invoke-FinnacialuxPowerShellScript `
  -ScriptPath (Join-Path $Root "scripts\signing\validate-signing-environment.ps1") `
  -Parameters $SigningParameters `
  -FailureMessage "O ambiente Authenticode não está pronto."

Invoke-ReleaseNode @($StableReleaseScript, "prepare", $Root, $PreviousReleaseDirectory) "Não foi possível preparar os manifestos da atualização."

$ReleaseDirectory = Join-Path $Root "releases\$Version"
$InstallerName = "FinnacialUX-Desktop_${Version}_x64-setup.exe"
$ReusableArtifacts = @(
  (Join-Path $ReleaseDirectory $InstallerName),
  (Join-Path $ReleaseDirectory "$InstallerName.sig"),
  (Join-Path $ReleaseDirectory "latest.json"),
  (Join-Path $ReleaseDirectory "SHA256SUMS.txt"),
  (Join-Path $ReleaseDirectory "release-manifest.json"),
  (Join-Path $ReleaseDirectory "RELEASE_NOTES.md"),
  (Join-Path $ReleaseDirectory "WINDOWS_AUTHENTICODE_REPORT.json")
)
$CanReuseSignedArtifacts = -not $ForceRebuild
foreach ($Artifact in $ReusableArtifacts) {
  $Info = Get-Item $Artifact -ErrorAction SilentlyContinue
  if (-not $Info -or $Info.Length -le 0) { $CanReuseSignedArtifacts = $false; break }
}
if ($CanReuseSignedArtifacts) {
  try {
    Invoke-ReleaseNode @($SigningPolicyScript, "verify-report", $Root, "releases\$Version\WINDOWS_AUTHENTICODE_REPORT.json") "Relatório Authenticode inválido."
  }
  catch { $CanReuseSignedArtifacts = $false }
}
if ($RequireReuse -and -not $CanReuseSignedArtifacts) {
  throw "Os artefatos existentes não podem ser reutilizados com segurança."
}

if ($CanReuseSignedArtifacts) {
  Write-Host "`n==> Reutilizando instalador, assinatura do updater e Authenticode já aprovados" -ForegroundColor Cyan
}
else {
  $LoadedConfigPath = [IO.Path]::GetFullPath((Join-Path $Root $SigningConfigPath))
  $Config = Get-Content $LoadedConfigPath -Raw | ConvertFrom-Json
  $PreviousPfxPassword = $env:FINNACIALUX_WINDOWS_PFX_PASSWORD
  if ($Config.provider -eq "pfx" -and [string]::IsNullOrWhiteSpace($env:FINNACIALUX_WINDOWS_PFX_PASSWORD)) {
    $SecurePassword = Read-Host "Senha do PFX (não será gravada)" -AsSecureString
    $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    try { $env:FINNACIALUX_WINDOWS_PFX_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer) }
  }

  $OverlayPath = Join-Path $Root "src-tauri\tauri.windows.conf.json"
  $BackupPath = "$OverlayPath.workflow-backup"
  $HadOverlay = Test-Path $OverlayPath -PathType Leaf
  if ($HadOverlay) { Copy-Item $OverlayPath $BackupPath -Force }
  $Signer = (Resolve-Path ".\scripts\signing\sign-tauri-artifact.ps1").Path
  $Overlay = [ordered]@{
    bundle = [ordered]@{
      publisher = [string]$Config.publisherDisplayName
      windows = [ordered]@{
        allowDowngrades = $false
        signCommand = [ordered]@{
          cmd = "powershell"
          args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $Signer, "-ArtifactPath", "%1", "-ConfigPath", $LoadedConfigPath)
        }
      }
    }
  }
  [IO.File]::WriteAllText($OverlayPath, (($Overlay | ConvertTo-Json -Depth 8) + "`n"), [Text.UTF8Encoding]::new($false))

  $PreviousOfficial = $env:FINNACIALUX_OFFICIAL_RELEASE
  $PreviousConfig = $env:FINNACIALUX_WINDOWS_SIGNING_CONFIG
  $env:FINNACIALUX_OFFICIAL_RELEASE = "1"
  $env:FINNACIALUX_WINDOWS_SIGNING_CONFIG = $LoadedConfigPath
  try {
    $BuildParameters = @{ Version = $Version; NotesFile = $Notes }
    if ($Offline) { $BuildParameters.Offline = $true }
    Invoke-FinnacialuxPowerShellScript `
      -ScriptPath (Join-Path $Root "scripts\release\build-release.ps1") `
      -Parameters $BuildParameters `
      -FailureMessage "A geração assinada da atualização falhou."
  }
  finally {
    $env:FINNACIALUX_OFFICIAL_RELEASE = $PreviousOfficial
    $env:FINNACIALUX_WINDOWS_SIGNING_CONFIG = $PreviousConfig
    if ($Config.provider -eq "pfx") {
      if ($null -eq $PreviousPfxPassword) { Remove-Item Env:FINNACIALUX_WINDOWS_PFX_PASSWORD -ErrorAction SilentlyContinue }
      else { $env:FINNACIALUX_WINDOWS_PFX_PASSWORD = $PreviousPfxPassword }
    }
    if ($HadOverlay) { Move-Item $BackupPath $OverlayPath -Force }
    else { Remove-Item $OverlayPath -Force -ErrorAction SilentlyContinue }
  }

  Ensure-FinnacialuxLooseApplicationAuthenticode -ConfigPath $SigningConfigPath
  Invoke-FinnacialuxPowerShellScript `
    -ScriptPath (Join-Path $Root "scripts\signing\verify-windows-release.ps1") `
    -Parameters @{ Version = $Version; ConfigPath = $SigningConfigPath } `
    -FailureMessage "A verificação Authenticode da atualização falhou."
}

Invoke-ReleaseNode @($StableReleaseScript, "prepare", $Root, $PreviousReleaseDirectory) "Não foi possível sincronizar os manifestos finais."
Invoke-ReleaseNode @($StableReleaseScript, "verify-artifacts", $Root, "releases\$Version") "Os artefatos da atualização são inválidos."

Write-Host "`nATUALIZAÇÃO $Version PREPARADA E VALIDADA" -ForegroundColor Green
Write-Host "Pasta: releases\$Version"
Write-Host "A publicação não foi executada. Use .\04_PUBLICAR_ATUALIZACAO.cmd somente após concluir os gates manuais." -ForegroundColor Yellow
