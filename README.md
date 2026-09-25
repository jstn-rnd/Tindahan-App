# ACDC

ACDC is an offline-first mobile store app designed for a small sari-sari store. The daily interface is intentionally simpler than ERPNext: products, selling price, and current stock appear together, while stock movements and transaction history remain traceable in the background.

## Current MVP

- Installable Android application built with React, TypeScript, and Capacitor
- Local SQLite database on Android, with browser storage during web development
- PIN unlock (`1234` on first launch)
- Responsive phone and tablet layouts
- Cash, e-wallet, and customer-credit sales
- Product maintenance: add, edit, disable, and delete unused products
- Stock additions, removals, counts, and movement history
- Customer balances and partial/full payments
- Expenses, sales history, void/reversal behavior, and basic reports
- Light mode in green and white
- Dark mode in true black/charcoal with green accents
- Offline outbox prepared for future Frappe synchronization

## Project layout

- `mobile/` — Android/web user interface and offline database
- `backend/acdc_backend/` — Frappe app scaffold and sync endpoint contract
- `docs/` — implementation and sync notes
- `ACDC.apk` — generated installable APK after a successful build

## Development

The mobile project requires Node.js 22 or later.

```bash
cd mobile
pnpm install
pnpm dev
```

Do not open `mobile/index.html` by double-clicking it. Modern JavaScript modules are blocked on `file://` pages, which produces a blank white screen. Use `pnpm dev` for browser development, or install `ACDC.apk` to run the packaged Android app.

## Android APK

With JDK 21 and Android SDK 36 configured:

```bash
cd mobile
pnpm android:apk
```

The Gradle output is generated at `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. The project build script also copies that file to the repository root as `ACDC.apk` for direct installation.

The initial APK is a debug-signed internal build. It can be installed directly on an Android device after allowing installation from the selected file manager. A private release signing key should be created before Play Store distribution.

## Frappe

The APK works without a server. The current Frappe code is a backend and sync-contract scaffold; remote synchronization remains disabled until a Frappe site is deployed and its DocTypes and authentication are configured. Its future HTTPS address belongs under **Store Settings → Frappe server URL**.

The backend scaffold is deliberately separate from ERPNext. It avoids ERPNext accounting, warehouse, tax, price-list, and submission workflows while preserving document history and idempotent sync events.
