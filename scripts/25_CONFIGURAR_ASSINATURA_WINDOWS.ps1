param(
  [ValidateSet("certificate-store", "pfx", "custom-command")][string]$Provider = "certificate-store",
  [string]$PublisherDisplayName = "FinnacialUX Desktop",
  [string]$ExpectedPublisher = "",
  [string]$TimestampUrl = "",
  [string]$CertificateThumbprint = "",
  [ValidateSet("CurrentUser", "LocalMachine")][string]$CertificateStoreLocation = "CurrentUser",
  [string]$PfxPath = "",
  [string]$CustomCommand = "",
  [string[]]$CustomArguments = @(),
  [string]$OutputPath = "release\windows-signing.local.json"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
. (Join-Path $PSScriptRoot "windows-signing.ps1")

if ([string]::IsNullOrWhiteSpace($TimestampUrl)) { $TimestampUrl = Read-Host "URL do servidor RFC 3161 fornecido pela autoridade certificadora" }
if ($Provider -eq "certificate-store") {
  if ([string]::IsNullOrWhiteSpace($CertificateThumbprint)) {
    Write-Host "Certificados de Code Signing disponíveis:" -ForegroundColor Cyan
    Get-ChildItem "Cert:\$CertificateStoreLocation\My" -ErrorAction SilentlyContinue |
      Where-Object { $_.HasPrivateKey -and (Test-FinnacialuxCodeSigningEku $_) } |
      Select-Object Subject, Thumbprint, NotAfter | Format-Table -AutoSize
    $CertificateThumbprint = Read-Host "Thumbprint do certificado"
  }
  $configProbe = [pscustomobject]@{ certificateStore=[pscustomobject]@{ location=$CertificateStoreLocation; name="My"; thumbprint=$CertificateThumbprint } }
  $certificate = Get-FinnacialuxStoreCertificate $configProbe
  if ([string]::IsNullOrWhiteSpace($ExpectedPublisher)) { $ExpectedPublisher = [string]$certificate.Subject }
} elseif ($Provider -eq "pfx") {
  if ([string]::IsNullOrWhiteSpace($PfxPath)) { $PfxPath = Read-Host "Caminho absoluto do PFX fora do repositório" }
  if ([string]::IsNullOrWhiteSpace($ExpectedPublisher)) { $ExpectedPublisher = Read-Host "Subject esperado do certificado (ex.: CN=Empresa)" }
} else {
  if ([string]::IsNullOrWhiteSpace($CustomCommand)) { $CustomCommand = Read-Host "Executável do comando de assinatura" }
  if ($CustomArguments.Count -eq 0) { throw "Informe -CustomArguments incluindo {file} ou %1." }
  if ([string]::IsNullOrWhiteSpace($ExpectedPublisher)) { $ExpectedPublisher = Read-Host "Subject esperado do certificado público" }
}

$config = [ordered]@{
  formatVersion = 1
  provider = $Provider
  publisherDisplayName = $PublisherDisplayName
  expectedPublisher = $ExpectedPublisher
  timestampUrl = $TimestampUrl
  digestAlgorithm = "SHA256"
  timestampDigestAlgorithm = "SHA256"
}
if ($Provider -eq "certificate-store") { $config["certificateStore"] = [ordered]@{ location=$CertificateStoreLocation; name="My"; thumbprint=(Normalize-FinnacialuxThumbprint $CertificateThumbprint) } }
if ($Provider -eq "pfx") { $config["pfx"] = [ordered]@{ path=[System.IO.Path]::GetFullPath($PfxPath) } }
if ($Provider -eq "custom-command") { $config["customCommand"] = [ordered]@{ cmd=$CustomCommand; args=@($CustomArguments) } }

$target = if ([System.IO.Path]::IsPathRooted($OutputPath)) { [System.IO.Path]::GetFullPath($OutputPath) } else { [System.IO.Path]::GetFullPath((Join-Path $Root $OutputPath)) }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
[System.IO.File]::WriteAllText($target, (($config | ConvertTo-Json -Depth 8) + "`n"), [System.Text.UTF8Encoding]::new($false))
Write-Host "Configuração local criada em: $target" -ForegroundColor Green
Write-Host "Nenhuma senha foi gravada. O arquivo permanece ignorado pelo Git."
Write-Host "Próximo passo: .\25_VALIDAR_AMBIENTE_ASSINATURA_WINDOWS.cmd"
