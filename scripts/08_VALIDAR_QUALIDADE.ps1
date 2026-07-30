$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

Write-Host "FINNACIALUX DESKTOP - FASE 8 - QUALIDADE E REGRESSAO" -ForegroundColor Green
Write-Host "Raiz: $Root"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js 22 ou superior nao foi encontrado." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm nao foi encontrado." }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw "Rust/Cargo nao foi encontrado." }

Step "Instalando dependencias JavaScript"
npm install
if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar dependencias JavaScript." }

Step "Instalando o Chromium de testes"
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { throw "Falha ao preparar o Chromium do Playwright." }

Step "Validando lint, tipos, testes unitarios, cobertura e build"
npm run check:web
if ($LASTEXITCODE -ne 0) { throw "A validacao web encontrou uma regressao." }

Step "Executando os fluxos ponta a ponta"
npm run test:e2e
if ($LASTEXITCODE -ne 0) { throw "Os testes ponta a ponta encontraram uma regressao." }

Step "Executando os testes e a verificacao nativa"
npm run check:desktop
if ($LASTEXITCODE -ne 0) { throw "A validacao Rust/Tauri encontrou uma regressao." }

Step "Auditando dependencias sem aplicar correcoes automaticas"
npm audit --audit-level=critical
if ($LASTEXITCODE -ne 0) {
  Write-Warning "O npm encontrou vulnerabilidade critica. Revise o relatorio; nenhuma correcao forcada foi aplicada."
  exit 1
}

Write-Host ""
Write-Host "FASE 8 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Relatorios: coverage/, playwright-report/ e test-results/"
