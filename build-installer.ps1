# MIX LINE EXE Installer Builder
# Creates a self-extracting EXE that contains mywave.js and runs the installer

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outExe = Join-Path $scriptDir "MixLine-Setup.exe"
$mywaveJs = Join-Path $scriptDir "mywave.js"

if (-not (Test-Path $mywaveJs)) {
    Write-Host "mywave.js not found, building..." -ForegroundColor Yellow
    Push-Location $scriptDir
    npm run build
    Copy-Item "dist\app.js" "mywave.js"
    Pop-Location
}

$jsBytes = [System.IO.File]::ReadAllBytes($mywaveJs)
$jsB64 = [Convert]::ToBase64String($jsBytes)

$installerScript = @'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName PresentationFramework

$host.UI.RawUI.WindowTitle = "MIX LINE - Installer"

function Write-Banner {
    Write-Host ""
    Write-Host "  ==========================================" -ForegroundColor Cyan
    Write-Host "    MIX LINE - Installer" -ForegroundColor White
    Write-Host "    Infinite music stream for Spotify" -ForegroundColor DarkGray
    Write-Host "  ==========================================" -ForegroundColor Cyan
    Write-Host ""
}

Write-Banner

# --- Extract mywave.js ---
$tempDir = Join-Path $env:TEMP "mixline-install"
if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir | Out-Null }
$mywaveTarget = Join-Path $tempDir "mywave.js"
$b64 = @"
@@JS_BASE64@@
"@
[System.IO.File]::WriteAllBytes($mywaveTarget, [Convert]::FromBase64String($b64))
Write-Host "  [1/4] Files extracted." -ForegroundColor Green
Write-Host ""

# --- Check Spotify ---
$spotifyExe = Join-Path $env:APPDATA "Spotify\Spotify.exe"
if (-not (Test-Path $spotifyExe)) {
    Write-Host "  [WARNING] Spotify not found at default location." -ForegroundColor Yellow
    Write-Host "            Make sure Spotify (desktop app) is installed." -ForegroundColor Yellow
    Write-Host ""
}

# --- Check/Install Spicetify ---
Write-Host "  [2/4] Checking Spicetify..." -ForegroundColor White
$spicetifyExe = Join-Path $env:LOCALAPPDATA "spicetify\spicetify.exe"
if (-not (Test-Path $spicetifyExe)) {
    $spicetifyExe = Join-Path $env:APPDATA "spicetify\spicetify.exe"
}

if (Test-Path $spicetifyExe) {
    Write-Host "        Already installed." -ForegroundColor Green
} else {
    Write-Host "        Installing Spicetify..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/spicetify/cli/main/install.ps1" | Invoke-Expression
        Start-Sleep -Seconds 2
        $spicetifyExe = Join-Path $env:LOCALAPPDATA "spicetify\spicetify.exe"
        if (-not (Test-Path $spicetifyExe)) {
            $spicetifyExe = Join-Path $env:APPDATA "spicetify\spicetify.exe"
        }
        if (-not (Test-Path $spicetifyExe)) {
            Write-Host "  [ERROR] Spicetify installation failed." -ForegroundColor Red
            Write-Host "          Install manually: https://spicetify.app/docs/getting-started" -ForegroundColor Yellow
            Read-Host "Press Enter to exit"
            exit 1
        }
        Write-Host "        Spicetify installed." -ForegroundColor Green
        Write-Host "        Running backup..." -ForegroundColor White
        & $spicetifyExe backup --bypass-admin
        Write-Host "        Backup done." -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] Failed to install Spicetify: $_" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}
Write-Host ""

# --- Copy Extension ---
Write-Host "  [3/4] Installing MIX LINE extension..." -ForegroundColor White
$extDir = Join-Path $env:APPDATA "spicetify\Extensions"
if (-not (Test-Path $extDir)) { New-Item -ItemType Directory -Path $extDir | Out-Null }
Copy-Item $mywaveTarget (Join-Path $extDir "mywave.js") -Force
Write-Host "        Copied to Extensions folder." -ForegroundColor Green

# Register
& $spicetifyExe config extensions mywave.js --bypass-admin 2>$null
Write-Host ""

# --- Apply ---
Write-Host "  [4/4] Applying to Spotify..." -ForegroundColor White
Write-Host ""
& $spicetifyExe apply --bypass-admin
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Apply failed. Trying restore + apply..." -ForegroundColor Yellow
    & $spicetifyExe restore --bypass-admin
    Start-Sleep 1
    & $spicetifyExe backup --bypass-admin
    Start-Sleep 1
    & $spicetifyExe apply --bypass-admin
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Could not apply. Run manually:" -ForegroundColor Red
        Write-Host "    spicetify restore && spicetify backup && spicetify apply" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Cleanup
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host "    MIX LINE installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "    Spotify will restart automatically." -ForegroundColor White
Write-Host "    Look for the MIX LINE button near the" -ForegroundColor White
Write-Host "    playback controls at the bottom." -ForegroundColor White
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close"
'@

# Inject the base64 JS into the script
$installerScript = $installerScript.Replace('@@JS_BASE64@@', $jsB64)

# Create the EXE wrapper
$exeSource = @"
using System;
using System.Diagnostics;
using System.IO;
using System.Text;

class Program {
    static int Main(string[] args) {
        string tempPs1 = Path.Combine(Path.GetTempPath(), "mixline-installer.ps1");
        string script = Encoding.UTF8.GetString(Convert.FromBase64String(SCRIPT_B64));
        File.WriteAllText(tempPs1, script, Encoding.UTF8);

        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = "powershell.exe";
        psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + tempPs1 + "\"";
        psi.UseShellExecute = false;

        Process p = Process.Start(psi);
        p.WaitForExit();

        try { File.Delete(tempPs1); } catch {}
        return p.ExitCode;
    }

    const string SCRIPT_B64 = "@@SCRIPT_B64@@";
}
"@

$scriptBytes = [System.Text.Encoding]::UTF8.GetBytes($installerScript)
$scriptB64 = [Convert]::ToBase64String($scriptBytes)
$exeSource = $exeSource.Replace('@@SCRIPT_B64@@', $scriptB64)

# Compile
$cscPath = Join-Path ([System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) "csc.exe"
if (-not (Test-Path $cscPath)) {
    # Try finding csc via dotnet
    $cscPath = "csc"
}

$tempCs = Join-Path $env:TEMP "mixline-installer.cs"
[System.IO.File]::WriteAllText($tempCs, $exeSource, [System.Text.Encoding]::UTF8)

Write-Host "Compiling installer..." -ForegroundColor Cyan
try {
    Add-Type -TypeDefinition $exeSource -OutputAssembly $outExe -OutputType ConsoleApplication
    Write-Host "Created: $outExe" -ForegroundColor Green
} catch {
    # Fallback: use csc directly
    Write-Host "Trying csc..." -ForegroundColor Yellow
    & $cscPath /nologo /target:exe /out:$outExe $tempCs
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Created: $outExe" -ForegroundColor Green
    } else {
        Write-Host "CSC failed. Trying .NET Framework csc..." -ForegroundColor Yellow
        $fwCsc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
        if (Test-Path $fwCsc) {
            & $fwCsc /nologo /target:exe /out:$outExe $tempCs
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Created: $outExe" -ForegroundColor Green
            } else {
                Write-Host "Failed to compile EXE." -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "No C# compiler found. Install .NET SDK or use the .bat installer instead." -ForegroundColor Red
            exit 1
        }
    }
}

Remove-Item $tempCs -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "Installer size: $([Math]::Round((Get-Item $outExe).Length / 1KB)) KB" -ForegroundColor Cyan
