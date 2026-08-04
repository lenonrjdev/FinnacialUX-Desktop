param([string]$ConfigPath = "", [switch]$RequireReady, [switch]$Quiet)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
. (Join-Path $PSScriptRoot "windows-signing.ps1")
if ($env:OS -ne "Windows_NT") { throw "A assinatura Authenticode oficial precisa ser validada no Windows." }
$loaded = Read-FinnacialuxSigningConfig $ConfigPath
$config = $loaded.Value
$provider = [string]$config.provider
$record = [ordered]@{ provider=$provider; configPath=$loaded.Path; signTool=$null; certificate=$null; ready=$false }
$record.signTool = Get-FinnacialuxSignTool
if ($provider -eq "certificate-store") {
  $certificate = Get-FinnacialuxStoreCertificate $config
  if (-not $certificate.HasPrivateKey) { throw "O certificado não possui chave privada acessível." }
  if (-not (Test-FinnacialuxCodeSigningEku $certificate)) { throw "O certificado não permite Code Signing." }
  if ($certificate.NotAfter -le (Get-Date)) { throw "O certificado está expirado." }
  $record.certificate = [ordered]@{ subject=$certificate.Subject; thumbprint=$certificate.Thumbprint; notAfter=$certificate.NotAfter.ToUniversalTime().ToString("o"); hasPrivateKey=$certificate.HasPrivateKey }
} elseif ($provider -eq "pfx") {
  if (-not (Test-Path ([string]$config.pfx.path) -PathType Leaf)) { throw "PFX externo não encontrado: $($config.pfx.path)" }
  if ($RequireReady -and [string]::IsNullOrWhiteSpace($env:FINNACIALUX_WINDOWS_PFX_PASSWORD)) { throw "Defina FINNACIALUX_WINDOWS_PFX_PASSWORD somente durante a geração oficial." }
} elseif ($provider -eq "custom-command") {
  $command = Get-Command ([string]$config.customCommand.cmd) -ErrorAction SilentlyContinue
  if (-not $command) { throw "Comando customizado não encontrado: $($config.customCommand.cmd)" }
  $args = @($config.customCommand.args)
  if (-not ($args | Where-Object { ([string]$_).Contains("{file}") -or ([string]$_).Contains("%1") })) { throw "O comando customizado precisa do marcador {file} ou %1." }
} else { throw "Provider não suportado: $provider" }
$record.ready = $true
if (-not $Quiet) {
  Write-Host "AMBIENTE DE ASSINATURA WINDOWS VALIDADO" -ForegroundColor Green
  Write-Host "Provider: $provider"
  Write-Host "Publisher esperado: $($config.expectedPublisher)"
  Write-Host "Timestamp: $($config.timestampUrl)"
  if ($record.signTool) { Write-Host "SignTool: $($record.signTool)" }
  Write-Host "Nenhuma chave privada ou senha foi copiada para o projeto."
}
return [pscustomobject]$record
