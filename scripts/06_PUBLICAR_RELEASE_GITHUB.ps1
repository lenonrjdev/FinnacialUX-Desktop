param([string]$Version = "")
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI não encontrado. Instale com: winget install --id GitHub.cli"
}
$Package = Get-Content ".\package.json" -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($Version)) { $Version = [string]$Package.version }
$ReleaseDir = Join-Path $Root "releases\$Version"
if (-not (Test-Path $ReleaseDir)) { throw "Gere primeiro a release com .\05_GERAR_RELEASE.cmd" }

& gh auth status
if ($LASTEXITCODE -ne 0) { throw "Entre no GitHub CLI executando: gh auth login" }
$Tag = "desktop-v$Version"
$Notes = Join-Path $ReleaseDir "RELEASE_NOTES.md"
$Assets = Get-ChildItem $ReleaseDir -File | Where-Object { $_.Name -ne "RELEASE_NOTES.md" } | ForEach-Object { $_.FullName }

& gh release view $Tag *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Host "A release $Tag já existe. Atualizando arquivos..." -ForegroundColor Yellow
  & gh release upload $Tag @Assets --clobber
  if ($LASTEXITCODE -eq 0) { & gh release edit $Tag --latest }
} else {
  & gh release create $Tag @Assets --title "FinnacialUX Desktop $Version" --notes-file $Notes --latest
}
if ($LASTEXITCODE -ne 0) { throw "A publicação da release falhou." }
Write-Host "Release $Tag publicada com sucesso." -ForegroundColor Green
