$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

. (Join-Path $PSScriptRoot "libsodium-cache.ps1")

if (-not (Test-Path ".\node_modules")) {
  throw "Dependências não instaladas. Execute primeiro .\01_CONFIGURAR_DESKTOP.cmd"
}

Initialize-LibsodiumCache -Root $Root

Write-Host "Gerando o instalador NSIS do FinnacialUX Desktop..." -ForegroundColor Cyan
npm run desktop:build
if ($LASTEXITCODE -ne 0) {
  throw "A geração do instalador falhou. Corrija o erro exibido acima antes de distribuir o aplicativo."
}

$Bundle = Join-Path $Root "src-tauri\target\release\bundle\nsis"
Write-Host "`nInstalador gerado em:" -ForegroundColor Green
Write-Host $Bundle
if (Test-Path $Bundle) {
  Get-ChildItem $Bundle -Filter "*.exe" | ForEach-Object { Write-Host $_.FullName }
}
