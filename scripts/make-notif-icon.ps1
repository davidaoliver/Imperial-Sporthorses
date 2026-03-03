Add-Type -AssemblyName System.Drawing

# Load source logo and crop the center square (where the horse is)
$srcPath = Join-Path $PSScriptRoot '..\public\logo.png'
$src = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath).Path)
Write-Host "Source: $($src.Width) x $($src.Height)"

# The horse diamond is centered in the image. Crop a square from the center.
$cropSize = $src.Height  # use the shorter dimension (height)
$cropX = [int](($src.Width - $cropSize) / 2)
$cropY = 0
$cropRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropSize, $cropSize)

$size = 192
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$destRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$g.DrawImage($src, $destRect, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)

$g.Dispose()
$src.Dispose()

$outPath = Join-Path $PSScriptRoot '..\public\notif-icon.png'
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Created $outPath ($size x $size)"
