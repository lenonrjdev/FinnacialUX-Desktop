param([switch]$Offline)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
. (Join-Path $PSScriptRoot "libsodium-cache.ps1")

if (-not (Test-Path ".\node_modules")) {
  throw "Dependências não instaladas. Execute primeiro .\01_CONFIGURAR_DESKTOP.cmd"
}

Initialize-LibsodiumCache -Root $Root
$ConfigArgs = @()
if (Test-Path ".\src-tauri\tauri.updater.conf.json") {
  $ConfigArgs += @("--config", "src-tauri/tauri.updater.conf.json")
}
$ModeLabel = "instalador NSIS padrão"
if ($Offline) {
  $ConfigArgs += @("--config", "src-tauri/tauri.offline.conf.json")
  $ModeLabel = "instalador NSIS offline com WebView2"
}

Write-Host "Gerando $ModeLabel do FinnacialUX Desktop..." -ForegroundColor Cyan
& npm run tauri -- build @ConfigArgs
if ($LASTEXITCODE -ne 0) {
  throw "A geração do instalador falhou. Corrija o erro exibido acima antes de distribuir o aplicativo."
}

$Bundle = Join-Path $Root "src-tauri\target\release\bundle\nsis"
Write-Host "`nInstalador gerado em:" -ForegroundColor Green
Write-Host $Bundle
if (Test-Path $Bundle) {
  Get-ChildItem $Bundle -Filter "*.exe" | Sort-Object LastWriteTime -Descending | ForEach-Object { Write-Host $_.FullName }
}
if (-not $Offline) {
  Write-Host "`nEste setup é indicado para testes locais. Para uma release pública assinada, use .\05_GERAR_RELEASE.cmd" -ForegroundColor Yellow
}
