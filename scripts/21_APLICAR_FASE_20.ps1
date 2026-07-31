$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$required = @("package-lock.json", "lib\maintenance-engine.ts", "components\configuracoes\maintenance-panel.tsx", "tests\unit\maintenance-engine.test.ts", "scripts\21_FINALIZAR_FASE_20.mjs")
foreach ($file in $required) { if (-not (Test-Path (Join-Path $Root $file))) { throw "Arquivo obrigatório da Fase 20 ausente: $file" } }
$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -notin @("1.0.0", "1.1.0")) { throw "A Fase 20 exige a versão 1.0.0 validada. Versão atual: $($package.version)" }
$migrations = @(Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "*.sql" | Sort-Object Name)
if ($migrations.Count -ne 14 -or $migrations[-1].Name -notlike "0014_*") { throw "O schema precisa permanecer congelado em 14 migrations." }
node scripts\21_FINALIZAR_FASE_20.mjs $Root
if ($LASTEXITCODE -ne 0) { throw "Não foi possível alinhar a versão 1.1.0." }
Write-Host ""; Write-Host "FASE 20 APLICADA COM SUCESSO" -ForegroundColor Green; Write-Host "Versão: 1.1.0"; Write-Host "Schema: 14 (congelado)"; Write-Host "Execute agora: .\21_VALIDAR_FASE_20.cmd"
