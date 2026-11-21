# Product

<!-- impeccable:product-schema 1 -->

Mis à jour le 13 novembre 2026. Référence complète : [`docs/prd/PANEL_PRD_V1.md`](docs/prd/PANEL_PRD_V1.md).

## Platform

web

(Single-file web app `index.html`, also shipped as an installable PWA and as an Android APK via Capacitor for a Samsung Galaxy S25. The Android build wraps the same web UI; its design language is web, not native Material. Decision of 13 November 2026: this client is kept, no migration to Next.js/React.)

## Users

Today, one primary user: a French-speaking comics collector who owns ~1,200 physical US single issues (395 series, many recent DC "Absolute" variants) and buys French editions too. He uses Panel at his desk (PC, Edge) and on his phone (S25). Interface language: French.

Target: French-speaking comics readers and collectors (launch in the francophonie, then Europe), plus reading-club hosts and moderators (personas in the PRD § 2).

## Product Purpose

PANEL is a social and cultural platform for comics readers, built on three balanced pillars:
- **Collection**: catalogue a physical collection (barcode scanner, cover recognition, variants, boxes, grades, values, wishlist, series completion, finances);
- **Reading**: track what you read, event reading orders by level (essential, recommended, complete), what to read next;
- **Community**: share, discuss and meet other readers without exposing private data (planned; needs the backend).

Releases calendar and pull list connect the three. Business model: freemium (PANEL Free / PANEL Plus); essential social features are always free.

Success: identifying and adding a physical comic is as fast and as exact as League of Comic Geeks, never silently wrong; a reader knows what to read next; the community is spoiler-safe.

## Positioning

Local-first and honest: no account required for personal features, data stays on the user's devices until they choose to sync, every cover and edition carries its source and reliability, uncertain identifications are shown as choices. French-first, with collection features free where competitors charge.

## Scope

Comics only: American publishers and French comics publishers (Urban, Panini Comics, Delcourt Comics, Bliss, HiComics…). Excluded: manga, manhwa, manhua, webtoon, Franco-Belgian BD, digital page reading. Existing out-of-scope data is kept and hidden, never deleted.

## Operating Context

- Scanning comics at home, one by one or in continuous mode, phone camera, varying light, comics in bags/boards.
- Importing the League of Comic Geeks Excel export (~2,700 rows) and CLZ/CSV files.
- Checking the weekly releases (US Wednesday, French releases) and the pull list.
- Data sources: Comic Vine (user key), Metron (user account), GCD; relay via `node serve.js` on PC, built-in relay in the Android app.

## Capabilities and Constraints

- Single `index.html` (~17,400 lines, vanilla JS, IIFE), no build step; business rules extracted into `domains/**` and inlined by `scripts/sync-domains.js`.
- Public test API `window.Panel`; 52 interface tests (`node run-all-tests.js`, Edge headless), 55 domain tests, 124 database tests (PGlite) — all must keep passing.
- Storage: localStorage + IndexedDB (`panel-catalog`, `panel-library`), snapshots, per-domain backups. Offline-capable.
- Backend: Supabase migrations prepared (`backend/`), not deployed yet.
- All existing features must be preserved in any redesign.

## Brand Commitments

Name "PANEL". French UI copy. Black and yellow identity, Barlow Condensed headings, light/dark/system modes. Existing icons in `icons/`.

## Evidence on Hand

Real data: the user's League of Comic Geeks export (1,174 comics, kept outside the project). No testimonials, users, metrics or press exist; none may be invented.

## Product Principles

1. Never silently wrong: uncertainty is shown, the user decides.
2. The user's data is sacred: back up before changing, protect manual choices, allow undo.
3. Private by default: finances, values, locations and notes are never public.
4. Fast at the shelf: scan → right comic → saved in the fewest steps.
5. Mobile first-class, not a shrunken desktop.
6. Essential social features are never paywalled.

## Accessibility & Inclusion

WCAG 2.2 AA target: AA contrast in both modes, touch targets ≥ 44 px, no horizontal scroll at 375 px, keyboard access.
