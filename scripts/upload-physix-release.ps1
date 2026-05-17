# Upload Physix web export to GitHub Release (reliable vs browser UI).
# Prereq: gh auth login
# Usage:
#   .\scripts\upload-physix-release.ps1 -ExportDir "C:\path\to\export"
#   .\scripts\upload-physix-release.ps1 -ExportDir "..\Physix\exports" -Tag v1.0

param(
    [Parameter(Mandatory = $true)]
    [string]$ExportDir,
    [string]$Tag = "v1.0",
    [string]$Repo = "techteachdva/dva"
)

$ErrorActionPreference = "Stop"
$files = @(
    "physix.pck",
    "physix.wasm",
    "physix.side.wasm",
    "physix.js",
    "physix.audio.worklet.js",
    "physix.audio.position.worklet.js"
)

$dir = Resolve-Path $ExportDir
Write-Host "Export folder: $dir"

foreach ($name in $files) {
    $path = Join-Path $dir $name
    if (-not (Test-Path $path)) {
        throw "Missing $name - export Web from Godot (extensions_support=true) first."
    }
}

$wasm = Get-Item (Join-Path $dir "physix.wasm")
$sidePath = Join-Path $dir "physix.side.wasm"
$wasmMb = [math]::Round($wasm.Length / 1MB, 1)
Write-Host "physix.wasm size: $wasmMb MB"

if (Test-Path $sidePath) {
    $sideMb = [math]::Round((Get-Item $sidePath).Length / 1MB, 1)
    Write-Host "physix.side.wasm size: $sideMb MB"
    if ($sideMb -lt 10) {
        throw "physix.side.wasm is only $sideMb MB - export again with extensions_support enabled."
    }
}
elseif ($wasmMb -lt 10) {
    throw "Missing physix.side.wasm and physix.wasm is only $wasmMb MB - enable extensions_support and re-export."
}

Write-Host "Creating/updating release $Tag on $Repo ..."
gh release view $Tag --repo $Repo 2>$null
if ($LASTEXITCODE -ne 0) {
    gh release create $Tag --repo $Repo --title "Physix $Tag" --notes "Physix web binaries"
}

foreach ($name in $files) {
    $path = Join-Path $dir $name
    Write-Host "Uploading $name ..."
    $attempt = 0
    while ($attempt -lt 5) {
        $attempt++
        gh release upload $Tag $path --repo $Repo --clobber
        if ($LASTEXITCODE -eq 0) { break }
        if ($attempt -ge 5) { throw "Failed to upload $name after 5 attempts" }
        Write-Host "  retry $attempt in 3s ..."
        Start-Sleep -Seconds 3
    }
}

Write-Host "Done. Verify:"
Write-Host ('  https://github.com/' + $Repo + '/releases/tag/' + $Tag)
