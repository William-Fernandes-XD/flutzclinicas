Add-Type -AssemblyName System.Drawing

function Resize-Max([string]$InputPath, [string]$OutputPath, [int]$Max = 720) {
  $img = [System.Drawing.Bitmap]::FromFile((Resolve-Path $InputPath))
  try {
    $scale = $Max / [Math]::Max($img.Width, $img.Height)
    if ($scale -gt 1) { $scale = 1 }
    $nw = [Math]::Max(1, [int]($img.Width * $scale))
    $nh = [Math]::Max(1, [int]($img.Height * $scale))
    $bmp = New-Object System.Drawing.Bitmap $nw, $nh, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $nw, $nh)
    $g.Dispose()
    if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force }
    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  }
  finally { $img.Dispose() }
}

$pairs = @(
  @{ In = "C:\Users\willi\.cursor\projects\c-Users-willi-Documents-Flutz\assets\hero-kitten-white.png"; Out = "frontend\src\assets\hero-kitten.png" },
  @{ In = "C:\Users\willi\.cursor\projects\c-Users-willi-Documents-Flutz\assets\hero-puppy-white.png"; Out = "frontend\src\assets\hero-puppy.png" },
  @{ In = "C:\Users\willi\.cursor\projects\c-Users-willi-Documents-Flutz\assets\hero-cat-white.png"; Out = "frontend\src\assets\hero-cat.png" }
)

foreach ($p in $pairs) {
  $tmp = [System.IO.Path]::ChangeExtension($p.Out, ".tmp.png")
  Resize-Max $p.In $tmp 680
  & powershell -NoProfile -File "scripts\strip-white-background.ps1" -InputPath $tmp -OutputPath $p.Out -WhiteThreshold 246 -Padding 4
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}
Write-Output "pets ready"
