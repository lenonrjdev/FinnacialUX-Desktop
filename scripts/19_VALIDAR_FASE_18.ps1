$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}
function Read-Utf8Text([string]$RelativePath) {
  $Path = Join-Path $Root $RelativePath
  if (-not (Test-Path -LiteralPath $Path)) { throw "Arquivo obrigatório não encontrado: $RelativePath" }
  return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -ne "0.18.0-rc.1") {
  throw "A versão esperada é 0.18.0-rc.1. Versão atual: $($package.version)"
}

Step "Executando a suíte completa de qualidade e segurança"
& (Join-Path $Root "08_VALIDAR_QUALIDADE.cmd")
if ($LASTEXITCODE -ne 0) { throw "A suíte completa encontrou uma regressão na Fase 18." }

Step "Validando fonte reproduzível e schema congelado"
node scripts\release-candidate.mjs verify-source $Root
if ($LASTEXITCODE -ne 0) { throw "A fonte da Release Candidate não passou pela verificação." }

Step "Confirmando atualização a partir dos schemas históricos"
$database = Read-Utf8Text "src-tauri\src\encrypted_database.rs"
foreach ($contract in @(
  "CURRENT_SCHEMA_VERSION: i64 = 14",
  "every_historical_schema_upgrades_to_fourteen_without_losing_core_data",
  "starting_schema in [1_i64, 4, 7, 10, 13, 14]",
  "assert_eq!(user_count, 1",
  "document_json"
)) {
  if ($database -notmatch [regex]::Escape($contract)) { throw "Contrato de atualização ausente: $contract" }
}

$diagnostics = Read-Utf8Text "src-tauri\src\diagnostics.rs"
if ($diagnostics -notmatch "CURRENT_SCHEMA_VERSION: i64 = 14") { throw "O diagnóstico ainda não reconhece o schema 14." }

Step "Confirmando publicação como pré-release"
$workflow = Read-Utf8Text ".github\workflows\release-desktop.yml"
foreach ($contract in @(
  "softprops/action-gh-release@v3",
  "FINNACIALUX_PRERELEASE",
  "FINNACIALUX_MAKE_LATEST",
  "FINNACIALUX_DRAFT",
  "prerelease:",
  "make_latest:"
)) {
  if ($workflow -notmatch [regex]::Escape($contract)) { throw "Workflow de publicação incompleto: $contract" }
}

$publisher = Read-Utf8Text "scripts\06_PUBLICAR_RELEASE_GITHUB.ps1"
foreach ($contract in @(
  '$IsPrerelease = $Version -match "-rc\.\d+$"',
  '"--prerelease"',
  '"--latest=false"'
)) {
  if ($publisher -notmatch [regex]::Escape($contract)) { throw "Publicação local não protege o canal estável: $contract" }
}

Step "Confirmando artefatos, privacidade e segurança"
foreach ($file in @(
  "release\RELEASE_NOTES_0_18_0_RC_1.md",
  "release\RC_CHECKLIST_0_18_0_RC_1.md",
  "release\release-candidate.json",
  "release\schema-freeze-14.json",
  "docs\RELEASE_CANDIDATE_1_0.md",
  "PRIVACY.md",
  "SECURITY.md"
)) {
  if (-not (Test-Path (Join-Path $Root $file))) { throw "Documento da Release Candidate ausente: $file" }
}

$engineTests = Read-Utf8Text "tests\unit\release-candidate.test.ts"
foreach ($contract in @(
  "0.18.0-rc.1",
  "schemaVersion: 15",
  "updaterConfigured: false",
  "backupBeforeInstall: false"
)) {
  if ($engineTests -notmatch [regex]::Escape($contract)) { throw "Teste da Release Candidate ausente: $contract" }
}

Write-Host ""
Write-Host "FASE 18 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 14 (congelado)"
Write-Host "Versão: 0.18.0-rc.1"
Write-Host "Release: fonte, upgrades, canal pré-release e documentação validados."
Write-Host "Próximo passo: .\19_GERAR_RELEASE_CANDIDATE.cmd"
