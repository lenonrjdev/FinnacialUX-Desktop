param(
  [switch]$SkipQuality,
  [string]$PreviousReleaseDirectory = "releases\1.0.0"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Version = "1.1.0"
$Notes = ".\release\RELEASE_NOTES_1_1_0.md"
$package = Get-Content ".\package.json" -Raw | ConvertFrom-Json
if ($package.version -ne $Version) { throw "A versão atual precisa ser $Version." }
node scripts\stable-release.mjs verify-promotion $Root $PreviousReleaseDirectory
if ($LASTEXITCODE -ne 0) { throw "A versão 1.0.0 ainda não possui evidência de homologação suficiente." }
if (-not $SkipQuality) { & ".\21_VALIDAR_FASE_20.cmd"; if ($LASTEXITCODE -ne 0) { throw "A validação da Fase 20 falhou." } }
node scripts\stable-release.mjs prepare $Root $PreviousReleaseDirectory
if ($LASTEXITCODE -ne 0) { throw "Não foi possível preparar os manifestos da atualização 1.1.0." }
& ".\scripts\05_GERAR_RELEASE.ps1" -Version $Version -NotesFile $Notes
if ($LASTEXITCODE -ne 0) { throw "A geração assinada da atualização 1.1.0 falhou." }
node scripts\stable-release.mjs verify-artifacts $Root "releases\$Version"
if ($LASTEXITCODE -ne 0) { throw "Os artefatos da atualização 1.1.0 são inválidos." }
Write-Host ""; Write-Host "ATUALIZAÇÃO ESTÁVEL 1.1.0 GERADA COM SUCESSO" -ForegroundColor Green; Write-Host "Pasta: releases\1.1.0"; Write-Host "Execute: .\21_HOMOLOGAR_ATUALIZACAO_ESTAVEL.cmd"
