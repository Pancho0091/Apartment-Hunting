# Apartment Search 2027

A web app for finding a 1BR (700+ sq ft, rent ≤ $2,300 after specials, in-unit W/D, central AC,
dishwasher, parking, package handling) in LA, Long Beach and Orange County, before The Jayne lease
ends on 2027-01-29.

Live app: https://claude.ai/artifact/WKf2rA6YdPZHSU57nMyLDd

## How it ranks
- **Neighborhood score** (0–10): freeway + traffic 30%, coffee + walkability 30%, quiet 15%,
  safety 15%, LAX 5%, nightlife/gyms/errands 5%. Adjustable in the app.
- **Building reputation** (0–10): resident reviews of management, maintenance, cleanliness, noise,
  security, pests and fees. Default weight 20% on top of the neighborhood factors.
- **Requirements** are shown as confirmed / not confirmed / fails. "Not confirmed" means the
  research could not find evidence either way — ask the leasing office.

## Files
- `index.html` — the app (published as a claude.ai artifact; storage holds buildings, neighborhoods,
  your statuses and notes; falls back to the JSON files below).
- `data/buildings.json`, `data/neighborhoods.json` — merged data the app loads.
- `data/prior/` — the Oct 14 2026 search from the earlier chat.
- `data/research/` — raw research: neighborhood reports (`out_*`), requirement checks (`verified_*`),
  resident reviews (`reviews_out_*`).
- `scripts/build_data.py` — merges the above: `python3 -I scripts/build_data.py data/research`.

## Data limits (Oct 15 2026)
Research came from web-search snippets; page fetches and Reddit were blocked. Building coordinates are
hand-placed estimates, drive times are estimates, and per-capita crime rates are missing for most areas.
Unit prices and specials date from Oct 14 and will change before a January move.
