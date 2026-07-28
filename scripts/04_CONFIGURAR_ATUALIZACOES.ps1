$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $Encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $Encoding)
}

if (-not (Test-Path ".\node_modules")) {
  throw "Dependências não instaladas. Execute primeiro .\01_CONFIGURAR_DESKTOP.cmd"
}

Write-Host "FINNACIALUX DESKTOP - CONFIGURAÇÃO DE ATUALIZAÇÕES" -ForegroundColor Cyan
$DefaultOwner = "lenonrjdev"
$Owner = Read-Host "Usuário ou organização do GitHub [$DefaultOwner]"
if ([string]::IsNullOrWhiteSpace($Owner)) { $Owner = $DefaultOwner }
$DefaultRepository = "FinnacialUX-Desktop"
$Repository = Read-Host "Repositório de releases [$DefaultRepository]"
if ([string]::IsNullOrWhiteSpace($Repository)) { $Repository = $DefaultRepository }

$KeyDirectory = Join-Path $HOME ".finnacialux-release"
$PrivateKeyPath = Join-Path $KeyDirectory "finnacialux-updater.key"
New-Item -ItemType Directory -Force -Path $KeyDirectory | Out-Null

$ResolvedRoot = [System.IO.Path]::GetFullPath($Root)
$ResolvedKey = [System.IO.Path]::GetFullPath($PrivateKeyPath)
if ($ResolvedKey.StartsWith($ResolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "A chave privada não pode ficar dentro da pasta do projeto."
}

if (-not (Test-Path $PrivateKeyPath)) {
  Write-Host "`nGerando o par de chaves do updater fora do projeto..." -ForegroundColor Yellow
  Write-Host "Crie uma senha forte e guarde-a em um gerenciador de senhas." -ForegroundColor Yellow
  & npm run tauri -- signer generate -w $PrivateKeyPath
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível gerar as chaves do updater." }
}

$PublicKeyPath = "$PrivateKeyPath.pub"
if (-not (Test-Path $PublicKeyPath)) {
  throw "A chave pública não foi encontrada em $PublicKeyPath"
}
$PublicKey = (Get-Content $PublicKeyPath -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($PublicKey)) { throw "A chave pública está vazia." }

$Endpoint = "https://github.com/$Owner/$Repository/releases/latest/download/latest.json"
$RepositoryUrl = "https://github.com/$Owner/$Repository"
$UpdaterConfig = [ordered]@{
  '$schema' = "https://schema.tauri.app/config/2"
  plugins = [ordered]@{
    updater = [ordered]@{
      pubkey = $PublicKey
      endpoints = @($Endpoint)
      windows = [ordered]@{ installMode = "passive" }
    }
  }
}
$PublicConfig = [ordered]@{
  enabled = $true
  channel = "stable"
  repositoryUrl = $RepositoryUrl
  endpoint = $Endpoint
  configuredAt = [DateTime]::UtcNow.ToString("o")
}
$LocalConfig = [ordered]@{
  owner = $Owner
  repository = $Repository
  repositoryUrl = $RepositoryUrl
  privateKeyPath = $PrivateKeyPath
  releaseTagPrefix = "desktop-v"
}

New-Item -ItemType Directory -Force -Path ".release" | Out-Null
Write-Utf8NoBom (Join-Path $Root "src-tauri\tauri.updater.conf.json") (($UpdaterConfig | ConvertTo-Json -Depth 8) + "`n")
Write-Utf8NoBom (Join-Path $Root "release\updater-config.json") (($PublicConfig | ConvertTo-Json -Depth 5) + "`n")
Write-Utf8NoBom (Join-Path $Root ".release\updater.local.json") (($LocalConfig | ConvertTo-Json -Depth 5) + "`n")

Write-Host "`nAtualizações configuradas com sucesso." -ForegroundColor Green
Write-Host "Chave privada: $PrivateKeyPath" -ForegroundColor Yellow
Write-Host "Chave pública incorporada em: src-tauri\tauri.updater.conf.json"
Write-Host "Assinatura de artefatos habilitada por: src-tauri\tauri.release.conf.json"
Write-Host "Endpoint estável: $Endpoint"
Write-Host "`nNUNCA envie a chave privada no GitHub, em ZIPs ou dentro do instalador." -ForegroundColor Red
Write-Host "Faça duas cópias seguras da chave e da senha. Depois gere a release com .\05_GERAR_RELEASE.cmd"
