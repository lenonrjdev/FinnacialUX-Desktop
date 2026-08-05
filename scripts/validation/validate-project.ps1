param(
  [switch]$SkipInstall,
  [switch]$SkipE2E,
  [switch]$SkipReleaseArtifacts,
  [switch]$PreBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptsRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $ScriptsRoot "core\command-runner.ps1")
$Root = Get-FinnacialuxProjectRoot -StartPath $PSScriptRoot
Set-Location $Root

function Invoke-ValidationStep {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Action
  )
  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan
  try {
    & $Action
    if (-not $?) { throw "A etapa PowerShell retornou status de falha." }
  }
  catch {
    throw "Etapa '$Name' falhou: $($_.Exception.Message)"
  }
}

function Read-Json([string]$RelativePath) {
  $Path = Join-Path $Root $RelativePath
  if (-not (Test-Path $Path -PathType Leaf)) { throw "Arquivo obrigatório ausente: $RelativePath" }
  return [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) | ConvertFrom-Json
}

function Assert-ProjectStructure {
  $RequiredFiles = @(
    "package.json", "package-lock.json", "next.config.ts", "tsconfig.json",
    "playwright.config.ts", "vitest.config.ts", "src-tauri\Cargo.toml",
    "src-tauri\Cargo.lock", "src-tauri\tauri.conf.json",
    "release\schema-freeze-14.json", "release\stable-release.json",
    "scripts\release\stable-release.mjs", "scripts\signing\windows-signing.mjs",
    "scripts\signing\windows-signing.ps1", "scripts\signing\sign-tauri-artifact.ps1",
    "scripts\core\command-runner.ps1", "scripts\cli\rodar-projeto.ps1",
    "scripts\cli\gerar-instalador.ps1", "scripts\cli\validar-e-preparar-atualizacao.ps1",
    "scripts\cli\publicar-atualizacao.ps1", "01_RODAR_PROJETO.cmd",
    "02_GERAR_INSTALADOR.cmd", "03_VALIDAR_E_PREPARAR_ATUALIZACAO.cmd",
    "04_PUBLICAR_ATUALIZACAO.cmd",
    "project_brain\README.md", "project_brain\PROJECT_STATE.json", "AGENTS.md"
  )
  foreach ($RelativePath in $RequiredFiles) {
    if (-not (Test-Path (Join-Path $Root $RelativePath) -PathType Leaf)) {
      throw "Estrutura obrigatória ausente: $RelativePath"
    }
  }
  foreach ($Directory in @("app", "components", "lib", "types", "src-tauri\src", "src-tauri\migrations")) {
    if (-not (Test-Path (Join-Path $Root $Directory) -PathType Container)) { throw "Diretório obrigatório ausente: $Directory" }
  }
}

function Assert-VersionAndLock {
  $Package = Read-Json "package.json"
  $Tauri = Read-Json "src-tauri\tauri.conf.json"
  $CargoText = [IO.File]::ReadAllText((Join-Path $Root "src-tauri\Cargo.toml"), [Text.Encoding]::UTF8)
  $CargoVersion = [regex]::Match($CargoText, '(?ms)^\[package\].*?^version\s*=\s*"([^"]+)"').Groups[1].Value
  $LockVersionOutput = & $Node -e "const p=require('./package-lock.json'); process.stdout.write([p.version,p.packages?.['']?.version].join('|'));"
  $LockExitCode = $LASTEXITCODE
  if ($LockExitCode -ne 0) { throw "Falha ao ler package-lock.json. Exit code: $LockExitCode." }
  $LockVersions = ([string]::Join('', @($LockVersionOutput))).Split('|')
  if ($LockVersions.Count -ne 2) { throw "Estrutura de versao inesperada no package-lock.json." }
  $Versions = @([string]$Package.version, [string]$Tauri.version, $CargoVersion, $LockVersions[0], $LockVersions[1])
  if (@($Versions | Where-Object { $_ -ne "1.5.0" }).Count -gt 0) { throw "Versões divergentes ou diferentes de 1.5.0: $($Versions -join ', ')" }
  if ($Package.engines.node -ne ">=22.13.0" -or $Package.engines.npm -ne ">=10.9.0") { throw "Engines Node/npm divergentes do contrato atual." }
}

