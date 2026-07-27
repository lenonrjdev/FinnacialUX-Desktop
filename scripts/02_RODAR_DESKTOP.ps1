$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".\node_modules")) {
  throw "Dependências não instaladas. Execute primeiro .\01_CONFIGURAR_DESKTOP.cmd"
}

$RunningApp = Get-Process -Name "finnacialux-desktop" -ErrorAction SilentlyContinue
if ($RunningApp) {
  Write-Host "O FinnacialUX Desktop já está aberto." -ForegroundColor Yellow
  Write-Host "Use a janela existente. O aplicativo não iniciará uma segunda instância."
  exit 0
}

$PortInUse = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($PortInUse) {
  throw "A porta 3000 já está em uso. Encerre a execução anterior do FinnacialUX Desktop antes de iniciar novamente."
}

Write-Host "FINNACIALUX DESKTOP - MODO DE DESENVOLVIMENTO" -ForegroundColor Cyan
Write-Host "Esta janela de terminal é necessária somente durante o desenvolvimento." -ForegroundColor Yellow
Write-Host "Usuários do instalador .exe não verão este terminal." -ForegroundColor Yellow
Write-Host "Para encerrar o modo de desenvolvimento, pressione Ctrl + C neste terminal.`n"

npm run desktop:dev
if ($LASTEXITCODE -ne 0) {
  throw "Não foi possível abrir o FinnacialUX Desktop. Corrija o erro exibido acima."
}
