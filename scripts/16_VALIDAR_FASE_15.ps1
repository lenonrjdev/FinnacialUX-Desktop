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
if ($package.version -ne "0.15.0") {
  throw "A versão esperada para a Fase 15 é 0.15.0. Versão atual: $($package.version)"
}

Step "Executando a suíte completa de qualidade e segurança"
& (Join-Path $Root "08_VALIDAR_QUALIDADE.cmd")
if ($LASTEXITCODE -ne 0) { throw "A suíte completa encontrou uma regressão na Fase 15." }

Step "Confirmando schema 12 e fila persistente"
$database = Read-Utf8Text "src-tauri\src\encrypted_database.rs"
if ($database -notmatch "CURRENT_SCHEMA_VERSION: i64 = 12") { throw "O núcleo SQLCipher não aponta para o schema 12." }
if ($database -notmatch "0012_local_background_tasks_and_notifications.sql") { throw "A migration das rotinas não foi registrada." }

$protection = Read-Utf8Text "src-tauri\src\protection.rs"
if ($protection -notmatch "CURRENT_SCHEMA_VERSION: i64 = 12") { throw "Backups e recuperação ainda não reconhecem o schema 12." }

$migration = Read-Utf8Text "src-tauri\migrations\0012_local_background_tasks_and_notifications.sql"
foreach ($contract in @(
  "background_task_preferences",
  "background_task_queue",
  "background_task_runs",
  "background_notification_outbox",
  "background_scheduler_leases",
  "UNIQUE (workspace_id, dedup_key)",
  "PRAGMA user_version = 12"
)) {
  if ($migration -notmatch [regex]::Escape($contract)) { throw "Contrato do schema 12 ausente: $contract" }
}

Step "Confirmando agendador, concorrência e tentativas"
$native = Read-Utf8Text "src-tauri\src\background_tasks.rs"
foreach ($contract in @(
  "BackgroundSchedulerState",
  "acquire_lease",
  "release_lease",
  "retry_delay_minutes",
  "task_dedup_key",
  "enabled_task_kinds",
  "claim_next_task",
  "finish_task_failure",
  "database.access_status().read_only",
  "is_quiet_hours",
  "simulate_automation_preview",
  "background_notification_outbox",
  "finnacialux-background-notification"
)) {
  if ($native -notmatch [regex]::Escape($contract)) { throw "Contrato nativo das rotinas ausente: $contract" }
}

$runStart = $native.IndexOf("async fn run_due_tasks_internal")
$runEnd = $native.IndexOf("#[tauri::command", $runStart)
if ($runStart -lt 0 -or $runEnd -le $runStart) {
  throw "A função principal das rotinas não foi localizada para validar o modo somente leitura."
}
$runBody = $native.Substring($runStart, $runEnd - $runStart)
$readOnlyIndex = $runBody.IndexOf("database.access_status().read_only")
$queueIndex = $runBody.IndexOf("enqueue_due_tasks(")
if ($readOnlyIndex -lt 0 -or $queueIndex -lt 0 -or $readOnlyIndex -ge $queueIndex) {
  throw "O bloqueio de somente leitura não está comprovadamente antes da criação da fila."
}

$lib = Read-Utf8Text "src-tauri\src\lib.rs"
foreach ($command in @(
  "background_get_preferences",
  "background_save_preferences",
  "background_start_scheduler",
  "background_stop_scheduler",
  "background_run_due_tasks",
  "background_get_status",
  "background_list_tasks",
  "background_list_runs",
  "background_cancel_task",
  "background_retry_task",
  "background_list_notifications",
  "background_flush_notifications",
  "background_ack_notification"
)) {
  if ($lib -notmatch $command) { throw "Comando nativo ausente: $command" }
}

Step "Confirmando inicialização, notificações e segurança financeira"
$provider = Read-Utf8Text "components\providers\background-tasks-provider.tsx"
foreach ($contract in @(
  "window.setInterval",
  "listenBackgroundNotifications",
  "sendNativeNotification",
  "acknowledgeBackgroundNotification",
  "finnacialux-background-preferences-updated",
  "finnacialux-background-updated"
)) {
  if ($provider -notmatch [regex]::Escape($contract)) { throw "Integração do provedor ausente: $contract" }
}

$refreshStart = $provider.IndexOf("const refreshPreferences = async (runStartup: boolean)")
$refreshEnd = $provider.IndexOf("const unlisteners", $refreshStart)
if ($refreshStart -lt 0 -or $refreshEnd -le $refreshStart) {
  throw "O fluxo de configuração do agendador não foi localizado no provedor."
}
$refreshBody = $provider.Substring($refreshStart, $refreshEnd - $refreshStart)
if ($refreshBody -notmatch [regex]::Escape("startBackgroundScheduler(runStartup)")) {
  throw "O provedor não encaminha runStartup ao agendador nativo."
}
foreach ($contract in @(
  "refreshPreferences(true)",
  "refreshPreferences(false)"
)) {
  if ($provider -notmatch [regex]::Escape($contract)) { throw "Fluxo de inicialização ou reconfiguração ausente: $contract" }
}

$automations = Read-Utf8Text "src-tauri\src\automations.rs"
if ($automations -notmatch "simulate_automation_preview") { throw "O agendador não reutiliza a simulação protegida das automações." }
if ($native -match "automation_apply") { throw "Rotinas em segundo plano não podem aplicar automações financeiras silenciosamente." }

$tests = Read-Utf8Text "tests\unit\background-task-engine.test.ts"
foreach ($contract in @(
  "isWithinQuietHours",
  "calculateRetryDelayMinutes",
  "schedulerNextTick",
  "taskDedupKey",
  "enabledTaskKinds"
)) {
  if ($tests -notmatch $contract) { throw "A cobertura funcional não inclui: $contract" }
}

Write-Host ""
Write-Host "FASE 15 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 12"
Write-Host "Versão: 0.15.0"
Write-Host "Motor: fila, agendamento, tentativas, pausa, silêncio e notificações nativas validados."
Write-Host "Auditoria: nenhuma vulnerabilidade alta ou crítica."
