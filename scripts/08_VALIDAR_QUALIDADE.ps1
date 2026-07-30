$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Run-Step([string]$Message, [scriptblock]$Command, [string]$FailureMessage) {
  Step $Message
  & $Command
  if ($LASTEXITCODE -ne 0) { throw $FailureMessage }
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
$version = $package.version

Write-Host "FINNACIALUX DESKTOP - FASE $version - QUALIDADE, REGRESSAO E SEGURANCA" -ForegroundColor Green
Write-Host "Raiz: $Root"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js 22 ou superior nao foi encontrado." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm nao foi encontrado." }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw "Rust/Cargo nao foi encontrado." }
if (-not (Test-Path (Join-Path $Root "package-lock.json"))) {
  throw "package-lock.json nao encontrado. Execute primeiro .\09_CORRIGIR_VULNERABILIDADES.cmd."
}

if (Test-Path (Join-Path $Root "src-tauri\target")) {
  Write-Host "Artefatos Rust existentes: src-tauri\target (ignorados pelo ESLint)." -ForegroundColor DarkGray
}

Run-Step "Instalando a arvore exata do package-lock" { npm ci } "Falha ao instalar as dependencias registradas no package-lock.json."
Run-Step "Validando manifesto, lockfile e dependencias diretas" { node scripts\validate-installed-dependencies.mjs $Root } "A arvore JavaScript instalada ficou inconsistente."
Run-Step "Auditando dependencias altas e criticas antes dos testes" { npm audit --audit-level=high } "Existe vulnerabilidade alta ou critica na arvore instalada."
Run-Step "Instalando o Chromium de testes" { npx playwright install chromium } "Falha ao preparar o Chromium do Playwright."
Run-Step "Validando o ESLint" { npm run lint } "O ESLint encontrou uma regressao real no codigo-fonte."
Run-Step "Validando o TypeScript" { npm run typecheck } "O TypeScript encontrou uma regressao."
Run-Step "Executando testes unitarios e cobertura" { npm run test:coverage } "Os testes unitarios ou a cobertura encontraram uma regressao."
Run-Step "Gerando o frontend estatico" { npm run build } "O build web encontrou uma regressao."
Run-Step "Executando os fluxos ponta a ponta" { npm run test:e2e } "Os testes ponta a ponta encontraram uma regressao."
Run-Step "Executando os testes e a verificacao nativa" { npm run check:desktop } "A validacao Rust/Tauri encontrou uma regressao."
Run-Step "Reauditando a arvore final" { npm audit --audit-level=high } "A arvore final possui vulnerabilidade alta ou critica."

Write-Host ""
Write-Host "FASE $version VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Auditoria: nenhuma vulnerabilidade alta ou critica."
Write-Host "Relatorios: coverage/, playwright-report/ e test-results/"
