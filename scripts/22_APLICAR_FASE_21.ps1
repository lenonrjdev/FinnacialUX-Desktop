$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$required = @(
  "package-lock.json",
  "lib\backup-automation-engine.ts",
  "lib\desktop\backup-automation.ts",
  "components\providers\backup-automation-provider.tsx",
  "components\configuracoes\backup-automation-panel.tsx",
  "tests\unit\backup-automation-engine.test.ts",
  "scripts\22_FINALIZAR_FASE_21.mjs"
)
foreach ($file in $required) { if (-not (Test-Path (Join-Path $Root $file))) { throw "Arquivo obrigatório da Fase 21 ausente: $file" } }
$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -notin @("1.1.0", "1.2.0")) { throw "A Fase 21 exige a versão 1.1.0 validada. Versão atual: $($package.version)" }
$migrations = @(Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "*.sql" | Sort-Object Name)
if ($migrations.Count -ne 14 -or $migrations[-1].Name -notlike "0014_*") { throw "O schema precisa permanecer congelado em 14 migrations." }
node scripts\22_FINALIZAR_FASE_21.mjs $Root
if ($LASTEXITCODE -ne 0) { throw "Não foi possível alinhar a versão 1.2.0." }
Write-Host ""; Write-Host "FASE 21 APLICADA COM SUCESSO" -ForegroundColor Green; Write-Host "Versão: 1.2.0"; Write-Host "Schema: 14 (congelado)"; Write-Host "Execute agora: .\22_VALIDAR_FASE_21.cmd"
