# MIX LINE — One-line uninstaller
# Usage: iwr -useb https://raw.githubusercontent.com/l1kad/MIX-LINE---spotify-/main/uninstall.ps1 | iex

$ErrorActionPreference = "Stop"
$extName = "mywave.js"

Write-Host ""
Write-Host "  MIX LINE — Uninstaller" -ForegroundColor Yellow
Write-Host ""

$spicetifyCmd = Get-Command spicetify -ErrorAction SilentlyContinue
if (-not $spicetifyCmd) {
    $spExe = Join-Path $env:LOCALAPPDATA "spicetify\spicetify.exe"
    if (Test-Path $spExe) { $spicetifyCmd = Get-Item $spExe }
}

if (-not $spicetifyCmd) {
    Write-Host "  Spicetify not found. Nothing to uninstall." -ForegroundColor Red
    return
}
$spPath = if ($spicetifyCmd.Source) { $spicetifyCmd.Source } else { $spicetifyCmd.Path }

Write-Host "  [1/3] Removing from config..." -ForegroundColor Cyan
& $spPath config extensions "$extName-" 2>$null

Write-Host "  [2/3] Deleting extension file..." -ForegroundColor Cyan
$extFile = Join-Path $env:APPDATA "spicetify\Extensions\$extName"
if (Test-Path $extFile) { Remove-Item $extFile -Force }

Write-Host "  [3/3] Applying changes..." -ForegroundColor Cyan
& $spPath apply

Write-Host ""
Write-Host "  MIX LINE uninstalled. Spotify will restart." -ForegroundColor Green
Write-Host ""
