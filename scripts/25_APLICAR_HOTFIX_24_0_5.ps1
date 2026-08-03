$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$NodeValidator = Join-Path $PSScriptRoot "25_VALIDAR_LOCK_MINIMATCH_SECURE.mjs"
$CompatValidator = Join-Path $PSScriptRoot "check-minimatch-compat.mjs"
$PackageJson = Join-Path $ProjectRoot "package.json"
$PackageLock = Join-Path $ProjectRoot "package-lock.json"
$ProjectNpmrc = Join-Path $ProjectRoot ".npmrc"
$Shrinkwrap = Join-Path $ProjectRoot "npm-shrinkwrap.json"
$VendorSource = Join-Path $ProjectRoot "vendor\minimatch-v3-secure-compat"
$HiddenLock = Join-Path $ProjectRoot "node_modules\.package-lock.json"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $ProjectRoot ".dependency-backup\hotfix-24-0-5-$Timestamp"
$StagingDir = Join-Path ([System.IO.Path]::GetTempPath()) "FinnacialUX-hotfix-24-0-5-$Timestamp-$PID"
$Succeeded = $false

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$FailureMessage
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
}

function Restore-Lockfile {
  $BackupLock = Join-Path $BackupDir "package-lock.json"
  if (Test-Path $BackupLock) {
    Copy-Item $BackupLock $PackageLock -Force
  }
}

try {
  Set-Location $ProjectRoot

  Write-Host "FINNACIALUX DESKTOP - HOTFIX 24.0.5 - LOCKFILE DO MINIMATCH LOCAL"
  Write-Host "Raiz: $ProjectRoot"
  Write-Host "Versao esperada: 1.5.0"
  Write-Host "Schema esperado: 14 (congelado)"
  Write-Host ""

  foreach ($RequiredFile in @($PackageJson, $PackageLock, $NodeValidator, $CompatValidator)) {
    if (-not (Test-Path $RequiredFile)) {
      throw "Arquivo obrigatorio nao encontrado: $RequiredFile"
    }
  }

  if (-not (Test-Path $VendorSource)) {
    throw "Pacote local minimatch nao encontrado: $VendorSource"
  }

  if (Test-Path $Shrinkwrap) {
    throw "npm-shrinkwrap.json foi encontrado. O hotfix nao continuara."
  }

  $Node = (Get-Command node.exe -ErrorAction Stop).Source
  $Npm = (Get-Command npm.cmd -ErrorAction Stop).Source

  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $StagingDir "vendor") -Force | Out-Null

  Copy-Item $PackageJson (Join-Path $BackupDir "package.json") -Force
  Copy-Item $PackageLock (Join-Path $BackupDir "package-lock.json") -Force

  Write-Host "==> Validando o estado seguro aplicado pelo Hotfix 24.0.4"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeValidator,
    "verify-manifest",
    "--root",
    $ProjectRoot
  ) -FailureMessage "O package.json ou o pacote vendor nao possuem o contrato esperado."

  Write-Host ""
  Write-Host "==> Preparando staging externo com o pacote local completo"
  Copy-Item $PackageJson (Join-Path $StagingDir "package.json") -Force
  Copy-Item $VendorSource (Join-Path $StagingDir "vendor\minimatch-v3-secure-compat") -Recurse -Force
  if (Test-Path $ProjectNpmrc) {
    Copy-Item $ProjectNpmrc (Join-Path $StagingDir ".npmrc") -Force
  }

  Write-Host "O staging inclui vendor\minimatch-v3-secure-compat e sua dependencia minimatch-secure."
  Write-Host "Nenhum npm audit fix ou npm audit fix --force sera executado."

  Push-Location $StagingDir
  try {
    Write-Host ""
    Write-Host "==> Gerando package-lock novo com a dependencia local presente"
    Invoke-CheckedCommand -Command $Npm -Arguments @(
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--prefer-online",
      "--include=dev",
      "--include=optional"
    ) -FailureMessage "O npm nao conseguiu gerar o lockfile completo no staging."
  }
  finally {
    Pop-Location
  }

  Write-Host ""
  Write-Host "==> Confirmando minimatch local, alias interno e brace-expansion seguro"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeValidator,
    "verify-lock",
    "--root",
    $StagingDir
  ) -FailureMessage "O lockfile de staging nao registrou todas as dependencias locais."

  Push-Location $StagingDir
  try {
    Write-Host ""
    Write-Host "==> Reproduzindo o lockfile com npm ci no staging"
    Invoke-CheckedCommand -Command $Npm -Arguments @(
      "ci",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--include=dev",
      "--include=optional"
    ) -FailureMessage "O npm ci nao conseguiu reproduzir o lockfile corrigido."
  }
  finally {
    Pop-Location
  }

  Write-Host ""
  Write-Host "==> Validando a arvore instalada e a API de compatibilidade"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeValidator,
    "verify-installed",
    "--root",
    $StagingDir
  ) -FailureMessage "A arvore instalada no staging nao corresponde ao lockfile."

  Invoke-CheckedCommand -Command $Node -Arguments @(
    $CompatValidator,
    $StagingDir
  ) -FailureMessage "A camada de compatibilidade minimatch falhou no staging."

  Push-Location $StagingDir
  try {
    Write-Host ""
    Write-Host "==> Auditando o staging sem correcoes automaticas"
    Invoke-CheckedCommand -Command $Npm -Arguments @(
      "audit",
      "--audit-level=high"
    ) -FailureMessage "A auditoria do staging encontrou vulnerabilidade alta ou critica."
  }
  finally {
    Pop-Location
  }

  Write-Host ""
  Write-Host "==> Consolidando somente o package-lock.json corrigido"
  Copy-Item (Join-Path $StagingDir "package-lock.json") $PackageLock -Force

  if (Test-Path $HiddenLock) {
    Remove-Item $HiddenLock -Force
  }

  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeValidator,
    "verify-lock",
    "--root",
    $ProjectRoot
  ) -FailureMessage "O lockfile consolidado nao passou na verificacao final."

  $Succeeded = $true

  Write-Host ""
  Write-Host "HOTFIX 24.0.5 APLICADO COM SUCESSO"
  Write-Host "Versao: 1.5.0"
  Write-Host "Schema: 14 (congelado)"
  Write-Host "Backup: $BackupDir"
  Write-Host "Execute agora: .\25_VALIDAR_HOTFIX_24_0_5.cmd"
}
catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red

  if (Test-Path $BackupDir) {
    Restore-Lockfile
    Write-Host "package-lock.json restaurado a partir do backup."
    Write-Host "Backup: $BackupDir"
  }

  if (Test-Path $StagingDir) {
    Write-Host "Staging preservado para diagnostico: $StagingDir"
  }

  exit 1
}
finally {
  if ($Succeeded -and (Test-Path $StagingDir)) {
    Remove-Item $StagingDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
