$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$NodeValidator = Join-Path $PSScriptRoot "25_VALIDAR_LOCK_MINIMATCH_SECURE.mjs"
$CompatValidator = Join-Path $PSScriptRoot "check-minimatch-compat.mjs"
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

  Write-Host "FINNACIALUX DESKTOP - VALIDACAO DO HOTFIX 24.0.5"
  Write-Host "Raiz: $ProjectRoot"
  Write-Host ""

  $Node = (Get-Command node.exe -ErrorAction Stop).Source
  $Npm = (Get-Command npm.cmd -ErrorAction Stop).Source

  foreach ($RequiredFile in @($NodeValidator, $CompatValidator, $PhaseValidator)) {
    if (-not (Test-Path $RequiredFile)) {
      throw "Arquivo obrigatorio nao encontrado: $RequiredFile"
    }
  }

  Write-Host "==> Validando manifesto, vendor e package-lock.json"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeValidator,
    "verify-lock",
    "--root",
    $ProjectRoot
  ) -FailureMessage "O lockfile nao contem o alias minimatch-secure completo."

  Write-Host ""
  Write-Host "==> Executando a validacao completa acumulada da Fase 24"
  & $PhaseValidator
  if ($LASTEXITCODE -ne 0) {
    throw "A validacao completa da Fase 24 falhou."
  }

  Write-Host ""
  Write-Host "==> Conferindo a arvore instalada apos o npm ci acumulado"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeValidator,
    "verify-installed",
    "--root",
    $ProjectRoot
  ) -FailureMessage "A arvore instalada nao corresponde ao lockfile corrigido."

  Invoke-CheckedCommand -Command $Node -Arguments @(
    $CompatValidator,
    $ProjectRoot
  ) -FailureMessage "A API de compatibilidade minimatch falhou na raiz."

  Write-Host ""
  Write-Host "==> Reauditando a arvore final sem correcoes automaticas"
  Invoke-CheckedCommand -Command $Npm -Arguments @(
    "audit",
    "--audit-level=high"
  ) -FailureMessage "A arvore final possui vulnerabilidade alta ou critica."

  Write-Host ""
  Write-Host "HOTFIX 24.0.5 VALIDADO COM SUCESSO"
  Write-Host "Versao: 1.5.0"
  Write-Host "Schema: 14 (congelado)"
  Write-Host "Lockfile, minimatch local, alias, suite completa e auditoria aprovados."
}
catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
