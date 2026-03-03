Add-Type -AssemblyName System.Drawing

# Load source logo and crop the center square (where the horse is)
$srcPath = Join-Path $PSScriptRoot '..\public\logo.png'
$src = New-Object System.Drawing.Bitmap((Resolve-Path $srcPath).Path)
Write-Host "Source: $($src.Width) x $($src.Height)"

# Crop center square
$cropSize = $src.Height
$cropX = [int](($src.Width - $cropSize) / 2)

$size = 192

# --- Full color icon (for notification shade) ---
$color = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($color)
$g.Clear([System.Drawing.Color]::Black)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$cropRect = New-Object System.Drawing.Rectangle($cropX, 0, $cropSize, $cropSize)
$destRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$g.DrawImage($src, $destRect, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

$colorPath = Join-Path $PSScriptRoot '..\public\notif-icon.png'
$color.Save($colorPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created color icon: $colorPath"

# --- Monochrome badge (transparent bg, white horse) for Android status bar ---
# Take the cropped color icon and convert: dark pixels -> transparent, light/gold pixels -> white
$mono = New-Object System.Drawing.Bitmap($size, $size)
for ($y = 0; $y -lt $size; $y++) {
    for ($x = 0; $x -lt $size; $x++) {
        $px = $color.GetPixel($x, $y)
        # Calculate brightness
        $brightness = ($px.R * 0.299 + $px.G * 0.587 + $px.B * 0.114)
        if ($brightness -gt 80) {
            # Gold/light pixels -> white with proportional opacity
            $alpha = [Math]::Min(255, [int](($brightness / 255.0) * 255))
            $mono.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
        } else {
            # Dark pixels -> transparent
            $mono.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        }
    }
}

$monoPath = Join-Path $PSScriptRoot '..\public\notif-badge.png'
$mono.Save($monoPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created mono badge: $monoPath"

$color.Dispose()
$mono.Dispose()
$src.Dispose()
Write-Host "Done!"
