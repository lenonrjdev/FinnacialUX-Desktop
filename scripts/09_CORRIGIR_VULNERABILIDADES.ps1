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

function Read-PackageVersion([string]$PackagePath) {
  if (-not (Test-Path $PackagePath)) { return "ausente" }
  try { return (Get-Content $PackagePath -Raw | ConvertFrom-Json).version }
  catch { return "invalido" }
}

function Restore-OriginalProject(
  [string]$BackupDirectory,
  [string]$OriginalNodeModules,
  [string]$RootNodeModules
) {
  Write-Host ""
  Write-Host "Restaurando o estado anterior do projeto..." -ForegroundColor Yellow

  $files = @(
    "package.json",
    "package-lock.json",
    "src-tauri\Cargo.toml",
    "src-tauri\tauri.conf.json"
  )

  if (Test-Path $RootNodeModules) {
    Remove-Item $RootNodeModules -Recurse -Force -ErrorAction SilentlyContinue
  }

  foreach ($relative in $files) {
    $target = Join-Path $Root $relative
    $backup = Join-Path $BackupDirectory $relative

    if (Test-Path $target) { Remove-Item $target -Force -ErrorAction SilentlyContinue }
    if (Test-Path $backup) {
      $parent = Split-Path -Parent $target
      if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
      Copy-Item $backup $target -Force
    }
  }

  if (Test-Path $OriginalNodeModules) {
    Move-Item $OriginalNodeModules $RootNodeModules -Force
  }
}

Write-Host "FINNACIALUX DESKTOP - HOTFIX 8.0.6 - RESOLUCAO MINIMATCH AUTOSSUFICIENTE" -ForegroundColor Green
Write-Host "Raiz: $Root"
Write-Host "A instalacao atual permanecera intacta ate a arvore 0.8.6 passar na auditoria." -ForegroundColor DarkGray
Write-Host "Nenhuma atualizacao com --force sera executada." -ForegroundColor DarkGray

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js 22 ou superior nao foi encontrado." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm nao foi encontrado." }

$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 22) { throw "Use Node.js 22 ou superior para aplicar este hotfix." }

$rootPackage = Join-Path $Root "package.json"
$rootLock = Join-Path $Root "package-lock.json"
$rootNodeModules = Join-Path $Root "node_modules"
$rootCargo = Join-Path $Root "src-tauri\Cargo.toml"
$rootTauri = Join-Path $Root "src-tauri\tauri.conf.json"
$rootVendor = Join-Path $Root "vendor\minimatch-v3-secure-compat"
$patchScript = Join-Path $Root "scripts\patch-secure-dependencies.mjs"
$validatorScript = Join-Path $Root "scripts\validate-installed-dependencies.mjs"
$compatScript = Join-Path $Root "scripts\check-minimatch-compat.mjs"
$versionScript = Join-Path $Root "scripts\finalize-hotfix-version.mjs"

foreach ($required in @($rootPackage, $rootCargo, $rootTauri, $rootVendor, $patchScript, $validatorScript, $compatScript, $versionScript)) {
  if (-not (Test-Path $required)) { throw "Arquivo obrigatorio nao encontrado: $required" }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDirectory = Join-Path $Root ".dependency-backup\$timestamp"
$tempName = "FinnacialUX-dependency-staging-$timestamp-$PID"
$stagingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) $tempName
$stagingPackage = Join-Path $stagingDirectory "package.json"
$stagingLock = Join-Path $stagingDirectory "package-lock.json"
$stagingVendorRoot = Join-Path $stagingDirectory "vendor"
$stagingVendor = Join-Path $stagingVendorRoot "minimatch-v3-secure-compat"
$originalNodeModules = Join-Path $backupDirectory "node_modules.original"

$rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
$stagingFull = [System.IO.Path]::GetFullPath($stagingDirectory).TrimEnd('\')
if ($stagingFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "A pasta de staging deve ficar fora da raiz do projeto."
}

New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $backupDirectory "src-tauri") -Force | Out-Null
New-Item -ItemType Directory -Path $stagingVendorRoot -Force | Out-Null

