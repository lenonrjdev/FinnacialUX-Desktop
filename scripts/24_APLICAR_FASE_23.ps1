$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$required = @(
  "package-lock.json",
  "src-tauri\src\external_backup.rs",
  "lib\external-backup-engine.ts",
  "lib\external-backup-runtime.ts",
  "components\providers\external-backup-provider.tsx",
  "components\configuracoes\external-backup-panel.tsx",
  "tests\unit\external-backup-engine.test.ts",
  "scripts\24_FINALIZAR_FASE_23.mjs"
)
foreach ($file in $required) { if (-not (Test-Path (Join-Path $Root $file))) { throw "Arquivo obrigatório da Fase 23 ausente: $file" } }
$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -notin @("1.3.0", "1.4.0")) { throw "A Fase 23 exige a versão 1.3.0 validada. Versão atual: $($package.version)" }
$migrations = @(Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "*.sql" | Sort-Object Name)
if ($migrations.Count -ne 14 -or $migrations[-1].Name -notlike "0014_*") { throw "O schema precisa permanecer congelado em 14 migrations." }
node scripts\24_FINALIZAR_FASE_23.mjs $Root
if ($LASTEXITCODE -ne 0) { throw "Não foi possível alinhar a versão 1.4.0." }
Write-Host ""; Write-Host "FASE 23 APLICADA COM SUCESSO" -ForegroundColor Green; Write-Host "Versão: 1.4.0"; Write-Host "Schema: 14 (congelado)"; Write-Host "Execute agora: .\24_VALIDAR_FASE_23.cmd"
