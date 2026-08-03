$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$TargetValidator = Join-Path $PSScriptRoot "validate-installed-dependencies.mjs"
$PatchScript = Join-Path $PSScriptRoot "25_PATCH_VALIDATE_INSTALLED_DEPENDENCIES.mjs"
$PreviousHotfixValidator = Join-Path $ProjectRoot "25_VALIDAR_HOTFIX_24_0_5.cmd"

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

  Write-Host "FINNACIALUX DESKTOP - VALIDACAO DO HOTFIX 24.0.6"
  Write-Host "Raiz: $ProjectRoot"
  Write-Host ""

  foreach ($RequiredFile in @($TargetValidator, $PatchScript, $PreviousHotfixValidator)) {
    if (-not (Test-Path $RequiredFile)) {
      throw "Arquivo obrigatorio nao encontrado: $RequiredFile"
    }
  }

  $Node = (Get-Command node.exe -ErrorAction Stop).Source

  Write-Host "==> Confirmando a nova regra do validador acumulado"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $PatchScript,
    "verify",
    $TargetValidator
  ) -FailureMessage "O validador acumulado ainda possui a regra antiga de brace-expansion."

  Write-Host ""
  Write-Host "==> Reexecutando toda a homologacao do Hotfix 24.0.5"
  & $PreviousHotfixValidator
  if ($LASTEXITCODE -ne 0) {
    throw "A homologacao completa do Hotfix 24.0.5 ainda encontrou regressao."
  }

  Write-Host ""
  Write-Host "HOTFIX 24.0.6 VALIDADO COM SUCESSO"
  Write-Host "Versao: 1.5.0"
  Write-Host "Schema: 14 (congelado)"
  Write-Host "Validador acumulado, npm ci, lockfile, minimatch, suite completa e auditoria aprovados."
}
catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