Copy-Item $rootPackage (Join-Path $backupDirectory "package.json") -Force
if (Test-Path $rootLock) { Copy-Item $rootLock (Join-Path $backupDirectory "package-lock.json") -Force }
Copy-Item $rootCargo (Join-Path $backupDirectory "src-tauri\Cargo.toml") -Force
Copy-Item $rootTauri (Join-Path $backupDirectory "src-tauri\tauri.conf.json") -Force
Copy-Item $rootPackage $stagingPackage -Force
Copy-Item $rootVendor $stagingVendor -Recurse -Force

Write-Host "Versao atual do manifesto: $(Read-PackageVersion $rootPackage)"
Write-Host "Backup: $backupDirectory" -ForegroundColor DarkGray
Write-Host "Staging externo: $stagingDirectory" -ForegroundColor DarkGray

$swapStarted = $false

try {
  Run-Step "Preparando o package.json 0.8.6 no staging externo" {
    node $patchScript $stagingPackage
  } "Nao foi possivel preparar o manifesto seguro."

  Run-Step "Verificando o cache do npm" {
    npm cache verify
  } "O cache do npm nao passou na verificacao."

  Push-Location $stagingDirectory
  try {
    Run-Step "Gerando o lockfile com camada minimatch autossuficiente" {
      npm install --package-lock-only --ignore-scripts --no-audit --no-fund
    } "Nao foi possivel gerar o package-lock.json seguro."

    if (-not (Test-Path $stagingLock)) { throw "O npm terminou sem criar o package-lock.json no staging." }

    Run-Step "Instalando a arvore auditavel no staging externo" {
      npm ci --no-audit --no-fund
    } "A instalacao isolada das dependencias falhou."

    Run-Step "Validando manifesto, lockfile e dependencias" {
      node $validatorScript $stagingDirectory
    } "A arvore isolada ficou inconsistente."

    Run-Step "Validando a API legada e a resolucao interna do minimatch" {
      node $compatScript $stagingDirectory
    } "A camada de compatibilidade do minimatch falhou."

    Run-Step "Auditando vulnerabilidades altas e criticas no staging" {
      npm audit --audit-level=high
    } "A arvore isolada ainda possui vulnerabilidade alta ou critica."
  } finally {
    Pop-Location
  }

  Step "Aplicando a arvore aprovada na raiz"
  $swapStarted = $true

  if (Test-Path $rootNodeModules) { Move-Item $rootNodeModules $originalNodeModules -Force }

  Copy-Item $stagingPackage $rootPackage -Force
  Copy-Item $stagingLock $rootLock -Force

  Run-Step "Instalando exatamente o lockfile aprovado na raiz" {
    npm ci --no-audit --no-fund
  } "A instalacao final na raiz falhou."

  Run-Step "Confirmando manifesto, lockfile e dependencias na raiz" {
    node $validatorScript $Root
  } "Manifesto, lockfile ou dependencias ficaram inconsistentes na raiz."

  Run-Step "Confirmando a compatibilidade do minimatch na raiz" {
    node $compatScript $Root
  } "A camada de compatibilidade do minimatch falhou na raiz."

  Run-Step "Confirmando a auditoria final" {
    npm audit --audit-level=high
  } "A auditoria final encontrou vulnerabilidade alta ou critica."

  Run-Step "Atualizando as versoes nativas somente apos a auditoria" {
    node $versionScript $Root 0.8.6
  } "Nao foi possivel atualizar Cargo.toml e tauri.conf.json."

  if (Test-Path $originalNodeModules) { Remove-Item $originalNodeModules -Recurse -Force }
  if (Test-Path $stagingDirectory) { Remove-Item $stagingDirectory -Recurse -Force -ErrorAction SilentlyContinue }

  Write-Host ""
  Write-Host "HOTFIX 8.0.6 CONSOLIDADO COM SUCESSO" -ForegroundColor Green
  Write-Host "A camada minimatch agora resolve sua implementacao segura sem depender do hoisting do npm."
  Write-Host "Execute agora: .\VALIDAR_PROJETO.cmd" -ForegroundColor Yellow
} catch {
  if ($swapStarted) { Restore-OriginalProject $backupDirectory $originalNodeModules $rootNodeModules }

  Write-Host ""
  Write-Host "O projeto original foi preservado." -ForegroundColor Yellow
  Write-Host "Backup: $backupDirectory" -ForegroundColor Yellow
  Write-Host "Staging mantido para diagnostico: $stagingDirectory" -ForegroundColor Yellow
  throw
}
