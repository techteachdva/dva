# Runs _selftest.html in headless Chrome (desk crawl, vault, collisions).
$chrome = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) { Write-Error "Chrome not found"; exit 1 }

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "file:///" + ($dir -replace '\\', '/') + "/_selftest.html"
$out = Join-Path $env:TEMP "te-selftest-out.txt"
Remove-Item $out -ErrorAction SilentlyContinue

Start-Process -FilePath $chrome -ArgumentList @(
  "--headless=new", "--disable-gpu", "--no-sandbox",
  "--allow-file-access-from-files",
  "--user-data-dir=$env:TEMP\te-chrome-selftest",
  "--virtual-time-budget=15000",
  "--dump-dom", $url
) -NoNewWindow -Wait -RedirectStandardOutput $out | Out-Null

$text = Get-Content $out -Raw
$failMatch = [regex]::Match($text, 'FAILURES:\s*(\d+)')
$fails = if ($failMatch.Success) { [int]$failMatch.Groups[1].Value } else { 999 }

$lines = $text -split "`r?`n" | Where-Object { $_ -match '^(PASS|FAIL)' }
$lines | ForEach-Object { Write-Output $_ }
Write-Output ""
Write-Output "FAILURES: $fails"
if ($fails -gt 0) { exit 1 }
