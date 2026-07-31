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
if ($package.version -ne "0.17.0") {
  throw "A versão esperada para a Fase 17 é 0.17.0. Versão atual: $($package.version)"
}

Step "Executando a suíte completa de qualidade e segurança"
& (Join-Path $Root "08_VALIDAR_QUALIDADE.cmd")
if ($LASTEXITCODE -ne 0) { throw "A suíte completa encontrou uma regressão na Fase 17." }

Step "Confirmando schema 14 e persistência do guia"
$database = Read-Utf8Text "src-tauri\src\encrypted_database.rs"
if ($database -notmatch "CURRENT_SCHEMA_VERSION: i64 = 14") { throw "O núcleo SQLCipher não aponta para o schema 14." }
if ($database -notmatch "0014_guided_onboarding_and_contextual_help.sql") { throw "A migration do onboarding não foi registrada." }

$protection = Read-Utf8Text "src-tauri\src\protection.rs"
if ($protection -notmatch "CURRENT_SCHEMA_VERSION: i64 = 14") { throw "Backups e recuperação ainda não reconhecem o schema 14." }

$migration = Read-Utf8Text "src-tauri\migrations\0014_guided_onboarding_and_contextual_help.sql"
foreach ($contract in @(
  "onboarding_preferences",
  "onboarding_steps",
  "onboarding_events",
  "show_progress_dock",
  "contextual_help_enabled",
  "PRAGMA user_version = 14"
)) {
  if ($migration -notmatch [regex]::Escape($contract)) { throw "Contrato do schema 14 ausente: $contract" }
}

Step "Confirmando progresso real e proteção somente leitura"
$native = Read-Utf8Text "src-tauri\src\onboarding.rs"
foreach ($contract in @(
  "observed_completion",
  "account_count",
  "transaction_count",
  "budget_count",
  "security_ready",
  "backup_count",
  "state.access_status().read_only",
  "persisted",
  "ensure_database_writable"
)) {
  if ($native -notmatch [regex]::Escape($contract)) { throw "Contrato do motor de onboarding ausente: $contract" }
}
if ($native -match "INSERT INTO finance_documents" -or $native -match "UPDATE finance_documents" -or $native -match "DELETE FROM finance_documents") {
  throw "O onboarding não pode alterar documentos financeiros."
}

$syncStart = $native.IndexOf("pub fn onboarding_sync_progress")
$completeStart = $native.IndexOf("pub fn onboarding_complete_step", $syncStart)
if ($syncStart -lt 0 -or $completeStart -le $syncStart) { throw "A sincronização do onboarding não foi localizada." }
$syncBody = $native.Substring($syncStart, $completeStart - $syncStart)
$readOnlyIndex = $syncBody.IndexOf("if read_only")
$preferencesWriteIndex = $syncBody.IndexOf("ensure_preferences_row")
if ($readOnlyIndex -lt 0 -or $preferencesWriteIndex -lt 0 -or $readOnlyIndex -ge $preferencesWriteIndex) {
  throw "A sincronização precisa tratar o modo somente leitura antes de persistir o progresso."
}

Step "Confirmando comandos Tauri e integração da interface"
$lib = Read-Utf8Text "src-tauri\src\lib.rs"
foreach ($command in @(
  "onboarding_get_state",
  "onboarding_sync_progress",
  "onboarding_complete_step",
  "onboarding_skip_guide",
  "onboarding_reset_guide",
  "onboarding_save_preferences"
)) {
  if ($lib -notmatch $command) { throw "Comando nativo ausente: $command" }
}

$provider = Read-Utf8Text "components\onboarding\onboarding-provider.tsx"
foreach ($contract in @(
  "syncOnboardingProgress",
  "listNativeBackups",
  "securityReady",
  "finnacialux-onboarding-open-request",
  "finnacialux-contextual-help-enabled",
  "OnboardingProgressDock"
)) {
  if ($provider -notmatch [regex]::Escape($contract)) { throw "Integração do guia ausente: $contract" }
}

$experience = Read-Utf8Text "components\providers\desktop-experience-provider.tsx"
foreach ($contract in @(
  "findContextualHelp",
  "contextualHelpTopics",
  'event.key === "F1"',
  "event.shiftKey",
  "finnacialux-onboarding-open-request"
)) {
  if ($experience -notmatch [regex]::Escape($contract)) { throw "Experiência contextual ausente: $contract" }
}

$palette = Read-Utf8Text "components\desktop\desktop-command-palette.tsx"
foreach ($contract in @(
  "scoreCommandSearch",
  "finnacialux-command-history-v1",
  "category",
  "Buscar páginas, módulos, ações e ajuda"
)) {
  if ($palette -notmatch [regex]::Escape($contract)) { throw "Busca global incompleta: $contract" }
}

Step "Confirmando testes e documentação offline"
$tests = Read-Utf8Text "tests\unit\onboarding-engine.test.ts"
foreach ($contract in @(
  "createDefaultOnboardingSteps",
  "mergeObservedOnboardingProgress",
  "calculateOnboardingSummary",
  "findContextualHelp",
  "scoreCommandSearch"
)) {
  if ($tests -notmatch [regex]::Escape($contract)) { throw "A cobertura funcional não inclui: $contract" }
}

$help = Read-Utf8Text "content\ajuda.ts"
if ($help -notmatch [regex]::Escape('["F1", "Abrir ajuda da tela atual"]')) { throw "A central de ajuda não documenta o atalho contextual." }
if ($help -notmatch [regex]::Escape('["Shift + F1", "Abrir a central completa de ajuda"]')) { throw "A central de ajuda não documenta o manual completo." }

Write-Host ""
Write-Host "FASE 17 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 14"
Write-Host "Versão: 0.17.0"
Write-Host "Motor: onboarding, busca global, ajuda contextual, atalhos e experiência final validados."
Write-Host "Auditoria: nenhuma vulnerabilidade alta ou crítica."
