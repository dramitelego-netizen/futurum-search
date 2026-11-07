# Все картинки гида → data/guide_img (без parapa).
# Крупные файлы жмём в JPEG (имя .png/.jpg сохраняем — браузер покажет).
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$wikiJson = Join-Path $Root "data\wiki_items.json"
$destDir = Join-Path $Root "data\guide_img"
$maxEdge = 256
$copyAsIsBytes = 80KB
$jpegQuality = 42L
$gifMaxBytes = 400KB

New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$wiki = Get-Content $wikiJson -Raw -Encoding UTF8 | ConvertFrom-Json
$need = New-Object "System.Collections.Generic.HashSet[string]"

function Consider([string]$p) {
  if ([string]::IsNullOrWhiteSpace($p)) { return }
  $rel = ($p -replace '^\./', '').Replace('/', '\')
  if ($rel -notmatch '^data\\wiki_img\\') { return }
  [void]$need.Add($rel)
}

foreach ($it in $wiki.items) {
  Consider $it.image
  Consider $it.lookImage
  if ($it.lookVariants) {
    foreach ($v in $it.lookVariants) {
      Consider $v.image
      Consider $v.lookImage
    }
  }
}

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq "image/jpeg" } |
  Select-Object -First 1

function Save-Jpeg([System.Drawing.Bitmap]$bmp, [string]$dest) {
  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality,
    $jpegQuality
  )
  $bmp.Save($dest, $jpegCodec, $ep)
  $ep.Dispose()
}

function Save-Resized([string]$src, [string]$dest) {
  $img = $null; $bmp = $null; $g = $null
  try {
    $img = [System.Drawing.Image]::FromFile($src)
    $w = $img.Width; $h = $img.Height
    $scale = 1.0
    if ($w -gt $maxEdge -or $h -gt $maxEdge) {
      $scale = [Math]::Min($maxEdge / [double]$w, $maxEdge / [double]$h)
    }
    $nw = [Math]::Max(1, [int][Math]::Round($w * $scale))
    $nh = [Math]::Max(1, [int][Math]::Round($h * $scale))
    $bmp = New-Object System.Drawing.Bitmap $nw, $nh
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($img, 0, 0, $nw, $nh)
    $g.Dispose(); $g = $null
    $img.Dispose(); $img = $null
    Save-Jpeg $bmp $dest
    $bmp.Dispose(); $bmp = $null
    return "resize"
  } catch {
    if ($g) { try { $g.Dispose() } catch {} }
    if ($bmp) { try { $bmp.Dispose() } catch {} }
    if ($img) { try { $img.Dispose() } catch {} }
    Copy-Item -LiteralPath $src -Destination $dest -Force
    return "fallback-copy"
  }
}

$copied = 0; $resized = 0; $missing = 0; $skippedGif = 0; $bytes = [int64]0
$keepBases = New-Object "System.Collections.Generic.HashSet[string]"
$i = 0
foreach ($rel in $need) {
  $i++
  if ($i % 500 -eq 0) { Write-Host "progress $i / $($need.Count)" }
  $src = Join-Path $Root $rel
  $base = [IO.Path]::GetFileName($rel)
  if (-not $base) { continue }
  if (-not (Test-Path -LiteralPath $src)) { $missing++; continue }
  $len = (Get-Item -LiteralPath $src).Length
  $ext = [IO.Path]::GetExtension($src).ToLowerInvariant()

  # слишком тяжёлые gif не тащим (эмоции) — значок останется
  if ($ext -eq ".gif" -and $len -gt $gifMaxBytes) {
    $skippedGif++
    continue
  }

  [void]$keepBases.Add($base)
  $dest = Join-Path $destDir $base
  if ($len -le $copyAsIsBytes -or $ext -eq ".gif") {
    Copy-Item -LiteralPath $src -Destination $dest -Force
    $copied++
  } else {
    $mode = Save-Resized $src $dest
    if ($mode -eq "resize") { $resized++ } else { $copied++ }
  }
  $bytes += (Get-Item -LiteralPath $dest).Length
}

$removed = 0
Get-ChildItem -LiteralPath $destDir -File | ForEach-Object {
  if (-not $keepBases.Contains($_.Name)) {
    Remove-Item -LiteralPath $_.FullName -Force
    $removed++
  }
}

Write-Host (@{
  kept = $keepBases.Count
  copied = $copied
  resized = $resized
  missing = $missing
  skippedGif = $skippedGif
  removed = $removed
  mb = [Math]::Round($bytes / 1MB, 1)
  maxEdge = $maxEdge
  jpegQuality = [int]$jpegQuality
} | ConvertTo-Json -Compress)
