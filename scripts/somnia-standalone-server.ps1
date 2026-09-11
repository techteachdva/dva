# Minimal static file server for local Somnia standalone testing.
# Started by "Start Somnia.bat" — do not open index.html directly in the browser.

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Port = 8765

$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif"  = "image/gif"
  ".webp" = "image/webp"
  ".svg"  = "image/svg+xml"
  ".mp3"  = "audio/mpeg"
  ".woff" = "font/woff"
  ".woff2" = "font/woff2"
  ".ico"  = "image/x-icon"
}

function Get-MimeType([string]$Path) {
  $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  if ($MimeTypes.ContainsKey($ext)) { return $MimeTypes[$ext] }
  return "application/octet-stream"
}

function Get-LocalPath([System.Net.HttpListenerRequest]$Request) {
  $raw = [System.Uri]::UnescapeDataString($Request.Url.AbsolutePath.TrimStart("/"))
  if ([string]::IsNullOrWhiteSpace($raw)) { $raw = "index.html" }
  $candidate = [System.IO.Path]::GetFullPath((Join-Path $Root ($raw -replace "/", [System.IO.Path]::DirectorySeparatorChar)))
  $rootFull = [System.IO.Path]::GetFullPath($Root)
  if (-not $candidate.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }
  if (Test-Path $candidate -PathType Container) {
    $index = Join-Path $candidate "index.html"
    if (Test-Path $index -PathType Leaf) { return $index }
    return $null
  }
  return $candidate
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Prefixes.Add("http://localhost:$Port/")

try {
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "Could not start server on port $Port."
  Write-Host $_.Exception.Message
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

$url = "http://localhost:$Port/"
Write-Host ""
Write-Host "Somnia local server"
Write-Host "  $url"
Write-Host ""
Write-Host "Leave this window open while you play. Press Ctrl+C to stop."
Write-Host ""

Start-Process $url | Out-Null

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response

  try {
    $localPath = Get-LocalPath $request
    if ($null -ne $localPath -and (Test-Path $localPath -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($localPath)
      $response.StatusCode = 200
      $response.ContentType = Get-MimeType $localPath
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $response.StatusCode = 404
      $response.ContentType = "text/plain; charset=utf-8"
      $response.ContentLength64 = $body.Length
      $response.OutputStream.Write($body, 0, $body.Length)
    }
  } catch {
    $body = [System.Text.Encoding]::UTF8.GetBytes("500 Server Error")
    $response.StatusCode = 500
    $response.ContentType = "text/plain; charset=utf-8"
    $response.ContentLength64 = $body.Length
    $response.OutputStream.Write($body, 0, $body.Length)
  } finally {
    $response.OutputStream.Close()
    $response.Close()
  }
}
