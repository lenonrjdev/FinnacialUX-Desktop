$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$NodeScript = Join-Path $PSScriptRoot "25_CORRIGIR_BRACE_EXPANSION.mjs"
$PhaseValidator = Join-Path $ProjectRoot "25_VALIDAR_FASE_24.cmd"

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$FailureMessage
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
}

try {
  Set-Location $ProjectRoot

  Write-Host "FINNACIALUX DESKTOP - VALIDACAO DO HOTFIX 24.0.4"
  Write-Host "Raiz: $ProjectRoot"
  Write-Host ""

  $Node = (Get-Command node.exe -ErrorAction Stop).Source
  $Npm = (Get-Command npm.cmd -ErrorAction Stop).Source

  Write-Host "==> Validando package.json e package-lock.json"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeScript,
    "verify-lock",
    "--root",
    $ProjectRoot
  ) -FailureMessage "O lockfile nao atende ao advisory de brace-expansion."

  if (-not (Test-Path $PhaseValidator)) {
    throw "25_VALIDAR_FASE_24.cmd nao foi encontrado na raiz do projeto."
  }

  Write-Host ""
  Write-Host "==> Executando a validacao completa acumulada da Fase 24"
  & $PhaseValidator
  if ($LASTEXITCODE -ne 0) {
    throw "A validacao completa da Fase 24 falhou."
  }

  Write-Host ""
  Write-Host "==> Conferindo a arvore realmente instalada apos npm ci"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeScript,
    "verify-installed",
    "--root",
    $ProjectRoot
  ) -FailureMessage "A arvore instalada ainda contem brace-expansion vulneravel ou incompleto."

  Write-Host ""
  Write-Host "==> Reauditando a arvore final sem correcoes automaticas"
  Invoke-CheckedCommand -Command $Npm -Arguments @(
    "audit",
    "--audit-level=high"
  ) -FailureMessage "A arvore final possui vulnerabilidade alta ou critica."

  Write-Host ""
  Write-Host "HOTFIX 24.0.4 VALIDADO COM SUCESSO"
  Write-Host "Versao: 1.5.0"
  Write-Host "Schema: 14 (congelado)"
  Write-Host "Lockfile, instalacao, suite completa e auditoria aprovados."
}
catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
