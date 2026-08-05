param(
  [switch]$SomenteValidar,
  [switch]$ReutilizarArtefatos,
  [switch]$Offline,
  [switch]$ForceRebuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
. (Join-Path (Split-Path -Parent $PSScriptRoot) "core\command-runner.ps1")
$Root = Get-FinnacialuxProjectRoot -StartPath $PSScriptRoot
Set-Location $Root

function Update-FinnacialuxProjectState {
  param([switch]$ReleasePrepared)

  $StatePath = Join-Path $Root "project_brain\PROJECT_STATE.json"
  $Utf8 = [Text.UTF8Encoding]::new($false)
  $State = [IO.File]::ReadAllText($StatePath, $Utf8) | ConvertFrom-Json
  $State.validation.lastResult = "passed"
  $State.validation.lastValidatedAt = [DateTime]::UtcNow.ToString("o")
  if ($ReleasePrepared) { $State.release.automaticChecks = "approved" }
  [IO.File]::WriteAllText($StatePath, (($State | ConvertTo-Json -Depth 12) + "`n"), $Utf8)
}

function Assert-UpdaterConfiguration {
  param([switch]$RequirePrivateKey)

  $UpdaterConfig = Join-Path $Root "src-tauri\tauri.updater.conf.json"
  $LocalConfig = Join-Path $Root ".release\updater.local.json"
  if (-not (Test-Path $UpdaterConfig -PathType Leaf) -or -not (Test-Path $LocalConfig -PathType Leaf)) {
    Write-Host "`n==> Configurando o updater" -ForegroundColor Cyan
    Invoke-FinnacialuxPowerShellScript `
      -ScriptPath (Join-Path $Root "scripts\updater\configure-updater.ps1") `
      -FailureMessage "Não foi possível configurar o updater."
  }

  $Updater = Get-Content $UpdaterConfig -Raw | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace([string]$Updater.plugins.updater.pubkey)) {
    throw "A chave pública do updater está ausente."
  }
  if (@($Updater.plugins.updater.endpoints).Count -eq 0) {
    throw "O endpoint do updater está ausente."
  }

  if ($RequirePrivateKey) {
    $Local = Get-Content $LocalConfig -Raw | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace([string]$Local.privateKeyPath) -or -not (Test-Path ([string]$Local.privateKeyPath) -PathType Leaf)) {
      throw "A chave privada do updater não está disponível fora do projeto."
    }
    Write-Host "Chave privada do updater: disponível fora do projeto." -ForegroundColor Green
  }
}

try {
  if ($SomenteValidar -and ($ReutilizarArtefatos -or $ForceRebuild -or $Offline)) {
    throw "-SomenteValidar não pode ser combinado com parâmetros de geração."
  }
  if ($ReutilizarArtefatos -and $ForceRebuild) {
    throw "-ReutilizarArtefatos e -ForceRebuild são mutuamente exclusivos."
  }

  Write-Host "FINNACIALUX DESKTOP - VALIDAR E PREPARAR ATUALIZAÇÃO" -ForegroundColor Cyan
  Invoke-FinnacialuxPowerShellScript `
    -ScriptPath (Join-Path $Root "scripts\validation\validate-project.ps1") `
    -Parameters @{ SkipReleaseArtifacts = $SomenteValidar -eq $false -and $ForceRebuild } `
    -FailureMessage "A suíte de qualidade falhou."

  if ($SomenteValidar) {
    Update-FinnacialuxProjectState -ReleasePrepared
    Write-Host "`nVALIDAÇÃO CONCLUÍDA. Nenhuma release foi gerada ou publicada." -ForegroundColor Green
    return
  }

  $Installer = Join-Path $Root "releases\1.5.0\FinnacialUX-Desktop_1.5.0_x64-setup.exe"
  $UpdaterSignature = "$Installer.sig"
  $ArtifactsAvailable = (Test-Path $Installer -PathType Leaf) -and (Test-Path $UpdaterSignature -PathType Leaf)
  $NeedsPrivateKey = $ForceRebuild -or (-not $ReutilizarArtefatos -and -not $ArtifactsAvailable)
  Assert-UpdaterConfiguration -RequirePrivateKey:$NeedsPrivateKey

  $SigningConfig = Join-Path $Root "release\windows-signing.local.json"
  if (-not (Test-Path $SigningConfig -PathType Leaf)) {
    Write-Host "`n==> Configurando Authenticode" -ForegroundColor Cyan
    Invoke-FinnacialuxPowerShellScript `
      -ScriptPath (Join-Path $Root "scripts\signing\configure-windows-signing.ps1") `
      -FailureMessage "Não foi possível configurar a assinatura Authenticode."
  }

  $PrepareParameters = @{ SkipQuality = $true }
  if ($ReutilizarArtefatos) { $PrepareParameters.RequireReuse = $true }
  if ($ForceRebuild) { $PrepareParameters.ForceRebuild = $true }
  if ($Offline) { $PrepareParameters.Offline = $true }
  Invoke-FinnacialuxPowerShellScript `
    -ScriptPath (Join-Path $Root "scripts\release\prepare-stable-release.ps1") `
    -Parameters $PrepareParameters `
    -FailureMessage "A preparação da atualização falhou."

  Update-FinnacialuxProjectState -ReleasePrepared
  Write-Host "`nAtualização preparada. A publicação continua separada e não foi executada." -ForegroundColor Yellow
}
catch {
  Write-Host "`nFalha ao validar ou preparar a atualização: $($_.Exception.Message)" -ForegroundColor Red
  throw
}
