# Quick QR Code Publishing Guide

## Method 1: EAS Update (Recommended for Sharing)

### Step 1: Run this command:
```bash
eas update --branch preview --message "iOS fixes and responsive improvements - v1.1.0"
```

**OR** Double-click: `eas-publish.bat`

### Step 2: Get QR Code
1. Go to: https://expo.dev
2. Login to your Expo account
3. Navigate to: **Project** → **Teleprompter** → **Updates** → **Preview Branch**
4. Find your latest update
5. Click on it to see the QR code

### Step 3: Share QR Code
- Screenshot the QR code
- Share via WhatsApp/Email
- Others scan with **Expo Go** app

---

## Method 2: Development QR Code (For Quick Testing)

### Run this command:
```bash
npx expo start --tunnel
```

**OR** Double-click: `share-qr.bat`

This will:
- Start development server
- Create tunnel connection
- Show QR code in terminal
- You can screenshot and share immediately

---

## Method 3: Build APK/IPA (For Production)

### For Android APK:
```bash
eas build --platform android --profile preview
```

### For iOS IPA:
```bash
eas build --platform ios --profile preview
```

After build completes, download and share the APK/IPA file.

---

## Current Configuration

- **Project ID**: `b8442cb8-8033-4425-bf42-ab0329375971`
- **Owner**: `beauty-genie`
- **Branch**: `preview`
- **Runtime Version**: `52.0.0`

---

## Troubleshooting

### If EAS Update Fails:
1. Make sure you're logged in: `eas login`
2. Check your Expo account has access to the project
3. Verify `app.json` has correct `projectId`

### If QR Code Doesn't Work:
1. Make sure recipient has **Expo Go** app installed
2. Both devices should be on internet connection
3. For tunnel mode, your computer must stay online


