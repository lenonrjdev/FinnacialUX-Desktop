$script:CodeSigningEkuOid = "1.3.6.1.5.5.7.3.3"

function Get-FinnacialuxSigningRoot {
  return (Split-Path -Parent $PSScriptRoot)
}

function Get-FinnacialuxSigningConfigPath([string]$ConfigPath = "") {
  $root = Get-FinnacialuxSigningRoot
  if (-not [string]::IsNullOrWhiteSpace($ConfigPath)) {
    if ([System.IO.Path]::IsPathRooted($ConfigPath)) { return [System.IO.Path]::GetFullPath($ConfigPath) }
    return [System.IO.Path]::GetFullPath((Join-Path $root $ConfigPath))
  }
  if (-not [string]::IsNullOrWhiteSpace($env:FINNACIALUX_WINDOWS_SIGNING_CONFIG)) { return [System.IO.Path]::GetFullPath($env:FINNACIALUX_WINDOWS_SIGNING_CONFIG) }
  return (Join-Path $root "release\windows-signing.local.json")
}

function Read-FinnacialuxSigningConfig([string]$ConfigPath = "") {
  $resolved = Get-FinnacialuxSigningConfigPath $ConfigPath
  if (-not (Test-Path $resolved -PathType Leaf)) { throw "Configuração local de assinatura ausente: $resolved" }
  $text = [System.IO.File]::ReadAllText($resolved, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
  $config = $text | ConvertFrom-Json
  if ($config.formatVersion -ne 1) { throw "Formato da configuração de assinatura não suportado." }
  if ($config.digestAlgorithm -ne "SHA256" -or $config.timestampDigestAlgorithm -ne "SHA256") { throw "A assinatura e o timestamp precisam usar SHA256." }
  if ([string]::IsNullOrWhiteSpace([string]$config.expectedPublisher)) { throw "expectedPublisher é obrigatório." }
  if ([string]::IsNullOrWhiteSpace([string]$config.publisherDisplayName)) { throw "publisherDisplayName é obrigatório." }
  if ([string]::IsNullOrWhiteSpace([string]$config.timestampUrl)) { throw "timestampUrl é obrigatório." }
  return [pscustomobject]@{ Path=$resolved; Value=$config }
}

function Get-FinnacialuxSignTool {
  if (-not [string]::IsNullOrWhiteSpace($env:FINNACIALUX_SIGNTOOL_PATH) -and (Test-Path $env:FINNACIALUX_SIGNTOOL_PATH -PathType Leaf)) {
    return (Resolve-Path $env:FINNACIALUX_SIGNTOOL_PATH).Path
  }
  $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $kits = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
  if (Test-Path $kits) {
    $candidate = Get-ChildItem $kits -Filter signtool.exe -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match "\\x64\\signtool\.exe$" } |
      Sort-Object { try { [version]$_.Directory.Parent.Name } catch { [version]"0.0" } } -Descending |
      Select-Object -First 1
    if ($candidate) { return $candidate.FullName }
  }
  throw "SignTool não foi localizado. Instale o Windows SDK ou defina FINNACIALUX_SIGNTOOL_PATH."
}

function Normalize-FinnacialuxThumbprint([string]$Value) {
  return ($Value -replace '[^a-fA-F0-9]', '').ToUpperInvariant()
}

function Get-FinnacialuxStoreCertificate($Config) {
  $thumbprint = Normalize-FinnacialuxThumbprint ([string]$Config.certificateStore.thumbprint)
  $location = if ($Config.certificateStore.location -eq "LocalMachine") { "LocalMachine" } else { "CurrentUser" }
  $storeName = if ([string]::IsNullOrWhiteSpace([string]$Config.certificateStore.name)) { "My" } else { [string]$Config.certificateStore.name }
  $path = "Cert:\$location\$storeName\$thumbprint"
  $certificate = Get-Item $path -ErrorAction SilentlyContinue
  if (-not $certificate) { throw "Certificado não encontrado no armazenamento: $location\\$storeName ($thumbprint)." }
  return $certificate
}

function Get-FinnacialuxSafePropertyValue($InputObject, [string]$PropertyName) {
  if ($null -eq $InputObject) { return $null }
  try {
    $property = $InputObject.PSObject.Properties[$PropertyName]
    if ($null -eq $property) { return $null }
    return $property.Value
  } catch {
    return $null
  }
}

