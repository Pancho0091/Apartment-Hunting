"""Merge the prior search data with new neighborhood research and building verification.

Usage: python3 -I scripts/build_data.py <research_dir>
Writes data/buildings.json and data/neighborhoods.json.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESEARCH = Path(sys.argv[1])

EXCLUDED = {
    "99th St Apts at Sofi": "Inglewood is outside the search area",
    "Perinos Luxury Apartments": "1BR starts at 650 sq ft",
}
NEIGHBORHOOD_FIX = {
    "Avila at Rancho Santa Margarita": "Rancho Santa Margarita",
    "7122 Kittyhawk Ave Unit 0": "Westchester",
}
CHECKED_ON = "2026-10-15"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60]


def norm_name(s):
    return (s or "").replace(" - ", " – ")


def region_of(name):
    if name.startswith("Long Beach"):
        return "Long Beach"
    la = ("Downtown LA", "Chinatown", "Little Tokyo", "Echo Park", "Historic Filipinotown",
          "Silver Lake", "Koreatown", "Mid-City", "Hollywood", "Culver City", "Westchester")
    return "Los Angeles" if name.startswith(la) else "Orange County"


def tri(v):
    s = str(v or "").strip().lower()
    if s.startswith("yes"):
        return "yes"
    if s.startswith("no"):
        return "no"
    return "unclear"


def packages_tri(v):
    s = str(v or "").strip().lower()
    if s.startswith(("locker", "package room", "front desk")):
        return "yes"
    if s.startswith("none"):
        return "no"
    return "unclear"


def num(v):
    try:
        return None if v in (None, "") else float(v)
    except (TypeError, ValueError):
        return None


def main():
    prior = json.loads((ROOT / "data/prior/apartments.json").read_text())
    prior_areas = {norm_name(a["neighborhood"]): a for a in json.loads((ROOT / "data/prior/neighborhoods.json").read_text())}

    research, coords = {}, {}
    for f in sorted(RESEARCH.glob("out_*.json")):
        d = json.loads(f.read_text())
        for a in d.get("neighborhoods", []):
            research[norm_name(a["neighborhood"])] = a
        for b in d.get("buildings", []):
            coords[b["name"]] = b
    verified = {}
    for f in sorted(RESEARCH.glob("verified_*.json")):
        for v in json.loads(f.read_text()):
            verified[v["name"]] = v

    areas = []
    for name, r in research.items():
        p = prior_areas.get(name, {})
        a = dict(r)
        a["id"] = slug(name)
        a["name"] = name
        a["region"] = region_of(name)
        if p:
            a["remote_work"] = {k: p.get(k) for k in ("remote_work_score", "cafes", "coworking", "packages", "internet", "groceries") if p.get(k)}
        areas.append(a)
    area_ids = {a["name"]: a["id"] for a in areas}

    buildings, missing = [], []
    for r in prior:
        if r["name"] in EXCLUDED:
            continue
        nb = NEIGHBORHOOD_FIX.get(r["name"], norm_name(r.get("neighborhood_report")))
        v = verified.get(r["name"], {})
        c = coords.get(r["name"], {})
        if nb not in area_ids:
            missing.append((r["name"], nb))
        req = {
            "wd": tri(v.get("washer_dryer", r.get("washer_dryer"))),
            "ac": tri(v.get("central_ac", r.get("central_ac"))),
            "dw": tri(v.get("dishwasher", r.get("dishwasher"))),
            "parking": tri(v.get("parking", r.get("parking"))),
            "packages": packages_tri(v.get("packages")) if v else "unclear",
        }
        sources = list(dict.fromkeys([u for u in [r.get("listing_url")] + v.get("sources", []) if u]))
        buildings.append({
            "id": slug(r["name"]),
            "name": r["name"],
            "address": r.get("address"),
            "area_id": area_ids.get(nb),
            "region": region_of(nb) if nb else None,
            "lat": c.get("lat"),
            "lng": c.get("lng"),
            "location_note": c.get("geocode_note"),
            "sqft": num(r.get("sqft")),
            "base_rent": num(r.get("base_rent")),
            "effective_rent": num(r.get("net_effective_rent")) or num(r.get("base_rent")),
            "special": r.get("special"),
            "parking_fee": num(v.get("parking_fee")) if v.get("parking_fee") is not None else num(r.get("parking_per_month")),
            "year_built": r.get("year_built"),
            "req": req,
            "packages_detail": v.get("packages_detail") or r.get("packages"),
            "ac_evidence": v.get("central_ac_evidence"),
            "red_flags": v.get("red_flags") or "",
            "internet": r.get("internet"),
            "notes": r.get("notes"),
            "listing_url": r.get("listing_url"),
            "sources": sources,
            "checked_on": CHECKED_ON if v else "2026-10-14",
            "source": "claude",
            "my_status": "new",
            "my_note": "",
        })

    (ROOT / "data/buildings.json").write_text(json.dumps(buildings, indent=1, ensure_ascii=False))
    (ROOT / "data/neighborhoods.json").write_text(json.dumps(areas, indent=1, ensure_ascii=False))
    print(f"{len(buildings)} buildings, {len(areas)} neighborhoods")
    for name, nb in missing:
        print("NO AREA:", name, "->", nb)
    for b in buildings:
        if b["lat"] is None:
            print("NO COORDS:", b["name"])


if __name__ == "__main__":
    main()
