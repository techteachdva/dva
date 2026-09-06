$root = Join-Path $PSScriptRoot "..\src\site\somnia"
$missing = @()
foreach ($name in @("dreams", "dreambeasts", "objects", "landscapes", "archetypes", "dreamers")) {
  $jsonPath = Join-Path $root "data\$name.json"
  $data = Get-Content $jsonPath -Raw | ConvertFrom-Json
  $items = if ($name -eq "landscapes") { $data | Where-Object { -not $_.hidden } } else { $data }
  foreach ($item in $items) {
    foreach ($field in @("image", "wastelandImage")) {
      $rel = $item.$field
      if ($rel) {
        $fp = Join-Path $root $rel
        if (-not (Test-Path $fp)) {
          $missing += "[$name] $($item.id) $field -> $rel"
        }
      }
    }
  }
}
Write-Host "Missing: $($missing.Count)"
$missing | ForEach-Object { Write-Host $_ }
foreach ($d in @("dreams", "dreambeasts", "objects", "landscapes", "archetypes", "dreamers")) {
  $dir = Join-Path $root "images\$d"
  $n = if (Test-Path $dir) {
    (Get-ChildItem $dir -File | Where-Object { $_.Extension -match "\.(png|jpg|webp)$" }).Count
  } else { 0 }
  Write-Host "$d on disk: $n"
}
