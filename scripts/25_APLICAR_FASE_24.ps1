$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$required = @(
  "package-lock.json", "release\windows-signing-policy.json", "release\windows-signing.example.json",
  "lib\windows-signing-engine.ts", "tests\unit\windows-signing-engine.test.ts",
  "scripts\windows-signing.ps1", "scripts\25_SIGN_TAURI_ARTIFACT.ps1", "scripts\25_FINALIZAR_FASE_24.mjs"
)
foreach ($file in $required) { if (-not (Test-Path (Join-Path $Root $file))) { throw "Arquivo obrigatório da Fase 24 ausente: $file" } }
$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -notin @("1.4.0", "1.5.0")) { throw "A Fase 24 exige a versão 1.4.0 validada. Versão atual: $($package.version)" }
$migrations = @(Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "*.sql" | Sort-Object Name)
if ($migrations.Count -ne 14 -or $migrations[-1].Name -notlike "0014_*") { throw "O schema precisa permanecer congelado em 14 migrations." }
node scripts\25_FINALIZAR_FASE_24.mjs $Root
if ($LASTEXITCODE -ne 0) { throw "Não foi possível alinhar a versão 1.5.0." }
Write-Host ""; Write-Host "FASE 24 APLICADA COM SUCESSO" -ForegroundColor Green; Write-Host "Versão: 1.5.0"; Write-Host "Schema: 14 (congelado)"; Write-Host "Execute agora: .\25_VALIDAR_FASE_24.cmd"
