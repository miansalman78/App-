@echo off
echo ================================================
echo  Expo EAS Update - Production QR Code
echo ================================================
echo.

echo Step 1: Installing EAS CLI...
call npm install -g eas-cli

echo.
echo Step 2: Login to Expo...
call eas login

echo.
echo Step 3: Configure EAS (if not done)...
call eas build:configure

echo.
echo Step 4: Creating Update...
call eas update --branch preview --message "Latest build with all fixes"

echo.
echo ================================================
echo  Done! Check Expo Dashboard for QR code
echo  Dashboard: https://expo.dev
echo ================================================
pause
