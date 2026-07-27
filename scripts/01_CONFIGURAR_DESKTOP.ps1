$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Require-Command([string]$Name, [string]$Message) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw $Message
  }
}

function Invoke-Checked([string]$Description, [scriptblock]$Command) {
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Description falhou com o código $LASTEXITCODE. Corrija o erro exibido acima antes de continuar."
  }
}

Write-Host ""
Write-Host "FINNACIALUX DESKTOP - CONFIGURACAO INICIAL" -ForegroundColor Cyan
Write-Host "Raiz: $Root"

Require-Command "node" "Node.js não encontrado. Instale o Node.js 22 LTS atualizado."
Require-Command "npm" "npm não encontrado. Reinstale o Node.js LTS."
Require-Command "rustc" "Rust não encontrado. Execute: winget install --id Rustlang.Rustup"
Require-Command "cargo" "Cargo não encontrado. Feche e abra o PowerShell depois de instalar o Rust."
Require-Command "rustup" "rustup não encontrado. Reinstale o Rust pelo instalador oficial."

$nodeVersionText = (node --version).TrimStart('v')
$nodeVersion = [Version]$nodeVersionText
if ($nodeVersion -lt [Version]"22.13.0") {
  throw "Node.js $nodeVersionText é antigo para as dependências atuais. Instale Node.js 22.13.0 ou superior. Recomendado: Node.js 22 LTS mais recente."
}

Write-Host "Node:  $(node --version)" -ForegroundColor DarkGray
Write-Host "npm:   $(npm --version)" -ForegroundColor DarkGray
Write-Host "Rust:  $(rustc --version)" -ForegroundColor DarkGray
Write-Host "Cargo: $(cargo --version)" -ForegroundColor DarkGray

Write-Host "`n==> Instalando dependências JavaScript" -ForegroundColor Yellow
Invoke-Checked "npm install" { npm install }

Write-Host "`n==> Selecionando o toolchain Rust MSVC" -ForegroundColor Yellow
Invoke-Checked "Seleção do Rust MSVC" { rustup default stable-msvc }

Write-Host "`n==> Validando o TypeScript" -ForegroundColor Yellow
Invoke-Checked "Typecheck" { npm run typecheck }

Write-Host "`n==> Gerando o frontend estático" -ForegroundColor Yellow
Invoke-Checked "Build do Next.js" { npm run build }

Write-Host "`n==> Validando o aplicativo nativo" -ForegroundColor Yellow
cargo check --manifest-path .\src-tauri\Cargo.toml
if ($LASTEXITCODE -ne 0) {
  throw "Validação nativa falhou. Se o terminal mostrar 'link.exe not found', instale o Visual Studio Build Tools 2022 com a carga 'Desenvolvimento para desktop com C++', feche o terminal e execute este script novamente."
}

Write-Host "`nConfiguração validada com sucesso." -ForegroundColor Green
Write-Host "Agora execute .\02_RODAR_DESKTOP.cmd para abrir o aplicativo."
