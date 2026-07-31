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
  "src-tauri\migrations\0014_guided_onboarding_and_contextual_help.sql",
  "src-tauri\src\onboarding.rs",
  "types\onboarding.ts",
  "lib\onboarding-engine.ts",
  "lib\desktop\onboarding.ts",
  "components\onboarding\onboarding-provider.tsx",
  "components\ajuda\contextual-help-panel.tsx",
  "tests\unit\onboarding-engine.test.ts"
)
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $Root $file))) { throw "Arquivo obrigatório da Fase 17 ausente: $file" }
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -notin @("0.16.0", "0.17.0")) {
  throw "A Fase 17 exige a base 0.16.0 validada. Versão atual: $($package.version)"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $Root ".phase-backup\fase-17-$stamp"
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
  Step "Atualizando a versão da aplicação para 0.17.0"
  node scripts\18_FINALIZAR_FASE_17.mjs $Root
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível alinhar as versões da Fase 17." }

  Step "Validando a estrutura mínima do onboarding"
  $migration = Read-Utf8Text "src-tauri\migrations\0014_guided_onboarding_and_contextual_help.sql"
  foreach ($table in @("onboarding_preferences", "onboarding_steps", "onboarding_events")) {
    if ($migration -notmatch $table) { throw "A migration da Fase 17 não cria $table." }
  }

  $native = Read-Utf8Text "src-tauri\src\onboarding.rs"
  foreach ($contract in @(
    "onboarding_get_state",
    "onboarding_sync_progress",
    "onboarding_complete_step",
    "onboarding_skip_guide",
    "onboarding_reset_guide",
    "onboarding_save_preferences",
    "ensure_database_writable"
  )) {
    if ($native -notmatch [regex]::Escape($contract)) { throw "O onboarding nativo está incompleto: $contract" }
  }

  Write-Host ""
  Write-Host "FASE 17 APLICADA COM SUCESSO" -ForegroundColor Green
  Write-Host "Versão: 0.17.0"
  Write-Host "Schema: 14"
  Write-Host "Execute agora: .\18_VALIDAR_FASE_17.cmd"
} catch {
  foreach ($file in $versionFiles) {
    $source = Join-Path $backup $file
    if (Test-Path $source) { Copy-Item $source (Join-Path $Root $file) -Force }
  }
  throw
}
