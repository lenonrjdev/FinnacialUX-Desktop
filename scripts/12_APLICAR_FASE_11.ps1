$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

$required = @(
  "package-lock.json",
  "src-tauri\migrations\0008_local_financial_intelligence.sql",
  "src-tauri\src\intelligence.rs",
  "lib\intelligence-engine.ts",
  "lib\desktop\intelligence.ts",
  "components\relatorios\financial-intelligence-panel.tsx",
  "tests\unit\intelligence-engine.test.ts"
)
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $Root $file))) {
    throw "Arquivo obrigatorio da Fase 11 ausente: $file"
  }
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ([version]$package.version -lt [version]"0.10.0") {
  throw "A Fase 11 exige a versao 0.10.0 validada. Versao atual: $($package.version)"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $Root ".phase-backup\fase-11-$stamp"
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
  Step "Atualizando a versao da aplicacao para 0.11.0"
  node scripts\12_FINALIZAR_FASE_11.mjs $Root
  if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel alinhar as versoes da Fase 11." }

  Step "Validando a estrutura minima da inteligencia financeira"
  $migration = Get-Content (Join-Path $Root "src-tauri\migrations\0008_local_financial_intelligence.sql") -Raw
  foreach ($table in @("financial_intelligence_preferences", "financial_intelligence_scenarios", "financial_intelligence_snapshots")) {
    if ($migration -notmatch $table) { throw "A migration da Fase 11 nao cria $table." }
  }
  $engine = Get-Content (Join-Path $Root "lib\intelligence-engine.ts") -Raw
  foreach ($symbol in @("buildFinancialIntelligenceProjection", "detectSpendingAnomalies", "createSourceChecksum")) {
    if ($engine -notmatch $symbol) { throw "O motor local nao contem $symbol." }
  }
  $native = Get-Content (Join-Path $Root "src-tauri\src\intelligence.rs") -Raw
  if ($native -notmatch "intelligence_save_scenario" -or $native -notmatch "intelligence_record_snapshot") {
    throw "A persistencia nativa de cenarios ou leituras esta incompleta."
  }

  Write-Host ""
  Write-Host "FASE 11 APLICADA COM SUCESSO" -ForegroundColor Green
  Write-Host "Versao: 0.11.0"
  Write-Host "Schema: 8"
  Write-Host "Execute agora: .\12_VALIDAR_FASE_11.cmd"
} catch {
  foreach ($file in $versionFiles) {
    $saved = Join-Path $backup $file
    if (Test-Path $saved) { Copy-Item $saved (Join-Path $Root $file) -Force }
  }
  throw
}
