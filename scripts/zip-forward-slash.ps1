param(
  [Parameter(Mandatory = $true)]
  [string]$Root,
  [Parameter(Mandatory = $true)]
  [string]$ZipPath
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$rootPath = (Resolve-Path -LiteralPath $Root).Path
$zipFullPath = [System.IO.Path]::GetFullPath($ZipPath)

if (Test-Path -LiteralPath $zipFullPath) {
  Remove-Item -LiteralPath $zipFullPath -Force
}

$zipDir = Split-Path -Parent $zipFullPath
if (-not (Test-Path -LiteralPath $zipDir)) {
  New-Item -ItemType Directory -Path $zipDir | Out-Null
}

$zip = [System.IO.Compression.ZipFile]::Open($zipFullPath, "Create")
try {
  Get-ChildItem -LiteralPath $rootPath -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($rootPath.Length).TrimStart("\", "/").Replace("\", "/")
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip,
      $_.FullName,
      $relative,
      [System.IO.Compression.CompressionLevel]::Optimal
    )
  }
}
finally {
  $zip.Dispose()
}
