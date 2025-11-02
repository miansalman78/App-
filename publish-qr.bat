@echo off
cls
echo ================================================
echo  Publishing QR Code for Teleprompter App
echo ================================================
echo.
echo Project: Teleprompter
echo Version: 1.1.0
echo.
echo ================================================
echo.

echo Starting Expo with Tunnel (for QR Code)...
echo.
echo This will:
echo 1. Start Expo development server
echo 2. Create tunnel connection
echo 3. Generate QR code that you can share
echo.
echo Press Ctrl+C to stop the server
echo.
echo ================================================
echo.

npx expo start --tunnel --clear

pause


