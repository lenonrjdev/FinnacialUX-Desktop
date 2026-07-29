param(
  [string]$Version = "",
  [string]$Repository = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Resolve-GitHubCli {
  $command = Get-Command gh -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $knownPaths = @(
    "C:\Program Files\GitHub CLI\gh.exe",
    (Join-Path $env:LOCALAPPDATA "Programs\GitHub CLI\gh.exe")
  )

  foreach ($path in $knownPaths) {
    if ($path -and (Test-Path $path)) {
      return $path
    }
  }

  throw "GitHub CLI nao encontrado. Feche e abra o PowerShell ou instale com: winget install --id GitHub.cli"
}

function Resolve-Repository {
  param([string]$ExplicitRepository)

  if (-not [string]::IsNullOrWhiteSpace($ExplicitRepository)) {
    return $ExplicitRepository.Trim()
  }

  $updaterConfigPath = Join-Path $Root "release\updater-config.json"
  if (Test-Path $updaterConfigPath) {
    try {
      $updaterConfig = Get-Content $updaterConfigPath -Raw | ConvertFrom-Json
      $candidates = @(
        [string]$updaterConfig.repositoryUrl,
        [string]$updaterConfig.endpoint
      )

      foreach ($candidate in $candidates) {
        if ($candidate -match "github\.com/([^/]+/[^/]+?)(?:\.git|/releases|$)") {
          return $Matches[1]
        }
      }
    } catch {
      Write-Host "Aviso: nao foi possivel ler release\updater-config.json." -ForegroundColor Yellow
    }
  }

  # Fallback oficial deste projeto. Evita depender de um remote antigo que apenas redireciona.
  return "lenonrjdev/FinnacialUX-Desktop"
}

function Test-GitHubReleaseExists {
  param(
    [string]$GhPath,
    [string]$Repo,
    [string]$ReleaseTag
  )

  # No Windows PowerShell 5.1, stderr de programas nativos entra no Error stream.
  # Uma release ausente faz o gh escrever "release not found" e retornar codigo 1.
  # Aqui isso e tratado como resultado normal da sondagem, e nao como falha fatal.
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "SilentlyContinue"
    & $GhPath release view $ReleaseTag --repo $Repo *> $null
    return ($LASTEXITCODE -eq 0)
  } finally {
    $ErrorActionPreference = $previousPreference
  }
}

$Gh = Resolve-GitHubCli
$Package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($Version)) {
  $Version = [string]$Package.version
}

$Repository = Resolve-Repository -ExplicitRepository $Repository
$ReleaseDir = Join-Path $Root "releases\$Version"
if (-not (Test-Path $ReleaseDir)) {
  throw "Release local nao encontrada em: $ReleaseDir. Finalize-a primeiro com .\05B_FINALIZAR_RELEASE_EXISTENTE.cmd"
}

$RequiredFiles = @(
  "FinnacialUX-Desktop_${Version}_x64-setup.exe",
  "FinnacialUX-Desktop_${Version}_x64-setup.exe.sig",
  "latest.json",
  "SHA256SUMS.txt",
  "release-manifest.json",
  "RELEASE_NOTES.md"
)

foreach ($file in $RequiredFiles) {
  $path = Join-Path $ReleaseDir $file
  if (-not (Test-Path $path)) {
    throw "Arquivo obrigatorio ausente na release: $path"
  }
}

Write-Host "FINNACIALUX DESKTOP - PUBLICACAO DA RELEASE $Version" -ForegroundColor Cyan
Write-Host "Repositorio: $Repository"
Write-Host "Pasta local: $ReleaseDir"
Write-Host ""

& $Gh auth status
if ($LASTEXITCODE -ne 0) {
  throw "Entre no GitHub CLI executando: gh auth login"
}

