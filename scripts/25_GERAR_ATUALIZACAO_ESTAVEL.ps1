param(
  [switch]$SkipQuality,
  [string]$PreviousReleaseDirectory = "releases\1.4.0",
  [string]$SigningConfigPath = "release\windows-signing.local.json",
  [switch]$ForceRebuild
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Version = "1.5.0"
$Notes = ".\release\RELEASE_NOTES_1_5_0.md"
$package = Get-Content ".\package.json" -Raw | ConvertFrom-Json
if ($package.version -ne $Version) { throw "A versão atual precisa ser $Version." }
node scripts\stable-release.mjs verify-source $Root
if ($LASTEXITCODE -ne 0) { throw "A fonte da versão 1.5.0 não passou pela validação de release." }
node scripts\stable-release.mjs verify-promotion $Root $PreviousReleaseDirectory
if ($LASTEXITCODE -ne 0) { throw "A versão 1.4.0 não possui evidência de homologação suficiente." }
if (-not $SkipQuality) { & ".\25_VALIDAR_FASE_24.cmd"; if ($LASTEXITCODE -ne 0) { throw "A validação da Fase 24 falhou." } }
& ".\scripts\25_VALIDAR_AMBIENTE_ASSINATURA_WINDOWS.ps1" -ConfigPath $SigningConfigPath -RequireReady -Quiet
node scripts\stable-release.mjs prepare $Root $PreviousReleaseDirectory
if ($LASTEXITCODE -ne 0) { throw "Não foi possível preparar os manifestos da atualização 1.5.0." }
$ReleaseDirectory = Join-Path $Root "releases\$Version"
$InstallerName = "FinnacialUX-Desktop_${Version}_x64-setup.exe"
$ReusableArtifacts = @((Join-Path $ReleaseDirectory $InstallerName),(Join-Path $ReleaseDirectory "$InstallerName.sig"),(Join-Path $ReleaseDirectory "latest.json"),(Join-Path $ReleaseDirectory "SHA256SUMS.txt"),(Join-Path $ReleaseDirectory "release-manifest.json"),(Join-Path $ReleaseDirectory "RELEASE_NOTES.md"),(Join-Path $ReleaseDirectory "WINDOWS_AUTHENTICODE_REPORT.json"))
$CanReuseSignedArtifacts = -not $ForceRebuild
foreach ($Artifact in $ReusableArtifacts) { $Info = Get-Item $Artifact -ErrorAction SilentlyContinue; if (-not $Info -or $Info.Length -le 0) { $CanReuseSignedArtifacts = $false; break } }
if ($CanReuseSignedArtifacts) {
  try { node scripts\windows-signing.mjs verify-report $Root "releases\$Version\WINDOWS_AUTHENTICODE_REPORT.json"; if ($LASTEXITCODE -ne 0) { throw "invalid" } } catch { $CanReuseSignedArtifacts = $false }
}
if ($CanReuseSignedArtifacts) { Write-Host ""; Write-Host "==> Reutilizando instalador Authenticode já aprovado" -ForegroundColor Cyan }
else {
  $loadedConfig = [System.IO.Path]::GetFullPath((Join-Path $Root $SigningConfigPath))
  $config = Get-Content $loadedConfig -Raw | ConvertFrom-Json
  $previousPfxPassword = $env:FINNACIALUX_WINDOWS_PFX_PASSWORD
  if ($config.provider -eq "pfx" -and [string]::IsNullOrWhiteSpace($env:FINNACIALUX_WINDOWS_PFX_PASSWORD)) {
    $secure = Read-Host "Senha do PFX (não será gravada)" -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $env:FINNACIALUX_WINDOWS_PFX_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  }
  $overlayPath = Join-Path $Root "src-tauri\tauri.windows.conf.json"
  $backupPath = "$overlayPath.phase24-backup"
  $hadOverlay = Test-Path $overlayPath
  if ($hadOverlay) { Copy-Item $overlayPath $backupPath -Force }
  $signer = (Resolve-Path ".\scripts\25_SIGN_TAURI_ARTIFACT.ps1").Path
  $overlay = [ordered]@{ bundle=[ordered]@{ publisher=[string]$config.publisherDisplayName; windows=[ordered]@{ allowDowngrades=$false; signCommand=[ordered]@{ cmd="powershell"; args=@("-NoProfile","-ExecutionPolicy","Bypass","-File",$signer,"-ArtifactPath","%1","-ConfigPath",$loadedConfig) } } } }
  [System.IO.File]::WriteAllText($overlayPath, (($overlay | ConvertTo-Json -Depth 8) + "`n"), [System.Text.UTF8Encoding]::new($false))
  $previousOfficial = $env:FINNACIALUX_OFFICIAL_RELEASE
  $previousConfig = $env:FINNACIALUX_WINDOWS_SIGNING_CONFIG
  $env:FINNACIALUX_OFFICIAL_RELEASE = "1"
  $env:FINNACIALUX_WINDOWS_SIGNING_CONFIG = $loadedConfig
  try {
    & ".\scripts\05_GERAR_RELEASE.ps1" -Version $Version -NotesFile $Notes
    if ($LASTEXITCODE -ne 0) { throw "A geração assinada da atualização 1.5.0 falhou." }
  } finally {
    $env:FINNACIALUX_OFFICIAL_RELEASE = $previousOfficial
    $env:FINNACIALUX_WINDOWS_SIGNING_CONFIG = $previousConfig
    if ($config.provider -eq "pfx") {
      if ($null -eq $previousPfxPassword) { Remove-Item Env:FINNACIALUX_WINDOWS_PFX_PASSWORD -ErrorAction SilentlyContinue }
      else { $env:FINNACIALUX_WINDOWS_PFX_PASSWORD = $previousPfxPassword }
    }
    if ($hadOverlay) { Move-Item $backupPath $overlayPath -Force } else { Remove-Item $overlayPath -Force -ErrorAction SilentlyContinue }
  }
  & ".\scripts\25_VERIFICAR_RELEASE_WINDOWS.ps1" -Version $Version -ConfigPath $SigningConfigPath
  if ($LASTEXITCODE -ne 0) { throw "A verificação Authenticode da atualização 1.5.0 falhou." }
}
node scripts\stable-release.mjs prepare $Root $PreviousReleaseDirectory
if ($LASTEXITCODE -ne 0) { throw "Não foi possível sincronizar a documentação final da atualização 1.5.0." }
node scripts\stable-release.mjs verify-artifacts $Root "releases\$Version"
if ($LASTEXITCODE -ne 0) { throw "Os artefatos da atualização 1.5.0 são inválidos." }
Write-Host ""; Write-Host "ATUALIZAÇÃO ESTÁVEL 1.5.0 GERADA E ASSINADA COM SUCESSO" -ForegroundColor Green; Write-Host "Pasta: releases\1.5.0"; Write-Host "Execute: .\25_HOMOLOGAR_ATUALIZACAO_ESTAVEL.cmd"
