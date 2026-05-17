# Copy Godot web export JS/worklets from Physix project exports/ into dva site folder.
# Run from repo root after exporting Web from Godot.

$ErrorActionPreference = "Stop"
$src = Join-Path $PSScriptRoot "..\..\Physix\exports"
if (-not (Test-Path $src)) {
    $src = Join-Path $env:USERPROFILE "OneDrive\Desktop\Physix\exports"
}
$dst = Join-Path $PSScriptRoot "..\src\site\physix"
$godotOut = Join-Path $dst "_godot_export"
if (Test-Path $godotOut) {
    $src = $godotOut
    Write-Host "Using Godot export folder: $src"
}
foreach ($name in @("physix.js", "physix.audio.worklet.js", "physix.audio.position.worklet.js", "physix.icon.png", "physix.apple-touch-icon.png", "physix.png")) {
    $from = Join-Path $src $name
    if (-not (Test-Path $from)) { throw "Missing export file: $from" }
    Copy-Item $from (Join-Path $dst $name) -Force
    Write-Host "Copied $name"
}
Write-Host "Done. Do NOT overwrite src/site/physix/physix.html with Godot export — only update fileSizes there if needed."
