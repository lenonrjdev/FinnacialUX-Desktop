$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Read-Utf8Text([string]$RelativePath) {
  $path = Join-Path $Root $RelativePath
  if (-not (Test-Path $path)) { throw "Arquivo ausente: $RelativePath" }
  return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -ne "1.1.0") {
  throw "A versão esperada é 1.1.0. Versão atual: $($package.version)"
}

Write-Host ""
Write-Host "==> Executando a suíte completa de qualidade e segurança" -ForegroundColor Cyan
& ".\08_VALIDAR_QUALIDADE.cmd"
if ($LASTEXITCODE -ne 0) { throw "A suíte completa encontrou uma regressão na Fase 20." }

Write-Host ""
Write-Host "==> Confirmando manutenção pós-lançamento" -ForegroundColor Cyan
$engine = Read-Utf8Text "lib\maintenance-engine.ts"
foreach ($contract in @(
  'currentVersion === "1.1.0"',
  'schemaVersion === 14',
  'isWithinMaintenanceWindow',
  'deferUpdates',
  'requireVerifiedBackup'
)) {
  if ($engine -notmatch [regex]::Escape($contract)) { throw "Contrato de manutenção ausente: $contract" }
}

$preferences = Read-Utf8Text "lib\maintenance-preferences.ts"
foreach ($contract in @(
  'localTechnicalJournal',
  'SEGREDO_REMOVIDO',
  'journalRetention',
  'finnacialux-local-technical-journal-v1'
)) {
  if ($preferences -notmatch [regex]::Escape($contract)) { throw "Proteção do diário técnico ausente: $contract" }
}

$updater = Read-Utf8Text "lib\desktop\updater.ts"
foreach ($contract in @(
  'deferredUntil',
  'installOnlyInsideWindow',
  'A instalação está fora da janela de manutenção configurada'
)) {
  if ($updater -notmatch [regex]::Escape($contract)) { throw "Contrato do updater ausente: $contract" }
}

$boundary = Read-Utf8Text "components\providers\client-error-boundary.tsx"
if ($boundary -notmatch [regex]::Escape('recordLocalTechnicalError')) {
  throw "O diário técnico não foi integrado ao limite de erros."
}

$runtimeProvider = Read-Utf8Text "components\providers\desktop-updater-provider.tsx"
foreach ($contract in @('unhandledrejection', 'isWithinMaintenanceWindow', '#manutencao')) {
  if ($runtimeProvider -notmatch [regex]::Escape($contract)) { throw "Integração operacional ausente: $contract" }
}

$migrations = @(Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "*.sql" | Sort-Object Name)
if ($migrations.Count -ne 14 -or ($migrations | Where-Object { [int]$_.BaseName.Substring(0, 4) -gt 14 })) {
  throw "O schema 14 deixou de estar congelado."
}
if (Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "0015_*.sql" -ErrorAction SilentlyContinue) {
  throw "A Fase 20 não permite migration 0015."
}

Write-Host ""
Write-Host "FASE 20 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 14 (congelado)"
Write-Host "Versão: 1.1.0"
Write-Host "Motor: manutenção, adiamento, rollback e diário técnico local validados."
Write-Host "Auditoria: nenhuma vulnerabilidade alta ou crítica."
