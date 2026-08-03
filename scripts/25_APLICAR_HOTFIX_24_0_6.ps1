$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$TargetValidator = Join-Path $PSScriptRoot "validate-installed-dependencies.mjs"
$PatchScript = Join-Path $PSScriptRoot "25_PATCH_VALIDATE_INSTALLED_DEPENDENCIES.mjs"
$LockValidator = Join-Path $PSScriptRoot "25_VALIDAR_LOCK_MINIMATCH_SECURE.mjs"
$PackageJson = Join-Path $ProjectRoot "package.json"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $ProjectRoot ".dependency-backup\hotfix-24-0-6-$Timestamp"
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

try {
  Set-Location $ProjectRoot

  Write-Host "FINNACIALUX DESKTOP - HOTFIX 24.0.6 - VALIDADOR BRACE-EXPANSION"
  Write-Host "Raiz: $ProjectRoot"
  Write-Host "Versao esperada: 1.5.0"
  Write-Host "Schema esperado: 14 (congelado)"
  Write-Host ""

  foreach ($RequiredFile in @($PackageJson, $TargetValidator, $PatchScript, $LockValidator)) {
    if (-not (Test-Path $RequiredFile)) {
      throw "Arquivo obrigatorio nao encontrado: $RequiredFile"
    }
  }

  $Manifest = Get-Content $PackageJson -Raw | ConvertFrom-Json
  if ($Manifest.version -ne "1.5.0") {
    throw "Versao inesperada do projeto: $($Manifest.version). Esperado: 1.5.0."
  }

  $Node = (Get-Command node.exe -ErrorAction Stop).Source

  Write-Host "==> Confirmando o lockfile seguro consolidado pelo Hotfix 24.0.5"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $LockValidator,
    "verify-lock",
    "--root",
    $ProjectRoot
  ) -FailureMessage "O estado seguro do Hotfix 24.0.5 nao foi encontrado."

  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  Copy-Item $TargetValidator (Join-Path $BackupDir "validate-installed-dependencies.mjs") -Force

  Write-Host ""
  Write-Host "==> Corrigindo somente a regra historica do validador acumulado"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $PatchScript,
    "apply",
    $TargetValidator
  ) -FailureMessage "Nao foi possivel corrigir o validador acumulado."

  Write-Host ""
  Write-Host "==> Validando sintaxe e contrato do arquivo corrigido"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    "--check",
    $TargetValidator
  ) -FailureMessage "O validador corrigido possui erro de sintaxe."

  Invoke-CheckedCommand -Command $Node -Arguments @(
    $PatchScript,
    "verify",
    $TargetValidator
  ) -FailureMessage "A regra segura nao foi consolidada no validador."

  Write-Host ""
  Write-Host "==> Executando a verificacao de dependencias ja instaladas"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $TargetValidator,
    $ProjectRoot
  ) -FailureMessage "A arvore instalada ainda foi rejeitada pelo validador acumulado."

  $Succeeded = $true

  Write-Host ""
  Write-Host "HOTFIX 24.0.6 APLICADO COM SUCESSO"
  Write-Host "Versao: 1.5.0"
  Write-Host "Schema: 14 (congelado)"
  Write-Host "Backup: $BackupDir"
  Write-Host "Execute agora: .\25_VALIDAR_HOTFIX_24_0_6.cmd"
}
catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red

  $BackupValidator = Join-Path $BackupDir "validate-installed-dependencies.mjs"
  if (-not $Succeeded -and (Test-Path $BackupValidator)) {
    Copy-Item $BackupValidator $TargetValidator -Force
    Write-Host "O validador anterior foi restaurado a partir do backup."
    Write-Host "Backup: $BackupDir"
  }

  exit 1
}
