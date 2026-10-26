"""Build listing + neighborhood data for the Seattle and New York markets.

Usage: python3 -I scripts/build_market_data.py seattle|nyc
Reads data/research/<market>/areas.json and find*.json (same schemas as the LA research) and writes
data/buildings-<market>.json and data/neighborhoods-<market>.json in the same shape as the LA files.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_data import ROOT, slug, tri, packages_tri, num, destar, norm_name, add_freeway_distance  # noqa: E402

MARKET = sys.argv[1]
PREFIX = {"seattle": "sea-", "nyc": "nyc-"}[MARKET]
RES = ROOT / "data/research" / MARKET
CHECKED_ON = "2026-10-26"
DETAIL_KEYS = ("costs", "pets", "parking", "building", "unit", "internet", "location", "availability", "evidence")


def main():
    raw = destar(json.loads((RES / "areas.json").read_text()))
    areas = []
    for r in raw.get("neighborhoods", raw if isinstance(raw, list) else []):
        a = dict(r)
        a["name"] = norm_name(r["neighborhood"])
        a["id"] = PREFIX + slug(a["name"])
        a["market"] = MARKET
        areas.append(a)
    by_name = {a["name"]: a for a in areas}

    buildings, seen = [], set()
    for f in sorted(RES.glob("find*.json")):
        for c in destar(json.loads(f.read_text())):
            key = c["name"].lower()
            if key in seen:
                continue
            seen.add(key)
            area = by_name.get(norm_name(c.get("area") or "").replace("NEW: ", ""))
            loc_note = c.get("geocode_note") or ""
            lat, lng = c.get("lat"), c.get("lng")
            if lat is None and area and area.get("lat") is not None:
                lat, lng = area["lat"], area["lng"]
                loc_note = "Map position is approximate: placed at the center of " + area["name"] + ". " + loc_note
            if area is None and lat is not None:
                area = min((x for x in areas if x.get("lat") is not None),
                           key=lambda x: (x["lat"] - lat) ** 2 + (x["lng"] - lng) ** 2, default=None)
                if area:
                    loc_note = f"Assigned to the nearest scored neighborhood, {area['name']}. " + loc_note
            b = {
                "id": PREFIX + slug(c["name"]), "market": MARKET, "name": c["name"], "address": c.get("address"),
                "area_id": area["id"] if area else None, "region": area.get("region") if area else None,
                "lat": lat, "lng": lng, "location_note": loc_note,
                "sqft": num(c.get("sqft")), "base_rent": num(c.get("base_rent")),
                "effective_rent": num(c.get("effective_rent")) or num(c.get("base_rent")),
                "special": c.get("special"), "parking_fee": num(c.get("parking_fee")),
                "year_built": c.get("year_built"),
                "req": {"wd": tri(c.get("washer_dryer")), "ac": tri(c.get("central_ac")), "dw": tri(c.get("dishwasher")),
                        "parking": tri(c.get("parking")), "packages": packages_tri(c.get("packages"))},
                "packages_detail": c.get("packages_detail"), "ac_evidence": c.get("central_ac_evidence"),
                "red_flags": c.get("red_flags") or "", "scam_flags": c.get("scam_flags") or "",
                "notes": " ".join(x for x in [c.get("floor_plan") and "Plan " + str(c["floor_plan"]) + ".", c.get("units_note"),
                                              c.get("seen_on") and "Seen on " + c["seen_on"] + "."] if x),
                "listing_url": c.get("listing_url"), "sources": c.get("sources") or [],
                "reviews": {"reputation_score": None, "confidence": "low", "management_company": c.get("management_company"),
                            "complaints": [], "praise": [], "dealbreakers": "", "recent_trend": "unknown",
                            "management": {"score": None, "summary": c.get("reputation_gist") or ""}},
                "landlord": c.get("landlord") or "company", "owner_type": c.get("owner_type"), "platform": c.get("platform"),
                "checked_on": CHECKED_ON, "source": "claude", "batch": "recent-oct26", "my_status": "new", "my_note": "",
            }
            e = {**c, "parking": c.get("parking_detail")}
            b["detail"] = {k: e.get(k) for k in DETAIL_KEYS if e.get(k) is not None}
            costs = e.get("costs") or {}
            fees = [x for x in (costs.get("required_fees") or []) if isinstance(x, dict) and isinstance(x.get("amount"), (int, float))]
            b["required_fees_total"] = round(sum(x["amount"] for x in fees), 2) if fees else None
            if b["parking_fee"] is None and isinstance(costs.get("parking_fee"), (int, float)):
                b["parking_fee"] = costs["parking_fee"]
            if not b["year_built"] and isinstance((e.get("building") or {}).get("year_built"), (int, float)):
                b["year_built"] = int(e["building"]["year_built"])
            buildings.append(b)

    add_freeway_distance(buildings, areas, f"geo-{MARKET}.json")
    (ROOT / f"data/buildings-{MARKET}.json").write_text(json.dumps(buildings, indent=1, ensure_ascii=False))
    (ROOT / f"data/neighborhoods-{MARKET}.json").write_text(json.dumps(areas, indent=1, ensure_ascii=False))
    print(f"{MARKET}: {len(buildings)} listings, {len(areas)} neighborhoods; "
          f"no area: {[b['name'] for b in buildings if not b['area_id']]}")


if __name__ == "__main__":
    main()
