$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -ne "0.9.0") { throw "Versão esperada 0.9.0; encontrada $($package.version)." }

Write-Host "FINNACIALUX DESKTOP - FASE 9 - VALIDACAO COMPLETA" -ForegroundColor Green
& (Join-Path $Root "08_VALIDAR_QUALIDADE.cmd")
if ($LASTEXITCODE -ne 0) { throw "A suíte completa encontrou uma regressão na Fase 9." }

$required = @(
  "src-tauri\migrations\0006_data_continuity.sql",
  "src-tauri\src\continuity.rs",
  "tests\unit\continuity.test.ts"
)
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $Root $file))) { throw "Artefato da Fase 9 ausente: $file" }
}

Write-Host ""
Write-Host "FASE 9 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 6"
Write-Host "Versão: 0.9.0"
Write-Host "Auditoria: 0 vulnerabilidades altas ou críticas."
