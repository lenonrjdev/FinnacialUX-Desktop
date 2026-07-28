$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $Encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $Encoding)
}

Write-Host "FINNACIALUX DESKTOP - ASSINATURA DE CODIGO WINDOWS" -ForegroundColor Cyan
Write-Host "Este passo exige um certificado de assinatura de codigo instalado no Windows." -ForegroundColor Yellow
Write-Host "A assinatura do updater e a assinatura de editor do Windows sao protecoes diferentes." -ForegroundColor Yellow

$Thumbprint = (Read-Host "Impressao digital SHA-1 do certificado (certificate thumbprint)").Replace(" ", "").Trim()
if ($Thumbprint -notmatch '^[A-Fa-f0-9]{40}$') {
  throw "A impressao digital precisa conter exatamente 40 caracteres hexadecimais."
}
$Thumbprint = $Thumbprint.ToUpperInvariant()
$Certificate = Get-ChildItem Cert:\CurrentUser\My, Cert:\LocalMachine\My -ErrorAction SilentlyContinue |
  Where-Object { $_.Thumbprint -eq $Thumbprint } |
  Select-Object -First 1
if (-not $Certificate) { throw "O certificado nao foi encontrado nos armazenamentos CurrentUser\My ou LocalMachine\My." }
if (-not $Certificate.HasPrivateKey) { throw "O certificado encontrado nao possui uma chave privada disponivel para assinatura." }
$CodeSigningOid = "1.3.6.1.5.5.7.3.3"
if (-not ($Certificate.EnhancedKeyUsageList.ObjectId.Value -contains $CodeSigningOid)) {
  throw "O certificado encontrado nao possui a finalidade Code Signing."
}

$DefaultTimestamp = "http://timestamp.digicert.com"
$TimestampUrl = Read-Host "Servidor de timestamp RFC 3161 [$DefaultTimestamp]"
if ([string]::IsNullOrWhiteSpace($TimestampUrl)) { $TimestampUrl = $DefaultTimestamp }
if ($TimestampUrl -notmatch '^https?://') { throw "Informe uma URL HTTP ou HTTPS valida para timestamp." }

$Config = [ordered]@{
  '$schema' = "https://schema.tauri.app/config/2"
  bundle = [ordered]@{
    windows = [ordered]@{
      certificateThumbprint = $Thumbprint
      digestAlgorithm = "sha256"
      timestampUrl = $TimestampUrl
      tsp = $true
    }
  }
}

$Destination = Join-Path $Root "src-tauri\tauri.windows-signing.conf.json"
Write-Utf8NoBom $Destination (($Config | ConvertTo-Json -Depth 6) + "`n")
Write-Host "`nConfiguracao criada em: $Destination" -ForegroundColor Green
Write-Host "O certificado e sua chave privada continuam no armazenamento seguro do Windows." -ForegroundColor Green
Write-Host "A proxima execucao de .\05_GERAR_RELEASE.cmd usara esta configuracao automaticamente."
