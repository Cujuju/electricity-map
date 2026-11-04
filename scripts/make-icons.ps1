# Resize the archived Image Gen artwork; purple is the packaged app's default.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$resourceDir = Join-Path $projectRoot 'resources'
$publicDir = Join-Path $projectRoot 'public/icons'
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

$sources = @{
  blue = '02-midnight-grid-full-bleed.png'
  purple = '02-midnight-grid-purple-full-bleed.png'
}
$sizes = 16, 24, 32, 48, 64, 128, 256
$pngs = @{}
foreach ($color in 'blue', 'purple') {
  $sourcePath = Join-Path $projectRoot "output/imagegen/round-3-icons/$($sources[$color])"
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    [System.IO.File]::WriteAllBytes((Join-Path $publicDir "$color.png"), (Get-IconPng $source 512))
    if ($color -eq 'purple') {
      foreach ($size in $sizes) { $pngs[$size] = Get-IconPng $source $size }
      [System.IO.File]::WriteAllBytes((Join-Path $resourceDir 'icon.png'), $pngs[256])
      [System.IO.File]::WriteAllBytes((Join-Path $resourceDir 'icon-1024.png'), (Get-IconPng $source 1024))
    }
  } finally { $source.Dispose() }
}
$output = [System.IO.MemoryStream]::new()
$writer = [System.IO.BinaryWriter]::new($output)
try {
  $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
  $offset = 6 + 16 * $sizes.Count
  foreach ($size in $sizes) {
    $dimension = if ($size -eq 256) { 0 } else { $size }
    $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
    $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32)
    $writer.Write([uint32]$pngs[$size].Length); $writer.Write([uint32]$offset)
    $offset += $pngs[$size].Length
  }
  foreach ($size in $sizes) { $writer.Write($pngs[$size]) }
  $writer.Flush()
  [System.IO.File]::WriteAllBytes((Join-Path $resourceDir 'icon.ico'), $output.ToArray())
} finally { $writer.Dispose(); $output.Dispose() }
Write-Output 'Blue and purple Electricity Map icons generated; packaged default is purple.'
