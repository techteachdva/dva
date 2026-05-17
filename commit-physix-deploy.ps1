# Run once from PowerShell:  cd C:\Users\phili\OneDrive\Desktop\dva  .\commit-physix-deploy.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

& "$PSScriptRoot\scripts\sync-physix-export.ps1"

git status -sb
$tracked = git ls-files "src/site/physix/*.pck" "src/site/physix/*.wasm" 2>$null
if ($tracked) {
    Write-Host "Removing tracked binaries from index:"
    git rm --cached -- $tracked
}

git add .gitignore `
    docs/PHYSIX_DEPLOY.md `
    scripts/download-physix.js `
    scripts/sync-physix-export.ps1 `
    physix/web/README.md `
    physix/scripts/download-physix.js `
    src/site/physix/

git commit -m "Deploy Physix web export: sync JS/worklets, tighten gitignore and release download"
git push origin HEAD

Write-Host "Done. Confirm Vercel env PHYSIX_PCK_URL / PHYSIX_WASM_URL point at the correct release assets."
