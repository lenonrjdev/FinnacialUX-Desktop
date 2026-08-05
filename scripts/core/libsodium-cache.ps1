function Initialize-LibsodiumCache {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Root
  )

  $cacheDirectory = Join-Path $Root ".cache\libsodium"
  New-Item -ItemType Directory -Path $cacheDirectory -Force | Out-Null

  $baseUrl = "https://download.libsodium.org/libsodium/releases"
  $artifacts = @(
    @{ Name = "LATEST.tar.gz"; MinimumBytes = 1000000 },
    @{ Name = "LATEST.tar.gz.minisig"; MinimumBytes = 200 },
    @{ Name = "libsodium-1.0.22-stable-msvc.zip"; MinimumBytes = 10000000 },
    @{ Name = "libsodium-1.0.22-stable-msvc.zip.minisig"; MinimumBytes = 200 }
  )

  function Test-CachedArtifact {
    param(
      [Parameter(Mandatory = $true)]
      [string]$Path,
      [Parameter(Mandatory = $true)]
      [long]$MinimumBytes
    )

    if (-not (Test-Path $Path -PathType Leaf)) {
      return $false
    }

    try {
      return (Get-Item $Path).Length -ge $MinimumBytes
    }
    catch {
      return $false
    }
  }

  function Get-ArtifactWithRetry {
    param(
      [Parameter(Mandatory = $true)]
      [string]$Name,
      [Parameter(Mandatory = $true)]
      [long]$MinimumBytes
    )

    $destination = Join-Path $cacheDirectory $Name
    if (Test-CachedArtifact -Path $destination -MinimumBytes $MinimumBytes) {
      Write-Host "Cache libsodium encontrado: $Name" -ForegroundColor DarkGray
      return
    }

    Remove-Item $destination -Force -ErrorAction SilentlyContinue
    $temporary = "$destination.part"
    $url = "$baseUrl/$Name"
    $lastError = $null

    for ($attempt = 1; $attempt -le 5; $attempt++) {
      Remove-Item $temporary -Force -ErrorAction SilentlyContinue
      try {
        Write-Host "Baixando $Name (tentativa $attempt de 5)..." -ForegroundColor DarkGray

        Invoke-WebRequest `
          -Uri $url `
          -OutFile $temporary `
          -UseBasicParsing `
          -TimeoutSec 600

        if (-not (Test-CachedArtifact -Path $temporary -MinimumBytes $MinimumBytes)) {
          throw "O arquivo recebido está incompleto."
        }

        Move-Item $temporary $destination -Force
        return
      }
      catch {
        $lastError = $_
        Remove-Item $temporary -Force -ErrorAction SilentlyContinue
        if ($attempt -lt 5) {
          Start-Sleep -Seconds ([Math]::Min(30, $attempt * 5))
        }
      }
    }

    throw "Não foi possível baixar $Name depois de 5 tentativas. Verifique internet, antivírus, proxy ou VPN. Detalhes: $($lastError.Exception.Message)"
  }

  Write-Host "`n==> Preparando cache verificado do libsodium" -ForegroundColor Yellow
  foreach ($artifact in $artifacts) {
    Get-ArtifactWithRetry -Name $artifact.Name -MinimumBytes $artifact.MinimumBytes
  }

  # O build.rs do libsodium-sys-stable valida as assinaturas Minisign antes de usar
  # qualquer arquivo deste diretório. Assim, o Cargo não depende de um download
  # único e frágil durante a compilação.
  $env:SODIUM_DIST_DIR = $cacheDirectory
  $env:CARGO_NET_RETRY = "10"
  $env:CARGO_HTTP_TIMEOUT = "600"
  $env:CARGO_HTTP_MULTIPLEXING = "false"

  Write-Host "Cache libsodium preparado em: $cacheDirectory" -ForegroundColor DarkGray
}
