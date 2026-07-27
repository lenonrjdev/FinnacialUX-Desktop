$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".\node_modules")) {
  throw "Dependências não instaladas. Execute primeiro .\01_CONFIGURAR_DESKTOP.cmd"
}

Write-Host "Abrindo o FinnacialUX Desktop em modo de desenvolvimento..." -ForegroundColor Cyan
npm run desktop:dev
if ($LASTEXITCODE -ne 0) {
  throw "Não foi possível abrir o FinnacialUX Desktop. Corrija o erro exibido acima."
}
