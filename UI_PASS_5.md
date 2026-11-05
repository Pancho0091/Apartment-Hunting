# UI pass 5: Downtown LA guide

Read DESIGN_BRIEF.md, UI_PASS_3.md and UI_PASS_4.md first. All the rules carry over: modern apothecary, light theme
only, one standalone file, accessible, no invented data. For this pass you own src/*, scripts/build_html.py and
scripts/check.mjs. Do not commit. Do not touch scripts/build_*data*.py, scripts/build_timing.py, data/research/ or the
data/*.json listing files.

The user has narrowed the search to Downtown LA. They plan to stay one year, and their priorities are freeway access,
specialty coffee and walking, and nightlife, gyms and errands. Quiet, safety and traffic are low priority.

## Data
- `data/dtla-guide.json` is optional; the build must work without it. Embed it as `DATA.markets.la.dtla`. Shape:
  `{"subdistricts": [{"name", "maps_to_area", "vibe", "residents", "coffee": [{"name", "address"}], "groceries": [..],
  "gyms": [..], "parks": [..], "nightlife", "metro": [..], "freeways", "noise", "safety", "homelessness", "cleanliness",
  "changes_2026_28", "advice", "scores": {"coffee", "walk", "nightlife", "errands", "freeway", "quiet", "safety"} (0–10),
  "sources": [..]}], "edges": [{"where", "note", "sources"}], "trends": [{"topic", "finding", "as_of", "source"}], "summary"}`.
  List items may be strings or objects; render both. `maps_to_area` matches LA neighborhood names. Three values
  ("Downtown LA – Fashion District", "Downtown LA – Civic Center", "Downtown LA – City West") are not scored
  neighborhoods. Listings there sit in the nearest scored area, and their `location_note` says so.

## 1. Downtown guide (LA market)
- Add a "Downtown LA guide" panel. Put it at the top of the Neighborhoods view when the market is LA, and also make it
  reachable from the "Downtown LA" quick-filter chip (e.g. a small "Open the Downtown guide" link in the results header
  while that chip is on).
- Show the 12 sub-districts as comparable cards or rows. Each shows:
  - name, vibe, and the advice line
  - a compact score strip for coffee, walk, nightlife, errands, freeway, quiet and safety. Order the strip by the
    user's priorities: coffee, walk, freeway, nightlife and errands first; quiet and safety last.
  - expandable detail: coffee shops, groceries, gyms, parks, Metro, freeways, noise, safety, homelessness,
    cleanliness, 2026–28 changes, and sources
  - how many current listings fall in that sub-district's mapped area, as a link that filters the list
- Add a sort control for the sub-districts: by the user's weighted priorities (default), by coffee, or by freeway.
  Label the weighted score as "Guide score", not "Match", so it isn't confused with listing match.
- "Streets and edges": the 11 edges as a list of where plus a note, with sources. Mark it clearly as walking-route
  advice.
- Trends: dated items with sources.
- The guide's safety scores are the researcher's judgement from news and anecdotes, not crime data. Say so once, plainly.
- If you can do it cheaply in the existing atlas map, add a toggle that labels the sub-districts on the LA map
  at the DTLA zoom. Skip it if it's costly.

## 2. Neighborhood drawer
For the five DTLA neighborhoods (South Park; Historic Core / Financial District / Bunker Hill; Arts District; Little
Tokyo; Chinatown), add a "Downtown guide" section listing the sub-districts mapped to it, each with a short summary and
a link to its guide card.

## 3. Listing drawer: reviews
Listings may now have `reviews.news` (`[{when, summary, source}]`) and `reviews.reddit` (`[{summary, source}]`, which
is anecdotal). If they aren't already shown, render them in the reviews section, with news labeled by date and Reddit
labeled "Anecdotal". Keep the rest of the reviews UI as is.

## 4. Constraints
- File budget is 2.4 MB total (currently about 2.1 MB plus the new listings).
- Keep motion and reduced-motion support, the focus trap, 40px touch targets, axe-clean, zero console errors, filter
  changes < 100 ms, and no horizontal scroll at 390px.
- Extend scripts/check.mjs: open the guide, expand a card, change the sort, click a listing-count link, and check that
  the drawer guide section appears for Little Tokyo. Take screenshots. Save final screenshots in screenshots/ as
  14-dtla-guide.png, 15-dtla-guide-mobile.png and 16-dtla-drawer.png.
- Build with `python3 -I scripts/build_html.py`. Check with `PW=$(npm root -g)/playwright/index.mjs node scripts/check.mjs <scratch dir>`.
  Look at the screenshots and iterate.
- Reply with a short summary when done.
