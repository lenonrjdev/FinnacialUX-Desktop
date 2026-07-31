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
if ($package.version -ne "0.13.0") {
  throw "A versão esperada para a Fase 13 é 0.13.0. Versão atual: $($package.version)"
}

Step "Executando a suíte completa de qualidade e segurança"
& (Join-Path $Root "08_VALIDAR_QUALIDADE.cmd")
if ($LASTEXITCODE -ne 0) { throw "A suíte completa encontrou uma regressão na Fase 13." }

Step "Confirmando schema 10 e comandos nativos"
$database = Read-Utf8Text "src-tauri\src\encrypted_database.rs"
if ($database -notmatch "CURRENT_SCHEMA_VERSION: i64 = 10") { throw "O núcleo SQLCipher não aponta para o schema 10." }
if ($database -notmatch "0010_bank_reconciliation_and_monthly_closing.sql") { throw "A migration da conciliação não foi registrada." }
if ($database -notmatch "guard_finance_document_sql_write") { throw "A gravação comum não respeita o bloqueio dos meses fechados." }

$protection = Read-Utf8Text "src-tauri\src\protection.rs"
if ($protection -notmatch "CURRENT_SCHEMA_VERSION: i64 = 10") { throw "Backups e integridade ainda não reconhecem o schema 10." }

$lib = Read-Utf8Text "src-tauri\src\lib.rs"
foreach ($command in @(
  "reconciliation_get_preferences",
  "reconciliation_save_preferences",
  "reconciliation_preview_import",
  "reconciliation_apply_import",
  "reconciliation_list_imports",
  "reconciliation_undo_import",
  "reconciliation_preview_closure",
  "reconciliation_close_month",
  "reconciliation_list_closures",
  "reconciliation_reopen_month",
  "reconciliation_list_events",
  "reconciliation_save_evidence",
  "reconciliation_list_evidence",
  "reconciliation_read_evidence",
  "reconciliation_delete_evidence"
)) {
  if ($lib -notmatch $command) { throw "Comando nativo ausente: $command" }
}

Step "Confirmando correspondência, fechamento e proteção transversal"
$tests = Read-Utf8Text "tests\unit\reconciliation-engine.test.ts"
foreach ($contract in @(
  "prepareStatementEntries",
  "scoreStatementMatch",
  "buildLocalReconciliationPreview",
  "calculateClosureMovements",
  "buildLocalClosurePreview",
  "toBe\(true\)",
  "toBe\(false\)"
)) {
  if ($tests -notmatch $contract) { throw "A cobertura funcional da conciliação está incompleta: $contract" }
}

$native = Read-Utf8Text "src-tauri\src\reconciliation.rs"
foreach ($protectionContract in @(
  "ensure_transaction_document_change_allowed",
  "after_transactions_checksum",
  "source_checksum",
  "status = 'closed'",
  "reopening_reason",
  "content_blob"
)) {
  if ($native -notmatch $protectionContract) { throw "Proteção nativa ausente: $protectionContract" }
}

$automations = Read-Utf8Text "src-tauri\src\automations.rs"
$portability = Read-Utf8Text "src-tauri\src\portability.rs"
if ($automations -notmatch "ensure_transaction_document_change_allowed") { throw "Automações podem contornar meses fechados." }
if ($portability -notmatch "ensure_transaction_document_change_allowed") { throw "Portabilidade pode contornar meses fechados." }

Write-Host ""
Write-Host "FASE 13 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 10"
Write-Host "Versão: 0.13.0"
Write-Host "Motor: CSV/OFX, correspondências, desfazer, fechamento, reabertura e comprovantes validados."
Write-Host "Auditoria: nenhuma vulnerabilidade alta ou crítica."
