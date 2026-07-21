# Regenerates static/images/effects/cursor-12.png (the custom mouse cursor)
# from the source drawing static/images/drawings/12.png.
#
# CSS `cursor: url()` can't rotate or resize an image - it just displays the
# file as-is - so both the tilt and the "not too big" size are baked into
# these pixels instead. To change the tilt, edit $angleDeg below and re-run
# this script (from the repo root, in PowerShell):
#
#   .\scripts\make-cursor.ps1
#
# Positive angles rotate clockwise, negative counter-clockwise.

$angleDeg = 25
$maxDim = 48   # largest side of the final cursor image, in px

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot "static\images\drawings\12.png"
$outputPath = Join-Path $repoRoot "static\images\effects\cursor-12.png"

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile($sourcePath)
$angleRad = $angleDeg * [Math]::PI / 180
$W = $src.Width
$H = $src.Height
$newW = [int][Math]::Ceiling([Math]::Abs($W * [Math]::Cos($angleRad)) + [Math]::Abs($H * [Math]::Sin($angleRad)))
$newH = [int][Math]::Ceiling([Math]::Abs($W * [Math]::Sin($angleRad)) + [Math]::Abs($H * [Math]::Cos($angleRad)))

$rotated = New-Object System.Drawing.Bitmap $newW, $newH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($rotated)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.TranslateTransform($newW / 2, $newH / 2)
$g.RotateTransform($angleDeg)
$g.TranslateTransform(-$W / 2, -$H / 2)
$g.DrawImage($src, 0, 0, $W, $H)
$g.Dispose()

$ratio = [Math]::Min($maxDim / $rotated.Width, $maxDim / $rotated.Height)
$w2 = [int][Math]::Round($rotated.Width * $ratio)
$h2 = [int][Math]::Round($rotated.Height * $ratio)

$final = New-Object System.Drawing.Bitmap $w2, $h2, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g2 = [System.Drawing.Graphics]::FromImage($final)
$g2.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g2.DrawImage($rotated, 0, 0, $w2, $h2)
$g2.Dispose()

$final.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Saved $outputPath ($w2 x $h2)"

$final.Dispose()
$rotated.Dispose()
$src.Dispose()
