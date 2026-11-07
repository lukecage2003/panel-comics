# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Single-file web app `index.html`, also shipped as an installable PWA and as an Android APK via Capacitor for a Samsung Galaxy S25. The Android build wraps the same web UI; its design language is web, not native Material.)

## Users

One primary user today: a French-speaking comics collector who owns ~1,200 physical US single issues (395 series, many recent DC "Absolute" variants) and also reads digital comics (PDF, CBZ, CBR, image folders). He uses Panel both at his desk (PC, Edge) and on his phone (S25), physical collection and digital reading **equally**. Interface language: French.

## Product Purpose

Panel is a private, local-first alternative to League of Comic Geeks combined with a digital comics reader:
- catalogue a physical collection (barcode scanner, cover recognition, variants, boxes, grades, values, wishlist, pull list, series completion);
- import, organize and read digital comics files;
- keep everything on the user's own devices, with backups and rollback.

Success: identifying and adding a physical comic is as fast and as exact as League of Comic Geeks, never silently wrong; reading a digital comic is comfortable on both phone and desktop.

## Positioning

Local-first and honest: no account required to use it, data stays on the user's devices, every cover and edition carries its source and reliability, uncertain identifications are shown as choices instead of guesses. Combines collection management and a reader in one app.

## Operating Context

- Scanning comics at home, one by one or in continuous mode, phone camera, varying light, comics in bags/boards.
- Importing the League of Comic Geeks Excel export (~2,700 rows) and CLZ/CSV files.
- Importing digital comics files and reading them for long sessions (mobile portrait and desktop).
- Data sources: Comic Vine, Fandom wikis, Metron (user account), GCD; relay via `node serve.js` on PC, built-in relay in the Android app.

## Capabilities and Constraints

- Single `index.html` (≈10,700 lines, vanilla JS, IIFE), no build step for the web app; `android-app/` copies it into the APK.
- Public test API `window.Panel` and 21 automated suites (`node run-all-tests.js`, Edge headless) that must keep passing.
- Storage: localStorage + IndexedDB (pages, singles mirror, snapshots). Offline-capable (service worker on web, bundled libraries in APK).
- Libraries: PDF.js 3.11, JSZip 3.10, zxing-wasm 3.1.3.
- All existing features must be preserved in any redesign.
- **Digital side (import, library, reader) is explicitly unsatisfactory end to end** and is in scope for redesign.

## Brand Commitments

Name "Panel". French UI copy. Existing icons in `icons/` (PWA, maskable, Android). No other binding brand assets.

## Evidence on Hand

Real data: the user's League of Comic Geeks export (1,174 comics, kept outside the project). No testimonials, users, metrics or press exist; none may be invented.

## Product Principles

1. Never silently wrong: uncertainty is shown, the user decides.
2. The user's data is sacred: back up before changing, protect manual choices, allow undo.
3. Fast at the shelf: the common path (scan → right comic → saved) takes the fewest steps.
4. One app, two equal halves: physical collection and digital reading get the same care.
5. Works on the phone first-class, not as a shrunken desktop.

## Accessibility & Inclusion

No specific requirement stated; baseline WCAG AA contrast, touch targets suited to one-handed phone use.
