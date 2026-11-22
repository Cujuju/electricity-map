# Resize the archived Image Gen artwork; purple is the packaged app's and browser's default.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$resourceDir = Join-Path $projectRoot 'resources'
$webRoot = Join-Path $projectRoot 'public'
$publicDir = Join-Path $webRoot 'icons'
New-Item -ItemType Directory -Force -Path $resourceDir, $publicDir | Out-Null

function Get-IconPng([System.Drawing.Image]$Source, [int]$Size) {
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CompositingQuality = 'HighQuality'
    $graphics.InterpolationMode = 'HighQualityBicubic'
    $graphics.PixelOffsetMode = 'HighQuality'
    $graphics.DrawImage($Source, 0, 0, $Size, $Size)
    $stream = [System.IO.MemoryStream]::new()
    try {
      $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
      return ,$stream.ToArray()
    } finally { $stream.Dispose() }
  } finally { $graphics.Dispose(); $bitmap.Dispose() }
}

# ICO with PNG-compressed entries; a 0 dimension byte means 256 px.
function Write-Ico([string]$Path, [System.Drawing.Image]$Source, [int[]]$Sizes) {
  $pngs = foreach ($size in $Sizes) { ,(Get-IconPng $Source $size) }
  $output = [System.IO.MemoryStream]::new()
  $writer = [System.IO.BinaryWriter]::new($output)
  try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$Sizes.Count)
    $offset = 6 + 16 * $Sizes.Count
    for ($i = 0; $i -lt $Sizes.Count; $i++) {
      $dimension = if ($Sizes[$i] -eq 256) { 0 } else { $Sizes[$i] }
      $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
      $writer.Write([byte]0); $writer.Write([byte]0)
      $writer.Write([uint16]1); $writer.Write([uint16]32)
      $writer.Write([uint32]$pngs[$i].Length); $writer.Write([uint32]$offset)
      $offset += $pngs[$i].Length
    }
    foreach ($png in $pngs) { $writer.Write($png) }
    $writer.Flush()
    [System.IO.File]::WriteAllBytes($Path, $output.ToArray())
  } finally { $writer.Dispose(); $output.Dispose() }
}

$sources = @{
  blue = '02-midnight-grid-full-bleed.png'
  purple = '02-midnight-grid-purple-full-bleed.png'
}
$pickerSize = 512
$desktopIcoSizes = 16, 24, 32, 48, 64, 128, 256
$desktopPngSize = 256
$desktopLargeSize = 1024
# Browser tab sizes; standard and high-DPI.
$faviconSizes = 16, 32, 48
# iOS home-screen size; iOS applies its own corner mask.
$appleTouchSize = 180
foreach ($color in 'blue', 'purple') {
  $sourcePath = Join-Path $projectRoot "output/imagegen/round-3-icons/$($sources[$color])"
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    [System.IO.File]::WriteAllBytes((Join-Path $publicDir "$color.png"), (Get-IconPng $source $pickerSize))
    if ($color -eq 'purple') {
      [System.IO.File]::WriteAllBytes((Join-Path $resourceDir 'icon.png'), (Get-IconPng $source $desktopPngSize))
      [System.IO.File]::WriteAllBytes((Join-Path $resourceDir 'icon-1024.png'), (Get-IconPng $source $desktopLargeSize))
      Write-Ico (Join-Path $resourceDir 'icon.ico') $source $desktopIcoSizes
      Write-Ico (Join-Path $webRoot 'favicon.ico') $source $faviconSizes
      [System.IO.File]::WriteAllBytes((Join-Path $webRoot 'apple-touch-icon.png'), (Get-IconPng $source $appleTouchSize))
    }
  } finally { $source.Dispose() }
}
Write-Output 'Blue and purple Electricity Map icons generated; packaged and browser default is purple.'
