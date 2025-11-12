# QR Code Publish Guide

## Quick Start - Generate QR Code for Sharing

### Method 1: Development QR Code (Share via Tunnel)

1. **Run this command:**
   ```bash
   npm run start:qr
   ```
   
   OR double-click:
   ```
   publish-qr.bat
   ```

2. **This will:**
   - Start Expo development server
   - Create tunnel connection
   - Generate QR code in terminal
   - Show QR code that you can share with others

3. **Share the QR Code:**
   - Anyone with Expo Go app can scan this QR code
   - They'll be able to access your app instantly
   - Works on both iOS and Android

### Method 2: Publish to EAS (Recommended for Production)

1. **Publish Update:**
   ```bash
   npm run publish
   ```
   
   OR double-click:
   ```
   publish-update.bat
   ```

2. **Get QR Code from Dashboard:**
   - Open: https://expo.dev/accounts/beauty-genie/projects/teleprompter/updates
   - Find your latest update
   - Copy QR code or share link

## Commands Reference

| Command | Description |
|---------|-------------|
| `npm run start:qr` | Start with tunnel and show QR code |
| `npm run publish` | Publish update to preview branch |
| `npm run publish:production` | Publish to production branch |

## Prerequisites

Make sure you have:
- ✅ Expo Go app installed on your phone
- ✅ Same WiFi network OR tunnel mode enabled
- ✅ Expo account logged in (`npx expo login`)

## Sharing Options

1. **Screen Share**: Show QR code on your screen, others scan with Expo Go
2. **Screenshot**: Take screenshot of QR code and send via WhatsApp/Email
3. **Dashboard Link**: Share Expo Dashboard link directly
4. **Expo Share**: Use `npx expo share` command

## Troubleshooting

**QR Code not showing?**
- Make sure tunnel mode is enabled (`--tunnel` flag)
- Check internet connection
- Try `npx expo start --tunnel --clear`

**Can't connect?**
- Ensure Expo Go app is updated
- Check firewall settings
- Try restarting Expo server

**Need public URL?**
- Use EAS Update for permanent shareable links
- Dashboard provides permanent QR codes

## Production Sharing

For production sharing:
1. Build app with `eas build`
2. Submit to stores (App Store/Play Store)
3. Or use EAS Update for over-the-air updates


