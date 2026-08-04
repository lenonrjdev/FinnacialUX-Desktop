$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PatchScript = Join-Path $PSScriptRoot "25_PATCH_CODE_SIGNING_EKU_SAFE.mjs"
$SigningLibrary = Join-Path $ProjectRoot "scripts\windows-signing.ps1"
$EnvironmentValidator = Join-Path $ProjectRoot "scripts\25_VALIDAR_AMBIENTE_ASSINATURA_WINDOWS.ps1"
$LocalConfig = Join-Path $ProjectRoot "release\windows-signing.local.json"
$PreviousHotfixValidator = Join-Path $ProjectRoot "25_VALIDAR_HOTFIX_24_0_7.cmd"

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$FailureMessage
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw $FailureMessage }
}

try {
  Set-Location $ProjectRoot

  Write-Host "FINNACIALUX DESKTOP - VALIDACAO DO HOTFIX 24.0.9"
  Write-Host "Raiz: $ProjectRoot"
  Write-Host ""

  foreach ($RequiredFile in @($PatchScript, $SigningLibrary, $EnvironmentValidator, $LocalConfig, $PreviousHotfixValidator)) {
    if (-not (Test-Path $RequiredFile)) { throw "Arquivo obrigatorio nao encontrado: $RequiredFile" }
  }

  $Node = (Get-Command node.exe -ErrorAction Stop).Source

  Write-Host "==> Confirmando que nao existem acessos inseguros a propriedades opcionais"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $PatchScript,
    "verify",
    $ProjectRoot
  ) -FailureMessage "O validador EKU ainda possui leitura insegura."

  Write-Host ""
  Write-Host "==> Validando o certificado real configurado"
  & $EnvironmentValidator -RequireReady
  if ($LASTEXITCODE -ne 0) {
    throw "O certificado configurado ainda nao foi aprovado."
  }

  Write-Host ""
  Write-Host "==> Reexecutando a homologacao acumulada do Hotfix 24.0.7"
  & $PreviousHotfixValidator
  if ($LASTEXITCODE -ne 0) {
    throw "A homologacao acumulada anterior encontrou regressao."
  }

  Write-Host ""
  Write-Host "==> Reconfirmando o ambiente de assinatura apos toda a suite"
  & $EnvironmentValidator -RequireReady
  if ($LASTEXITCODE -ne 0) {
    throw "O ambiente de assinatura deixou de ser valido apos a suite acumulada."
  }

  Write-Host ""
  Write-Host "HOTFIX 24.0.9 VALIDADO COM SUCESSO"
  Write-Host "Versao: 1.5.0"
  Write-Host "Schema: 14 (congelado)"
  Write-Host "Certificado de teste, SignTool, EKU e suite acumulada aprovados."
}
catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
