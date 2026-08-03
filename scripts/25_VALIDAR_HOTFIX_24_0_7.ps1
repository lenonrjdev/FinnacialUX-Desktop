$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PatchScript = Join-Path $PSScriptRoot "25_PATCH_WINDOWS_SIGNING_SANITIZER.mjs"
$WindowsScript = Join-Path $ProjectRoot "scripts\windows-signing.mjs"
$VitestCli = Join-Path $ProjectRoot "node_modules\vitest\vitest.mjs"
$EslintCli = Join-Path $ProjectRoot "node_modules\eslint\bin\eslint.js"
$PreviousHotfixValidator = Join-Path $ProjectRoot "25_VALIDAR_HOTFIX_24_0_6.cmd"

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

  Write-Host "FINNACIALUX DESKTOP - VALIDACAO DO HOTFIX 24.0.7"
  Write-Host "Raiz: $ProjectRoot"
  Write-Host ""

  foreach ($RequiredFile in @($PatchScript, $WindowsScript, $VitestCli, $EslintCli, $PreviousHotfixValidator)) {
    if (-not (Test-Path $RequiredFile)) {
      throw "Arquivo obrigatorio nao encontrado: $RequiredFile"
    }
  }

  $Node = (Get-Command node.exe -ErrorAction Stop).Source

  Write-Host "==> Confirmando o contrato do sanitizador"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $PatchScript,
    "verify",
    $ProjectRoot
  ) -FailureMessage "O sanitizador ou seus testes ainda estao incorretos."

  Write-Host ""
  Write-Host "==> Reexecutando o teste unitario direcionado"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $VitestCli,
    "run",
    "tests/unit/windows-signing-engine.test.ts"
  ) -FailureMessage "A regressao de sanitizacao ainda permanece."

  Write-Host ""
  Write-Host "==> Exigindo lint limpo nos arquivos alterados"
  Invoke-CheckedCommand -Command $Node -Arguments @(
    $EslintCli,
    "lib/windows-signing-engine.ts",
    "tests/unit/windows-signing-engine.test.ts",
    "scripts/windows-signing.mjs",
    "--max-warnings=0"
  ) -FailureMessage "Os arquivos do hotfix ainda possuem erro ou aviso de lint."

  Write-Host ""
  Write-Host "==> Reexecutando toda a homologacao acumulada do Hotfix 24.0.6"
  & $PreviousHotfixValidator
  if ($LASTEXITCODE -ne 0) {
    throw "A homologacao completa acumulada ainda encontrou regressao."
  }

  Write-Host ""
  Write-Host "HOTFIX 24.0.7 VALIDADO COM SUCESSO"
  Write-Host "Versao: 1.5.0"
  Write-Host "Schema: 14 (congelado)"
  Write-Host "Sanitizacao, testes, lint, lockfile, npm audit e suite completa aprovados."
}
catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
