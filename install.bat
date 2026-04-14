@echo off
title MIX LINE - Installer
echo.
echo  ==========================================
echo    MIX LINE - Installer
echo    Infinite music stream for Spotify
echo  ==========================================
echo.

set "SRC=%~dp0"
set "SPICETIFY_DIR=%LOCALAPPDATA%\spicetify"
set "SPICETIFY=%SPICETIFY_DIR%\spicetify.exe"
set "SPICETIFY_EXT=%APPDATA%\spicetify\Extensions"

:: -------------------------------------------
:: Step 1: Check mywave.js exists next to bat
:: -------------------------------------------
echo  [1/4] Checking files...
if not exist "%SRC%mywave.js" (
    if exist "%SRC%dist\app.js" (
        copy /Y "%SRC%dist\app.js" "%SRC%mywave.js" >nul
    ) else (
        echo.
        echo  [ERROR] mywave.js not found next to install.bat
        echo          Make sure mywave.js is in the same folder.
        echo.
        pause
        exit /b 1
    )
)
echo        mywave.js found.
echo.

:: -------------------------------------------
:: Step 2: Install Spicetify if needed
:: -------------------------------------------
echo  [2/4] Checking Spicetify...
if exist "%SPICETIFY%" (
    echo        Already installed.
) else (
    echo        Spicetify not found. Installing...
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 | iex"
    timeout /t 2 >nul
    if not exist "%SPICETIFY%" (
        :: Check alternate path
        set "SPICETIFY=%APPDATA%\spicetify\spicetify.exe"
        if not exist "!SPICETIFY!" (
            echo.
            echo  [ERROR] Spicetify installation failed.
            echo          Try installing manually:
            echo          https://spicetify.app/docs/getting-started
            echo.
            pause
            exit /b 1
        )
    )
    echo.
    echo        Spicetify installed.
    echo.
    echo  Running first-time backup of Spotify...
    "%SPICETIFY%" backup
    echo        Backup done.
)
echo.

:: -------------------------------------------
:: Step 3: Copy extension
:: -------------------------------------------
echo  [3/4] Installing MIX LINE extension...
if not exist "%SPICETIFY_EXT%" mkdir "%SPICETIFY_EXT%"
copy /Y "%SRC%mywave.js" "%SPICETIFY_EXT%\mywave.js" >nul
if errorlevel 1 (
    echo  [ERROR] Failed to copy mywave.js
    echo.
    pause
    exit /b 1
)
echo        Copied to Extensions folder.

:: Register in spicetify config
"%SPICETIFY%" config extensions mywave.js >nul 2>&1
echo.

:: -------------------------------------------
:: Step 4: Apply
:: -------------------------------------------
echo  [4/4] Applying to Spotify...
echo.
"%SPICETIFY%" apply
if errorlevel 1 (
    echo.
    echo  Apply failed. Trying restore then apply...
    "%SPICETIFY%" restore
    timeout /t 1 >nul
    "%SPICETIFY%" backup
    timeout /t 1 >nul
    "%SPICETIFY%" apply
    if errorlevel 1 (
        echo.
        echo  [ERROR] Could not apply changes.
        echo          Open PowerShell and run:
        echo            spicetify restore
        echo            spicetify backup
        echo            spicetify apply
        echo.
        pause
        exit /b 1
    )
)
echo.
echo  ==========================================
echo    MIX LINE installed successfully!
echo.
echo    Spotify will restart automatically.
echo    Look for the MIX LINE button near the
echo    playback controls at the bottom.
echo  ==========================================
echo.
pause
