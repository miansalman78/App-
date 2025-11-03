@echo off
echo ================================================
echo  Generate QR Code for Sharing (Expo Go)
echo ================================================
echo.
echo Starting Expo development server with tunnel...
echo This will generate a QR code that you can share!
echo.
echo Press Ctrl+C to stop the server
echo.

call npx expo start --tunnel --clear

pause


