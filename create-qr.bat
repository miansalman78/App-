@echo off
cls
echo ================================================
echo  Creating EAS Update with QR Code
echo ================================================
echo.
echo Project: Teleprompter Video Editor
echo Version: 1.1.0
echo Branch: preview
echo.
echo ================================================
echo.

echo Creating update...
eas update --branch preview --message "All features working - v1.1.0"

echo.
echo ================================================
echo  Update Complete!
echo ================================================
echo.
echo Open Expo Dashboard to get QR code:
echo https://expo.dev/accounts/beauty-genie/projects/teleprompter/updates
echo.
echo Or scan QR code from Expo Go app
echo.
pause
