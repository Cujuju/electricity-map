# Rasterizes the existing favicon geometry. ICO directory layout follows Spillway's icon builder.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$resourceDir = Join-Path $projectRoot 'resources'
New-Item -ItemType Directory -Force -Path $resourceDir | Out-Null

function Get-IconPng([int]$Size) {
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = 'AntiAlias'
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.ScaleTransform($Size / 64.0, $Size / 64.0)
    $shape = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $shape.AddArc(0, 0, 36, 36, 180, 90)
    $shape.AddArc(28, 0, 36, 36, 270, 90)
    $shape.AddArc(28, 28, 36, 36, 0, 90)
    $shape.AddArc(0, 28, 36, 36, 90, 90)
    $shape.CloseFigure()
    $lime = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#d4fa66'))
    $ink = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#142019'))
    try {
      $graphics.FillPath($lime, $shape)
      $points = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(36, 9), [System.Drawing.PointF]::new(16, 36),
        [System.Drawing.PointF]::new(30, 36), [System.Drawing.PointF]::new(27, 55),
        [System.Drawing.PointF]::new(49, 25), [System.Drawing.PointF]::new(34, 25)
      )
      $graphics.FillPolygon($ink, $points)
    } finally { $shape.Dispose(); $lime.Dispose(); $ink.Dispose() }
    $stream = [System.IO.MemoryStream]::new()
    try {
      $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
      return ,$stream.ToArray()
    } finally { $stream.Dispose() }
  } finally { $graphics.Dispose(); $bitmap.Dispose() }
}

$sizes = 16, 24, 32, 48, 64, 128, 256
$pngs = @{}
foreach ($size in $sizes) { $pngs[$size] = Get-IconPng $size }
[System.IO.File]::WriteAllBytes((Join-Path $resourceDir 'icon.png'), $pngs[256])
[System.IO.File]::WriteAllBytes((Join-Path $resourceDir 'icon-1024.png'), (Get-IconPng 1024))
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
Write-Output 'Electricity Map icons generated.'
