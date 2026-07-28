param(
  [string]$Version = "",
  [string]$NotesFile = "",
  [switch]$Ci,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
. (Join-Path $PSScriptRoot "libsodium-cache.ps1")

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

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $Encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $Encoding)
}

function Write-Stage([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Get-ReleaseInstaller([string]$NsisDirectory, [string]$ReleaseVersion) {
  Write-Stage "Localizando instalador NSIS e assinatura"

  if (-not (Test-Path $NsisDirectory)) {
    throw "Pasta NSIS nao encontrada: $NsisDirectory"
  }

  $VersionPattern = "*_$ReleaseVersion`_x64-setup.exe"
  $Installer = Get-ChildItem $NsisDirectory -File -Filter $VersionPattern |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $Installer) {
    $Installer = Get-ChildItem $NsisDirectory -File -Filter "*.exe" |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
  }

  if (-not $Installer) {
    throw "Instalador NSIS nao encontrado em $NsisDirectory"
  }

  $SignatureSource = "$($Installer.FullName).sig"
  if (-not (Test-Path $SignatureSource)) {
    throw "Assinatura do updater nao encontrada: $SignatureSource"
  }

  $Installer.Refresh()
  if ($Installer.Length -le 0) {
    throw "O instalador NSIS esta vazio: $($Installer.FullName)"
  }

  Write-Host "Instalador: $($Installer.FullName)" -ForegroundColor Green
  Write-Host "Tamanho: $([Math]::Round($Installer.Length / 1MB, 2)) MB"
  Write-Host "Assinatura: $SignatureSource" -ForegroundColor Green

  return [pscustomobject]@{
    Installer = $Installer
    Signature = $SignatureSource
  }
}

function Remove-FileIfExists([string]$Path) {
  if (Test-Path $Path) {
    Remove-Item $Path -Force -ErrorAction Stop
  }
}

function Copy-FileAtomicWithProgress(
  [string]$Source,
  [string]$Destination,
  [string]$Label
) {
  $Partial = "$Destination.partial"
  Remove-FileIfExists $Partial

  $SourceStream = $null
  $DestinationStream = $null
  try {
    $SourceStream = New-Object System.IO.FileStream(
      $Source,
      [System.IO.FileMode]::Open,
      [System.IO.FileAccess]::Read,
      [System.IO.FileShare]::ReadWrite
    )

    $DestinationStream = New-Object System.IO.FileStream(
      $Partial,
      [System.IO.FileMode]::Create,
      [System.IO.FileAccess]::Write,
      [System.IO.FileShare]::None
    )

    $Total = $SourceStream.Length
    if ($Total -le 0) {
      throw "O arquivo de origem esta vazio: $Source"
    }

    $Buffer = New-Object byte[] (4MB)
    $Copied = [int64]0
    $LastPercent = -1

    while (($Read = $SourceStream.Read($Buffer, 0, $Buffer.Length)) -gt 0) {
      $DestinationStream.Write($Buffer, 0, $Read)
      $Copied += $Read
      $Percent = [Math]::Min(100, [int](($Copied * 100) / $Total))

      if ($Percent -ge ($LastPercent + 5) -or $Percent -eq 100) {
        Write-Progress -Activity $Label -Status "$Percent%" -PercentComplete $Percent
        Write-Host ("  {0}% ({1:N2} MB de {2:N2} MB)" -f $Percent, ($Copied / 1MB), ($Total / 1MB))
        $LastPercent = $Percent
      }
    }

    $DestinationStream.Flush()
  }
  finally {
    if ($DestinationStream) { $DestinationStream.Dispose() }
    if ($SourceStream) { $SourceStream.Dispose() }
    Write-Progress -Activity $Label -Completed
  }

  Remove-FileIfExists $Destination
  Move-Item $Partial $Destination -Force
}

function Get-Sha256WithProgress([string]$Path) {
  $Stream = $null
  $Sha = $null
  try {
    $Stream = New-Object System.IO.FileStream(
      $Path,
      [System.IO.FileMode]::Open,
      [System.IO.FileAccess]::Read,
      [System.IO.FileShare]::Read
    )
    $Sha = [System.Security.Cryptography.SHA256]::Create()
    $Buffer = New-Object byte[] (4MB)
    $Total = $Stream.Length
    $Processed = [int64]0
    $LastPercent = -1

    while (($Read = $Stream.Read($Buffer, 0, $Buffer.Length)) -gt 0) {
      [void]$Sha.TransformBlock($Buffer, 0, $Read, $Buffer, 0)
      $Processed += $Read
      $Percent = if ($Total -gt 0) { [Math]::Min(100, [int](($Processed * 100) / $Total)) } else { 100 }
      if ($Percent -ge ($LastPercent + 10) -or $Percent -eq 100) {
        Write-Progress -Activity "Calculando SHA-256" -Status "$Percent%" -PercentComplete $Percent
        $LastPercent = $Percent
      }
    }

    [void]$Sha.TransformFinalBlock((New-Object byte[] 0), 0, 0)
    return ([BitConverter]::ToString($Sha.Hash)).Replace('-', '').ToLowerInvariant()
  }
  finally {
    if ($Sha) { $Sha.Dispose() }
    if ($Stream) { $Stream.Dispose() }
    Write-Progress -Activity "Calculando SHA-256" -Completed
  }
}

function Finalize-Release(
  [string]$ReleaseVersion,
  [string]$Repository,
  [string]$ReleaseNotesFile
) {
  $CurrentStage = "inicio"
  try {
    $CurrentStage = "localizacao dos artefatos"
    $Nsis = Join-Path $Root "src-tauri\target\release\bundle\nsis"
    $Artifacts = Get-ReleaseInstaller -NsisDirectory $Nsis -ReleaseVersion $ReleaseVersion

    $CurrentStage = "preparacao da pasta final"
    Write-Stage "Preparando pasta da release"
    $ReleaseDir = Join-Path $Root "releases\$ReleaseVersion"
    New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null

    $AssetName = "FinnacialUX-Desktop_${ReleaseVersion}_x64-setup.exe"
    $AssetPath = Join-Path $ReleaseDir $AssetName
    $SignaturePath = "$AssetPath.sig"

    @(
      $AssetPath,
      $SignaturePath,
      "$AssetPath.partial",
      "$SignaturePath.partial",
      (Join-Path $ReleaseDir "latest.json"),
      (Join-Path $ReleaseDir "SHA256SUMS.txt"),
      (Join-Path $ReleaseDir "release-manifest.json"),
      (Join-Path $ReleaseDir "RELEASE_NOTES.md")
    ) | ForEach-Object { Remove-FileIfExists $_ }

    $CurrentStage = "copia do instalador"
    Write-Stage "Copiando instalador para a pasta final"
    Copy-FileAtomicWithProgress -Source $Artifacts.Installer.FullName -Destination $AssetPath -Label "Copiando instalador"

    $CurrentStage = "copia da assinatura"
    Write-Stage "Copiando assinatura do updater"
    Copy-FileAtomicWithProgress -Source $Artifacts.Signature -Destination $SignaturePath -Label "Copiando assinatura"

    $CurrentStage = "leitura da assinatura"
    $Tag = "desktop-v$ReleaseVersion"
    $DownloadUrl = "https://github.com/$Repository/releases/download/$Tag/$AssetName"
    $Signature = (Get-Content $SignaturePath -Raw).Trim()
    if ([string]::IsNullOrWhiteSpace($Signature)) {
      throw "O arquivo de assinatura esta vazio: $SignaturePath"
    }

    $CurrentStage = "geracao do latest.json"
    Write-Stage "Gerando latest.json"
    $Notes = Get-Content $ReleaseNotesFile -Raw
    $Latest = [ordered]@{
      version = $ReleaseVersion
      notes = $Notes
      pub_date = [DateTime]::UtcNow.ToString("o")
      platforms = [ordered]@{
        'windows-x86_64' = [ordered]@{
          signature = $Signature
          url = $DownloadUrl
        }
      }
    }
    Write-Utf8NoBom (Join-Path $ReleaseDir "latest.json") (($Latest | ConvertTo-Json -Depth 8) + "`n")

    $CurrentStage = "calculo do SHA-256"
    Write-Stage "Calculando SHA-256 do instalador"
    $Hash = Get-Sha256WithProgress $AssetPath
    Write-Utf8NoBom (Join-Path $ReleaseDir "SHA256SUMS.txt") "$Hash  $AssetName`n"

    $CurrentStage = "geracao do manifesto"
    Write-Stage "Gerando manifesto tecnico"
    $Manifest = [ordered]@{
      product = "FinnacialUX Desktop"
      version = $ReleaseVersion
      tag = $Tag
      repository = $Repository
      installer = $AssetName
      updaterSignature = "$AssetName.sig"
      updaterManifest = "latest.json"
      sha256 = $Hash
      generatedAt = [DateTime]::UtcNow.ToString("o")
    }
    Write-Utf8NoBom (Join-Path $ReleaseDir "release-manifest.json") (($Manifest | ConvertTo-Json -Depth 6) + "`n")

    $CurrentStage = "copia das notas"
    Write-Stage "Copiando notas da versao"
    Copy-Item $ReleaseNotesFile (Join-Path $ReleaseDir "RELEASE_NOTES.md") -Force

    $CurrentStage = "validacao final"
    $Required = @(
      $AssetName,
      "$AssetName.sig",
      "latest.json",
      "SHA256SUMS.txt",
      "release-manifest.json",
      "RELEASE_NOTES.md"
    )
    foreach ($Name in $Required) {
      $Path = Join-Path $ReleaseDir $Name
      if (-not (Test-Path $Path)) {
        throw "Arquivo final ausente: $Path"
      }
      if ((Get-Item $Path).Length -le 0) {
        throw "Arquivo final vazio: $Path"
      }
    }

    Write-Host "`nRelease preparada com sucesso:" -ForegroundColor Green
    Write-Host $ReleaseDir
    Get-ChildItem $ReleaseDir | Sort-Object Name | ForEach-Object {
      Write-Host " - $($_.Name)"
    }
    Write-Host "`nNenhuma chave privada foi copiada para a pasta da release." -ForegroundColor Green
  }
  catch {
    throw "Falha durante a etapa '$CurrentStage': $($_.Exception.Message)"
  }
}

if (-not (Test-Path ".\node_modules")) {
  throw "Execute primeiro .\01_CONFIGURAR_DESKTOP.cmd"
}
if (-not (Test-Path ".\src-tauri\tauri.updater.conf.json")) {
  throw "Execute primeiro .\04_CONFIGURAR_ATUALIZACOES.cmd"
}
if (-not (Test-Path ".\src-tauri\tauri.release.conf.json")) {
  throw "Configuracao de release ausente: src-tauri\tauri.release.conf.json"
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
  throw "Repositorio nao resolvido. Execute 04_CONFIGURAR_ATUALIZACOES.cmd ou defina GITHUB_REPOSITORY."
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

    if (Test-Path ".\src-tauri\tauri.windows-signing.conf.json") {
      $BuildArguments += @("--config", "src-tauri/tauri.windows-signing.conf.json")
      Write-Host "Assinatura de editor do Windows: configurada" -ForegroundColor Green
    }
    else {
      Write-Host "Assinatura de editor do Windows: nao configurada (updater continua assinado)" -ForegroundColor Yellow
    }

    # Executa a CLI diretamente. Isto evita o processo npm intermediario que pode
    # permanecer aberto no Windows mesmo depois de o Tauri concluir o bundle.
    & $TauriCli @BuildArguments
    if ($LASTEXITCODE -ne 0) {
      throw "O build da release falhou."
    }

    Write-Host "`nBuild concluido. Organizando os artefatos da release..." -ForegroundColor Cyan
  }
  else {
    Write-Host "FINNACIALUX DESKTOP - FINALIZANDO RELEASE EXISTENTE $Version" -ForegroundColor Cyan
    Write-Host "O instalador e o arquivo .sig existentes serao reutilizados; nenhum novo build sera executado." -ForegroundColor Yellow
  }

  Finalize-Release -ReleaseVersion $Version -Repository $RepositoryFull -ReleaseNotesFile $NotesFile
}
finally {
  if (-not $PrivateKeyWasSet) {
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
  }
  if (-not $PasswordWasSet) {
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
  }
}
