# Play Store Deployment Guide

## What's been done ✅
- Capacitor installed + Android platform added
- Web app built to `dist/` and synced to `android/`
- App icons generated (all densities: mdpi → xxxhdpi)
- Splash screens generated (all portrait densities)
- Play Store icon: `store-assets/icon-1024.png`
- Play Store feature graphic: `store-assets/feature-graphic.png`
- App ID: `com.lawcodeeng.app`
- App name: Thai Law Code · English

## Next: Open in Android Studio

### Step 1 — Open project
```
npm run cap:open
# or manually open folder: android/ in Android Studio
```

### Step 2 — Change App ID (if needed)
In Android Studio → app/build.gradle:
```gradle
applicationId "com.lawcodeeng.app"   // change to your domain
```

### Step 3 — Sign the app (required for Play Store)
1. Build → Generate Signed Bundle / APK
2. Choose **Android App Bundle (.aab)** — required by Google
3. Create a new keystore or use existing
   - Store it safely — you CANNOT change it later
   - Key alias: `lawcodeeng`
   - Validity: 25+ years
4. Build → Release

### Step 4 — Update web app & re-sync
Whenever you change the React code:
```bash
npm run build:android   # builds vite + syncs to Android
npm run cap:open        # open Android Studio to rebuild AAB
```

## Play Store submission checklist
- [ ] Developer account ($25 one-time fee)
- [ ] `store-assets/icon-1024.png` (512×512 also accepted — scale down)
- [ ] `store-assets/feature-graphic.png` (1024×500)
- [ ] At least 2 screenshots (phone)
- [ ] Privacy Policy URL (required — app stores bookmarks locally)
- [ ] App title: "Thai Law Code in English"
- [ ] Short description (80 chars max)
- [ ] Full description
- [ ] Content rating: Everyone / Reference
- [ ] Category: Books & Reference

## Privacy Policy (minimum)
This app stores bookmarks and reading history locally on your device only.
No data is sent to any server. No account required.
