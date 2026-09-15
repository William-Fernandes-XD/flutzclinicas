param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [int]$WhiteThreshold = 248,
  [int]$Padding = 8,
  [switch]$Square
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $InputPath))
try {
  $w = $src.Width
  $h = $src.Height
  $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($src, 0, 0, $w, $h)
  $g.Dispose()

  $minX = $w
  $minY = $h
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $c = $bmp.GetPixel($x, $y)
      if ($c.R -ge $WhiteThreshold -and $c.G -ge $WhiteThreshold -and $c.B -ge $WhiteThreshold) {
        $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $c.R, $c.G, $c.B))
      }
      else {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -lt 0) { throw "Nenhum pixel visivel em $InputPath" }

  $minX = [Math]::Max(0, $minX - $Padding)
  $minY = [Math]::Max(0, $minY - $Padding)
  $maxX = [Math]::Min($w - 1, $maxX + $Padding)
  $maxY = [Math]::Min($h - 1, $maxY + $Padding)
  $cw = $maxX - $minX + 1
  $ch = $maxY - $minY + 1

  $crop = New-Object System.Drawing.Bitmap $cw, $ch, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gc = [System.Drawing.Graphics]::FromImage($crop)
  $gc.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $gc.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0, 0, $cw, $ch), $minX, $minY, $cw, $ch, [System.Drawing.GraphicsUnit]::Pixel)
  $gc.Dispose()
  $bmp.Dispose()

  $final = $crop
  if ($Square) {
    $side = [Math]::Max($cw, $ch)
    $canvas = [Math]::Max($side + 8, [int]($side / 0.88))
    $sq = New-Object System.Drawing.Bitmap $canvas, $canvas, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gs = [System.Drawing.Graphics]::FromImage($sq)
    $gs.Clear([System.Drawing.Color]::Transparent)
    $ox = [int](($canvas - $cw) / 2)
    $oy = [int](($canvas - $ch) / 2)
    $gs.DrawImage($crop, $ox, $oy, $cw, $ch)
    $gs.Dispose()
    $crop.Dispose()
    $final = $sq
  }

  $dir = Split-Path -Parent $OutputPath
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force }
  $final.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output ("OK {0} -> {1} ({2}x{3})" -f $InputPath, $OutputPath, $final.Width, $final.Height)
  $final.Dispose()
}
finally {
  $src.Dispose()
}
