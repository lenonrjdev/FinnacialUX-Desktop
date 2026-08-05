Set-StrictMode -Version Latest

function Get-FinnacialuxProjectRoot {
  param([Parameter(Mandatory = $true)][string]$StartPath)

  $Current = [System.IO.DirectoryInfo]::new([System.IO.Path]::GetFullPath($StartPath))
  while ($null -ne $Current) {
    $PackagePath = Join-Path $Current.FullName "package.json"
    $CargoPath = Join-Path $Current.FullName "src-tauri\Cargo.toml"
    if ((Test-Path $PackagePath -PathType Leaf) -and (Test-Path $CargoPath -PathType Leaf)) {
      return $Current.FullName
    }
    $Current = $Current.Parent
  }
  throw "A raiz do FinnacialUX Desktop não foi localizada a partir de: $StartPath"
}

function Get-FinnacialuxCommandPath {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$InstallHint = ""
  )

  $Command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -eq $Command) {
    $Suffix = if ([string]::IsNullOrWhiteSpace($InstallHint)) { "" } else { " $InstallHint" }
    throw "Comando obrigatório não encontrado: $Name.$Suffix"
  }
  return $Command.Source
}

function Invoke-FinnacialuxNativeCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory = $true)][string]$FailureMessage
  )

  & $Command @Arguments
  $ExitCode = $LASTEXITCODE
  if ($ExitCode -ne 0) {
    throw "$FailureMessage Código de saída: $ExitCode."
  }
}

function Invoke-FinnacialuxPowerShellScript {
  param(
    [Parameter(Mandatory = $true)][string]$ScriptPath,
    [hashtable]$Parameters = @{},
    [Parameter(Mandatory = $true)][string]$FailureMessage
  )

  try {
    & $ScriptPath @Parameters
    if (-not $?) { throw "O script PowerShell retornou estado de falha." }
  }
  catch {
    throw "$FailureMessage $($_.Exception.Message)"
  }
}

function Assert-FinnacialuxFile {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$RelativePath
  )

  $Path = Join-Path $Root $RelativePath
  if (-not (Test-Path $Path -PathType Leaf)) {
    throw "Arquivo obrigatório ausente: $RelativePath"
  }
  return $Path
}
