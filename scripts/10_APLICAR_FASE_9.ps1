$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

$required = @(
  "src-tauri\migrations\0006_data_continuity.sql",
  "src-tauri\src\continuity.rs",
  "lib\desktop\continuity.ts",
  "components\configuracoes\continuity-panel.tsx"
)
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $Root $file))) {
    throw "Arquivo obrigatório da Fase 9 ausente: $file"
  }
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ([version]$package.version -lt [version]"0.8.6") {
  throw "A Fase 9 exige a versão 0.8.6 validada. Versão atual: $($package.version)"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $Root ".phase-backup\fase-9-$stamp"
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
  Step "Atualizando a versão da aplicação para 0.9.0"
  node scripts\10_FINALIZAR_FASE_9.mjs $Root
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível alinhar as versões da Fase 9." }

  Step "Validando a estrutura mínima da continuidade"
  $migration = Get-Content (Join-Path $Root "src-tauri\migrations\0006_data_continuity.sql") -Raw
  if ($migration -notmatch "continuity_recovery_points" -or $migration -notmatch "continuity_events") {
    throw "A migration de continuidade está incompleta."
  }

  Write-Host ""
  Write-Host "FASE 9 APLICADA COM SUCESSO" -ForegroundColor Green
  Write-Host "Versão: 0.9.0"
  Write-Host "Execute agora: .\10_VALIDAR_FASE_9.cmd"
} catch {
  foreach ($file in $versionFiles) {
    $saved = Join-Path $backup $file
    if (Test-Path $saved) {
      $destination = Join-Path $Root $file
      Copy-Item $saved $destination -Force
    }
  }
  throw
}
