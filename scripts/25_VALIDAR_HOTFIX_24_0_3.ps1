$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$NodeScript = Join-Path $PSScriptRoot "25_CORRIGIR_BRACE_EXPANSION.mjs"
$PhaseValidator = Join-Path $ProjectRoot "25_VALIDAR_FASE_24.cmd"
$TreeJson = Join-Path $env:TEMP ("finnacialux-brace-expansion-tree-" + [guid]::NewGuid().ToString("N") + ".json")
$TreeError = Join-Path $env:TEMP ("finnacialux-brace-expansion-tree-" + [guid]::NewGuid().ToString("N") + ".log")

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

  Write-Host "FINNACIALUX DESKTOP - VALIDACAO DO HOTFIX 24.0.3"
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
  ) -FailureMessage "O lockfile nao atende ao advisory GHSA-rgw5-rvv9-x895."

  if (-not (Test-Path $PhaseValidator)) {
    throw "25_VALIDAR_FASE_24.cmd nao foi encontrado na raiz do projeto."
  }

  Write-Host ""
  Write-Host "==> Executando a validacao completa da Fase 24"
  & $PhaseValidator
  if ($LASTEXITCODE -ne 0) {
    throw "A validacao completa da Fase 24 falhou."
  }

  Write-Host ""
  Write-Host "==> Conferindo a arvore npm realmente instalada"
  $TreeOutput = & $Npm ls brace-expansion --all --json 2> $TreeError
  $TreeExitCode = $LASTEXITCODE
  [System.IO.File]::WriteAllText(
    $TreeJson,
    ($TreeOutput -join [Environment]::NewLine),
    [System.Text.UTF8Encoding]::new($false)
  )

  if ($TreeExitCode -ne 0) {
    $ErrorText = if (Test-Path $TreeError) { Get-Content $TreeError -Raw } else { "" }
    throw "npm ls encontrou uma arvore invalida. $ErrorText"
  }

  Invoke-CheckedCommand -Command $Node -Arguments @(
    $NodeScript,
    "verify-tree",
    "--input",
    $TreeJson
  ) -FailureMessage "A arvore instalada ainda contem uma versao vulneravel."

  Write-Host ""
  Write-Host "HOTFIX 24.0.3 VALIDADO COM SUCESSO"
  Write-Host "Versao: 1.5.0"
  Write-Host "Schema: 14 (congelado)"
  Write-Host "Auditoria e arvore brace-expansion aprovadas."
}
catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
finally {
  Remove-Item $TreeJson -Force -ErrorAction SilentlyContinue
  Remove-Item $TreeError -Force -ErrorAction SilentlyContinue
}
