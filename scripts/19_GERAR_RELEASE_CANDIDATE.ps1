param([switch]$SkipQuality, [switch]$SkipBuild)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Version = "0.18.0-rc.1"
$Notes = ".\release\RELEASE_NOTES_0_18_0_RC_1.md"

$package = Get-Content ".\package.json" -Raw | ConvertFrom-Json
if ($package.version -ne $Version) { throw "A versão atual precisa ser $Version." }

if (-not $SkipQuality) {
  & ".\19_VALIDAR_FASE_18.cmd"
  if ($LASTEXITCODE -ne 0) { throw "A validação da Fase 18 falhou." }
}

node scripts\release-candidate.mjs prepare $Root
if ($LASTEXITCODE -ne 0) { throw "Não foi possível preparar os manifestos da RC." }

& ".\scripts\05_GERAR_RELEASE.ps1" -Version $Version -NotesFile $Notes -SkipBuild:$SkipBuild
if ($LASTEXITCODE -ne 0) { throw "A geração assinada da RC falhou." }

node scripts\release-candidate.mjs verify-artifacts $Root "releases\$Version"
if ($LASTEXITCODE -ne 0) { throw "Os artefatos finais da RC são inválidos." }

Write-Host ""
Write-Host "RELEASE CANDIDATE GERADA COM SUCESSO" -ForegroundColor Green
Write-Host "Pasta: releases\$Version"
Write-Host "A RC ainda não foi publicada como versão estável."
Write-Host "Execute: .\19_HOMOLOGAR_INSTALADOR_RC.cmd"
