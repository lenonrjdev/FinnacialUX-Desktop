param([switch]$SkipQuality)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
function Read-Utf8Text([string]$RelativePath) { $path = Join-Path $Root $RelativePath; if (-not (Test-Path $path)) { throw "Arquivo ausente: $RelativePath" }; return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8) }
$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -ne "1.5.0") { throw "A versão esperada é 1.5.0. Versão atual: $($package.version)" }
if (-not $SkipQuality) {
  Write-Host ""; Write-Host "==> Executando a suíte completa de qualidade e segurança" -ForegroundColor Cyan
  & ".\08_VALIDAR_QUALIDADE.cmd"
  if ($LASTEXITCODE -ne 0) { throw "A suíte completa encontrou uma regressão na Fase 24." }
} else { Write-Host ""; Write-Host "==> Suíte completa já aprovada; validando somente os contratos da Fase 24" -ForegroundColor Yellow }
Write-Host ""; Write-Host "==> Confirmando cadeia de assinatura Windows" -ForegroundColor Cyan
node scripts\windows-signing.mjs validate-example $Root release\windows-signing.example.json
if ($LASTEXITCODE -ne 0) { throw "A configuração de exemplo da assinatura Windows é inválida." }
$policy = Get-Content ".\release\windows-signing-policy.json" -Raw | ConvertFrom-Json
if ($policy.requiredForStable -ne $true -or $policy.fileDigestAlgorithm -ne "SHA256" -or $policy.timestampDigestAlgorithm -ne "SHA256" -or $policy.timestampRequired -ne $true) { throw "A política de assinatura Windows foi enfraquecida." }
$signing = Read-Utf8Text "scripts\windows-signing.ps1"
foreach ($contract in @("Get-FinnacialuxSignTool", "certificate-store", "FINNACIALUX_WINDOWS_PFX_PASSWORD", "/fd", "SHA256", "/tr", "/td", "verify", "/pa", "Get-AuthenticodeSignature", "TimeStamperCertificate", "CodeSigningEkuOid")) { if ($signing -notmatch [regex]::Escape($contract)) { throw "Contrato de assinatura ausente: $contract" } }
$tauriSigner = Read-Utf8Text "scripts\25_SIGN_TAURI_ARTIFACT.ps1"
foreach ($contract in @("FINNACIALUX_OFFICIAL_RELEASE", "Invoke-FinnacialuxSignArtifact", "timestampPresent", "publisherMatch")) { if ($tauriSigner -notmatch [regex]::Escape($contract)) { throw "Contrato do assinador Tauri ausente: $contract" } }
$generator = Read-Utf8Text "scripts\25_GERAR_ATUALIZACAO_ESTAVEL.ps1"
foreach ($contract in @("tauri.windows.conf.json", "25_SIGN_TAURI_ARTIFACT.ps1", "FINNACIALUX_OFFICIAL_RELEASE", "25_VERIFICAR_RELEASE_WINDOWS.ps1", "finally")) { if ($generator -notmatch [regex]::Escape($contract)) { throw "Contrato do gerador assinado ausente: $contract" } }
$stable = Read-Utf8Text "scripts\stable-release.mjs"
foreach ($contract in @("WINDOWS_AUTHENTICODE_REPORT.json", "windowsAuthenticodeRequired", "timestampComplete", "publisherMatch")) { if ($stable -notmatch [regex]::Escape($contract)) { throw "Gate Authenticode ausente no manifesto estável: $contract" } }
$engine = Read-Utf8Text "lib\windows-signing-engine.ts"
foreach ($contract in @("createWindowsSigningReadiness", "normalizeCertificateThumbprint", "sanitizeWindowsSigningError", "SHA256", "SEGREDO_REMOVIDO")) { if ($engine -notmatch [regex]::Escape($contract)) { throw "Contrato do motor de assinatura ausente: $contract" } }
$ignore = Read-Utf8Text ".gitignore"
foreach ($entry in @("release/windows-signing.local.json", "*.pfx", "*.p12", "*.pvk")) { if ($ignore -notmatch [regex]::Escape($entry)) { throw "Proteção de segredo ausente no .gitignore: $entry" } }
if (Get-Command git -ErrorAction SilentlyContinue) {
  $trackedSecrets = @(git ls-files | Where-Object { $_ -match '(?i)(^|/).+\.(pfx|p12|pvk|snk)$' -or $_ -eq 'release/windows-signing.local.json' })
  if ($trackedSecrets.Count -gt 0) { throw "Arquivos de chave/certificado estão rastreados pelo Git: $($trackedSecrets -join ', ')" }
}
$migrations = @(Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "*.sql" | Sort-Object Name)
if ($migrations.Count -ne 14 -or ($migrations | Where-Object { [int]$_.BaseName.Substring(0, 4) -gt 14 })) { throw "O schema 14 deixou de estar congelado." }
if (Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "0015_*.sql" -ErrorAction SilentlyContinue) { throw "A Fase 24 não permite migration 0015." }
Write-Host ""; Write-Host "FASE 24 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 14 (congelado)"
Write-Host "Versão: 1.5.0"
Write-Host "Gate: Authenticode, SHA-256, timestamp, publisher e proteção de segredos validados."
Write-Host "Observação: o certificado real será exigido somente ao gerar a release oficial."
