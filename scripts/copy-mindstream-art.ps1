$assets = Join-Path $env:USERPROFILE ".cursor\projects\c-Users-phili-Desktop-coding-projects-dva\assets"
$root = Join-Path $PSScriptRoot "..\src\site\somnia"
$ms = Get-Content (Join-Path $root "data\mindstream.json") -Raw | ConvertFrom-Json

foreach ($suit in @("lucidity", "elasticity", "willpower")) {
  $destDir = Join-Path $root "images\cards\mindstream\$suit"
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null

  foreach ($card in $ms.$suit) {
    $name = Split-Path $card.image -Leaf
    $src = Join-Path $assets $name
    $dest = Join-Path $destDir $name
    if (Test-Path $src) {
      Copy-Item $src $dest -Force
    } else {
      Write-Host "MISSING asset: $name"
    }
  }

  foreach ($util in @("power-token.png", "draw-dream.png")) {
    $src = Join-Path $assets $util
    $dest = Join-Path $destDir $util
    if (Test-Path $src) {
      Copy-Item $src $dest -Force
    } else {
      Write-Host "MISSING utility: $util"
    }
  }
}

Write-Host "Mindstream art copy complete."
