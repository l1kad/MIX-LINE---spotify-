@echo off
chcp 65001 >nul 2>&1
title MIX LINE — Uninstaller
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║       MIX LINE — Uninstaller             ║
echo  ╚══════════════════════════════════════════╝
echo.

set "SPICETIFY_EXT=%APPDATA%\spicetify\Extensions"
set "SPICETIFY=%LOCALAPPDATA%\spicetify\spicetify.exe"

echo  [1/3] Removing from Spicetify config...
"%SPICETIFY%" config extensions mywave.js- >nul 2>&1

echo  [2/3] Deleting extension file...
del /Q "%SPICETIFY_EXT%\mywave.js" 2>nul

echo  [3/3] Applying changes to Spotify...
"%SPICETIFY%" apply

echo.
echo  MIX LINE uninstalled. Spotify will restart.
echo.
pause
