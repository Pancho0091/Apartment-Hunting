"""Assemble rent-timing and concession research into the tool's data files.

Reads data/research/timing/*.json (written by the research passes):
  timing_market.json   seasonality, timing effects, market now, forecast, history, concession share
  timing_areas.json    concessions by submarket + lease-up buildings
  tactics.json         operators, tactics, pitfalls, California rules, anecdotes
  concessions_*.json   per-listing specials history (arrays keyed by listing id)
Writes data/timing-la.json and data/concessions-la.json.

Usage: python3 -I scripts/build_timing.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data/research/timing"


def load(name, default):
    p = SRC / name
    return json.loads(p.read_text()) if p.exists() else default


def main():
    area_ids = {a["id"] for a in json.loads((ROOT / "data/neighborhoods.json").read_text())}
    listing_ids = {b["id"] for b in json.loads((ROOT / "data/buildings.json").read_text())}

    market = load("timing_market.json", {})
    areas = load("timing_areas.json", {})
    tactics = load("tactics.json", {})

    area_rows = []
    for a in areas.get("areas", []):
        if a.get("area_id") not in area_ids:
            a = {**a, "area_id": None}
        area_rows.append(a)
    rank = {"high": 0, "medium": 1, "low": 2, "unknown": 3}
    area_rows.sort(key=lambda a: (rank.get(a.get("level"), 3), a.get("region") or "", a.get("name") or ""))

    timing = {
        "updated": "2026-10-26",
        **{k: market.get(k) for k in ("seasonality", "timing_effects", "market_now", "forecast", "history",
                                      "concession_share_history")},
        "areas": area_rows,
        "area_summary": areas.get("summary"),
        "lease_ups": areas.get("lease_ups"),
        **{k: tactics.get(k) for k in ("operators", "tactics", "pitfalls", "rules", "anecdotes")},
    }
    timing = {k: v for k, v in timing.items() if v not in (None, [], {}, "")}

    conc, unknown = {}, []
    for f in sorted(SRC.glob("concessions_*.json")):
        for c in json.loads(f.read_text()):
            if str(c.get("id")).startswith("_operator:"):
                # Operator-level pattern from a property pass: fold into the operators list.
                op = {
                    "name": c["name"].split(" (")[0], "pricing": c.get("negotiation_note"),
                    "concession_style": "; ".join(f"{s['when']}: {s['offer']}" for s in c.get("seen", [])[:5]),
                    "note": " ".join(x for x in [c.get("renewal_note"), c.get("evidence")] if x),
                    "sources": c.get("sources") or [s["source"] for s in c.get("seen", []) if s.get("source")]}
                ops = timing.setdefault("operators", [])
                key = " ".join(op["name"].lower().split()[:2])
                prev = next((o for o in ops if o.get("name", "").lower().startswith(key)), None)
                if prev:  # fill what the operator pass left unknown
                    for k in ("pricing", "concession_style", "note"):
                        if op.get(k) and (not prev.get(k) or "unknown" in str(prev[k]).lower()[:40]):
                            prev[k] = op[k]
                    prev["sources"] = list(dict.fromkeys((prev.get("sources") or []) + op["sources"]))
                else:
                    ops.append({**op, "negotiable": "unknown"})
                continue
            if c.get("id") not in listing_ids:
                unknown.append(c.get("id"))
                continue
            conc[c["id"]] = {k: c.get(k) for k in ("pattern", "seen", "renewal_note", "negotiation_note", "evidence", "sources")
                             if c.get(k) not in (None, [], "")}

    (ROOT / "data/timing-la.json").write_text(json.dumps(timing, indent=1, ensure_ascii=False))
    (ROOT / "data/concessions-la.json").write_text(json.dumps(conc, indent=1, ensure_ascii=False))
    linked = sum(1 for a in area_rows if a.get("area_id"))
    print(f"timing-la.json: {len(area_rows)} areas ({linked} linked), {len(timing.get('lease_ups') or [])} lease-ups, "
          f"{len(timing.get('operators') or [])} operators · concessions-la.json: {len(conc)} listings"
          + (f" · unknown ids skipped: {unknown}" if unknown else ""))


if __name__ == "__main__":
    main()
