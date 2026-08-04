$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PatchScript = Join-Path $PSScriptRoot "25_PATCH_CODE_SIGNING_EKU_SAFE.mjs"
$SigningLibrary = Join-Path $ProjectRoot "scripts\windows-signing.ps1"
$EnvironmentValidator = Join-Path $ProjectRoot "scripts\25_VALIDAR_AMBIENTE_ASSINATURA_WINDOWS.ps1"
$LocalConfig = Join-Path $ProjectRoot "release\windows-signing.local.json"
$PackageJson = Join-Path $ProjectRoot "package.json"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $ProjectRoot ".dependency-backup\hotfix-24-0-9-$Timestamp"
$Succeeded = $false

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$FailureMessage
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw $FailureMessage }
}

try {
  Set-Location $ProjectRoot

  Write-Host "FINNACIALUX DESKTOP - HOTFIX 24.0.9 - LEITURA SEGURA DO EKU"
  Write-Host "Raiz: $ProjectRoot"
  Write-Host "Versao esperada: 1.5.0"
  Write-Host "Schema esperado: 14 (congelado)"
  Write-Host "Certificado e configuracao local serao preservados."
  Write-Host ""

  foreach ($RequiredFile in @($PatchScript, $SigningLibrary, $EnvironmentValidator, $LocalConfig, $PackageJson)) {
    if (-not (Test-Path $RequiredFile)) { throw "Arquivo obrigatorio nao encontrado: $RequiredFile" }
  }

  $Manifest = Get-Content $PackageJson -Raw | ConvertFrom-Json
  if ($Manifest.version -ne "1.5.0") {
    throw "Versao inesperada do projeto: $($Manifest.version). Esperado: 1.5.0."
  }

  $Node = (Get-Command node.exe -ErrorAction Stop).Source
  New-Item -ItemType Directory -Path (Join-Path $BackupDir "scripts") -Force | Out-Null
  Copy-Item $SigningLibrary (Join-Path $BackupDir "scripts\windows-signing.ps1") -Force

  Write-Host "==> Aplicando leitura segura do certificado e dos OIDs"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $PatchScript,
    "apply",
    $ProjectRoot
  ) -FailureMessage "Nao foi possivel corrigir a leitura segura do EKU."

  Write-Host ""
  Write-Host "==> Confirmando o contrato do patch"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    "--check",
    $PatchScript
  ) -FailureMessage "O script de patch possui erro de sintaxe."

  Invoke-CheckedCommand -Command $Node -Arguments @(
    $PatchScript,
    "verify",
    $ProjectRoot
  ) -FailureMessage "A correcao segura do EKU nao atende ao contrato esperado."

  Write-Host ""
  Write-Host "==> Validando o certificado configurado pelo filtro nativo do Windows"
  & $EnvironmentValidator -RequireReady
  if ($LASTEXITCODE -ne 0) {
    throw "O ambiente de assinatura ainda nao foi aprovado depois da correcao segura do EKU."
  }

  $Succeeded = $true
  Write-Host ""
  Write-Host "HOTFIX 24.0.9 APLICADO COM SUCESSO"
  Write-Host "Versao: 1.5.0"
  Write-Host "Schema: 14 (congelado)"
  Write-Host "Certificado: preservado"
  Write-Host "Configuracao local: preservada"
  Write-Host "Backup: $BackupDir"
  Write-Host "Execute agora: .\25_VALIDAR_HOTFIX_24_0_9.cmd"
}
catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red

  if (-not $Succeeded -and (Test-Path $BackupDir)) {
    $BackupFile = Join-Path $BackupDir "scripts\windows-signing.ps1"
    if (Test-Path $BackupFile) {
      Copy-Item $BackupFile $SigningLibrary -Force
      Write-Host "O arquivo anterior foi restaurado a partir do backup."
      Write-Host "Backup: $BackupDir"
    }
  }

  exit 1
}
