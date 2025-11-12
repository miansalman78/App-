@echo off
cls
echo ================================================
echo  Publishing EAS Update for Teleprompter App
echo ================================================
echo.
echo Project: Teleprompter
echo Version: 1.1.0
echo Branch: preview
echo.
echo ================================================
echo.

echo Publishing update to EAS...
echo.

eas update --branch preview --message "Latest update with responsive design - v1.1.0"

echo.
echo ================================================
echo  Update Published!
echo ================================================
echo.
echo You can now:
echo 1. Open Expo Go app
echo 2. Scan QR code from: https://expo.dev/accounts/beauty-genie/projects/teleprompter
echo 3. Or use the QR code from Expo Dashboard
echo.
echo Dashboard URL:
echo https://expo.dev/accounts/beauty-genie/projects/teleprompter/updates
echo.
pause


