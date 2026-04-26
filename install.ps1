# MIX LINE — One-line installer for Spotify Desktop
# Usage: iwr -useb https://raw.githubusercontent.com/l1kad/MIX-LINE---spotify-/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
$repo = "l1kad/MIX-LINE---spotify-"
$extName = "mywave.js"

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Green
Write-Host "    MIX LINE — Installer" -ForegroundColor Green
Write-Host "    Infinite music stream for Spotify" -ForegroundColor DarkGray
Write-Host "  ========================================" -ForegroundColor Green
Write-Host ""

# --- Step 1: Locate or install Spicetify ---
Write-Host "  [1/4] Checking Spicetify..." -ForegroundColor Cyan
$spicetifyCmd = Get-Command spicetify -ErrorAction SilentlyContinue
if (-not $spicetifyCmd) {
    $spExe = Join-Path $env:LOCALAPPDATA "spicetify\spicetify.exe"
    if (Test-Path $spExe) {
        $spicetifyCmd = Get-Item $spExe
    }
}

if (-not $spicetifyCmd) {
    Write-Host "        Spicetify not found. Installing..." -ForegroundColor Yellow
    Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/spicetify/cli/main/install.ps1" | Invoke-Expression
    Start-Sleep -Seconds 2
    $spicetifyCmd = Get-Command spicetify -ErrorAction SilentlyContinue
    if (-not $spicetifyCmd) {
        $spExe = Join-Path $env:LOCALAPPDATA "spicetify\spicetify.exe"
        if (Test-Path $spExe) {
            $spicetifyCmd = Get-Item $spExe
        } else {
            Write-Host "  [ERROR] Spicetify installation failed." -ForegroundColor Red
            Write-Host "          Install manually: https://spicetify.app/docs/getting-started" -ForegroundColor Red
            return
        }
    }
    Write-Host "        Running first-time backup..." -ForegroundColor DarkGray
    & $spicetifyCmd.Source backup 2>$null
    Write-Host "        Spicetify installed." -ForegroundColor Green
} else {
    Write-Host "        Already installed." -ForegroundColor Green
}
$spPath = if ($spicetifyCmd.Source) { $spicetifyCmd.Source } else { $spicetifyCmd.Path }
Write-Host ""

# --- Step 2: Download latest mywave.js from GitHub ---
Write-Host "  [2/4] Downloading MIX LINE..." -ForegroundColor Cyan
$extDir = Join-Path $env:APPDATA "spicetify\Extensions"
if (-not (Test-Path $extDir)) { New-Item -ItemType Directory -Path $extDir -Force | Out-Null }

$downloadUrl = "https://raw.githubusercontent.com/$repo/main/mywave.js"
$destPath = Join-Path $extDir $extName

try {
    Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $destPath
    Write-Host "        Downloaded to Extensions folder." -ForegroundColor Green
} catch {
    # Fallback: try GitHub releases
    Write-Host "        Trying release download..." -ForegroundColor Yellow
    $releaseApi = "https://api.github.com/repos/$repo/releases/latest"
    try {
        $release = Invoke-RestMethod -Uri $releaseApi -UseBasicParsing
        $asset = $release.assets | Where-Object { $_.name -eq $extName } | Select-Object -First 1
        if ($asset) {
            Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -OutFile $destPath
            Write-Host "        Downloaded from release." -ForegroundColor Green
        } else {
            throw "Asset not found"
        }
    } catch {
        Write-Host "  [ERROR] Could not download mywave.js" -ForegroundColor Red
        Write-Host "          Download manually from: https://github.com/$repo/releases/latest" -ForegroundColor Red
        return
    }
}
Write-Host ""

# --- Step 3: Register extension ---
Write-Host "  [3/4] Registering extension..." -ForegroundColor Cyan
& $spPath config extensions $extName 2>$null
Write-Host "        Registered." -ForegroundColor Green
Write-Host ""

# --- Step 4: Apply ---
Write-Host "  [4/4] Applying to Spotify..." -ForegroundColor Cyan
& $spPath apply
if ($LASTEXITCODE -ne 0) {
    Write-Host "        Apply failed, trying restore..." -ForegroundColor Yellow
    & $spPath restore 2>$null
    Start-Sleep -Seconds 1
    & $spPath backup 2>$null
    Start-Sleep -Seconds 1
    & $spPath apply
}
Write-Host ""

Write-Host "  ========================================" -ForegroundColor Green
Write-Host "    MIX LINE installed!" -ForegroundColor Green
Write-Host ""
Write-Host "    Spotify will restart automatically." -ForegroundColor DarkGray
Write-Host "    Look for the MIX LINE button in the" -ForegroundColor DarkGray
Write-Host "    bottom playback bar." -ForegroundColor DarkGray
Write-Host "  ========================================" -ForegroundColor Green
Write-Host ""
