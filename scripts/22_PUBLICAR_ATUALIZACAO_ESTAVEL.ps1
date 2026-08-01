param([string]$Repository = "")
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Version = "1.2.0"
$ReportPath = Join-Path $Root "releases\$Version\STABLE_VALIDATION_REPORT.json"
node scripts\stable-release.mjs verify-artifacts $Root "releases\$Version"
if ($LASTEXITCODE -ne 0) { throw "Os artefatos 1.2.0 não passaram pela verificação final." }
if (-not (Test-Path $ReportPath)) { throw "Relatório de homologação ausente: $ReportPath" }
$report = Get-Content $ReportPath -Raw | ConvertFrom-Json
if ($report.manualMatrixComplete -ne $true -or $report.status -ne "approved-for-stable" -or $report.latestChannelConfirmed -ne $true) { throw "A homologação manual da atualização 1.2.0 ainda não foi concluída." }
& ".\scripts\06_PUBLICAR_RELEASE_GITHUB.ps1" -Version $Version -Repository $Repository
if ($LASTEXITCODE -ne 0) { throw "A publicação da atualização 1.2.0 falhou." }
Write-Host ""; Write-Host "FINNACIALUX DESKTOP 1.2.0 PUBLICADO COM SUCESSO" -ForegroundColor Green; Write-Host "Tag: desktop-v1.2.0"; Write-Host "Canal: estável / Latest"
