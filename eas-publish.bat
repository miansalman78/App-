@echo off
echo ================================================
echo  Expo EAS Update - Publish QR Code
echo ================================================
echo.

echo Checking EAS CLI installation...
where eas >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo EAS CLI not found. Installing...
    call npm install -g eas-cli
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to install EAS CLI. Please install manually:
        echo npm install -g eas-cli
        pause
        exit /b 1
    )
) else (
    echo EAS CLI is installed.
)

echo.
echo Step 1: Checking Expo login status...
call eas whoami >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Not logged in. Please login to your Expo account...
    call eas login
    if %ERRORLEVEL% NEQ 0 (
        echo Login failed. Please try again.
        pause
        exit /b 1
    )
) else (
    echo Already logged in to Expo.
)

echo.
echo Step 2: Publishing EAS Update to Preview Branch...
echo.
echo Publishing Android update...
call eas update --branch preview --message "Responsive improvements for all devices - v1.1.0" --platform android

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Android update failed!
    echo Please check your internet connection and try again.
    pause
    exit /b 1
)

echo.
echo Publishing iOS update...
call eas update --branch preview --message "Responsive improvements for all devices - v1.1.0" --platform ios

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: iOS update failed!
    echo Please check your internet connection and try again.
    pause
    exit /b 1
)

echo.
echo ================================================
echo  Update Published Successfully!
echo ================================================
echo.
echo  QR Code Location:
echo  1. Go to: https://expo.dev
echo  2. Login to your Expo account (beauty-genie)
echo  3. Navigate to: Projects ^> Teleprompter ^> Updates ^> Preview Branch
echo  4. Find your latest update (just published)
echo  5. Click on the update to see QR code
echo  6. Screenshot and share the QR code
echo.
echo  Project Details:
echo  - Project ID: b8442cb8-8033-4425-bf42-ab0329375971
echo  - Owner: beauty-genie
echo  - Branch: preview
echo.
echo  To share:
echo  - Users need Expo Go app installed
echo  - Scan QR code with Expo Go
echo  - App will update automatically
echo.
echo ================================================
pause
