$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$NodeScript = Join-Path $PSScriptRoot "25_CORRIGIR_BRACE_EXPANSION.mjs"
$PackageJson = Join-Path $ProjectRoot "package.json"
$PackageLock = Join-Path $ProjectRoot "package-lock.json"
$HiddenLock = Join-Path $ProjectRoot "node_modules\.package-lock.json"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $ProjectRoot ".dependency-backup\hotfix-24-0-3-$Timestamp"
$StagingDir = Join-Path $ProjectRoot ".dependency-staging\hotfix-24-0-3-$Timestamp"
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

  Write-Host "FINNACIALUX DESKTOP - HOTFIX 24.0.3 - BRACE-EXPANSION COMPLETO"
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

  $Node = (Get-Command node.exe -ErrorAction Stop).Source
  $Npm = (Get-Command npm.cmd -ErrorAction Stop).Source

  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

  Copy-Item $PackageJson (Join-Path $BackupDir "package.json") -Force
  Copy-Item $PackageLock (Join-Path $BackupDir "package-lock.json") -Force

  Write-Host "==> Atualizando overrides por linha principal segura"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeScript,
    "prepare",
    "--root",
    $ProjectRoot
  ) -FailureMessage "Nao foi possivel preparar package.json e package-lock.json."

  Copy-Item $PackageJson (Join-Path $StagingDir "package.json") -Force
  Copy-Item $PackageLock (Join-Path $StagingDir "package-lock.json") -Force

  Write-Host ""
  Write-Host "==> Regenerando o lockfile em staging isolado"
  Write-Host "Nenhum npm audit fix ou npm audit fix --force sera executado."

  Push-Location $StagingDir
  try {
    Invoke-CheckedCommand -Command $Npm -Arguments @(
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--prefer-online"
    ) -FailureMessage "O npm nao conseguiu regenerar o lockfile seguro no staging."
  }
  finally {
    Pop-Location
  }

  Write-Host ""
  Write-Host "==> Validando todas as linhas de brace-expansion no staging"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeScript,
    "verify-lock",
    "--root",
    $StagingDir
  ) -FailureMessage "O lockfile de staging ainda contem brace-expansion vulneravel."

  Copy-Item (Join-Path $StagingDir "package-lock.json") $PackageLock -Force

  if (Test-Path $HiddenLock) {
    Remove-Item $HiddenLock -Force
  }

  Write-Host ""
  Write-Host "==> Validando os arquivos consolidados na raiz"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeScript,
    "verify-lock",
    "--root",
    $ProjectRoot
  ) -FailureMessage "Os arquivos consolidados nao passaram na verificacao final."

  $Succeeded = $true

  Write-Host ""
  Write-Host "HOTFIX 24.0.3 APLICADO COM SUCESSO"
  Write-Host "Versao: 1.5.0"
  Write-Host "Schema: 14 (congelado)"
  Write-Host "Backup: $BackupDir"
  Write-Host "Execute agora: .\25_VALIDAR_HOTFIX_24_0_3.cmd"
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
