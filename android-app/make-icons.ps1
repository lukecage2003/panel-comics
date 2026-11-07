# Génère les icônes Android (classiques, rondes, adaptatives) et l'écran de démarrage à partir des icônes PWA de Panel.
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$res = Join-Path $root 'android\app\src\main\res'
$icon = [System.Drawing.Image]::FromFile((Join-Path $root '..\icons\icon-512.png'))
$mask = [System.Drawing.Bitmap]::FromFile((Join-Path $root '..\icons\icon-maskable-512.png'))
$bg = $mask.GetPixel(4, 4)
$hex = '#{0:X2}{1:X2}{2:X2}' -f $bg.R, $bg.G, $bg.B

function Save-Png($img, [int]$size, [string]$path, [double]$scale = 1.0, $fill = $null, [bool]$round = $false) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'HighQuality'; $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  if ($round) { $p = New-Object System.Drawing.Drawing2D.GraphicsPath; $p.AddEllipse(0, 0, $size, $size); $g.SetClip($p) }
  if ($fill) { $g.Clear($fill) }
  $d = [int]($size * $scale); $o = [int](($size - $d) / 2)
  $g.DrawImage($img, $o, $o, $d, $d)
  $g.Dispose(); $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}

$dens = @{ 'mdpi' = 1.0; 'hdpi' = 1.5; 'xhdpi' = 2.0; 'xxhdpi' = 3.0; 'xxxhdpi' = 4.0 }
foreach ($k in $dens.Keys) {
  $dir = Join-Path $res "mipmap-$k"
  $l = [int](48 * $dens[$k]); $f = [int](108 * $dens[$k])
  Save-Png $icon $l (Join-Path $dir 'ic_launcher.png')
  Save-Png $mask $l (Join-Path $dir 'ic_launcher_round.png') 1.0 $null $true
  # Avant-plan adaptatif : la zone sûre (80 %) de l'icône « maskable » couvre les 72 dp toujours visibles
  Save-Png $mask $f (Join-Path $dir 'ic_launcher_foreground.png') 0.833
}
Set-Content -Path (Join-Path $res 'values\ic_launcher_background.xml') -Encoding UTF8 -Value "<?xml version=`"1.0`" encoding=`"utf-8`"?>`n<resources>`n    <color name=`"ic_launcher_background`">$hex</color>`n</resources>"

# Écran de démarrage : logo centré sur le fond de Panel
Get-ChildItem $res -Directory | Where-Object { $_.Name -like 'drawable*' } | ForEach-Object {
  $sp = Join-Path $_.FullName 'splash.png'
  if (Test-Path $sp) {
    $old = [System.Drawing.Image]::FromFile($sp); $w = $old.Width; $h = $old.Height; $old.Dispose()
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear($bg); $g.InterpolationMode = 'HighQualityBicubic'
    $s = [int]([Math]::Min($w, $h) * 0.28); $g.DrawImage($icon, [int](($w - $s) / 2), [int](($h - $s) / 2), $s, $s)
    $g.Dispose(); $bmp.Save($sp, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  }
}
$icon.Dispose(); $mask.Dispose()
Write-Output "Icônes et écran de démarrage générés (fond $hex)."
