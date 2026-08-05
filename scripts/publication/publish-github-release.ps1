param(
  [string]$Version = "",
  [string]$Repository = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
. (Join-Path (Split-Path -Parent $PSScriptRoot) "core\command-runner.ps1")
$Root = Get-FinnacialuxProjectRoot -StartPath $PSScriptRoot
Set-Location $Root

function Resolve-GitHubCli {
  $Command = Get-Command "gh.exe" -ErrorAction SilentlyContinue
  if ($Command) { return $Command.Source }
  foreach ($Path in @(
    "C:\Program Files\GitHub CLI\gh.exe",
    (Join-Path $env:LOCALAPPDATA "Programs\GitHub CLI\gh.exe")
  )) {
    if ($Path -and (Test-Path $Path -PathType Leaf)) { return $Path }
  }
  throw "GitHub CLI não encontrado. Instale com: winget install --id GitHub.cli"
}

function Resolve-Repository {
  param([string]$ExplicitRepository)
  if (-not [string]::IsNullOrWhiteSpace($ExplicitRepository)) { return $ExplicitRepository.Trim() }

  $UpdaterConfigPath = Join-Path $Root "release\updater-config.json"
  if (Test-Path $UpdaterConfigPath -PathType Leaf) {
    $UpdaterConfig = Get-Content $UpdaterConfigPath -Raw | ConvertFrom-Json
    foreach ($Candidate in @([string]$UpdaterConfig.repositoryUrl, [string]$UpdaterConfig.endpoint)) {
      if ($Candidate -match "github\.com/([^/]+/[^/]+?)(?:\.git|/releases|$)") { return $Matches[1] }
    }
  }
  throw "Repositório GitHub não resolvido pela configuração pública do updater."
}

function Test-ReleaseExists {
  param([string]$Gh, [string]$Repo, [string]$Tag)
  $PreviousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "SilentlyContinue"
    & $Gh "release" "view" $Tag "--repo" $Repo *> $null
    $ExitCode = $LASTEXITCODE
    return ($ExitCode -eq 0)
  }
  finally { $ErrorActionPreference = $PreviousPreference }
}

$Package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($Version)) { $Version = [string]$Package.version }
if ($Version -ne [string]$Package.version) { throw "A versão solicitada diverge do package.json." }

$Repository = Resolve-Repository -ExplicitRepository $Repository
$ReleaseDirectory = Join-Path $Root "releases\$Version"
$Notes = Join-Path $ReleaseDirectory "RELEASE_NOTES.md"
if (-not (Test-Path $Notes -PathType Leaf)) { throw "Notas da release ausentes: $Notes" }

$Gh = Resolve-GitHubCli
Invoke-FinnacialuxNativeCommand $Gh @("auth", "status") "Autenticação do GitHub CLI ausente. Execute gh auth login."

$RepoOutput = @(& $Gh "repo" "view" $Repository "--json" "nameWithOwner,visibility")
$RepoExitCode = $LASTEXITCODE
if ($RepoExitCode -ne 0) { throw "Não foi possível acessar o repositório $Repository." }
try { $RepoInfo = ([string]::Join([Environment]::NewLine, $RepoOutput) | ConvertFrom-Json) }
catch { throw "A resposta do GitHub para o repositório é inválida." }
Write-Host "Repositório confirmado: $($RepoInfo.nameWithOwner) [$($RepoInfo.visibility)]" -ForegroundColor Green

$Tag = "desktop-v$Version"
if (Test-ReleaseExists -Gh $Gh -Repo $Repository -Tag $Tag) {
  throw "A release $Tag já existe. O fluxo seguro não substitui releases existentes."
}

$Assets = @(Get-ChildItem $ReleaseDirectory -File | Where-Object { $_.Name -ne "RELEASE_NOTES.md" } | Sort-Object Name | ForEach-Object FullName)
if ($Assets.Count -eq 0) { throw "Nenhum artefato foi encontrado para publicação." }

$Arguments = @("release", "create", $Tag) + $Assets + @(
  "--repo", $Repository,
  "--title", "FinnacialUX Desktop $Version",
  "--notes-file", $Notes,
  "--target", "main",
  "--latest"
)
Invoke-FinnacialuxNativeCommand $Gh $Arguments "A criação da release $Tag falhou."

$ReleaseOutput = @(& $Gh "release" "view" $Tag "--repo" $Repository "--json" "tagName,name,url,isDraft,isPrerelease,assets")
$ReleaseExitCode = $LASTEXITCODE
if ($ReleaseExitCode -ne 0) { throw "A release foi enviada, mas a validação final falhou." }
try { $ReleaseInfo = ([string]::Join([Environment]::NewLine, $ReleaseOutput) | ConvertFrom-Json) }
catch { throw "A resposta final do GitHub é inválida." }

Write-Host "`nRelease publicada com sucesso." -ForegroundColor Green
Write-Host "Tag: $($ReleaseInfo.tagName)"
Write-Host "URL: $($ReleaseInfo.url)"
Write-Host "Arquivos publicados: $(@($ReleaseInfo.assets).Count)"
