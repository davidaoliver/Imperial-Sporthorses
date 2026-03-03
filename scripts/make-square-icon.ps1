Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot '..\public\logo.png'
$out512 = Join-Path $PSScriptRoot '..\public\icon-512.png'
$out192 = Join-Path $PSScriptRoot '..\public\icon-192.png'

$src = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath).Path)
Write-Host "Source: $($src.Width) x $($src.Height)"

foreach ($size in @(512, 192)) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Black)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Fit image inside the square, centered — scale up 20% to fill the icon better
    $ratio = [Math]::Min($size / $src.Width, $size / $src.Height) * 1.2
    $newW = [int]($src.Width * $ratio)
    $newH = [int]($src.Height * $ratio)
    $x = [int](($size - $newW) / 2)
    $y = [int](($size - $newH) / 2)

    $g.DrawImage($src, $x, $y, $newW, $newH)
    $g.Dispose()

    $outPath = if ($size -eq 512) { $out512 } else { $out192 }
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created $outPath ($size x $size)"
}

$src.Dispose()
Write-Host "Done!"
