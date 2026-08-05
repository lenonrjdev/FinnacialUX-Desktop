param([string]$Repository = "")

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
. (Join-Path (Split-Path -Parent $PSScriptRoot) "core\command-runner.ps1")
$Root = Get-FinnacialuxProjectRoot -StartPath $PSScriptRoot
Set-Location $Root
$Version = "1.5.0"
$ReleaseDirectory = Join-Path $Root "releases\$Version"
$InstallerName = "FinnacialUX-Desktop_${Version}_x64-setup.exe"
$Installer = Join-Path $ReleaseDirectory $InstallerName

try {
  $Git = Get-FinnacialuxCommandPath "git.exe"
  $Node = Get-FinnacialuxCommandPath "node.exe"

  $Pending = @(& $Git "status" "--porcelain")
  $StatusExitCode = $LASTEXITCODE
  if ($StatusExitCode -ne 0) { throw "Não foi possível consultar o estado do Git." }
  if ($Pending.Count -gt 0) { throw "O Git possui alterações pendentes. Faça commit antes da publicação." }

  $BranchOutput = @(& $Git "branch" "--show-current")
  $BranchExitCode = $LASTEXITCODE
  if ($BranchExitCode -ne 0) { throw "Não foi possível identificar a branch atual." }
  $Branch = ([string]::Join("", $BranchOutput)).Trim()
  if ($Branch -ne "main") { throw "Publicação estável permitida somente a partir da branch main." }

  $OriginOutput = @(& $Git "remote" "get-url" "origin")
  $OriginExitCode = $LASTEXITCODE
  if ($OriginExitCode -ne 0 -or [string]::IsNullOrWhiteSpace([string]::Join("", $OriginOutput))) {
    throw "O remote origin não está configurado."
  }

  foreach ($File in @(
    $InstallerName, "$InstallerName.sig", "latest.json", "SHA256SUMS.txt",
    "release-manifest.json", "STABLE_BUILD_MANIFEST.json",
    "WINDOWS_AUTHENTICODE_REPORT.json", "STABLE_VALIDATION_REPORT.json"
  )) {
    $Path = Join-Path $ReleaseDirectory $File
    $Info = Get-Item $Path -ErrorAction SilentlyContinue
    if (-not $Info -or $Info.Length -le 0) { throw "Artefato obrigatório ausente ou vazio: $File" }
  }

  Invoke-FinnacialuxNativeCommand $Node @("scripts\release\stable-release.mjs", "verify-artifacts-readonly", $Root, "releases\$Version") "Os artefatos da release foram rejeitados."
  Invoke-FinnacialuxNativeCommand $Node @("scripts\signing\windows-signing.mjs", "verify-report", $Root, "releases\$Version\WINDOWS_AUTHENTICODE_REPORT.json") "O relatório Authenticode foi rejeitado."

  $Validation = Get-Content (Join-Path $ReleaseDirectory "STABLE_VALIDATION_REPORT.json") -Raw | ConvertFrom-Json
  if ($Validation.manualMatrixComplete -ne $true -or $Validation.status -ne "approved-for-stable" -or $Validation.latestChannelConfirmed -ne $true -or $Validation.authenticodeValidated -ne $true) {
    throw "A homologação manual da atualização $Version ainda não foi concluída."
  }

  $Signature = Get-AuthenticodeSignature -FilePath $Installer
  if ([string]$Signature.Status -ne "Valid" -or $null -eq $Signature.TimeStamperCertificate) {
    throw "O instalador não possui Authenticode válido com timestamp."
  }
  $UpdaterSignature = (Get-Content "$Installer.sig" -Raw).Trim()
  if ([string]::IsNullOrWhiteSpace($UpdaterSignature)) { throw "A assinatura do updater está vazia." }

  Write-Host "`nPUBLICAÇÃO EXTERNA DA VERSÃO $Version" -ForegroundColor Yellow
  Write-Host "Nenhum arquivo existente será substituído silenciosamente."
  $Confirmation = Read-Host "Digite PUBLICAR-$Version para continuar"
  if ($Confirmation -cne "PUBLICAR-$Version") { throw "Confirmação incorreta. Publicação cancelada." }

  Invoke-FinnacialuxPowerShellScript `
    -ScriptPath (Join-Path $Root "scripts\publication\publish-github-release.ps1") `
    -Parameters @{ Version = $Version; Repository = $Repository } `
    -FailureMessage "A publicação externa falhou."
}
catch {
  Write-Host "`nPublicação bloqueada: $($_.Exception.Message)" -ForegroundColor Red
  throw
}
