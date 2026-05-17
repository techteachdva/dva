# Remove Physix binaries from git tracking (files stay on disk).
# Run from dva repo root: .\scripts\untrack-physix-binaries.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$patterns = @(
    "src/site/physix/*.pck",
    "src/site/physix/*.wasm",
    "src/site/physix/physix.side.wasm",
    "src/site/physix/_godot_export/*.pck",
    "src/site/physix/_godot_export/*.wasm",
    "src/site/physix/_godot_export/*.side.wasm"
)

$removed = @()
foreach ($pattern in $patterns) {
    $files = git ls-files $pattern 2>$null
    if ($files) {
        foreach ($f in $files) {
            git rm --cached --ignore-unmatch $f | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $removed += $f
            }
        }
    }
}

if ($removed.Count -eq 0) {
    Write-Host "No tracked Physix binaries found. .gitignore is doing its job."
} else {
    Write-Host "Untracked (still on disk):"
    $removed | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    Write-Host "Next:"
    Write-Host "  git commit -m `"Stop tracking Physix binaries`""
    Write-Host "  git push"
    Write-Host ""
    Write-Host "Host binaries on GitHub Release v1.0 only."
}
