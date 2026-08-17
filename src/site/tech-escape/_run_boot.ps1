# Loads the REAL game page in headless Chrome and fails on any console error.
# Module-level syntax errors do not show up in the unit harnesses, because those
# import modules individually - this catches them.
$chrome = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) { Write-Error "Chrome not found"; exit 1 }

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "file:///" + ($dir -replace '\\', '/') + "/index.html"
$out = Join-Path $env:TEMP "te-boot-out.html"
$err = Join-Path $env:TEMP "te-boot-err.txt"
Remove-Item $out, $err -ErrorAction SilentlyContinue

$chromeArgs = @(
  "--headless=new", "--disable-gpu", "--no-sandbox",
  "--allow-file-access-from-files",
  "--user-data-dir=$env:TEMP\te-chrome-profile",
  "--enable-logging=stderr", "--v=0",
  "--virtual-time-budget=20000",
  "--dump-dom", $url
)

Start-Process -FilePath $chrome -ArgumentList $chromeArgs -NoNewWindow -Wait `
  -RedirectStandardOutput $out -RedirectStandardError $err | Out-Null

$fails = 0
$consoleLines = (Get-Content $err -Raw) -split "`r?`n" |
  Where-Object { $_ -match 'CONSOLE|Uncaught|SyntaxError' }

if ($consoleLines) {
  $fails++
  Write-Output "FAIL page console is clean"
  $consoleLines | ForEach-Object { Write-Output "     $_" }
} else {
  Write-Output "PASS page console is clean"
}

$html = Get-Content $out -Raw
$titleVisible = ($html -match 'screen-title" class="screen"') -and ($html -notmatch 'screen-title" class="screen hidden"')
$firstrunVisible = ($html -match 'screen-firstrun" class="screen"') -and ($html -notmatch 'screen-firstrun" class="screen hidden"')
$profileVisible = ($html -match 'screen-profile" class="screen"') -and ($html -notmatch 'screen-profile" class="screen hidden"')
$lobbyVisible = $titleVisible -or $firstrunVisible -or $profileVisible

$checks = @(
  @{ name = "loading screen dismissed"; ok = ($html -notmatch 'screen-load" class="screen"') },
  @{ name = "lobby screen is showing"; ok = $lobbyVisible },
  @{ name = "how to play tutorial in DOM"; ok = ($html -match 'id="screen-tutorial"') },
  @{ name = "title is Tech Escape 2.3"; ok = ($html -match 'logo-ver">2\.3') },
  @{ name = "glitch overlay is in the DOM"; ok = ($html -match 'id="glitch-overlay"') },
  @{ name = "stance readout is in the HUD"; ok = ($html -match 'id="stance-value"') }
)
foreach ($c in $checks) {
  if ($c.ok) { Write-Output "PASS $($c.name)" } else { $fails++; Write-Output "FAIL $($c.name)" }
}

Write-Output ""
Write-Output "FAILURES: $fails"