# Confirma acesso ao repositorio antes de iniciar uploads.
# O JSON e interpretado pelo proprio PowerShell para evitar problemas de aspas
# do --jq ao chamar executaveis nativos no Windows PowerShell 5.1.
$previousPreference = $ErrorActionPreference
try {
  $ErrorActionPreference = "SilentlyContinue"
  $repoJsonLines = & $Gh repo view $Repository --json nameWithOwner,visibility 2>$null
  $repoExitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousPreference
}

if ($repoExitCode -ne 0) {
  throw "Nao foi possivel acessar o repositorio $Repository com a conta autenticada."
}

try {
  $repoInfo = (($repoJsonLines -join [Environment]::NewLine) | ConvertFrom-Json)
} catch {
  throw "O GitHub CLI respondeu, mas os dados do repositorio nao puderam ser interpretados."
}

Write-Host ("Repositorio confirmado: {0} [{1}]" -f $repoInfo.nameWithOwner, $repoInfo.visibility) -ForegroundColor Green

$Tag = "desktop-v$Version"
$Notes = Join-Path $ReleaseDir "RELEASE_NOTES.md"
$Assets = Get-ChildItem $ReleaseDir -File |
  Where-Object { $_.Name -ne "RELEASE_NOTES.md" } |
  Sort-Object Name |
  ForEach-Object { $_.FullName }

Write-Host ""
Write-Host "==> Verificando se a release $Tag ja existe" -ForegroundColor Cyan
$ReleaseExists = Test-GitHubReleaseExists -GhPath $Gh -Repo $Repository -ReleaseTag $Tag

if ($ReleaseExists) {
  Write-Host "A release $Tag ja existe. Atualizando os arquivos..." -ForegroundColor Yellow
  & $Gh release upload $Tag @Assets --clobber --repo $Repository
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao atualizar os arquivos da release $Tag."
  }

  & $Gh release edit $Tag --latest --title "FinnacialUX Desktop $Version" --notes-file $Notes --repo $Repository
  if ($LASTEXITCODE -ne 0) {
    throw "Os arquivos foram enviados, mas nao foi possivel atualizar os dados da release $Tag."
  }
} else {
  Write-Host "A release ainda nao existe. Criando $Tag..." -ForegroundColor Green
  & $Gh release create $Tag @Assets `
    --repo $Repository `
    --title "FinnacialUX Desktop $Version" `
    --notes-file $Notes `
    --target main `
    --latest

  if ($LASTEXITCODE -ne 0) {
    throw "A criacao da release $Tag falhou."
  }
}

Write-Host ""
Write-Host "==> Validando a publicacao" -ForegroundColor Cyan
$previousPreference = $ErrorActionPreference
try {
  $ErrorActionPreference = "SilentlyContinue"
  $releaseJsonLines = & $Gh release view $Tag --repo $Repository --json tagName,name,url,isDraft,isPrerelease,assets 2>$null
  $releaseExitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousPreference
}

if ($releaseExitCode -ne 0) {
  throw "A release foi enviada, mas a validacao final falhou."
}

try {
  $releaseInfo = (($releaseJsonLines -join [Environment]::NewLine) | ConvertFrom-Json)
} catch {
  throw "A release foi enviada, mas a resposta final do GitHub nao pode ser interpretada."
}

$assetCount = @($releaseInfo.assets).Count
Write-Host ("Tag: {0}" -f $releaseInfo.tagName)
Write-Host ("Nome: {0}" -f $releaseInfo.name)
Write-Host ("URL: {0}" -f $releaseInfo.url)
Write-Host ("Arquivos publicados: {0}" -f $assetCount)
Write-Host ("Rascunho: {0}" -f $releaseInfo.isDraft)
Write-Host ("Pre-release: {0}" -f $releaseInfo.isPrerelease)

Write-Host ""
Write-Host "Release $Tag publicada com sucesso." -ForegroundColor Green
Write-Host "O endpoint latest.json pode levar alguns segundos para ficar disponivel." -ForegroundColor Yellow
