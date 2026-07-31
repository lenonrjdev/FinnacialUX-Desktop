param(
  [switch]$SkipQuality,
  [string]$PreviousReleaseDirectory = "releases\1.0.0",
  [switch]$RequirePreviousReleaseEvidence,
  [switch]$ForceRebuild
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Version = "1.1.0"
$Notes = ".\release\RELEASE_NOTES_1_1_0.md"
$package = Get-Content ".\package.json" -Raw | ConvertFrom-Json
if ($package.version -ne $Version) { throw "A versão atual precisa ser $Version." }

node scripts\stable-release.mjs verify-source $Root
if ($LASTEXITCODE -ne 0) { throw "A fonte da versão 1.1.0 não passou pela validação de release." }

if ($RequirePreviousReleaseEvidence) {
  node scripts\stable-release.mjs verify-promotion $Root $PreviousReleaseDirectory
  if ($LASTEXITCODE -ne 0) { throw "A versão anterior não possui evidência de homologação suficiente." }
} else {
  node scripts\stable-release.mjs inspect-promotion $Root $PreviousReleaseDirectory
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível inspecionar a versão anterior." }
}

if (-not $SkipQuality) {
  & ".\21_VALIDAR_FASE_20.cmd"
  if ($LASTEXITCODE -ne 0) { throw "A validação da Fase 20 falhou." }
}

node scripts\stable-release.mjs prepare $Root $PreviousReleaseDirectory
if ($LASTEXITCODE -ne 0) { throw "Não foi possível preparar os manifestos da atualização 1.1.0." }

$ReleaseDirectory = Join-Path $Root "releases\$Version"
$InstallerName = "FinnacialUX-Desktop_${Version}_x64-setup.exe"
$ReusableArtifacts = @(
  (Join-Path $ReleaseDirectory $InstallerName),
  (Join-Path $ReleaseDirectory "$InstallerName.sig"),
  (Join-Path $ReleaseDirectory "latest.json"),
  (Join-Path $ReleaseDirectory "SHA256SUMS.txt"),
  (Join-Path $ReleaseDirectory "release-manifest.json"),
  (Join-Path $ReleaseDirectory "RELEASE_NOTES.md")
)
$CanReuseSignedArtifacts = -not $ForceRebuild
foreach ($Artifact in $ReusableArtifacts) {
  $Info = Get-Item $Artifact -ErrorAction SilentlyContinue
  if (-not $Info -or $Info.Length -le 0) {
    $CanReuseSignedArtifacts = $false
    break
  }
}

if ($CanReuseSignedArtifacts) {
  Write-Host ""
  Write-Host "==> Reutilizando instalador e assinatura já gerados" -ForegroundColor Cyan
  Write-Host "Os artefatos assinados existentes serão preservados; nenhum novo build será executado."
} else {
  & ".\scripts\05_GERAR_RELEASE.ps1" -Version $Version -NotesFile $Notes
  if ($LASTEXITCODE -ne 0) { throw "A geração assinada da atualização 1.1.0 falhou." }
}

# O finalizador genérico recria a pasta da release. Sincronize novamente os
# manifestos e documentos estáveis somente depois da geração/reutilização.
node scripts\stable-release.mjs prepare $Root $PreviousReleaseDirectory
if ($LASTEXITCODE -ne 0) { throw "Não foi possível sincronizar a documentação final da atualização 1.1.0." }

node scripts\stable-release.mjs verify-artifacts $Root "releases\$Version"
if ($LASTEXITCODE -ne 0) { throw "Os artefatos da atualização 1.1.0 são inválidos." }

Write-Host ""
Write-Host "ATUALIZAÇÃO ESTÁVEL 1.1.0 GERADA COM SUCESSO" -ForegroundColor Green
Write-Host "Pasta: releases\1.1.0"
Write-Host "Execute: .\21_HOMOLOGAR_ATUALIZACAO_ESTAVEL.cmd"
