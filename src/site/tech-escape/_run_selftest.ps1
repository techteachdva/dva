# Runs the Tech Escape self test in headless Chrome and prints the results.
# Usage:  powershell -ExecutionPolicy Bypass -File _run_selftest.ps1 [page]
param([string]$Page = "_selftest.html")

$chrome = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) { Write-Error "Chrome not found"; exit 1 }

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "file:///" + ($dir -replace '\\', '/') + "/$Page"
$out = Join-Path $env:TEMP "te-run-out.html"
$err = Join-Path $env:TEMP "te-run-err.txt"
Remove-Item $out, $err -ErrorAction SilentlyContinue

$chromeArgs = @(
  "--headless=new", "--disable-gpu", "--no-sandbox",
  "--allow-file-access-from-files",
  "--user-data-dir=$env:TEMP\te-chrome-profile",
  "--enable-logging=stderr", "--v=0",
  "--virtual-time-budget=40000",
  "--dump-dom", $url
)

Start-Process -FilePath $chrome -ArgumentList $chromeArgs -NoNewWindow -Wait `
  -RedirectStandardOutput $out -RedirectStandardError $err | Out-Null

$html = Get-Content $out -Raw
if ($html -match '(?s)<pre id="out">(.*?)</pre>') {
  $text = $matches[1] -replace '&amp;', '&' -replace '&lt;', '<' -replace '&gt;', '>' -replace '&quot;', '"'
  Write-Output $text
} else {
  Write-Output "--- no results element; page errors below ---"
}

# Surface page-level console errors, which are easy to miss otherwise
$log = Get-Content $err -Raw
if ($log) {
  $lines = $log -split "`r?`n" | Where-Object { $_ -match 'CONSOLE|Uncaught|SyntaxError' }
  if ($lines) {
    Write-Output "`n--- console ---"
    $lines | ForEach-Object { Write-Output $_ }
  }
}
