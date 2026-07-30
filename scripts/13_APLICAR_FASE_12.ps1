$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

$required = @(
  "package-lock.json",
  "src-tauri\migrations\0009_decision_oriented_financial_planning.sql",
  "src-tauri\src\planning.rs",
  "lib\planning-engine.ts",
  "lib\desktop\planning.ts",
  "components\relatorios\financial-planning-panel.tsx",
  "tests\unit\planning-engine.test.ts"
)
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $Root $file))) {
    throw "Arquivo obrigatório da Fase 12 ausente: $file"
  }
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -notin @("0.11.0", "0.12.0")) {
  throw "A Fase 12 exige a base 0.11.0 validada. Versão atual: $($package.version)"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $Root ".phase-backup\fase-12-$stamp"
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
  Step "Atualizando a versão da aplicação para 0.12.0"
  node scripts\13_FINALIZAR_FASE_12.mjs $Root
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível alinhar as versões da Fase 12." }

  Step "Validando a estrutura mínima do planejamento"
  $migration = Get-Content (Join-Path $Root "src-tauri\migrations\0009_decision_oriented_financial_planning.sql") -Raw
  foreach ($table in @("financial_planning_preferences", "financial_plans", "financial_plan_reviews", "financial_planning_decisions")) {
    if ($migration -notmatch $table) { throw "A migration da Fase 12 não cria $table." }
  }
  $engine = Get-Content (Join-Path $Root "lib\planning-engine.ts") -Raw
  foreach ($symbol in @("buildFinancialPlanSimulation", "createPlanningChecksum", "simulateDebtPlan", "simulateGoalPlan")) {
    if ($engine -notmatch $symbol) { throw "O motor local não contém $symbol." }
  }
  $native = Get-Content (Join-Path $Root "src-tauri\src\planning.rs") -Raw
  foreach ($command in @("planning_save_plan", "planning_activate_plan", "planning_record_review", "planning_list_decisions")) {
    if ($native -notmatch $command) { throw "A persistência nativa está incompleta: $command" }
  }

  Write-Host ""
  Write-Host "FASE 12 APLICADA COM SUCESSO" -ForegroundColor Green
  Write-Host "Versão: 0.12.0"
  Write-Host "Schema: 9"
  Write-Host "Execute agora: .\13_VALIDAR_FASE_12.cmd"
} catch {
  foreach ($file in $versionFiles) {
    $saved = Join-Path $backup $file
    if (Test-Path $saved) { Copy-Item $saved (Join-Path $Root $file) -Force }
  }
  throw
}
