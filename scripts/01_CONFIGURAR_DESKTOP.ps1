$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

. (Join-Path $PSScriptRoot "libsodium-cache.ps1")

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

function Require-ProjectFile([string]$RelativePath) {
  $FullPath = Join-Path $Root $RelativePath
  if (-not (Test-Path $FullPath -PathType Leaf)) {
    throw "Arquivo obrigatório ausente: $RelativePath. Reaplique o Hotfix 4.0.1 antes de continuar."
  }
}

function Invoke-CargoCheck {
  Write-Host "Executando validação nativa..." -ForegroundColor DarkGray
  cargo check --manifest-path .\src-tauri\Cargo.toml
  if ($LASTEXITCODE -ne 0) {
    throw "Validação nativa falhou com o código $LASTEXITCODE. O cache do libsodium já foi preparado; corrija o primeiro erro Rust exibido acima antes de repetir."
  }
}

Write-Host ""
Write-Host "FINNACIALUX DESKTOP - CONFIGURACAO INICIAL" -ForegroundColor Cyan
Write-Host "Raiz: $Root"

$RequiredProjectFiles = @(
  "types\desktop-security.ts",
  "types\configuracoes.ts",
  "components\security\desktop-lock-screen.tsx",
  "components\security\sensitive-action-dialog.tsx",
  "components\configuracoes\backups-panel.tsx",
  "src-tauri\migrations\0003_local_security.sql",
  "src-tauri\migrations\0004_database_encryption.sql"
)
foreach ($RequiredProjectFile in $RequiredProjectFiles) {
  Require-ProjectFile $RequiredProjectFile
}

Require-Command "node" "Node.js não encontrado. Instale o Node.js 22 LTS atualizado."
Require-Command "npm" "npm não encontrado. Reinstale o Node.js LTS."
Require-Command "rustc" "Rust não encontrado. Execute: winget install --id Rustlang.Rustup"
Require-Command "cargo" "Cargo não encontrado. Feche e abra o PowerShell depois de instalar o Rust."
Require-Command "rustup" "rustup não encontrado. Reinstale o Rust pelo instalador oficial."
Require-Command "perl" "Perl não encontrado. A compilação local do SQLCipher/OpenSSL exige Perl. Instale com: winget install --id StrawberryPerl.StrawberryPerl"

$nodeVersionText = (node --version).TrimStart('v')
$nodeVersion = [Version]$nodeVersionText
if ($nodeVersion -lt [Version]"22.13.0") {
  throw "Node.js $nodeVersionText é antigo para as dependências atuais. Instale Node.js 22.13.0 ou superior. Recomendado: Node.js 22 LTS mais recente."
}

Write-Host "Node:  $(node --version)" -ForegroundColor DarkGray
Write-Host "npm:   $(npm --version)" -ForegroundColor DarkGray
Write-Host "Rust:  $(rustc --version)" -ForegroundColor DarkGray
Write-Host "Cargo: $(cargo --version)" -ForegroundColor DarkGray
Write-Host "Perl:  $((perl -v | Select-String -Pattern 'This is perl' | Select-Object -First 1).Line.Trim())" -ForegroundColor DarkGray
if (-not (Get-Command "nasm" -ErrorAction SilentlyContinue)) {
  Write-Host "NASM não encontrado. O OpenSSL será compilado sem rotinas assembly quando suportado. Para melhor desempenho: winget install --id NASM.NASM" -ForegroundColor DarkYellow
}

Write-Host "`n==> Instalando dependências JavaScript" -ForegroundColor Yellow
Invoke-Checked "npm install" { npm install }

Write-Host "`n==> Selecionando o toolchain Rust MSVC" -ForegroundColor Yellow
Invoke-Checked "Seleção do Rust MSVC" { rustup default stable-msvc }

Write-Host "`n==> Validando o TypeScript" -ForegroundColor Yellow
Invoke-Checked "Typecheck" { npm run typecheck }

Write-Host "`n==> Gerando o frontend estático" -ForegroundColor Yellow
Invoke-Checked "Build do Next.js" { npm run build }

Initialize-LibsodiumCache -Root $Root

Write-Host "`n==> Validando SQLCipher, OpenSSL e o aplicativo nativo" -ForegroundColor Yellow
Write-Host "A primeira compilação desta fase pode demorar mais porque SQLCipher e OpenSSL são incorporados ao executável." -ForegroundColor DarkGray
Invoke-CargoCheck

Write-Host "`nConfiguração validada com sucesso." -ForegroundColor Green
Write-Host "Agora execute .\02_RODAR_DESKTOP.cmd para abrir o aplicativo."
