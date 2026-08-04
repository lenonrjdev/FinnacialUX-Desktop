$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js nao foi encontrado."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm nao foi encontrado."
}
if (-not (Test-Path (Join-Path $Root "package.json"))) {
  throw "package.json nao encontrado na raiz do projeto."
}
if (-not (Test-Path (Join-Path $Root "package-lock.json"))) {
  throw "package-lock.json nao encontrado na raiz do projeto."
}

Step "Retomando a correcao segura do brace-expansion"
node scripts\25_CORRIGIR_BRACE_EXPANSION.mjs apply $Root
if ($LASTEXITCODE -ne 0) {
  throw "Nao foi possivel atualizar a arvore npm para brace-expansion 5.0.9."
}

Step "Removendo os arquivos obsoletos do Hotfix 24.0.1"
$ObsoleteFiles = @(
  "25_APLICAR_HOTFIX_24_0_1.cmd",
  "scripts\25_APLICAR_HOTFIX_24_0_1.ps1",
  "HOTFIX_24_0_1_BRACE_EXPANSION_5_0_9.md",
  "HOTFIX_24_0_1_ARQUIVOS.txt"
)
foreach ($RelativePath in $ObsoleteFiles) {
  $AbsolutePath = Join-Path $Root $RelativePath
  if (Test-Path $AbsolutePath) {
    Remove-Item -LiteralPath $AbsolutePath -Force
    Write-Host "Removido: $RelativePath"
  }
}

Write-Host ""
Write-Host "HOTFIX 24.0.2 APLICADO E VALIDADO COM SUCESSO" -ForegroundColor Green
Write-Host "Versao do aplicativo: 1.5.0"
Write-Host "Schema SQLCipher: 14 (inalterado)"
Write-Host "brace-expansion 4/5: 5.0.9"
Write-Host "Execute agora: .\25_VALIDAR_FASE_24.cmd"
