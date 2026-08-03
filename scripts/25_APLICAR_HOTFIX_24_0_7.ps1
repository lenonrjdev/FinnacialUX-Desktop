$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PatchScript = Join-Path $PSScriptRoot "25_PATCH_WINDOWS_SIGNING_SANITIZER.mjs"
$PackageJson = Join-Path $ProjectRoot "package.json"
$EngineFile = Join-Path $ProjectRoot "lib\windows-signing-engine.ts"
$TestFile = Join-Path $ProjectRoot "tests\unit\windows-signing-engine.test.ts"
$WindowsScript = Join-Path $ProjectRoot "scripts\windows-signing.mjs"
$VitestCli = Join-Path $ProjectRoot "node_modules\vitest\vitest.mjs"
$EslintCli = Join-Path $ProjectRoot "node_modules\eslint\bin\eslint.js"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $ProjectRoot ".dependency-backup\hotfix-24-0-7-$Timestamp"
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

  Write-Host "FINNACIALUX DESKTOP - HOTFIX 24.0.7 - SANITIZACAO DA ASSINATURA WINDOWS"
  Write-Host "Raiz: $ProjectRoot"
  Write-Host "Versao esperada: 1.5.0"
  Write-Host "Schema esperado: 14 (congelado)"
  Write-Host "Dependencias e lockfile nao serao alterados."
  Write-Host ""

  foreach ($RequiredFile in @($PackageJson, $EngineFile, $TestFile, $WindowsScript, $PatchScript, $VitestCli, $EslintCli)) {
    if (-not (Test-Path $RequiredFile)) {
      throw "Arquivo obrigatorio nao encontrado: $RequiredFile"
    }
  }

  $Manifest = Get-Content $PackageJson -Raw | ConvertFrom-Json
  if ($Manifest.version -ne "1.5.0") {
    throw "Versao inesperada do projeto: $($Manifest.version). Esperado: 1.5.0."
  }

  $Node = (Get-Command node.exe -ErrorAction Stop).Source

  New-Item -ItemType Directory -Path (Join-Path $BackupDir "lib") -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $BackupDir "tests\unit") -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $BackupDir "scripts") -Force | Out-Null
  Copy-Item $EngineFile (Join-Path $BackupDir "lib\windows-signing-engine.ts") -Force
  Copy-Item $TestFile (Join-Path $BackupDir "tests\unit\windows-signing-engine.test.ts") -Force
  Copy-Item $WindowsScript (Join-Path $BackupDir "scripts\windows-signing.mjs") -Force

  Write-Host "==> Corrigindo a ordem e os limites da sanitizacao"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $PatchScript,
    "apply",
    $ProjectRoot
  ) -FailureMessage "Nao foi possivel corrigir a sanitizacao da assinatura Windows."

  Write-Host ""
  Write-Host "==> Validando sintaxe e contrato da correcao"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    "--check",
    $PatchScript
  ) -FailureMessage "O script de patch possui erro de sintaxe."

  Invoke-CheckedCommand -Command $Node -Arguments @(
    "--check",
    $WindowsScript
  ) -FailureMessage "O script Windows corrigido possui erro de sintaxe."

  Invoke-CheckedCommand -Command $Node -Arguments @(
    $PatchScript,
    "verify",
    $ProjectRoot
  ) -FailureMessage "A correcao nao atende ao contrato de sanitizacao."

  Write-Host ""
  Write-Host "==> Executando o teste unitario direcionado"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $VitestCli,
    "run",
    "tests/unit/windows-signing-engine.test.ts"
  ) -FailureMessage "O teste unitario da assinatura Windows ainda falhou."

  Write-Host ""
  Write-Host "==> Executando ESLint somente nos arquivos alterados"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $EslintCli,
    "lib/windows-signing-engine.ts",
    "tests/unit/windows-signing-engine.test.ts",
    "scripts/windows-signing.mjs",
    "--max-warnings=0"
  ) -FailureMessage "Os arquivos alterados ainda possuem erro ou aviso de lint."

  $Succeeded = $true

  Write-Host ""
  Write-Host "HOTFIX 24.0.7 APLICADO COM SUCESSO"
  Write-Host "Versao: 1.5.0"
  Write-Host "Schema: 14 (congelado)"
  Write-Host "Dependencias: preservadas"
  Write-Host "Backup: $BackupDir"
  Write-Host "Execute agora: .\25_VALIDAR_HOTFIX_24_0_7.cmd"
}
catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red

  if (-not $Succeeded -and (Test-Path $BackupDir)) {
    $BackupEngine = Join-Path $BackupDir "lib\windows-signing-engine.ts"
    $BackupTest = Join-Path $BackupDir "tests\unit\windows-signing-engine.test.ts"
    $BackupWindowsScript = Join-Path $BackupDir "scripts\windows-signing.mjs"
    if (Test-Path $BackupEngine) { Copy-Item $BackupEngine $EngineFile -Force }
    if (Test-Path $BackupTest) { Copy-Item $BackupTest $TestFile -Force }
    if (Test-Path $BackupWindowsScript) { Copy-Item $BackupWindowsScript $WindowsScript -Force }
    Write-Host "Os tres arquivos anteriores foram restaurados a partir do backup."
    Write-Host "Backup: $BackupDir"
  }

  exit 1
}
