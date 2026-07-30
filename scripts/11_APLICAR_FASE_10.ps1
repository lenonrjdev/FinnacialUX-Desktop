$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

$required = @(
  "package-lock.json",
  "src-tauri\migrations\0007_local_automation_engine.sql",
  "src-tauri\src\automations.rs",
  "lib\desktop\automations.ts",
  "components\dados-e-automacoes\automation-center-panel.tsx",
  "tests\unit\automation-engine.test.ts"
)
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $Root $file))) {
    throw "Arquivo obrigatorio da Fase 10 ausente: $file"
  }
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ([version]$package.version -lt [version]"0.9.0") {
  throw "A Fase 10 exige a versao 0.9.0 validada. Versao atual: $($package.version)"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $Root ".phase-backup\fase-10-$stamp"
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
  Step "Atualizando a versao da aplicacao para 0.10.0"
  node scripts\11_FINALIZAR_FASE_10.mjs $Root
  if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel alinhar as versoes da Fase 10." }

  Step "Validando a estrutura minima do motor de automacoes"
  $migration = Get-Content (Join-Path $Root "src-tauri\migrations\0007_local_automation_engine.sql") -Raw
  if ($migration -notmatch "automation_preferences" -or $migration -notmatch "automation_runs" -or $migration -notmatch "automation_alert_states") {
    throw "A migration do motor de automacoes esta incompleta."
  }
  $native = Get-Content (Join-Path $Root "src-tauri\src\automations.rs") -Raw
  if ($native -notmatch "source_checksum" -or $native -notmatch "automation_undo_run") {
    throw "O nucleo nativo de simulacao ou reversao esta incompleto."
  }

  Write-Host ""
  Write-Host "FASE 10 APLICADA COM SUCESSO" -ForegroundColor Green
  Write-Host "Versao: 0.10.0"
  Write-Host "Schema: 7"
  Write-Host "Execute agora: .\11_VALIDAR_FASE_10.cmd"
} catch {
  foreach ($file in $versionFiles) {
    $saved = Join-Path $backup $file
    if (Test-Path $saved) {
      Copy-Item $saved (Join-Path $Root $file) -Force
    }
  }
  throw
}
