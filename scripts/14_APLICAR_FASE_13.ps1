$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Read-Utf8Text([string]$RelativePath) {
  $Path = Join-Path $Root $RelativePath
  if (-not (Test-Path -LiteralPath $Path)) { throw "Arquivo obrigatório não encontrado: $RelativePath" }
  return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

$required = @(
  "package-lock.json",
  "src-tauri\migrations\0010_bank_reconciliation_and_monthly_closing.sql",
  "src-tauri\src\reconciliation.rs",
  "lib\reconciliation-engine.ts",
  "lib\desktop\reconciliation.ts",
  "components\conciliacao\reconciliation-view.tsx",
  "tests\unit\reconciliation-engine.test.ts"
)
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $Root $file))) { throw "Arquivo obrigatório da Fase 13 ausente: $file" }
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -notin @("0.12.0", "0.13.0")) {
  throw "A Fase 13 exige a base 0.12.0 validada. Versão atual: $($package.version)"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $Root ".phase-backup\fase-13-$stamp"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$versionFiles = @("package.json", "package-lock.json", "src-tauri\Cargo.toml", "src-tauri\tauri.conf.json")
foreach ($file in $versionFiles) {
  $source = Join-Path $Root $file
  if (Test-Path $source) {
    $destination = Join-Path $backup $file
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item $source $destination -Force
  }
}

try {
  Step "Atualizando a versão da aplicação para 0.13.0"
  node scripts\14_FINALIZAR_FASE_13.mjs $Root
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível alinhar as versões da Fase 13." }

  Step "Validando a estrutura mínima da conciliação"
  $migration = Read-Utf8Text "src-tauri\migrations\0010_bank_reconciliation_and_monthly_closing.sql"
  foreach ($table in @(
    "reconciliation_preferences",
    "bank_statement_imports",
    "bank_statement_entries",
    "reconciliation_matches",
    "monthly_financial_closures",
    "monthly_closure_events",
    "reconciliation_evidence"
  )) {
    if ($migration -notmatch $table) { throw "A migration da Fase 13 não cria $table." }
  }

  $engine = Read-Utf8Text "lib\reconciliation-engine.ts"
  foreach ($symbol in @(
    "prepareStatementEntries",
    "scoreStatementMatch",
    "buildLocalReconciliationPreview",
    "calculateClosureMovements",
    "buildLocalClosurePreview"
  )) {
    if ($engine -notmatch $symbol) { throw "O motor local não contém $symbol." }
  }

  $native = Read-Utf8Text "src-tauri\src\reconciliation.rs"
  foreach ($command in @(
    "reconciliation_preview_import",
    "reconciliation_apply_import",
    "reconciliation_undo_import",
    "reconciliation_close_month",
    "reconciliation_reopen_month",
    "reconciliation_save_evidence",
    "reconciliation_read_evidence"
  )) {
    if ($native -notmatch $command) { throw "A persistência nativa está incompleta: $command" }
  }

  Write-Host ""
  Write-Host "FASE 13 APLICADA COM SUCESSO" -ForegroundColor Green
  Write-Host "Versão: 0.13.0"
  Write-Host "Schema: 10"
  Write-Host "Execute agora: .\14_VALIDAR_FASE_13.cmd"
} catch {
  foreach ($file in $versionFiles) {
    $saved = Join-Path $backup $file
    if (Test-Path $saved) { Copy-Item $saved (Join-Path $Root $file) -Force }
  }
  throw
}
