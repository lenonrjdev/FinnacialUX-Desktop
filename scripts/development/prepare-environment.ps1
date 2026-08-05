Set-StrictMode -Version Latest

function Initialize-FinnacialuxDevelopmentEnvironment {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [switch]$InstallIfMissing
  )

  $Node = Get-FinnacialuxCommandPath "node.exe" "Instale o Node.js 22 LTS atualizado."
  $Npm = Get-FinnacialuxCommandPath "npm.cmd" "Reinstale o Node.js 22 LTS."
  $Rustc = Get-FinnacialuxCommandPath "rustc.exe" "Instale o Rust pelo rustup."
  $Cargo = Get-FinnacialuxCommandPath "cargo.exe" "Instale o Rust pelo rustup."
  $Rustup = Get-FinnacialuxCommandPath "rustup.exe" "Instale o Rust pelo rustup."
  $Perl = Get-FinnacialuxCommandPath "perl.exe" "Instale Strawberry Perl para compilar SQLCipher/OpenSSL."

  Assert-FinnacialuxFile -Root $Root -RelativePath "package.json" | Out-Null
  Assert-FinnacialuxFile -Root $Root -RelativePath "package-lock.json" | Out-Null

  $NodeVersionText = (& $Node "--version").TrimStart("v")
  $NodeVersionExitCode = $LASTEXITCODE
  if ($NodeVersionExitCode -ne 0) { throw "Não foi possível consultar a versão do Node.js." }
  if ([Version]$NodeVersionText -lt [Version]"22.13.0") {
    throw "Node.js $NodeVersionText é incompatível. Use 22.13.0 ou superior."
  }

  Write-Host "Node:  $NodeVersionText" -ForegroundColor DarkGray
  Invoke-FinnacialuxNativeCommand $Npm @("--version") "Não foi possível consultar o npm."
  Invoke-FinnacialuxNativeCommand $Rustc @("--version") "Não foi possível consultar o Rust."
  Invoke-FinnacialuxNativeCommand $Cargo @("--version") "Não foi possível consultar o Cargo."
  Invoke-FinnacialuxNativeCommand $Perl @("-e", "print qq(Perl disponivel\n)") "Não foi possível executar o Perl."

  $NodeModules = Join-Path $Root "node_modules"
  if (-not (Test-Path $NodeModules -PathType Container)) {
    if (-not $InstallIfMissing) { throw "Dependências ausentes. Execute novamente permitindo a instalação automática." }
    Write-Host "`n==> Instalando dependências exatas do package-lock" -ForegroundColor Cyan
    Invoke-FinnacialuxNativeCommand $Npm @("ci") "A instalação das dependências falhou."
  }

  $ActiveToolchain = @(& $Rustup "show" "active-toolchain")
  $ToolchainExitCode = $LASTEXITCODE
  if ($ToolchainExitCode -ne 0) { throw "Não foi possível consultar o toolchain Rust ativo." }
  if (([string]::Join(" ", $ActiveToolchain)) -notmatch "msvc") {
    Write-Host "`n==> Selecionando o toolchain Rust MSVC" -ForegroundColor Cyan
    Invoke-FinnacialuxNativeCommand $Rustup @("default", "stable-msvc") "Não foi possível selecionar o Rust MSVC."
  }

  Initialize-LibsodiumCache -Root $Root
}
