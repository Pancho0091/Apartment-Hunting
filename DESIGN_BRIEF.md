# Apartment Search 2027 — design brief

A personal decision tool for one person (Daniel) choosing a 1BR apartment in LA / Long Beach / Orange County
before Jan 30 2027. It ships as ONE standalone HTML file opened locally (no hosting, no server).

## The direction: "modern apothecary"

A precise, modern product UI (think Linear / Arc / Teenage Engineering-level polish: crisp grid, fast,
confident motion, excellent typography) dressed in the visual language of a 19th-century apothecary:
botanical line engravings, specimen labels, numbered drawers, pharmacist's measures, cartographic
engraving. Aesop-store calm, not costume. Restrained color, rich linework. Every listing is a "specimen";
every neighborhood a "region of the atlas".

Owner requests verbatim: "Clean, Swedish style" → "more design forward, cleaner, more visual, think apothecary
illustrations, map more detailed" → "no dark mode" → "modern, tech, modern design, great UX/UI".

### Hard rules
- LIGHT THEME ONLY. No dark mode, no prefers-color-scheme blocks.
- Standalone: everything inline. Only allowed network use: Google Fonts stylesheet (with good fallbacks).
  No CDNs, no tile servers, no images by URL. SVG inline, raster only as data: URIs (avoid).
- Must stay fast with 82+ listings; no layout thrash on filter changes. File budget: < 1.2 MB total.
- Accessible: keyboard reachable, visible focus, real buttons/labels, contrast AA for text,
  `prefers-reduced-motion` respected (motion off or minimal).
- Works at 390px phone width with no horizontal page scroll; desktop up to 1600px.
- Never invent data. Show "—" / "not confirmed" where data is missing.
- Copy: plain, specific, active voice. No emoji. No lorem ipsum.

### Design tokens (starting point — the UI pass owns and may refine them)
- Paper `#f3efe6`, panel `#fbf9f4`, ink `#1f1d1a`, muted ink `#6b655c`, hairline `#d9d2c3`
- Bottle green `#2f4b3c` (primary), amber glass `#a8641f` (secondary / highlights),
  label vermilion `#b8432f` (alerts, used sparingly), sage `#8a9a7b` (map land tints, fills)
- Status: confirmed = bottle green; not confirmed = amber; fails = vermilion
- Type: display serif **Instrument Serif** (headlines, numbers that matter, specimen names),
  UI sans **Geist** (body, controls), **Geist Mono** (labels, small caps metadata, numerals in tables;
  uppercase + 0.08–0.14em tracking reads like an apothecary label).
  Load from Google Fonts with fallbacks: Georgia / -apple-system / ui-monospace.
- Hairline rules (1px), double rules for "label" frames, small radii (2–4px), almost no shadows
  (one soft shadow for floating layers only).

## Architecture (who owns what)
Source lives in `src/`; `python3 -I scripts/build_html.py` inlines everything into
`Apartment-Search-2027.html`. Data: `data/buildings.json`, `data/neighborhoods.json`, `data/geo.json`
(do not edit data files; the geo layers are pre-projected, see `scripts/build_geo.py`).

| File | Owner | Notes |
|---|---|---|
| `src/index.html` | UI pass | page skeleton, font links, placeholders `/*__CSS__*/ /*__ILLUS__*/ /*__MAP__*/ /*__APP__*/ /*__DATA__*/` must remain |
| `src/styles.css` | UI pass | design system + all non-map styles |
| `src/app.js` | UI pass | state, filters, list/table/areas/compare/add views, drawers |
| `src/map.js` | Map pass | `window.MapView.render(root, list, ctx)`; inject its own `<style id="map-css">` once |
| `src/illustrations.js` | Illustration pass | `window.Illus` API below |

Do NOT edit files you don't own. If you need something from another owner, write it in your final report.

### `window.Illus` API (illustration pass implements; UI pass calls defensively: `Illus.x ? Illus.x(...) : ""`)
All return an SVG markup string. Line art, `stroke="currentColor"`, `fill="none"` unless a deliberate tint
uses `var(--sage)`/`var(--amber)` etc. Scalable via width/height attrs or CSS.
- `hero()` — wide header engraving (~1200×220 viewBox): a botanical composition of Southern California
  plants (fan palm, orange blossom, sage, bird-of-paradise or jacaranda) with a faint coastline; elegant,
  not busy; leaves room for the title on the left.
- `region(name)` — emblem ~64px for "Los Angeles" (fan palm), "Long Beach" (scallop shell / wave),
  "Orange County" (orange branch with blossom). Unknown name → generic sprig.
- `req(key)` — 18–20px icons: `wd` washer, `ac` vent/snowflake, `dw` dishes, `parking` car/P, `packages` parcel.
- `factor(key)` — icons for `drive` (road/milestone), `coffee` (cup/bean), `quiet` (moon/leaf),
  `safety` (shield/key), `lax` (plane), `extras` (lantern/dumbbell), `rep` (quill/stars).
- `seal(text)` — circular apothecary stamp/seal for "Meets everything" (text on a path).
- `ornament()` — horizontal divider flourish.
- `empty()` — vignette for empty states (an empty specimen jar).
- `compass()` — compass rose for the map.
- `jar(fill)` — small apothecary jar whose fill level (0–1) shows a score (used for match score).

## Map pass requirements
Detailed, beautiful, usable atlas of the search area using `ctx.geo`:
land (OSM coastline), ocean, 296 neighborhood outlines, excluded South Bay (hatched), county line,
25 freeways with shields, rail, airports, place labels. Engraved-cartography look (hatching for water
near the coast, fine linework). Zoom (wheel, pinch, +/- buttons) and pan (drag), reset; labels and
markers keep constant screen size while zooming; markers clustered or de-overlapped when dense
(Koreatown/DTLA have many). Marker = listing (status color); click → `ctx.openBuilding(b)`; hover/focus
tooltip; legend; scale bar in miles; layer toggles (neighborhoods, freeways, rail, excluded). Keyboard
accessible markers. Smooth zoom transitions. Projection: x = (lng-W)/(E-W)*size[0], y = (N-lat)/(N-S)*size[1]
with geo.bounds = [W,E,S,N].

## Process (every pass)
1. Read this brief and the files you own.
2. Build: `python3 -I scripts/build_html.py`
3. Check: `PW=$(npm root -g)/playwright/index.mjs node scripts/check.mjs <your-scratch-dir>` — prints JSON
   (counts, horizontal-scroll flags, console errors) and writes screenshots. LOOK at the screenshots
   (Read tool on the PNGs) and iterate until it is genuinely excellent. Zero console errors.
4. Keep the hooks the check script uses: `#q`, `#count`, `[data-view=list|table|map|areas|compare|add]`,
   `[data-listing]` on each listing element.
5. Do not commit. Report: what you changed, screenshots paths, anything another owner must do.
