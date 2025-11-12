@echo off
cls
echo ================================================
echo  Starting Expo with QR Code for Sharing
echo ================================================
echo.
echo Project: Teleprompter App
echo This will create a shareable QR code
echo.
echo ================================================
echo.
echo Starting Expo with tunnel mode...
echo QR code will appear in terminal and Expo Go app
echo.
echo Press Ctrl+C to stop
echo.
echo ================================================
echo.

npx expo start --tunnel --clear

pause


