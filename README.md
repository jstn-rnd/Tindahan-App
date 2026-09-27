# ACDC

ACDC is an offline-first mobile store app designed for a small sari-sari store. The daily interface is intentionally simpler than ERPNext: products, selling price, and current stock appear together, while stock movements and transaction history remain traceable in the background.

## Current MVP

- Shared Android and iOS application built with React, TypeScript, and Capacitor
- Local SQLite database on Android and iOS, with browser storage during web development
- PIN unlock (`1234` on first launch)
- Responsive phone and tablet layouts
- Cash, e-wallet, and customer-credit sales
- Product maintenance: add, edit, disable, and delete unused products
- Stock additions, removals, counts, and movement history
- Customer balances and partial/full payments
- Expenses, sales history, void/reversal behavior, and basic reports
- Light mode in green and white
- Dark mode in true black/charcoal with green accents
- Optional single-file backup through the Android system file picker
- Backup restore and monthly backup count

## Project layout

- `mobile/src/` — shared Android/iOS user interface and offline business logic
- `mobile/android/` — native Android project
- `mobile/ios/` — native iOS Xcode project
- `android/ACDC.apk` — generated installable Android package
- `ios/ACDC.ipa` — future signed iPhone package

## Development

The mobile project requires Node.js 22 or later.

```bash
cd mobile
pnpm install
pnpm dev
```

Do not open `mobile/index.html` by double-clicking it. Modern JavaScript modules are blocked on `file://` pages, which produces a blank white screen. Use `pnpm dev` for browser development, or install a packaged mobile build.

## Android APK

With JDK 21 and Android SDK 36 configured:

```bash
cd mobile
pnpm android:apk
```

The Gradle output is generated at `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. The project build script also copies that file to `android/ACDC.apk` for direct installation.

The initial APK is a debug-signed internal build. It can be installed directly on an Android device after allowing installation from the selected file manager. A private release signing key should be created before Play Store distribution.

## iOS

The iOS project uses the same React/TypeScript source and offline SQLite model as Android. Sync the shared web build into the native Xcode project with:

```bash
cd mobile
pnpm ios:sync
```

The native project is located at `mobile/ios/App/App.xcodeproj`. Building or exporting an installable `ACDC.ipa` requires the full Xcode application and an Apple signing identity. Xcode and personal-device testing are free, but a free Personal Team profile expires after 7 days and does not support distributing the app to friends. All application artwork in this repository is original project artwork and does not require paid assets. See `ios/README.md` for the no-cost workflow and current build requirement.

## Backup

ACDC does not require a server and all selling features remain offline-first. In the installed Android app, **More → Backup & Restore** supports two independent destinations:

- **Local** uses Android's system file picker and replaces the selected `ACDC-backup.json` file.
- **Google Drive** uses Google OAuth, verifies the selected account against the email entered in ACDC, and creates or replaces one app-managed `ACDC-backup.json` file using the narrow `drive.file` permission.

Direct Google Drive backup requires the Drive API and an Android OAuth client for package `com.acdc.store` in a Google Cloud project. The OAuth client must include the SHA-1 certificate fingerprint of the key used to sign the installed APK. No Google password is collected or stored by ACDC.
