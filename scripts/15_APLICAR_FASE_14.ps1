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
  "src-tauri\migrations\0011_large_volume_performance.sql",
  "src-tauri\src\performance.rs",
  "lib\performance-engine.ts",
  "lib\desktop\performance.ts",
  "components\configuracoes\performance-panel.tsx",
  "tests\unit\performance-engine.test.ts"
)
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $Root $file))) { throw "Arquivo obrigatório da Fase 14 ausente: $file" }
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -notin @("0.13.0", "0.14.0")) {
  throw "A Fase 14 exige a base 0.13.0 validada. Versão atual: $($package.version)"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $Root ".phase-backup\fase-14-$stamp"
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
  Step "Atualizando a versão da aplicação para 0.14.0"
  node scripts\15_FINALIZAR_FASE_14.mjs $Root
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível alinhar as versões da Fase 14." }

  Step "Validando a estrutura mínima de grandes volumes"
  $migration = Read-Utf8Text "src-tauri\migrations\0011_large_volume_performance.sql"
  foreach ($table in @(
    "performance_preferences",
    "finance_transaction_index",
    "performance_index_state",
    "performance_operation_jobs",
    "performance_operation_metrics"
  )) {
    if ($migration -notmatch $table) { throw "A migration da Fase 14 não cria $table." }
  }

  $native = Read-Utf8Text "src-tauri\src\performance.rs"
  foreach ($command in @(
    "performance_list_transactions_page",
    "performance_rebuild_transaction_index",
    "performance_cancel_operation",
    "performance_run_database_maintenance",
    "performance_benchmark_transactions"
  )) {
    if ($native -notmatch $command) { throw "O módulo nativo de desempenho está incompleto: $command" }
  }

  $reconciliation = Read-Utf8Text "src-tauri\src\reconciliation.rs"
  foreach ($contract in @("operation_cancelled", "update_operation_progress", "batch_size")) {
    if ($reconciliation -notmatch $contract) { throw "A importação em lotes não contém $contract." }
  }

  Write-Host ""
  Write-Host "FASE 14 APLICADA COM SUCESSO" -ForegroundColor Green
  Write-Host "Versão: 0.14.0"
  Write-Host "Schema: 11"
  Write-Host "Execute agora: .\15_VALIDAR_FASE_14.cmd"
} catch {
  foreach ($file in $versionFiles) {
    $saved = Join-Path $backup $file
    if (Test-Path $saved) { Copy-Item $saved (Join-Path $Root $file) -Force }
  }
  throw
}
