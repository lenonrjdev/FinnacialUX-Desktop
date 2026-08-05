param([switch]$Offline)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
. (Join-Path (Split-Path -Parent $PSScriptRoot) "core\command-runner.ps1")
$Root = Get-FinnacialuxProjectRoot -StartPath $PSScriptRoot
Set-Location $Root
. (Join-Path $Root "scripts\core\libsodium-cache.ps1")

$TauriCli = Join-Path $Root "node_modules\.bin\tauri.cmd"
if (-not (Test-Path $TauriCli -PathType Leaf)) {
  throw "CLI do Tauri ausente. Execute .\01_RODAR_PROJETO.cmd para instalar as dependências."
}

Initialize-LibsodiumCache -Root $Root
$Arguments = @("build")
if (Test-Path (Join-Path $Root "src-tauri\tauri.updater.conf.json") -PathType Leaf) {
  $Arguments += @("--config", "src-tauri/tauri.updater.conf.json")
}
$ModeLabel = "local de teste"
if ($Offline) {
  Assert-FinnacialuxFile -Root $Root -RelativePath "src-tauri\tauri.offline.conf.json" | Out-Null
  $Arguments += @("--config", "src-tauri/tauri.offline.conf.json")
  $ModeLabel = "offline com WebView2"
}

Write-Host "`n==> Gerando instalador NSIS $ModeLabel" -ForegroundColor Cyan
Invoke-FinnacialuxNativeCommand $TauriCli $Arguments "A geração do instalador falhou."

$BundleDirectory = Join-Path $Root "src-tauri\target\release\bundle\nsis"
$Installers = @(Get-ChildItem $BundleDirectory -Filter "*.exe" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
if ($Installers.Count -eq 0) { throw "O build terminou sem gerar um instalador NSIS em: $BundleDirectory" }

Write-Host "`nInstalador gerado sem publicação:" -ForegroundColor Green
Write-Host $Installers[0].FullName
return
