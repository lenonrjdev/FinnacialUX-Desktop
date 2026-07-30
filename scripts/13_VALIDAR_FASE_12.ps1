$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Read-Utf8Text([string]$RelativePath) {
  $Path = Join-Path $Root $RelativePath
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Arquivo obrigatório não encontrado: $RelativePath"
  }

  return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -ne "0.12.0") {
  throw "A versão esperada para a Fase 12 é 0.12.0. Versão atual: $($package.version)"
}

Step "Executando a suíte completa de qualidade e segurança"
& (Join-Path $Root "08_VALIDAR_QUALIDADE.cmd")
if ($LASTEXITCODE -ne 0) { throw "A suíte completa encontrou uma regressão na Fase 12." }

Step "Confirmando schema 9 e comandos nativos"
$databaseSource = Read-Utf8Text "src-tauri\src\encrypted_database.rs"
if ($databaseSource -notmatch "CURRENT_SCHEMA_VERSION: i64 = 9") { throw "O núcleo SQLCipher não aponta para o schema 9." }
if ($databaseSource -notmatch "0009_decision_oriented_financial_planning.sql") { throw "A migration do planejamento não foi registrada no núcleo SQLCipher." }
$protectionSource = Read-Utf8Text "src-tauri\src\protection.rs"
if ($protectionSource -notmatch "CURRENT_SCHEMA_VERSION: i64 = 9") { throw "Backups e integridade ainda não reconhecem o schema 9." }
$libSource = Read-Utf8Text "src-tauri\src\lib.rs"
foreach ($command in @(
  "planning_get_preferences",
  "planning_save_preferences",
  "planning_list_plans",
  "planning_save_plan",
  "planning_activate_plan",
  "planning_archive_plan",
  "planning_record_review",
  "planning_list_reviews",
  "planning_list_decisions",
  "planning_save_decision",
  "planning_update_decision_status",
  "planning_delete_decision"
)) {
  if ($libSource -notmatch $command) { throw "Comando nativo ausente: $command" }
}

Step "Confirmando testes e proteções do motor"
$tests = Read-Utf8Text "tests\unit\planning-engine.test.ts"
$expectations = @(
  @{ Label = "margem flexível"; Pattern = "monthlyFlexible" },
  @{ Label = "distribuição de 100%"; Pattern = "toBe\(100\)" },
  @{ Label = "estratégia avalanche"; Pattern = "avalanche" },
  @{ Label = "revisão mensal"; Pattern = 'kind === "review"' },
  @{ Label = "checksum determinístico"; Pattern = "createPlanningChecksum" }
)
foreach ($expectation in $expectations) {
  if ($tests -notmatch $expectation.Pattern) {
    throw "A cobertura funcional não inclui: $($expectation.Label)"
  }
}

$native = Read-Utf8Text "src-tauri\src\planning.rs"
if ($native -notmatch "ensure_database_writable" -or $native -notmatch "stored_source != request.source_checksum") {
  throw "As proteções nativas do planejamento estão incompletas."
}

$engine = Read-Utf8Text "lib\planning-engine.ts"
if ($engine -notmatch "canActivate" -or $engine -notmatch "monthlyFlexible" -or $engine -notmatch "createPlanningChecksum") {
  throw "A simulação não preserva os contratos de ativação, margem e checksum."
}

Write-Host ""
Write-Host "FASE 12 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 9"
Write-Host "Versão: 0.12.0"
Write-Host "Motor: envelopes, limites, dívidas, metas, revisão e decisões validados."
Write-Host "Auditoria: nenhuma vulnerabilidade alta ou crítica."
