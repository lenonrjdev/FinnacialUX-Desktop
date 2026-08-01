$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
function Read-Utf8Text([string]$RelativePath) { $path = Join-Path $Root $RelativePath; if (-not (Test-Path $path)) { throw "Arquivo ausente: $RelativePath" }; return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8) }
$package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ($package.version -ne "1.3.0") { throw "A versão esperada é 1.3.0. Versão atual: $($package.version)" }
Write-Host ""; Write-Host "==> Executando a suíte completa de qualidade e segurança" -ForegroundColor Cyan
& ".\08_VALIDAR_QUALIDADE.cmd"
if ($LASTEXITCODE -ne 0) { throw "A suíte completa encontrou uma regressão na Fase 22." }
Write-Host ""; Write-Host "==> Confirmando recuperação comprovada" -ForegroundColor Cyan
$engine = Read-Utf8Text "lib\recovery-readiness-engine.ts"
foreach ($contract in @("selectRecoveryDrillCandidate", "isRecoveryDrillDue", "createRecoveryReadinessReport", "SEGREDO_REMOVIDO", "rpoHours")) { if ($engine -notmatch [regex]::Escape($contract)) { throw "Contrato do motor ausente: $contract" } }
$runtime = Read-Utf8Text "lib\recovery-readiness-runtime.ts"
foreach ($contract in @("inspectNativeBackup", "previewNativeBackup", "manifest.schemaVersion === 14", "getDeviceCredential")) { if ($runtime -notmatch [regex]::Escape($contract)) { throw "Contrato do ensaio ausente: $contract" } }
if ($runtime -match [regex]::Escape("restoreNativeBackup")) { throw "O ensaio automático não pode executar restauração real." }
$provider = Read-Utf8Text "components\providers\recovery-readiness-provider.tsx"
foreach ($contract in @("runOnStartup", "runOnFocus", "finnacialux-recovery-readiness-run-now", "executeRecoveryReadinessDrill")) { if ($provider -notmatch [regex]::Escape($contract)) { throw "Integração global ausente: $contract" } }
$panel = Read-Utf8Text "components\configuracoes\recovery-readiness-panel.tsx"
foreach ($contract in @("Teste de recuperação e plano de desastre", "RPO", "RTO", "O banco financeiro atual nunca é substituído")) { if ($panel -notmatch [regex]::Escape($contract)) { throw "Contrato visual ausente: $contract" } }
$layout = Read-Utf8Text "app\layout.tsx"
if ($layout -notmatch [regex]::Escape("RecoveryReadinessProvider")) { throw "O executor de recuperação não foi instalado no layout global." }
$migrations = @(Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "*.sql" | Sort-Object Name)
if ($migrations.Count -ne 14 -or ($migrations | Where-Object { [int]$_.BaseName.Substring(0, 4) -gt 14 })) { throw "O schema 14 deixou de estar congelado." }
if (Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "0015_*.sql" -ErrorAction SilentlyContinue) { throw "A Fase 22 não permite migration 0015." }
Write-Host ""; Write-Host "FASE 22 VALIDADA COM SUCESSO" -ForegroundColor Green
Write-Host "Schema: 14 (congelado)"
Write-Host "Versão: 1.3.0"
Write-Host "Motor: ensaio de restauração, RPO, RTO, Stronghold e plano de desastre validados."
Write-Host "Auditoria: nenhuma vulnerabilidade alta ou crítica."
