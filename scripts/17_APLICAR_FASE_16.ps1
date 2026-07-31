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
  "src-tauri\migrations\0013_local_diagnostics_and_support.sql",
  "src-tauri\src\diagnostics.rs",
  "types\diagnostics.ts",
  "lib\diagnostic-engine.ts",
  "lib\desktop\diagnostics.ts",
  "components\configuracoes\diagnostics-panel.tsx",
  "tests\unit\diagnostic-engine.test.ts"
)
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $Root $file))) { throw "Arquivo obrigatório da Fase 16 ausente: $file" }
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -notin @("0.15.0", "0.16.0")) {
  throw "A Fase 16 exige a base 0.15.0 validada. Versão atual: $($package.version)"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $Root ".phase-backup\fase-16-$stamp"
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
  Step "Atualizando a versão da aplicação para 0.16.0"
  node scripts\17_FINALIZAR_FASE_16.mjs $Root
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível alinhar as versões da Fase 16." }

  Step "Validando a estrutura mínima do diagnóstico local"
  $migration = Read-Utf8Text "src-tauri\migrations\0013_local_diagnostics_and_support.sql"
  foreach ($table in @(
    "diagnostic_preferences",
    "diagnostic_runs",
    "diagnostic_checks",
    "diagnostic_repairs",
    "support_package_exports",
    "diagnostic_probe"
  )) {
    if ($migration -notmatch $table) { throw "A migration da Fase 16 não cria $table." }
  }

  $native = Read-Utf8Text "src-tauri\src\diagnostics.rs"
  foreach ($contract in @(
    "diagnostics_run_suite",
    "collect_read_write_check",
    "transaction.rollback",
    "collect_restore_drill_check",
    "export_plaintext_snapshot",
    "sanitize_log_line",
    "diagnostics_export_support_package",
    "payloadSha256"
  )) {
    if ($native -notmatch [regex]::Escape($contract)) { throw "O diagnóstico local está incompleto: $contract" }
  }

  Write-Host ""
  Write-Host "FASE 16 APLICADA COM SUCESSO" -ForegroundColor Green
  Write-Host "Versão: 0.16.0"
  Write-Host "Schema: 13"
  Write-Host "Execute agora: .\17_VALIDAR_FASE_16.cmd"
} catch {
  foreach ($file in $versionFiles) {
    $source = Join-Path $backup $file
    if (Test-Path $source) { Copy-Item $source (Join-Path $Root $file) -Force }
  }
  throw
}
