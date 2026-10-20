# Apartment Search 2027

A web app for finding a 1BR (700+ sq ft, rent ≤ $2,300 after specials, in-unit W/D, central AC,
dishwasher, parking, package handling) in LA, Long Beach and Orange County, before The Jayne lease
ends on 2027-01-29.

**Open `Apartment-Search-2027.html` in any browser.** It is one self-contained file: all listing and
neighborhood data is embedded, nothing is hosted. Statuses, notes and listings you add are saved in that
browser; use Export / Import at the bottom of the page to back them up or move them.

## How it ranks
- **Neighborhood score** (0–10): freeway + traffic 30%, coffee + walkability 30%, quiet 15%,
  safety 15%, LAX 5%, nightlife/gyms/errands 5%. Adjustable in the app.
- **Building reputation** (0–10): resident reviews of management, maintenance, cleanliness, noise,
  security, pests and fees. Default weight 20% on top of the neighborhood factors.
- **Requirements** are shown as confirmed / not confirmed / fails. "Not confirmed" means the
  research could not find evidence either way — ask the leasing office.

## Files
- `Apartment-Search-2027.html` — the standalone tool (generated; do not edit by hand).
- `app.template.html` — the tool's source; `scripts/build_html.py` embeds the data into it.
- `data/buildings.json`, `data/neighborhoods.json` — merged data the app loads.
- `data/prior/` — the Oct 14 2026 search from the earlier chat.
- `data/research/` — raw research: neighborhood reports (`out_*`), requirement checks (`verified_*`),
  resident reviews (`reviews_out_*`).
- `scripts/build_data.py` — merges the above: `python3 -I scripts/build_data.py data/research`.
- Rebuild the tool after any data change: `python3 -I scripts/build_html.py`.

## Data limits (Oct 15 2026)
Research came from web-search snippets; page fetches and Reddit were blocked. Building coordinates are
hand-placed estimates, drive times are estimates, and per-capita crime rates are missing for most areas.
Unit prices and specials date from Oct 14 and will change before a January move.
