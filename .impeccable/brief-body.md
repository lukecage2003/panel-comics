## Scope

Whole app shell of `index.html` (Panel): physical collection (default home), series, wishlist, stats, scanner and add sheet, digital library (folder import, series shelves), reader. Mode: Operate. Platforms: desktop Edge (main scene: daytime at the desk, well lit) and Galaxy S25 (APK, one-handed). Code-led (no image generation).

## Audience and job

One collector, ~1,200 single issues + digital PDF/CBZ folders. Jobs: find and check a comic in the collection, add by scan, import a whole folder of digital comics and read it. Must keep every existing feature, the `window.Panel` API and the 21 test suites.

## Direction contract

THESIS: Panel printed like a newsstand comic: four process inks on light newsprint grey, state and progress carried by Ben-Day dot screens; refuses the near-black + single neon accent dashboard the app ships today.

OWN-WORLD: Ground newsprint grey #EEF0EF, panels paper white, key black #161616 for text and 2px panel rules; cyan #00A3DA owns the navigation rail and primary actions; magenta #E5007E marks key issues and alerts; process yellow #FFE500 marks wishlist and highlights; flat fills, no gradients, no glow, hairline seams instead of shadows. Type: condensed grotesque display for numbers and headings (Barlow Condensed 700/800), system UI stack for body.

STORY: The visitor sees their collection as covers first, reads state at a glance from dot screens (read, key, wishlist, series completion), and reaches Scan in one tap on phone.

FIRST VIEWPORT: Desktop: solid cyan rail left (Collection, Séries, Wishlist, Stats, Numérique, Scanner), white header strip with search and one primary "Scanner" button, KPI band (count, value, completion) in black condensed numerals, filter chips, cover grid on newsprint with each card's issue number set large in a black corner box. Phone: same header compacted, 2-column grid, bottom bar with a raised cyan Scan button in the centre.

FORM: Kiosk four-colour process print, candidate 1 of my ordered list (chosen by the user as the pick card); seed: 0165e4befcec4e20. Signature move: Ben-Day halftone screens (CSS radial-gradient dot patterns in the process inks) as the only visual vocabulary for state and progress: read/unread, key issue, wishlist, series completion bars, import progress.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Raises carried from declined challengers

- Hierarchy by scale contrast (specimen): issue number very large, everything else small.
- Every object carries its number as headline (catalog): issue number is the card's headline.
- Flat colour at region scale (zoo map): cyan rail, flat fills, no gradients.
- Hairline seams and isolated destructive actions (console).
- Tabs sized by extent (acetate manual): series chips/shelves show proportional extent bars.
