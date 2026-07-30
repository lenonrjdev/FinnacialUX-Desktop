$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -ne "0.10.0") { throw "Versao esperada 0.10.0; encontrada $($package.version)." }

Write-Host "FINNACIALUX DESKTOP - FASE 10 - VALIDACAO COMPLETA" -ForegroundColor Green
& (Join-Path $Root "08_VALIDAR_QUALIDADE.cmd")
if ($LASTEXITCODE -ne 0) { throw "A suite completa encontrou uma regressao na Fase 10." }

$required = @(
  "src-tauri\migrations\0007_local_automation_engine.sql",
  "src-tauri\src\automations.rs",
  "tests\unit\automation-engine.test.ts",
  "components\dados-e-automacoes\automation-center-panel.tsx"
)
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $Root $file))) { throw "Artefato da Fase 10 ausente: $file" }
}

$databaseSource = Get-Content (Join-Path $Root "src-tauri\src\encrypted_database.rs") -Raw
if ($databaseSource -notmatch "CURRENT_SCHEMA_VERSION: i64 = 7") {
  throw "O nucleo SQLCipher nao aponta para o schema 7."
}
if ($databaseSource -notmatch "0007_local_automation_engine.sql") {
  throw "A migration 7 nao esta registrada no nucleo SQLCipher."
}
$protectionSource = Get-Content (Join-Path $Root "src-tauri\src\protection.rs") -Raw
if ($protectionSource -notmatch "CURRENT_SCHEMA_VERSION: i64 = 7") {
  throw "O modulo de backups e integridade ainda nao reconhece o schema 7."
}
$automationSource = Get-Content (Join-Path $Root "src-tauri\src\automations.rs") -Raw
if ($automationSource -notmatch "build_history_suggestion_candidates") {
  throw "As sugestoes conservadoras pelo historico nao foram registradas no motor."
}

Write-Host ""
Write-Host "FASE 10 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 7"
Write-Host "Versao: 0.10.0"
Write-Host "Motor: simulacao, checksum, aplicacao atomica e desfazer validados."
Write-Host "Auditoria: 0 vulnerabilidades altas ou criticas."
