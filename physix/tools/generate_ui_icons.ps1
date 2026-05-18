# Writes PNG UI icons into assets/icons/ using .NET (no Pillow required).
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$iconDir = Join-Path $PSScriptRoot "..\assets\icons"
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null

function Save-Icon($name, $draw) {
    $bmp = New-Object System.Drawing.Bitmap 64, 64
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    & $draw $g
    $g.Dispose()
    $path = Join-Path $iconDir $name
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "wrote $path"
}

Save-Icon "heart.png" {
    param($g)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 230, 45, 60))
    $g.FillEllipse($brush, 8, 18, 22, 22)
    $g.FillEllipse($brush, 34, 18, 22, 22)
    $g.FillPolygon($brush, @(
        [System.Drawing.Point]::new(12, 30),
        [System.Drawing.Point]::new(20, 18),
        [System.Drawing.Point]::new(32, 26),
        [System.Drawing.Point]::new(44, 18),
        [System.Drawing.Point]::new(52, 30),
        [System.Drawing.Point]::new(32, 54)
    ))
}

Save-Icon "star.png" {
    param($g)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 210, 40))
    $pts = @(
        32,6; 39,24; 58,24; 43,36; 49,56; 32,44; 15,56; 21,36; 6,24; 25,24
    ) | ForEach-Object { $_ } 
    $points = @()
    for ($i = 0; $i -lt $pts.Count; $i += 2) {
        $points += [System.Drawing.Point]::new($pts[$i], $pts[$i+1])
    }
    $g.FillPolygon($brush, $points)
}

Save-Icon "star_empty.png" {
    param($g)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 70, 70, 80))
    $pts = @(32,6; 39,24; 58,24; 43,36; 49,56; 32,44; 15,56; 21,36; 6,24; 25,24)
    $points = @()
    for ($i = 0; $i -lt $pts.Count; $i += 2) { $points += [System.Drawing.Point]::new($pts[$i], $pts[$i+1]) }
    $g.FillPolygon($brush, $points)
}

Save-Icon "coin.png" {
    param($g)
    $gold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 195, 30))
    $g.FillEllipse($gold, 10, 14, 44, 44)
    $font = New-Object System.Drawing.Font "Arial", 22, [System.Drawing.FontStyle]::Bold
    $g.DrawString('$', $font, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 180, 120, 0))), 22, 20)
}

Save-Icon "lock.png" {
    param($g)
    $body = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 170, 175, 190))
    $g.FillRectangle($body, 20, 30, 24, 24)
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 150, 155, 170)), 6
    $g.DrawArc($pen, 18, 10, 28, 28, 180, 180)
    $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 90, 95, 110))), 28, 38, 8, 8)
}

Write-Host "Done."
