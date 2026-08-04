$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$NodeScript = Join-Path $PSScriptRoot "25_CORRIGIR_BRACE_EXPANSION.mjs"
$PackageJson = Join-Path $ProjectRoot "package.json"
$PackageLock = Join-Path $ProjectRoot "package-lock.json"
$ProjectNpmrc = Join-Path $ProjectRoot ".npmrc"
$Shrinkwrap = Join-Path $ProjectRoot "npm-shrinkwrap.json"
$HiddenLock = Join-Path $ProjectRoot "node_modules\.package-lock.json"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $ProjectRoot ".dependency-backup\hotfix-24-0-4-$Timestamp"
$StagingDir = Join-Path $ProjectRoot ".dependency-staging\hotfix-24-0-4-$Timestamp"
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

function Restore-ProjectFiles {
  if (Test-Path (Join-Path $BackupDir "package.json")) {
    Copy-Item (Join-Path $BackupDir "package.json") $PackageJson -Force
  }

  if (Test-Path (Join-Path $BackupDir "package-lock.json")) {
    Copy-Item (Join-Path $BackupDir "package-lock.json") $PackageLock -Force
  }
}

try {
  Set-Location $ProjectRoot

  Write-Host "FINNACIALUX DESKTOP - HOTFIX 24.0.4 - REGENERACAO LIMPA DO LOCKFILE"
  Write-Host "Raiz: $ProjectRoot"
  Write-Host "Versao esperada do projeto: 1.5.0"
  Write-Host "Schema esperado: 14 (congelado)"
  Write-Host ""

  if (-not (Test-Path $PackageJson)) {
    throw "package.json nao encontrado na raiz do projeto."
  }

  if (-not (Test-Path $PackageLock)) {
    throw "package-lock.json nao encontrado na raiz do projeto."
  }

  if (Test-Path $Shrinkwrap) {
    throw "npm-shrinkwrap.json foi encontrado. O hotfix nao continuara para evitar substituir um lock prioritario."
  }

  $Node = (Get-Command node.exe -ErrorAction Stop).Source
  $Npm = (Get-Command npm.cmd -ErrorAction Stop).Source

  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

  Copy-Item $PackageJson (Join-Path $BackupDir "package.json") -Force
  Copy-Item $PackageLock (Join-Path $BackupDir "package-lock.json") -Force

  Write-Host "==> Atualizando somente os overrides do package.json"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeScript,
    "prepare-manifest",
    "--root",
    $ProjectRoot
  ) -FailureMessage "Nao foi possivel preparar os overrides seguros."

  Copy-Item $PackageJson (Join-Path $StagingDir "package.json") -Force
  if (Test-Path $ProjectNpmrc) {
    Copy-Item $ProjectNpmrc (Join-Path $StagingDir ".npmrc") -Force
  }

  Write-Host ""
  Write-Host "==> Criando um package-lock novo em staging isolado"
  Write-Host "O package-lock antigo nao sera copiado para o staging."
  Write-Host "Nenhum npm audit fix ou npm audit fix --force sera executado."

  Push-Location $StagingDir
  try {
    Invoke-CheckedCommand -Command $Npm -Arguments @(
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--prefer-online",
      "--include=dev",
      "--include=optional"
    ) -FailureMessage "O npm nao conseguiu criar um lockfile novo no staging."
  }
  finally {
    Pop-Location
  }

  Write-Host ""
  Write-Host "==> Validando estrutura, referencias e versoes do lockfile novo"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeScript,
    "verify-lock",
    "--root",
    $StagingDir
  ) -FailureMessage "O lockfile novo nao atende ao advisory de brace-expansion."

  Write-Host ""
  Write-Host "==> Instalando a arvore exata do staging sem scripts de dependencias"
  Push-Location $StagingDir
  try {
    Invoke-CheckedCommand -Command $Npm -Arguments @(
      "ci",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--include=dev",
      "--include=optional"
    ) -FailureMessage "O package-lock novo nao conseguiu reproduzir a arvore no staging."
  }
  finally {
    Pop-Location
  }

  Write-Host ""
  Write-Host "==> Conferindo os pacotes realmente instalados no staging"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeScript,
    "verify-installed",
    "--root",
    $StagingDir
  ) -FailureMessage "A arvore instalada no staging ainda contem brace-expansion vulneravel ou incompleto."

  Write-Host ""
  Write-Host "==> Auditando o staging sem correcoes automaticas"
  Push-Location $StagingDir
  try {
    Invoke-CheckedCommand -Command $Npm -Arguments @(
      "audit",
      "--audit-level=high"
    ) -FailureMessage "A auditoria do staging encontrou vulnerabilidade alta ou critica."
  }
  finally {
    Pop-Location
  }

  Write-Host ""
  Write-Host "==> Consolidando somente package.json e package-lock.json"
  Copy-Item (Join-Path $StagingDir "package-lock.json") $PackageLock -Force

  if (Test-Path $HiddenLock) {
    Remove-Item $HiddenLock -Force
  }

  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeScript,
    "verify-lock",
    "--root",
    $ProjectRoot
  ) -FailureMessage "Os arquivos consolidados nao passaram na verificacao final."

  $Succeeded = $true

  Write-Host ""
  Write-Host "HOTFIX 24.0.4 APLICADO COM SUCESSO"
  Write-Host "Versao: 1.5.0"
  Write-Host "Schema: 14 (congelado)"
  Write-Host "Backup: $BackupDir"
  Write-Host "Execute agora: .\25_VALIDAR_HOTFIX_24_0_4.cmd"
}
catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red

  if (Test-Path $BackupDir) {
    Restore-ProjectFiles
    Write-Host "package.json e package-lock.json foram restaurados a partir do backup."
    Write-Host "Backup: $BackupDir"
  }

  if (Test-Path $StagingDir) {
    Write-Host "Staging preservado para diagnostico: $StagingDir"
  }

  exit 1
}
finally {
  if ($Succeeded -and (Test-Path $StagingDir)) {
    Remove-Item $StagingDir -Recurse -Force
  }
}
