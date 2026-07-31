$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

$required = @(
  "package-lock.json",
  "release\release-candidate.json",
  "release\schema-freeze-14.json",
  "scripts\release-candidate.mjs",
  "scripts\19_FINALIZAR_FASE_18.mjs",
  "components\configuracoes\release-candidate-panel.tsx",
  "tests\unit\release-candidate.test.ts",
  "PRIVACY.md",
  "SECURITY.md"
)
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $Root $file))) { throw "Arquivo obrigatório da Fase 18 ausente: $file" }
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -notin @("0.17.0", "0.18.0-rc.1")) {
  throw "A Fase 18 exige a base 0.17.0 validada. Versão atual: $($package.version)"
}

$migrations = @(Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "*.sql" | Sort-Object Name)
if ($migrations.Count -ne 14 -or $migrations[-1].Name -notlike "0014_*") {
  throw "O schema precisa permanecer congelado em 14 migrations antes da Release Candidate."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $Root ".phase-backup\fase-18-$stamp"
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
  Step "Atualizando a aplicação para 0.18.0-rc.1"
  node scripts\19_FINALIZAR_FASE_18.mjs $Root
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível alinhar as versões da Fase 18." }

  Step "Confirmando congelamento do schema 14"
  node scripts\release-candidate.mjs verify-source $Root
  if ($LASTEXITCODE -ne 0) { throw "O contrato da Release Candidate não foi atendido." }

  Write-Host ""
  Write-Host "FASE 18 APLICADA COM SUCESSO" -ForegroundColor Green
  Write-Host "Versão: 0.18.0-rc.1"
  Write-Host "Schema: 14 (congelado)"
  Write-Host "Execute agora: .\19_VALIDAR_FASE_18.cmd"
} catch {
  foreach ($file in $versionFiles) {
    $source = Join-Path $backup $file
    if (Test-Path $source) { Copy-Item $source (Join-Path $Root $file) -Force }
  }
  throw
}
