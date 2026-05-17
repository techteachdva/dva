# Copy Godot web export JS/worklets from Physix project exports/ into dva site folder.
# Run from repo root after exporting Web from Godot.

$ErrorActionPreference = "Stop"
$src = Join-Path $PSScriptRoot "..\..\Physix\exports"
if (-not (Test-Path $src)) {
    $src = Join-Path $env:USERPROFILE "OneDrive\Desktop\Physix\exports"
}
$dst = Join-Path $PSScriptRoot "..\src\site\physix"
foreach ($name in @("physix.js", "physix.audio.worklet.js", "physix.audio.position.worklet.js")) {
    $from = Join-Path $src $name
    if (-not (Test-Path $from)) { throw "Missing export file: $from" }
    Copy-Item $from (Join-Path $dst $name) -Force
    Write-Host "Copied $name"
}
Write-Host "Done. Update fileSizes in src/site/physix/physix.html if pck/wasm sizes changed, then commit."