function Assert-SchemaFreeze {
  $Freeze = Read-Json "release\schema-freeze-14.json"
  if ($Freeze.schemaVersion -ne 14 -or $Freeze.frozen -ne $true -or $Freeze.migrationCount -ne 14) { throw "Contrato de congelamento do schema 14 inválido." }
  $Migrations = @(Get-ChildItem (Join-Path $Root "src-tauri\migrations") -Filter "*.sql" -File | Sort-Object Name)
  if ($Migrations.Count -ne 14) { throw "Esperadas 14 migrations; encontradas $($Migrations.Count)." }
  foreach ($Expected in @($Freeze.migrations)) {
    $Path = Join-Path $Root "src-tauri\migrations\$($Expected.file)"
    if (-not (Test-Path $Path -PathType Leaf)) { throw "Migration congelada ausente: $($Expected.file)" }
    $Hash = (Get-FileHash $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($Hash -ne [string]$Expected.sha256) { throw "Migration alterada depois do congelamento: $($Expected.file)" }
  }
  if ($Migrations[-1].Name -notmatch '^0014_') { throw "A última migration não corresponde ao schema 14." }
}

function Assert-TauriConfiguration {
  $Tauri = Read-Json "src-tauri\tauri.conf.json"
  if ($Tauri.build.frontendDist -ne "../out" -or $Tauri.bundle.targets -notcontains "nsis") { throw "Configuração Tauri não usa export estático e bundle NSIS." }
  if ($Tauri.bundle.windows.allowDowngrades -ne $false -or $Tauri.bundle.windows.nsis.installMode -ne "currentUser") { throw "Política Windows/Tauri divergente." }
  $Capabilities = Read-Json "src-tauri\capabilities\default.json"
  foreach ($Permission in @("stronghold:default", "updater:default", "fs:allow-read-file", "fs:allow-write-file")) {
    if ($Capabilities.permissions -notcontains $Permission) { throw "Permissão Tauri obrigatória ausente: $Permission" }
  }
}

function Assert-StaticRoutes {
  $Pages = @(Get-ChildItem (Join-Path $Root "app") -Filter "page.tsx" -File -Recurse)
  if ($Pages.Count -lt 20) { throw "Inventário de rotas estáticas inesperadamente pequeno: $($Pages.Count)." }
  foreach ($Page in $Pages) {
    $RelativeDirectory = $Page.Directory.FullName.Substring((Join-Path $Root "app").Length).TrimStart('\')
    $Output = if ([string]::IsNullOrWhiteSpace($RelativeDirectory)) { Join-Path $Root "out\index.html" } else { Join-Path $Root "out\$RelativeDirectory\index.html" }
    if (-not (Test-Path $Output -PathType Leaf)) { throw "Rota estática não gerada para app\$RelativeDirectory\page.tsx" }
  }
  Write-Host "Rotas estáticas aprovadas: $($Pages.Count)." -ForegroundColor Green
}

function Assert-NoTrackedSecrets {
  $Git = (Get-Command git.exe -ErrorAction Stop).Source
  $Tracked = @(& $Git ls-files)
  $ExitCode = $LASTEXITCODE
  if ($ExitCode -ne 0) { throw "git ls-files falhou com código $ExitCode." }
  $Forbidden = @($Tracked | Where-Object {
    $_ -match '(?i)(^|/)(node_modules|\.next|out|coverage|playwright-report|test-results|src-tauri/target|\.cache|\.dependency-backup|\.dependency-staging)/' -or
    $_ -match '(?i)\.(key|pfx|p12|cer|pvk|snk)$' -or
    $_ -eq 'release/windows-signing.local.json' -or $_ -match '(?i)(^|/)\.env($|\.)'
  })
  if ($Forbidden.Count -gt 0) { throw "Arquivos locais/privados rastreados: $($Forbidden -join ', ')" }

  foreach ($RelativePath in @("release/windows-signing.local.json", ".dependency-backup/", ".dependency-staging/", "src-tauri/target/", "node_modules/")) {
    $ProbePath = if ($RelativePath.EndsWith("/")) { "$RelativePath.__finnacialux_ignore_probe__" } else { $RelativePath }
    $Ignored = & $Git check-ignore --no-index -- $ProbePath 2>$null
    $IgnoreCode = $LASTEXITCODE
    if ($IgnoreCode -ne 0 -and [string]::IsNullOrWhiteSpace([string]$Ignored)) { throw "Regra de ignore ausente: $RelativePath" }
  }

  $TextExtensions = @(".ts", ".tsx", ".js", ".mjs", ".ps1", ".cmd", ".json", ".toml", ".yml", ".yaml", ".md", ".txt", ".rs", ".sql")
  foreach ($RelativePath in $Tracked) {
    $Path = Join-Path $Root $RelativePath
    $Info = Get-Item $Path -ErrorAction SilentlyContinue
    if (-not $Info -or $Info.Length -gt 2MB -or [IO.Path]::GetExtension($Path).ToLowerInvariant() -notin $TextExtensions) { continue }
    $Text = [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8)
    if ($Text -match '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----') { throw "Chave privada encontrada em arquivo rastreado: $RelativePath" }
  }
}

try {
  Write-Host "FINNACIALUX DESKTOP - VALIDAÇÃO CONSOLIDADA" -ForegroundColor Cyan
  Write-Host "Versão esperada: 1.5.0 | Schema esperado: 14"

  $Node = (Get-Command node.exe -ErrorAction Stop).Source
  $Npm = (Get-Command npm.cmd -ErrorAction Stop).Source
  $Cargo = (Get-Command cargo.exe -ErrorAction Stop).Source

  Invoke-ValidationStep "Estrutura, versões e lockfile" {
    Assert-ProjectStructure
    Assert-VersionAndLock
  }
  Invoke-ValidationStep "Schema SQLCipher e migrations congeladas" { Assert-SchemaFreeze }
  Invoke-ValidationStep "Configuração Tauri e permissões" { Assert-TauriConfiguration }
  Invoke-ValidationStep "Ausência de segredos e artefatos rastreados" { Assert-NoTrackedSecrets }
  Invoke-ValidationStep "Fonte da release estável" {
    Invoke-FinnacialuxNativeCommand $Node @("scripts\release\stable-release.mjs", "verify-source", $Root) "A fonte da release foi rejeitada."
    Invoke-FinnacialuxNativeCommand $Node @("scripts\signing\windows-signing.mjs", "validate-example", $Root, "release\windows-signing.example.json") "A configuração pública de assinatura é inválida."
  }

  if (-not $SkipInstall) {
    Invoke-ValidationStep "Instalação exata do package-lock" { Invoke-FinnacialuxNativeCommand $Npm @("ci") "npm ci falhou." }
  } elseif (-not (Test-Path (Join-Path $Root "node_modules") -PathType Container)) {
    throw "node_modules ausente. Execute sem -SkipInstall."
  }

  Invoke-ValidationStep "Auditoria de dependências" { Invoke-FinnacialuxNativeCommand $Npm @("audit", "--audit-level=high") "npm audit encontrou vulnerabilidade alta ou crítica." }
  Invoke-ValidationStep "ESLint" { Invoke-FinnacialuxNativeCommand $Npm @("run", "lint") "ESLint falhou." }
  Invoke-ValidationStep "TypeScript" { Invoke-FinnacialuxNativeCommand $Npm @("run", "typecheck") "TypeScript falhou." }
  if (-not $PreBuild) {
    Invoke-ValidationStep "Testes unitários e cobertura" { Invoke-FinnacialuxNativeCommand $Npm @("run", "test:coverage") "Testes unitários falharam." }
    Invoke-ValidationStep "Build estático Next.js" { Invoke-FinnacialuxNativeCommand $Npm @("run", "build") "Build Next.js falhou." }
    Invoke-ValidationStep "Rotas estáticas exportadas" { Assert-StaticRoutes }
    if (-not $SkipE2E) {
      Invoke-ValidationStep "Testes E2E" { Invoke-FinnacialuxNativeCommand $Npm @("run", "test:e2e") "Testes E2E falharam." }
    }
    Invoke-ValidationStep "Testes Rust" { Invoke-FinnacialuxNativeCommand $Npm @("run", "test:rust") "Testes Rust falharam." }
    Invoke-ValidationStep "Cargo check" { Invoke-FinnacialuxNativeCommand $Cargo @("check", "--manifest-path", "src-tauri/Cargo.toml") "cargo check falhou." }
  }
  else {
    Write-Host "`nPré-validação aprovada; o build Tauri executará Next.js e Rust na sequência." -ForegroundColor Green
  }

  if (-not $SkipReleaseArtifacts -and (Test-Path (Join-Path $Root "releases\1.5.0") -PathType Container)) {
    Invoke-ValidationStep "Artefatos da release 1.5.0" {
      Invoke-FinnacialuxNativeCommand $Node @("scripts\release\stable-release.mjs", "verify-artifacts-readonly", $Root, "releases\1.5.0") "Artefatos da release 1.5.0 inválidos."
      $AuthReport = Join-Path $Root "releases\1.5.0\WINDOWS_AUTHENTICODE_REPORT.json"
      if (Test-Path $AuthReport -PathType Leaf) {
        Invoke-FinnacialuxNativeCommand $Node @("scripts\signing\windows-signing.mjs", "verify-report", $Root, "releases\1.5.0\WINDOWS_AUTHENTICODE_REPORT.json") "Relatório Authenticode inválido."
      }
      $Installer = Join-Path $Root "releases\1.5.0\FinnacialUX-Desktop_1.5.0_x64-setup.exe"
      if (Test-Path $Installer -PathType Leaf) {
        $Signature = Get-AuthenticodeSignature -FilePath $Installer
        if ([string]$Signature.Status -ne "Valid" -or $null -eq $Signature.TimeStamperCertificate) { throw "Instalador sem Authenticode válido e timestamp." }
      }
    }
  }

  Write-Host ""
  Write-Host "PROJETO VALIDADO COM SUCESSO" -ForegroundColor Green
  Write-Host "Versão: 1.5.0 | Schema: 14 | Comando: 03_VALIDAR_E_PREPARAR_ATUALIZACAO.cmd -SomenteValidar"
  return
}
catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red
  throw
}
