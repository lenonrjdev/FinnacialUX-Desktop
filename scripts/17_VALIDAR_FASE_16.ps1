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
if ($package.version -ne "0.16.0") {
  throw "A versão esperada para a Fase 16 é 0.16.0. Versão atual: $($package.version)"
}

Step "Executando a suíte completa de qualidade e segurança"
& (Join-Path $Root "08_VALIDAR_QUALIDADE.cmd")
if ($LASTEXITCODE -ne 0) { throw "A suíte completa encontrou uma regressão na Fase 16." }

Step "Confirmando schema 13 e histórico técnico"
$database = Read-Utf8Text "src-tauri\src\encrypted_database.rs"
if ($database -notmatch "CURRENT_SCHEMA_VERSION: i64 = 13") { throw "O núcleo SQLCipher não aponta para o schema 13." }
if ($database -notmatch "0013_local_diagnostics_and_support.sql") { throw "A migration de diagnóstico não foi registrada." }

$protection = Read-Utf8Text "src-tauri\src\protection.rs"
if ($protection -notmatch "CURRENT_SCHEMA_VERSION: i64 = 13") { throw "Backups e recuperação ainda não reconhecem o schema 13." }
if ($protection -notmatch "sanitize_log_line") { throw "O exportador legado não reutiliza a sanitização de logs." }
if ($protection -match [regex]::Escape('"diagnostics": report')) { throw "O exportador legado ainda serializa caminhos internos completos." }

$migration = Read-Utf8Text "src-tauri\migrations\0013_local_diagnostics_and_support.sql"
foreach ($contract in @(
  "diagnostic_preferences",
  "diagnostic_runs",
  "diagnostic_checks",
  "diagnostic_repairs",
  "support_package_exports",
  "diagnostic_probe",
  "PRAGMA user_version = 13"
)) {
  if ($migration -notmatch [regex]::Escape($contract)) { throw "Contrato do schema 13 ausente: $contract" }
}

Step "Confirmando auditoria, ensaio de restauração e privacidade"
$native = Read-Utf8Text "src-tauri\src\diagnostics.rs"
foreach ($contract in @(
  "PRAGMA quick_check",
  "PRAGMA foreign_key_check",
  "diagnostic_probe",
  "transaction.rollback().await",
  "export_plaintext_snapshot",
  "diagnostic-restore-drill.sqlite",
  "sanitize_log_line",
  '"<path>"',
  '"<email>"',
  '"<token>"',
  "finnacialux-support-package",
  "payloadSha256",
  "diagnostics_validate_support_package"
)) {
  if ($native -notmatch [regex]::Escape($contract)) { throw "Contrato do diagnóstico ausente: $contract" }
}

$readWriteStart = $native.IndexOf("async fn collect_read_write_check")
$readWriteEnd = $native.IndexOf("async fn collect_restore_drill_check", $readWriteStart)
if ($readWriteStart -lt 0 -or $readWriteEnd -le $readWriteStart) {
  throw "O teste reversível de escrita não foi localizado."
}
$readWriteBody = $native.Substring($readWriteStart, $readWriteEnd - $readWriteStart)
$readOnlyIndex = $readWriteBody.IndexOf("state.access_status().read_only")
$beginIndex = $readWriteBody.IndexOf("connection.begin()")
$rollbackIndex = $readWriteBody.IndexOf("transaction.rollback()")
if ($readOnlyIndex -lt 0 -or $beginIndex -lt 0 -or $rollbackIndex -lt 0 -or $readOnlyIndex -ge $beginIndex -or $beginIndex -ge $rollbackIndex) {
  throw "O modo somente leitura e o rollback não protegem corretamente o teste de escrita."
}

$restoreStart = $native.IndexOf("async fn collect_restore_drill_check")
$restoreEnd = $native.IndexOf("async fn collect_checks", $restoreStart)
if ($restoreStart -lt 0 -or $restoreEnd -le $restoreStart) {
  throw "O ensaio de restauração não foi localizado."
}
$restoreBody = $native.Substring($restoreStart, $restoreEnd - $restoreStart)
if ($restoreBody -notmatch "TempDir::new" -or $restoreBody -notmatch "export_plaintext_snapshot" -or $restoreBody -match "replace_from_plaintext_snapshot") {
  throw "O ensaio de restauração deve usar um snapshot temporário sem substituir o banco real."
}

Step "Confirmando reparos seguros e comandos Tauri"
foreach ($repair in @(
  "optimize_database",
  "release_stale_tasks",
  "refresh_file_health",
  "clear_old_logs"
)) {
  if ($native -notmatch $repair) { throw "Reparo seguro ausente: $repair" }
}
if ($native -match "DELETE FROM finance_documents" -or $native -match "UPDATE finance_documents") {
  throw "O módulo de diagnóstico não pode alterar documentos financeiros."
}

$lib = Read-Utf8Text "src-tauri\src\lib.rs"
foreach ($command in @(
  "diagnostics_preview",
  "diagnostics_run_suite",
  "diagnostics_list_runs",
  "diagnostics_list_repairs",
  "diagnostics_apply_repair",
  "diagnostics_export_support_package",
  "diagnostics_validate_support_package"
)) {
  if ($lib -notmatch $command) { throw "Comando nativo ausente: $command" }
}

Step "Confirmando interface, contratos e testes"
$panel = Read-Utf8Text "components\configuracoes\diagnostics-panel.tsx"
foreach ($contract in @(
  "runDiagnosticSuite",
  "applyDiagnosticRepair",
  "exportSupportPackage",
  "validateSupportPackage",
  "formatDiagnosticSummary",
  "confirmSensitiveAction"
)) {
  if ($panel -notmatch $contract) { throw "Integração da central de diagnóstico ausente: $contract" }
}

$tests = Read-Utf8Text "tests\unit\diagnostic-engine.test.ts"
foreach ($contract in @(
  "diagnosticHealthLabel",
  "groupDiagnosticChecks",
  "recommendedRepairs",
  "formatDiagnosticSummary",
  "supportPackageFileName"
)) {
  if ($tests -notmatch $contract) { throw "A cobertura funcional não inclui: $contract" }
}

Write-Host ""
Write-Host "FASE 16 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 13"
Write-Host "Versão: 0.16.0"
Write-Host "Motor: SQLCipher, Stronghold, restauração temporária, reparos e pacote de suporte validados."
Write-Host "Auditoria: nenhuma vulnerabilidade alta ou crítica."