function Get-FinnacialuxOidValue($InputObject) {
  if ($null -eq $InputObject) { return "" }
  if ($InputObject -is [string]) { return [string]$InputObject }
  if ($InputObject -is [System.Security.Cryptography.Oid]) { return [string]$InputObject.Value }

  $directValue = Get-FinnacialuxSafePropertyValue $InputObject "Value"
  if ($null -ne $directValue -and -not [string]::IsNullOrWhiteSpace([string]$directValue)) {
    return [string]$directValue
  }

  foreach ($nestedName in @("ObjectId", "Oid")) {
    $nested = Get-FinnacialuxSafePropertyValue $InputObject $nestedName
    if ($null -eq $nested) { continue }
    if ($nested -is [string]) { return [string]$nested }
    if ($nested -is [System.Security.Cryptography.Oid]) { return [string]$nested.Value }
    $nestedValue = Get-FinnacialuxSafePropertyValue $nested "Value"
    if ($null -ne $nestedValue -and -not [string]::IsNullOrWhiteSpace([string]$nestedValue)) {
      return [string]$nestedValue
    }
  }

  return ""
}

function Test-FinnacialuxCodeSigningEku($Certificate) {
  if ($null -eq $Certificate) { return $false }

  $certificateThumbprint = Normalize-FinnacialuxThumbprint ([string](Get-FinnacialuxSafePropertyValue $Certificate "Thumbprint"))
  if (-not [string]::IsNullOrWhiteSpace($certificateThumbprint)) {
    foreach ($storePath in @("Cert:\CurrentUser\My", "Cert:\LocalMachine\My")) {
      $nativeMatch = Get-ChildItem $storePath -CodeSigningCert -ErrorAction SilentlyContinue |
        Where-Object { (Normalize-FinnacialuxThumbprint ([string]$_.Thumbprint)) -eq $certificateThumbprint } |
        Select-Object -First 1
      if ($null -ne $nativeMatch) { return $true }
    }
  }

  $enhancedKeyUsageList = Get-FinnacialuxSafePropertyValue $Certificate "EnhancedKeyUsageList"
  foreach ($usage in @($enhancedKeyUsageList)) {
    if ((Get-FinnacialuxOidValue $usage) -eq $script:CodeSigningEkuOid) { return $true }
  }

  $extensions = Get-FinnacialuxSafePropertyValue $Certificate "Extensions"
  foreach ($extension in @($extensions)) {
    if ($null -eq $extension) { continue }
    $extensionOid = Get-FinnacialuxOidValue (Get-FinnacialuxSafePropertyValue $extension "Oid")
    if ($extensionOid -ne "2.5.29.37") { continue }

    try {
      if ($extension -is [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]) {
        $ekuExtension = $extension
      } else {
        $ekuExtension = [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new()
        $ekuExtension.CopyFrom([System.Security.Cryptography.X509Certificates.X509Extension]$extension)
      }

      foreach ($oid in @($ekuExtension.EnhancedKeyUsages)) {
        if ((Get-FinnacialuxOidValue $oid) -eq $script:CodeSigningEkuOid) { return $true }
      }
    } catch {
      continue
    }
  }

  return $false
}

function Invoke-FinnacialuxExternalCommand([string]$Command, [string[]]$Arguments, [string]$FailureMessage) {
  $commandOutput = @(& $Command @Arguments 2>&1)
  $exitCode = $LASTEXITCODE
  if ($null -eq $exitCode) { $exitCode = 0 }
  foreach ($line in $commandOutput) {
    Write-Host ([string]$line)
  }
  if ($exitCode -ne 0) { throw "$FailureMessage (código $exitCode)." }
}

function Test-FinnacialuxPortableExecutable([string]$ArtifactPath) {
  $stream = $null
  $reader = $null
  try {
    $stream = [System.IO.File]::Open($ArtifactPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    if ($stream.Length -lt 64) { return $false }
    $reader = [System.IO.BinaryReader]::new($stream)
    if ($reader.ReadByte() -ne 0x4D -or $reader.ReadByte() -ne 0x5A) { return $false }
    $stream.Position = 0x3C
    $peOffset = $reader.ReadInt32()
    if ($peOffset -lt 0 -or ($peOffset + 4) -gt $stream.Length) { return $false }
    $stream.Position = $peOffset
    return ($reader.ReadByte() -eq 0x50 -and $reader.ReadByte() -eq 0x45 -and $reader.ReadByte() -eq 0x00 -and $reader.ReadByte() -eq 0x00)
  } catch {
    return $false
  } finally {
    if ($reader) { $reader.Dispose() } elseif ($stream) { $stream.Dispose() }
  }
}
function Invoke-FinnacialuxSignArtifact([string]$ArtifactPath, [string]$ConfigPath = "") {
  $resolvedArtifact = (Resolve-Path $ArtifactPath -ErrorAction Stop).Path
  $extension = [System.IO.Path]::GetExtension($resolvedArtifact).ToLowerInvariant()
  $isStandardArtifact = $extension -in @(".exe", ".msi", ".dll")
  $isNsisTemporaryPe = $extension -eq ".tmp" -and [System.IO.Path]::GetFileName($resolvedArtifact) -match "^nst[0-9A-Fa-f]+\.tmp$" -and (Test-FinnacialuxPortableExecutable $resolvedArtifact)
  if (-not ($isStandardArtifact -or $isNsisTemporaryPe)) { throw "Somente executáveis, instaladores e bibliotecas Windows podem ser assinados. Temporarios NSIS somente sao aceitos quando forem PE validos: $resolvedArtifact" }
  $loaded = Read-FinnacialuxSigningConfig $ConfigPath
  $config = $loaded.Value
  $provider = [string]$config.provider
  if ($provider -eq "custom-command") {
    $cmd = [string]$config.customCommand.cmd
    $args = @($config.customCommand.args | ForEach-Object { ([string]$_).Replace("{file}", $resolvedArtifact).Replace("%1", $resolvedArtifact) })
    Invoke-FinnacialuxExternalCommand $cmd $args "O comando customizado de assinatura falhou"
  } else {
    $signTool = Get-FinnacialuxSignTool
    $args = @("sign", "/v", "/fd", "SHA256", "/tr", [string]$config.timestampUrl, "/td", "SHA256", "/d", [string]$config.publisherDisplayName)
    if ($provider -eq "certificate-store") {
      $certificate = Get-FinnacialuxStoreCertificate $config
      if (-not $certificate.HasPrivateKey) { throw "O certificado selecionado não possui chave privada acessível." }
      if (-not (Test-FinnacialuxCodeSigningEku $certificate)) { throw "O certificado não possui EKU de Code Signing." }
      if ($certificate.NotAfter -le (Get-Date)) { throw "O certificado de assinatura está expirado." }
      if ($config.certificateStore.location -eq "LocalMachine") { $args += "/sm" }
      $args += @("/s", [string]$config.certificateStore.name, "/sha1", (Normalize-FinnacialuxThumbprint ([string]$config.certificateStore.thumbprint)))
    } elseif ($provider -eq "pfx") {
      $pfxPath = [System.IO.Path]::GetFullPath([string]$config.pfx.path)
      if (-not (Test-Path $pfxPath -PathType Leaf)) { throw "Arquivo PFX externo não encontrado: $pfxPath" }
      if ([string]::IsNullOrWhiteSpace($env:FINNACIALUX_WINDOWS_PFX_PASSWORD)) { throw "Defina FINNACIALUX_WINDOWS_PFX_PASSWORD apenas no processo de release." }
      $args += @("/f", $pfxPath, "/p", $env:FINNACIALUX_WINDOWS_PFX_PASSWORD)
    } else {
      throw "Provider de assinatura não suportado: $provider"
    }
    $args += $resolvedArtifact
    Invoke-FinnacialuxExternalCommand $signTool $args "SignTool não conseguiu assinar o artefato"
  }
  return (Get-FinnacialuxAuthenticodeRecord $resolvedArtifact $config)
}

function Get-FinnacialuxAuthenticodeRecord([string]$ArtifactPath, $Config) {
  $resolved = (Resolve-Path $ArtifactPath -ErrorAction Stop).Path
  $signTool = Get-FinnacialuxSignTool
  Invoke-FinnacialuxExternalCommand $signTool @("verify", "/pa", "/all", "/v", $resolved) "A política Authenticode rejeitou o artefato"
  $signature = Get-AuthenticodeSignature -FilePath $resolved
  $subject = if ($signature.SignerCertificate) { [string]$signature.SignerCertificate.Subject } else { "" }
  $expected = [string]$Config.expectedPublisher
  $publisherMatch = -not [string]::IsNullOrWhiteSpace($subject) -and $subject.IndexOf($expected, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  $timestampPresent = $null -ne $signature.TimeStamperCertificate
  return [pscustomobject]([ordered]@{
    fileName = [System.IO.Path]::GetFileName($resolved)
    sha256 = (Get-FileHash $resolved -Algorithm SHA256).Hash.ToLowerInvariant()
    signatureStatus = [string]$signature.Status
    signerSubject = $subject
    signerThumbprint = if ($signature.SignerCertificate) { [string]$signature.SignerCertificate.Thumbprint } else { "" }
    certificateNotAfter = if ($signature.SignerCertificate) { $signature.SignerCertificate.NotAfter.ToUniversalTime().ToString("o") } else { $null }
    timestampPresent = $timestampPresent
    timestampSubject = if ($signature.TimeStamperCertificate) { [string]$signature.TimeStamperCertificate.Subject } else { "" }
    publisherMatch = $publisherMatch
  })
}
