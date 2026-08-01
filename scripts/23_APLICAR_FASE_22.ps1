$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$required = @(
  "package-lock.json",
  "lib\recovery-readiness-engine.ts",
  "lib\recovery-readiness-runtime.ts",
  "components\providers\recovery-readiness-provider.tsx",
  "components\configuracoes\recovery-readiness-panel.tsx",
  "tests\unit\recovery-readiness-engine.test.ts",
  "scripts\23_FINALIZAR_FASE_22.mjs"
)
foreach ($file in $required) { if (-not (Test-Path (Join-Path $Root $file))) { throw "Arquivo obrigatório da Fase 22 ausente: $file" } }
$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -notin @("1.2.0", "1.3.0")) { throw "A Fase 22 exige a versão 1.2.0 validada. Versão atual: $($package.version)" }
$migrations = @(Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "*.sql" | Sort-Object Name)
if ($migrations.Count -ne 14 -or $migrations[-1].Name -notlike "0014_*") { throw "O schema precisa permanecer congelado em 14 migrations." }
node scripts\23_FINALIZAR_FASE_22.mjs $Root
if ($LASTEXITCODE -ne 0) { throw "Não foi possível alinhar a versão 1.3.0." }
Write-Host ""; Write-Host "FASE 22 APLICADA COM SUCESSO" -ForegroundColor Green; Write-Host "Versão: 1.3.0"; Write-Host "Schema: 14 (congelado)"; Write-Host "Execute agora: .\23_VALIDAR_FASE_22.cmd"
