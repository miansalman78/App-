# 📱 Expo QR Code Setup Guide

## 🚀 Quick Start

### Option 1: Development Server (QR Code)
```bash
npx expo start
```
- Opens Metro Bundler
- Shows QR code in terminal
- QR code also available at: http://localhost:8081

### Option 2: With Tunnel (Remote Testing)
```bash
npx expo start --tunnel
```
- Creates public URL
- QR code works from anywhere
- Good for testing on different WiFi

### Option 3: Browser QR Code
1. Run: `npx expo start`
2. Open: http://localhost:8081 in browser
3. Scan QR code from browser

---

## 📱 Testing on Device

### Android:
1. Install **Expo Go** app from Play Store
2. Open Expo Go
3. Scan QR code
4. App will load automatically

### iOS:
1. Install **Expo Go** app from App Store
2. Open Camera app (or Expo Go)
3. Scan QR code
4. Tap notification to open

---

## 🔧 Troubleshooting

### Port Already in Use
```bash
npx expo start --port 8082
```

### Clear Cache
```bash
npx expo start --clear
```

### Tunnel Not Working
```bash
npx expo start --lan
```

---

## 🌐 Option 2: EAS Update (Production-like)

### Setup EAS
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure
```

### Create Update
```bash
# Create update channel
eas update --branch preview

# Get QR code
eas update --branch preview --message "Latest fixes"
```

### Share with Team
- Update creates shareable link
- QR code in Expo dashboard
- No need for local server

---

## 📦 Option 3: Build APK/IPA (Standalone)

### Android APK (Preview Build)
```bash
# Configure EAS
eas build:configure

# Build preview APK
eas build --platform android --profile preview

# Download and install APK directly
```

### iOS (TestFlight)
```bash
# Build for iOS
eas build --platform ios --profile preview

# Upload to TestFlight
# Share TestFlight link
```

---

## 🎯 Recommended Workflow

### For Development:
```bash
npx expo start --tunnel
```
✅ Fastest for testing
✅ QR code available
✅ Hot reload enabled

### For Team Sharing:
```bash
eas update --branch preview
```
✅ No need for local server
✅ Shareable link
✅ QR code in dashboard

### For Client Demo:
```bash
eas build --platform android --profile preview
```
✅ Standalone APK
✅ No Expo Go needed
✅ Production-like experience

---

## 📱 Current Setup

### Metro Bundler Running:
- Port: 8082
- Access: http://localhost:8082
- QR Code: Available in terminal and browser

### Scan QR Code:
1. Open Expo Go on phone
2. Scan QR code from terminal or browser
3. App will load with all features

### Features Available:
✅ Video recording
✅ Video editing (trim, split, delete)
✅ Text overlays
✅ Image/sticker overlays
✅ Transitions
✅ Audio mixing
✅ AWS S3 upload
✅ Offline processing

---

## 🔗 Quick Links

- Expo Dashboard: https://expo.dev
- Expo Go Download: https://expo.dev/client
- EAS Documentation: https://docs.expo.dev/eas/
- Project Repository: https://github.com/StartupPal/teleprompter-module

---

**Version:** 1.1.0  
**Last Updated:** November 1, 2025
