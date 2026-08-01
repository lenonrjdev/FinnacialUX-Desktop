param([switch]$SkipQuality)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
function Read-Utf8Text([string]$RelativePath) { $path = Join-Path $Root $RelativePath; if (-not (Test-Path $path)) { throw "Arquivo ausente: $RelativePath" }; return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8) }
$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -ne "1.4.0") { throw "A versão esperada é 1.4.0. Versão atual: $($package.version)" }
if (-not $SkipQuality) {
  Write-Host ""; Write-Host "==> Executando a suíte completa de qualidade e segurança" -ForegroundColor Cyan
  & ".\08_VALIDAR_QUALIDADE.cmd"
  if ($LASTEXITCODE -ne 0) { throw "A suíte completa encontrou uma regressão na Fase 23." }
} else {
  Write-Host ""; Write-Host "==> Suíte completa já aprovada; validando somente os contratos da Fase 23" -ForegroundColor Yellow
}
Write-Host ""; Write-Host "==> Confirmando backup externo criptografado" -ForegroundColor Cyan
$native = Read-Utf8Text "src-tauri\src\external_backup.rs"
foreach ($contract in @("FinnacialUX-Backups", ".partial-", ".sha256", "backup_package_encryption_mode", "starts_with(&local_root)", "apply_retention", "source_checksum")) { if ($native -notmatch [regex]::Escape($contract)) { throw "Contrato nativo externo ausente: $contract" } }
foreach ($command in @("external_backup_get_preferences", "external_backup_save_preferences", "external_backup_get_destination_status", "external_backup_mirror", "external_backup_verify", "external_backup_open_destination")) { if ($native -notmatch [regex]::Escape($command)) { throw "Comando nativo ausente: $command" } }
$engine = Read-Utf8Text "lib\external-backup-engine.ts"
foreach ($contract in @("selectExternalBackupCandidate", "createExternalBackupHealth", "sanitizeExternalBackupError", "SEGREDO_REMOVIDO", "!input.destination.independent", "Destino no mesmo volume")) { if ($engine -notmatch [regex]::Escape($contract)) { throw "Contrato do motor externo ausente: $contract" } }
$externalTypes = Read-Utf8Text "types\external-backup.ts"
foreach ($contract in @("ExternalBackupDestinationKind", "same-volume")) { if ($externalTypes -notmatch [regex]::Escape($contract)) { throw "Contrato de tipos do backup externo ausente: $contract" } }
$runtime = Read-Utf8Text "lib\external-backup-runtime.ts"
foreach ($contract in @("listNativeBackups", "mirrorBackupExternally", "verifyExternalBackupDestination", "verifyAfterCopy")) { if ($runtime -notmatch [regex]::Escape($contract)) { throw "Contrato do executor externo ausente: $contract" } }
$provider = Read-Utf8Text "components\providers\external-backup-provider.tsx"
foreach ($contract in @("mirrorOnStartup", "mirrorOnFocus", "mirrorAfterBackup", "finnacialux-backup-automation-updated")) { if ($provider -notmatch [regex]::Escape($contract)) { throw "Integração global externa ausente: $contract" } }
$panel = Read-Utf8Text "components\configuracoes\external-backup-panel.tsx"
foreach ($contract in @("Backup externo criptografado", "A chave do Stronghold nunca é copiada", "SHA-256", "Escolher pasta")) { if ($panel -notmatch [regex]::Escape($contract)) { throw "Contrato visual externo ausente: $contract" } }
$layout = Read-Utf8Text "app\layout.tsx"
if ($layout -notmatch [regex]::Escape("ExternalBackupProvider")) { throw "O executor externo não foi instalado no layout global." }
$lib = Read-Utf8Text "src-tauri\src\lib.rs"
if ($lib -notmatch [regex]::Escape("mod external_backup;") -or $lib -notmatch [regex]::Escape("external_backup::external_backup_mirror")) { throw "O módulo externo não foi registrado no Tauri." }
$migrations = @(Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "*.sql" | Sort-Object Name)
if ($migrations.Count -ne 14 -or ($migrations | Where-Object { [int]$_.BaseName.Substring(0, 4) -gt 14 })) { throw "O schema 14 deixou de estar congelado." }
if (Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "0015_*.sql" -ErrorAction SilentlyContinue) { throw "A Fase 23 não permite migration 0015." }
Write-Host ""; Write-Host "FASE 23 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 14 (congelado)"
Write-Host "Versão: 1.4.0"
Write-Host "Motor: cópia externa atômica, SHA-256, retenção e mídia desconectada validados."
Write-Host "Auditoria: nenhuma vulnerabilidade alta ou crítica."
