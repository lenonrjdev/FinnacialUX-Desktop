$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
function Read-Utf8Text([string]$RelativePath) { $path = Join-Path $Root $RelativePath; if (-not (Test-Path $path)) { throw "Arquivo ausente: $RelativePath" }; return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8) }
$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -ne "1.2.0") { throw "A versão esperada é 1.2.0. Versão atual: $($package.version)" }
Write-Host ""; Write-Host "==> Executando a suíte completa de qualidade e segurança" -ForegroundColor Cyan
& ".\08_VALIDAR_QUALIDADE.cmd"
if ($LASTEXITCODE -ne 0) { throw "A suíte completa encontrou uma regressão na Fase 21." }
Write-Host ""; Write-Host "==> Confirmando backup automático e continuidade" -ForegroundColor Cyan
$engine = Read-Utf8Text "lib\backup-automation-engine.ts"
foreach ($contract in @("calculateNextAutomaticBackupAt", "recordBackupAutomationFailure", "historyRetention", "SEGREDO_REMOVIDO")) { if ($engine -notmatch [regex]::Escape($contract)) { throw "Contrato do motor ausente: $contract" } }
$provider = Read-Utf8Text "components\providers\backup-automation-provider.tsx"
foreach ($contract in @("runOnStartup", "runOnFocus", "finnacialux-backup-automation-run-now", "executeBackupAutomationCycle")) { if ($provider -notmatch [regex]::Escape($contract)) { throw "Integração do provider ausente: $contract" } }
$desktop = Read-Utf8Text "lib\desktop\backup-automation.ts"
if ($desktop -notmatch [regex]::Escape('invoke<AutomaticBackupResult>("run_automatic_backup"')) { throw "O comando nativo de backup automático não foi conectado." }
$native = Read-Utf8Text "src-tauri\src\protection.rs"
foreach ($contract in @("automatic_backup_due", "run_automatic_backup_internal", "remove_old_automatic_backups", "update_last_automatic_at")) { if ($native -notmatch [regex]::Escape($contract)) { throw "Contrato nativo de backup automático ausente: $contract" } }
$nativeLib = Read-Utf8Text "src-tauri\src\lib.rs"
if ($nativeLib -notmatch [regex]::Escape("protection::run_automatic_backup")) { throw "O comando run_automatic_backup não está registrado no invoke_handler." }
$panel = Read-Utf8Text "components\configuracoes\backup-automation-panel.tsx"
foreach ($contract in @("Backup automático real", "O comando nativo impede duplicações", "Histórico local")) { if ($panel -notmatch [regex]::Escape($contract)) { throw "Contrato visual ausente: $contract" } }
$layout = Read-Utf8Text "app\layout.tsx"
if ($layout -notmatch [regex]::Escape("BackupAutomationProvider")) { throw "O executor automático não foi instalado no layout global." }
$migrations = @(Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "*.sql" | Sort-Object Name)
if ($migrations.Count -ne 14 -or ($migrations | Where-Object { [int]$_.BaseName.Substring(0, 4) -gt 14 })) { throw "O schema 14 deixou de estar congelado." }
if (Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "0015_*.sql" -ErrorAction SilentlyContinue) { throw "A Fase 21 não permite migration 0015." }

Write-Host ""; Write-Host "==> Validando relatório homologado UTF-8 com BOM" -ForegroundColor Cyan
$fixture = Join-Path ([System.IO.Path]::GetTempPath()) ("finnacialux-phase21-bom-" + [guid]::NewGuid().ToString("N"))
try {
  New-Item -ItemType Directory -Path $fixture -Force | Out-Null
  $validationFixture = [ordered]@{
    formatVersion = 3
    product = "FinnacialUX Desktop"
    version = "1.1.0"
    schemaVersion = 14
    promotedFrom = "1.0.0"
    releaseMode = "bootstrap-full-installer"
    previousReleaseEvidenceAvailable = $false
    recordedAt = (Get-Date).ToUniversalTime().ToString("o")
    installerSha256 = ("a" * 64)
    manualMatrixComplete = $true
    latestChannelConfirmed = $true
    status = "approved-for-stable"
  }
  $manifestFixture = [ordered]@{
    product = "FinnacialUX Desktop"
    version = "1.1.0"
    channel = "stable"
    prerelease = $false
    schemaVersion = 14
    tag = "desktop-v1.1.0"
  }
  $utf8Bom = New-Object System.Text.UTF8Encoding($true)
  [System.IO.File]::WriteAllText((Join-Path $fixture "STABLE_VALIDATION_REPORT.json"), (($validationFixture | ConvertTo-Json -Depth 6) + "`n"), $utf8Bom)
  [System.IO.File]::WriteAllText((Join-Path $fixture "release-manifest.json"), (($manifestFixture | ConvertTo-Json -Depth 4) + "`n"), $utf8Bom)
  node scripts\stable-release.mjs verify-promotion $Root $fixture
  if ($LASTEXITCODE -ne 0) { throw "O leitor de evidência não aceita JSON UTF-8 com BOM gerado pelo Windows PowerShell." }
}
finally {
  Remove-Item $fixture -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""; Write-Host "FASE 21 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 14 (congelado)"
Write-Host "Versão: 1.2.0"
Write-Host "Motor: backup automático, retenção, Stronghold e histórico local validados."
Write-Host "Auditoria: nenhuma vulnerabilidade alta ou crítica."
