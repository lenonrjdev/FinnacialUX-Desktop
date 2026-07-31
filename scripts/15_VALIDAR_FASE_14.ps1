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

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -ne "0.14.0") {
  throw "A versão esperada para a Fase 14 é 0.14.0. Versão atual: $($package.version)"
}

Step "Executando a suíte completa de qualidade e segurança"
& (Join-Path $Root "08_VALIDAR_QUALIDADE.cmd")
if ($LASTEXITCODE -ne 0) { throw "A suíte completa encontrou uma regressão na Fase 14." }

Step "Confirmando schema 11 e paginação nativa"
$database = Read-Utf8Text "src-tauri\src\encrypted_database.rs"
if ($database -notmatch "CURRENT_SCHEMA_VERSION: i64 = 11") { throw "O núcleo SQLCipher não aponta para o schema 11." }
if ($database -notmatch "0011_large_volume_performance.sql") { throw "A migration de desempenho não foi registrada." }

$protection = Read-Utf8Text "src-tauri\src\protection.rs"
if ($protection -notmatch "CURRENT_SCHEMA_VERSION: i64 = 11") { throw "Backups e integridade ainda não reconhecem o schema 11." }

$lib = Read-Utf8Text "src-tauri\src\lib.rs"
foreach ($command in @(
  "performance_get_preferences",
  "performance_save_preferences",
  "performance_list_transactions_page",
  "performance_rebuild_transaction_index",
  "performance_cancel_operation",
  "performance_list_operations",
  "performance_list_metrics",
  "performance_get_database_health",
  "performance_run_database_maintenance",
  "performance_benchmark_transactions"
)) {
  if ($lib -notmatch $command) { throw "Comando nativo ausente: $command" }
}

Step "Confirmando índices, lotes e cancelamento"
$migration = Read-Utf8Text "src-tauri\migrations\0011_large_volume_performance.sql"
foreach ($contract in @(
  "idx_transaction_index_workspace_date",
  "idx_transaction_index_workspace_account_date",
  "idx_bank_statement_entries_import_posted",
  "PRAGMA user_version = 11"
)) {
  if ($migration -notmatch $contract) { throw "Contrato de índice ausente: $contract" }
}

$native = Read-Utf8Text "src-tauri\src\performance.rs"
foreach ($contract in @(
  "finance_transaction_index",
  "fallback_page",
  "rebuild_index_internal",
  "transaction_document_updated_at",
  "source_updated_at",
  "performance://progress",
  "wal_checkpoint",
  "ANALYZE",
  "PRAGMA optimize"
)) {
  if ($native -notmatch [regex]::Escape($contract)) { throw "Contrato de desempenho ausente: $contract" }
}

$reconciliation = Read-Utf8Text "src-tauri\src\reconciliation.rs"
foreach ($contract in @(
  "operation_id",
  "batch_size",
  "operation_cancelled",
  "finish_operation",
  "update_operation_progress",
  '"cancelled"'
)) {
  if ($reconciliation -notmatch [regex]::Escape($contract)) {
    throw "Contrato estrutural de importacao em lotes ausente: $contract"
  }
}

# O cancelamento precisa ser consultado antes da validacao que antecede a
# gravacao atomica do documento financeiro. A verificacao por identificadores
# evita depender de frases acentuadas interpretadas de forma diferente pelo
# Windows PowerShell 5.1.
$cancelCheckIndex = $reconciliation.IndexOf("operation_cancelled")
$writeGuardIndex = $reconciliation.IndexOf("ensure_transaction_document_change_allowed")
if ($cancelCheckIndex -lt 0 -or $writeGuardIndex -lt 0 -or $cancelCheckIndex -ge $writeGuardIndex) {
  throw "O cancelamento da importacao nao esta comprovadamente antes da gravacao atomica."
}

$tests = Read-Utf8Text "tests\unit\performance-engine.test.ts"
foreach ($contract in @(
  "buildBatchPlan",
  "normalizePageSize",
  "calculateReusablePercent",
  "summarizeBenchmark",
  "databaseHealthLabel"
)) {
  if ($tests -notmatch $contract) { throw "A cobertura funcional não inclui: $contract" }
}

Write-Host ""
Write-Host "FASE 14 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 11"
Write-Host "Versão: 0.14.0"
Write-Host "Motor: paginação, índices, lotes, cancelamento, métricas e manutenção validados."
Write-Host "Auditoria: nenhuma vulnerabilidade alta ou crítica."
