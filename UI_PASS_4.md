# UI pass 4: lease timeline + rent timing and concessions

Read DESIGN_BRIEF.md and UI_PASS_3.md first. The rules carry over: modern apothecary style, light theme only,
one standalone file, accessible, no invented data. For this pass you own src/*, scripts/build_html.py and scripts/check.mjs.
Do not commit. Do not touch scripts/build_data.py or data/research/.

## Data (new, optional files; the build must work without them)
- `data/timing-la.json`: market timing research for the LA market (LA + Long Beach + OC). Shape:
  ```
  {"updated": "2026-10-xx",
   "seasonality": {"months": [{"m": 1..12, "rent_vs_avg_pct": num|null, "concessions": "high|medium|low"|null, "note", "sources": []}],
                   "summary", "best_window", "evidence", "sources": []},
   "timing_effects": [{"title", "finding", "strength": "strong|moderate|weak|anecdotal", "sources": []}],
   "market_now": [{"geo", "metric", "value", "as_of", "source"}],
   "forecast": [{"geo", "finding", "as_of", "source"}],
   "history": [{"period", "geo", "event", "effect", "sources": []}],
   "concession_share_history": [{"period": "2024-06", "geo", "share_pct": num, "source"}],
   "areas": [{"area_id"|null, "name", "region", "level": "high|medium|low|unknown", "typical_offer", "driver", "vacancy",
              "pipeline", "evidence", "as_of", "sources": []}],
   "area_summary": "...",
   "lease_ups": [{"name", "address", "area", "region", "operator", "opening", "units", "special_seen", "studio_1br_rent", "sources": []}],
   "operators": [{"name", "pricing", "concession_style", "negotiable": "yes|somewhat|no|unknown", "note", "sources": []}],
   "tactics": [{"title", "how", "why", "strength", "sources": []}],
   "pitfalls": [{"title", "detail", "sources": []}],
   "rules": [{"name", "applies", "detail", "effective", "sources": []}],
   "anecdotes": [{"summary", "source"}]}
  ```
  Any key may be missing or empty, and any value may be null.
- `data/concessions-la.json`: `{ "<listing id>": {"pattern": "often|sometimes|rarely|unknown", "seen": [{"when", "offer", "source"}],
  "renewal_note", "negotiation_note", "evidence", "sources": []} }`. Attach it to LA buildings as `b.concessions`.
- Neighborhood entries in timing-la `areas` that have an `area_id`: attach them to LA neighborhoods as `a.concessions`.
- Embed as `DATA.markets.la.timing`. Drop null and empty keys as before. Real data arrives later. Until then, write
  obviously fake fixtures (`"fixture": true`, text like "Fixture …") at those two paths so you can develop against them.
  I'll overwrite them, so make sure the UI never depends on `fixture`.

## 1. Timeline view (new `[data-view=timeline]`, label "Timeline")
This is shared across markets, because the deadlines are shared. Build it as a designed calendar timeline, not a plain list.
- Span: Oct 26 2026 to Feb 28 2027, with month ticks and a "today" marker (computed from the real date).
- **Hard deadlines** (from the renewal letter and CA law):
  - Nov 13 2026: Renewal offer expires
  - Dec 30 2026: Written notice due
  - Jan 29 2027: Lease ends
  - Feb 19 2027: Deposit return deadline (21 days after move-out, Civ. Code 1950.5)
- **Recommended phases and milestones** (bars plus points), each with a short why and a checklist:
  1. Shortlist (now to Nov 15). Narrow the list, call to confirm central AC and in-unit W/D, set statuses.
  2. Renewal offer lapses Nov 13. Decide on purpose. Optional fallback: ask The Jayne the month-to-month or short-term
     rate in writing.
  3. Listings for a late-January move-in appear (about Dec 1 to Jan 1). Most buildings list 30 to 60 days ahead.
  4. Tour window, Dec 1 to Dec 14. Get the application packet ready by Dec 1: ID, pay stubs or offer letter, bank
     statements, a credit report, references, and a renters-insurance quote.
  5. Negotiation window, Dec 15 to Dec 23. Leasing offices have year-end occupancy goals. Ask for the special, fee
     waivers and free parking. Compare net-effective rent against base rent.
  6. Target signing date, Dec 23. That leaves a week's buffer before the notice date.
  7. Written notice to The Jayne, by Dec 30. Send it in writing and keep proof of delivery.
  8. Move logistics, Jan 2 to Jan 25: movers, utilities, internet install, renters insurance, USPS forwarding,
     parking permit, and the elevator or loading-dock booking.
  9. Pre-move-out inspection. Request it in writing, and do it about 2 weeks before Jan 29 (Civ. Code 1950.5(f)).
  10. Lease ends Jan 29; move in around Jan 30. Photograph both units.
  11. Deposit back by Feb 19.
- Checklist items are checkboxes, saved in localStorage per item and included in the existing Export/Import JSON.
  Show progress per phase and overall.
- An **"Add to calendar"** button downloads an .ics file with every deadline and milestone, generated client-side.
- The masthead deadline cards link to the Timeline view.
- Desktop: a horizontal time axis with the phases as bars. Mobile (390px): a vertical timeline. No horizontal scroll.

## 2. Rent timing research (inside the Timeline view, below the calendar)
Show this for the LA market only. Seattle and NYC get one plain line: "Timing research covers Los Angeles, Long Beach and Orange County."
Read the `dataviz` skill before drawing any chart. Hand-built SVG only, no libraries.
- **When:** a 12-month seasonality chart (rent vs. the annual average, and concession level by month), with
  the Dec–Jan move window highlighted and the summary and best window written out. Also timing effects (end of
  month, quarter and year), the current market (cards), the forecast, the history of events, and the concession
  share over time (a small chart if there are 3 or more points).
- **Where:** areas ranked by concession level with their typical offer and driver. Link to the neighborhood drawer
  when `area_id` is present. Also list the lease-up buildings (name, area, opening, special seen).
- **Who:** operators (pricing, concession style, how negotiable they are). Also show the current market's listings
  with a specials history of "often" or "sometimes", linked to their drawers.
- **How:** tactics, pitfalls and California rules, each with its sources.
- Every item shows its sources as compact links, labeled by host name. Mark anything unknown as "—" and label
  anecdotes as anecdotal.

## 3. Listing and neighborhood additions
- In the listing drawer, add a "Specials history" section: pattern, the dated offers seen with their source links,
  the renewal note and the negotiation note. Cards get a small mark when the pattern is "often". Compare gets a row.
- Table: add an optional "Specials history" column (in the column picker, off by default).
- Filters: add "Specials history: Often / Often or sometimes / Any".
- Neighborhood drawer and atlas plates: show concession level, typical offer and driver, with sources.

## 4. Constraints
- File budget is 2.3 MB total (currently about 1.9 MB).
- Keep everything from earlier passes: motion with reduced-motion support, focus trap, 40px touch targets, axe-clean, zero console errors, filter changes < 100 ms.
- Extend scripts/check.mjs: open the Timeline view (desktop and 390px), toggle a checklist item, click "Add to calendar"
  (assert the download), and screenshot. Check that the Seattle Timeline shows the one-line note.
- Build with `python3 -I scripts/build_html.py`. Check with `PW=$(npm root -g)/playwright/index.mjs node scripts/check.mjs <scratch dir>`.
  Look at the screenshots and iterate. Put final screenshots in screenshots/ as 10-timeline.png, 11-timeline-research.png and
  12-timeline-mobile.png, and update any existing screenshots that changed.
- When done, reply with a short summary: what you built, the file size, the check results, and anything left undone.
