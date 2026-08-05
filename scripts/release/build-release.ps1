param(
  [string]$Version = "",
  [string]$NotesFile = "",
  [switch]$Ci,
  [switch]$SkipBuild,
  [switch]$Offline
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding
Set-StrictMode -Version Latest
. (Join-Path (Split-Path -Parent $PSScriptRoot) "core\command-runner.ps1")
$Root = Get-FinnacialuxProjectRoot -StartPath $PSScriptRoot
Set-Location $Root
. (Join-Path $Root "scripts\core\libsodium-cache.ps1")

function Read-Json([string]$Path) {
  return Get-Content $Path -Raw | ConvertFrom-Json
}

function Convert-SecureStringToPlainText([Security.SecureString]$Value) {
  $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
  }
}

if (-not (Test-Path ".\node_modules")) {
  throw "Execute primeiro .\01_RODAR_PROJETO.cmd"
}
if (-not (Test-Path ".\src-tauri\tauri.updater.conf.json")) {
  throw "Configuração do updater ausente. Execute .\03_VALIDAR_E_PREPARAR_ATUALIZACAO.cmd."
}
if (-not (Test-Path ".\src-tauri\tauri.release.conf.json")) {
  throw "Configuracao de release ausente: src-tauri\tauri.release.conf.json"
}
if (-not (Test-Path ".\scripts\release\finalize-release.mjs")) {
  throw "Finalizador Node.js ausente: scripts\release\finalize-release.mjs"
}

$Package = Read-Json ".\package.json"
$Tauri = Read-Json ".\src-tauri\tauri.conf.json"
$CargoText = Get-Content ".\src-tauri\Cargo.toml" -Raw
$CargoVersion = [regex]::Match(
  $CargoText,
  '(?ms)^\[package\].*?^version\s*=\s*"([^"]+)"'
).Groups[1].Value

if ([string]::IsNullOrWhiteSpace($Version)) {
  $Version = [string]$Package.version
}

if (
  $Version -ne [string]$Package.version -or
  $Version -ne [string]$Tauri.version -or
  $Version -ne $CargoVersion
) {
  throw "As versoes nao coincidem. package.json=$($Package.version), tauri.conf.json=$($Tauri.version), Cargo.toml=$CargoVersion"
}

$ExpectedTag = "desktop-v$Version"
if ($env:GITHUB_REF_NAME -and $env:GITHUB_REF_NAME -ne $ExpectedTag) {
  throw "A tag do GitHub ($($env:GITHUB_REF_NAME)) nao corresponde a versao do projeto ($ExpectedTag)."
}

$Local = $null
if (Test-Path ".\.release\updater.local.json") {
  $Local = Read-Json ".\.release\updater.local.json"
}

$RepositoryFull = if ($env:GITHUB_REPOSITORY) {
  $env:GITHUB_REPOSITORY
}
elseif ($Local) {
  "$($Local.owner)/$($Local.repository)"
}
else {
  ""
}

if ([string]::IsNullOrWhiteSpace($RepositoryFull)) {
  throw "Repositorio não resolvido. Configure o updater pelo fluxo 03 ou defina GITHUB_REPOSITORY."
}

if ([string]::IsNullOrWhiteSpace($NotesFile)) {
  $NotesFile = ".\release\RELEASE_NOTES_$($Version.Replace('.', '_')).md"
}
if (-not (Test-Path $NotesFile)) {
  throw "Notas da versao nao encontradas: $NotesFile"
}

$PrivateKeyWasSet = -not [string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)
$PasswordWasSet = $null -ne $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD

try {
  if (-not $SkipBuild) {
    if (-not $PrivateKeyWasSet) {
      if (-not $Local -or -not (Test-Path $Local.privateKeyPath)) {
        throw "Chave privada do updater nao encontrada."
      }
      $env:TAURI_SIGNING_PRIVATE_KEY = [string]$Local.privateKeyPath
    }

    if (-not $PasswordWasSet -and -not $Ci) {
      $SecurePassword = Read-Host "Senha da chave privada do updater" -AsSecureString
      $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = Convert-SecureStringToPlainText $SecurePassword
    }
    if ($Ci -and -not $PasswordWasSet) {
      throw "O secret TAURI_SIGNING_PRIVATE_KEY_PASSWORD nao foi configurado no CI."
    }

    Initialize-LibsodiumCache -Root $Root
    Write-Host "FINNACIALUX DESKTOP - RELEASE ASSINADA $Version" -ForegroundColor Cyan
    Write-Host "Gerando NSIS e assinatura do updater..." -ForegroundColor Cyan

    $TauriCli = Join-Path $Root "node_modules\.bin\tauri.cmd"
    if (-not (Test-Path $TauriCli)) {
      throw "CLI do Tauri nao encontrada: $TauriCli"
    }

    $BuildArguments = @(
      "build",
      "--config", "src-tauri/tauri.updater.conf.json",
      "--config", "src-tauri/tauri.release.conf.json"
    )

    if ($Offline) {
      $BuildArguments += @("--config", "src-tauri/tauri.offline.conf.json")
    }

    if (Test-Path ".\src-tauri\tauri.windows-signing.conf.json") {
      $BuildArguments += @("--config", "src-tauri/tauri.windows-signing.conf.json")
      Write-Host "Assinatura de editor do Windows: configurada" -ForegroundColor Green
    }
    else {
      Write-Host "Assinatura de editor do Windows: nao configurada (updater continua assinado)" -ForegroundColor Yellow
    }

    Invoke-FinnacialuxNativeCommand $TauriCli $BuildArguments "O build da release falhou."

    Write-Host "`nBuild concluido. A finalizacao sera feita pelo Node.js para evitar travamentos do ConvertTo-Json no Windows PowerShell." -ForegroundColor Cyan
  }
  else {
    Write-Host "FINNACIALUX DESKTOP - FINALIZANDO RELEASE EXISTENTE $Version" -ForegroundColor Cyan
  }

  $FinalizerArguments = @(
    ".\scripts\release\finalize-release.mjs",
    "--version", $Version,
    "--notes", $NotesFile
  )

  $Node = Get-FinnacialuxCommandPath "node.exe"
  Invoke-FinnacialuxNativeCommand $Node $FinalizerArguments "A finalização Node.js da release falhou."
}
finally {
  if (-not $PrivateKeyWasSet) {
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
  }
  if (-not $PasswordWasSet) {
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
  }
}
