# UI pass 3 — markets + richer data

Read DESIGN_BRIEF.md first (modern apothecary, light theme only, standalone single file, accessibility,
no invented data). You own src/*, scripts/build_html.py and scripts/check.mjs for this pass.

## 1. Market tabs
Add a top-level market switch: **Los Angeles · Seattle · New York** (LA default; remember the choice in
localStorage). Each market has its own listings, neighborhoods, map geography, regions and match scaling.
Shared across markets: requirements (700+ sq ft, rent ≤ $2,300, in-unit W/D, central AC, dishwasher,
parking, package handling), deadlines, The Jayne baseline ($2,726.83), ranking weights, statuses/notes.

Data model (build_html.py):
- `data/buildings.json` and `data/neighborhoods.json` are LA (treat records without `market` as `"la"`).
- Seattle / New York data will arrive later as `data/buildings-seattle.json`, `data/neighborhoods-seattle.json`,
  `data/buildings-nyc.json`, `data/neighborhoods-nyc.json` (same shapes as LA). They may not exist yet:
  build must work without them.
- Geography: `data/geo.json` (LA), `data/geo-seattle.json`, `data/geo-nyc.json` (same shape; `excluded` may be "").
- Embed as `DATA.markets = { la: {label, buildings, neighborhoods, geo}, seattle: {...}, nyc: {...} }`.
- Regions come from each market's neighborhoods (`region` field). Expected: LA → Los Angeles / Long Beach /
  Orange County; Seattle → Seattle / Eastside / North & South suburbs; NYC → Manhattan / Brooklyn / Queens /
  Bronx / Staten Island / New Jersey. Filters must not break when a saved region doesn't exist in the market.
- A market with no listings yet shows its atlas map and a designed empty state: "Seattle research hasn't run
  yet" style copy (plain, no promises of dates), with the requirements it will use.
- src/map.js: make it market-aware — the title panel currently says LA things, and the legend mentions the
  "South Bay · ruled out" zone; derive labels from the geo/market (hide the ruled-out legend when `excluded` is
  empty; NYC "county" line = borough boundaries, Seattle = city limit). Keep one MapView instance per geo.
  Airports/places come from the geo. Keep all existing map behavior and performance.

## 2. New listing fields (LA now; same shape for other markets)
Each listing may now have:
- `detail.costs` {required_fees:[{name,amount}], utilities, deposit, application_fee, admin_fee, parking_fee, lease_terms}
- `detail.pets` {cats, dogs (yes|no|unclear), pet_rent, pet_deposit, limits}
- `detail.parking` {type: garage|covered|surface|tandem|street|unclear, ev_charging, guest_parking}
- `detail.building` {units, stories, year_built, renovated, elevator, gym, pool, coworking, rooftop_or_courtyard,
  controlled_access, onsite_management, smoke_free}
- `detail.unit` {balcony, storage, floors_available, features[]}
- `detail.internet` {fiber, providers[]}
- `detail.location` {walk_score, transit_score, bike_score, nearest_onramp, onramp_miles, freeway_within_500ft,
  nearest_specialty_cafe, cafe_walk_min, nearest_grocery, grocery_walk_min, nearest_metro, metro_walk_min,
  nearest_gym, gym_minutes, lax_drive_min_offpeak}
- `detail.availability` {units_note, website, leasing_phone}, `detail.evidence` (caveats text), `detail_sources[]`
- top level: `required_fees_total` (number|null), `freeway_band` ("under 1 mi"|"1–2 mi"|"over 2 mi", rough),
  `area_walk_score`, `batch` (recent finds: "new-oct15", "private-oct15", "recent-oct26").
Neighborhoods may have `extras` {median_1br_rent, rent_source, rent_trend, summer_high_f, summer_source,
marine_layer, fire_hazard, flood_zone, airport_noise, parks[], farmers_markets[], fiber, vibe}.
Coverage is uneven (many nulls / "unclear") — the UI must make unknown visible ("—", "not found") and never
imply a value. Field coverage today (LA, 120 listings): pets ~60, parking type ~66, year built ~50, gym/pool
~55, deposit ~23, parking fee ~17, fees ~10, walk score per address ~8, fiber 0. Neighborhood summer high 46/46,
1BR rent 45/46.

Make it filterable and checkable:
- **True monthly cost** = rent after specials + parking fee + required fees (when known). Show it on cards,
  table, compare, drawer, with a note when parts are unknown. Sort by it. Savings vs The Jayne use it.
- Filters (in sensible collapsible groups, with counts, "unknown" handled explicitly — e.g. a 3-state
  toggle "Any / Yes / Yes or not confirmed" where it matters): pets (cats / dogs allowed), parking type
  (garage/covered), EV charging, building amenities (gym, pool, elevator, controlled access), balcony,
  year built ≥, freeway distance band, neighborhood summer high ≤ (°F), neighborhood Walk Score ≥ (use
  per-address score when present else area score, labeled), max true monthly cost.
- Table: add columns (true monthly cost, deposit, pets, parking type/fee, year built, units, gym/pool, freeway
  band, walk score, area summer high, area typical 1BR rent) with a **column picker** (persisted).
- Drawer: a complete "Particulars" dossier grouped Costs / Pets / Parking / Building / Unit / Internet /
  Location / Availability, every field shown with value or "—", plus evidence text and sources.
  A small **data completeness** meter per listing (share of these fields known) — also on cards and as a
  table column, and a filter "Well documented (≥ N% known)".
- Neighborhood drawer + atlas plates: show extras (typical 1BR rent vs this listing set, summer high,
  marine layer, fire/flood/airport noise, parks, farmers markets, fiber, vibe), with sources.
- Compare: include the new rows.
- Listings over $2,300 (up to $2,600) now exist; they "fail" only on rent. Make that legible (e.g. verdict
  "Over budget" or the fail reason "Rent $2,450 > $2,300") and keep the default max-rent filter at $2,300.

## 3. Constraints
- File budget raised to 2.0 MB total (it is ~1.3 MB with three geos). Trim the payload where cheap
  (e.g. drop empty/null keys in build_html.py, compact JSON).
- Performance: filter changes < 100 ms long tasks on 150 listings; no layout thrash.
- Keep hooks for scripts/check.mjs (#q, #count, [data-view], [data-listing]); extend check.mjs to click each
  market tab (`[data-market=la|seattle|nyc]`) and screenshot its map + list.
- Keep motion, a11y and QA quality from previous passes (focus trap, reduced motion, 40px touch targets,
  axe-clean). Zero console errors. No horizontal scroll at 390px.

Process: build `python3 -I scripts/build_html.py`; check
`PW=$(npm root -g)/playwright/index.mjs node scripts/check.mjs <scratch>`; LOOK at screenshots; iterate.
Write final screenshots to screenshots/ (replace): 1-cards, 2-table (with new columns), 3-map, 4-filters,
5-detail (particulars), 6-neighborhood, 7-seattle (empty state + map), 8-nyc (map), 9-mobile.
Do not commit.
