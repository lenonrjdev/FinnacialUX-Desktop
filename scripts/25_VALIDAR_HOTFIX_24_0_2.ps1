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

Step "Validando lockfile, overrides e auditoria do Hotfix 24.0.2"
node scripts\25_CORRIGIR_BRACE_EXPANSION.mjs verify $Root
if ($LASTEXITCODE -ne 0) {
  throw "A validacao do Hotfix 24.0.2 falhou."
}

Write-Host ""
Write-Host "HOTFIX 24.0.2 VALIDADO COM SUCESSO" -ForegroundColor Green
Write-Host "Versao do aplicativo: 1.5.0"
Write-Host "Schema SQLCipher: 14 (inalterado)"
Write-Host "Proximo passo: .\25_VALIDAR_FASE_24.cmd"
