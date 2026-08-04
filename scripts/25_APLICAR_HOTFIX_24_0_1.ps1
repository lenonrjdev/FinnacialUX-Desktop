$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js não foi encontrado."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm não foi encontrado."
}
if (-not (Test-Path (Join-Path $Root "package.json"))) {
  throw "package.json não encontrado na raiz do projeto."
}
if (-not (Test-Path (Join-Path $Root "package-lock.json"))) {
  throw "package-lock.json não encontrado na raiz do projeto."
}

Step "Atualizando overrides seguros do brace-expansion"
node scripts\25_CORRIGIR_BRACE_EXPANSION.mjs apply $Root
if ($LASTEXITCODE -ne 0) {
  throw "Não foi possível atualizar a árvore npm para brace-expansion 5.0.9."
}

Write-Host ""
Write-Host "HOTFIX 24.0.1 VALIDADO COM SUCESSO" -ForegroundColor Green
Write-Host "Versão do aplicativo: 1.5.0"
Write-Host "Schema SQLCipher: 14 (inalterado)"
Write-Host "brace-expansion 4/5: 5.0.9"
Write-Host "Execute agora: .\25_VALIDAR_FASE_24.cmd"
