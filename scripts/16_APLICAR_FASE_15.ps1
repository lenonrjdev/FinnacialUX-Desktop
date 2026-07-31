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
  "src-tauri\migrations\0012_local_background_tasks_and_notifications.sql",
  "src-tauri\src\background_tasks.rs",
  "types\background-tasks.ts",
  "lib\background-task-engine.ts",
  "lib\desktop\background-tasks.ts",
  "components\providers\background-tasks-provider.tsx",
  "components\configuracoes\background-tasks-panel.tsx",
  "tests\unit\background-task-engine.test.ts"
)
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $Root $file))) { throw "Arquivo obrigatório da Fase 15 ausente: $file" }
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -notin @("0.14.0", "0.15.0")) {
  throw "A Fase 15 exige a base 0.14.0 validada. Versão atual: $($package.version)"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $Root ".phase-backup\fase-15-$stamp"
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
  Step "Atualizando a versão da aplicação para 0.15.0"
  node scripts\16_FINALIZAR_FASE_15.mjs $Root
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível alinhar as versões da Fase 15." }

  Step "Validando a estrutura mínima das rotinas locais"
  $migration = Read-Utf8Text "src-tauri\migrations\0012_local_background_tasks_and_notifications.sql"
  foreach ($table in @(
    "background_task_preferences",
    "background_task_queue",
    "background_task_runs",
    "background_notification_outbox",
    "background_scheduler_leases"
  )) {
    if ($migration -notmatch $table) { throw "A migration da Fase 15 não cria $table." }
  }

  $native = Read-Utf8Text "src-tauri\src\background_tasks.rs"
  foreach ($contract in @(
    "background_run_due_tasks",
    "acquire_lease",
    "retry_delay_minutes",
    "is_quiet_hours",
    "simulate_automation_preview",
    "finnacialux-background-notification"
  )) {
    if ($native -notmatch [regex]::Escape($contract)) { throw "O motor local está incompleto: $contract" }
  }

  Write-Host ""
  Write-Host "FASE 15 APLICADA COM SUCESSO" -ForegroundColor Green
  Write-Host "Versão: 0.15.0"
  Write-Host "Schema: 12"
  Write-Host "Execute agora: .\16_VALIDAR_FASE_15.cmd"
} catch {
  foreach ($file in $versionFiles) {
    $source = Join-Path $backup $file
    if (Test-Path $source) { Copy-Item $source (Join-Path $Root $file) -Force }
  }
  throw
}
