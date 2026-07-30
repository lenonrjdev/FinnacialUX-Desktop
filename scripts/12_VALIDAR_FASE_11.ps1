$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -ne "0.11.0") {
  throw "A versao esperada para a Fase 11 e 0.11.0. Versao atual: $($package.version)"
}

Step "Executando a suite completa de qualidade e seguranca"
& (Join-Path $Root "08_VALIDAR_QUALIDADE.cmd")
if ($LASTEXITCODE -ne 0) { throw "A suite completa encontrou uma regressao na Fase 11." }

Step "Confirmando schema 8 e comandos nativos"
$databaseSource = Get-Content (Join-Path $Root "src-tauri\src\encrypted_database.rs") -Raw
if ($databaseSource -notmatch "CURRENT_SCHEMA_VERSION: i64 = 8") {
  throw "O nucleo SQLCipher nao aponta para o schema 8."
}
if ($databaseSource -notmatch "0008_local_financial_intelligence.sql") {
  throw "A migration da inteligencia nao foi registrada no nucleo SQLCipher."
}
$protectionSource = Get-Content (Join-Path $Root "src-tauri\src\protection.rs") -Raw
if ($protectionSource -notmatch "CURRENT_SCHEMA_VERSION: i64 = 8") {
  throw "O modulo de backups e integridade ainda nao reconhece o schema 8."
}
$libSource = Get-Content (Join-Path $Root "src-tauri\src\lib.rs") -Raw
foreach ($command in @(
  "intelligence_get_preferences",
  "intelligence_save_preferences",
  "intelligence_list_scenarios",
  "intelligence_save_scenario",
  "intelligence_delete_scenario",
  "intelligence_record_snapshot",
  "intelligence_list_snapshots"
)) {
  if ($libSource -notmatch $command) { throw "Comando nativo ausente: $command" }
}

Step "Confirmando testes e protecoes do motor"
$tests = Get-Content (Join-Path $Root "tests\unit\intelligence-engine.test.ts") -Raw
foreach ($expectation in @("saldo negativo", "checksum", "gasto", "meta")) {
  if ($tests -notmatch $expectation) { throw "A cobertura funcional nao inclui: $expectation" }
}
$native = Get-Content (Join-Path $Root "src-tauri\src\intelligence.rs") -Raw
if ($native -notmatch "ensure_database_writable" -or $native -notmatch "validate_assumptions") {
  throw "As protecoes nativas da inteligencia local estao incompletas."
}

Write-Host ""
Write-Host "FASE 11 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 8"
Write-Host "Versao: 0.11.0"
Write-Host "Motor: projecao, cenarios, simulador, riscos e anomalias validados."
Write-Host "Auditoria: nenhuma vulnerabilidade alta ou critica."
