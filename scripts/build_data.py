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
# Search agents sometimes invent sub-area names; map them onto scored neighborhoods.
AREA_ALIAS = {
    "NEW: Highland Park": "Highland Park / Eagle Rock",
    "NEW: Santa Ana – East": "Santa Ana – East (Franzen Ave)",
    "NEW: Tustin": "Tustin – Tustin Legacy / Old Town",
    "NEW: Westminster": "Garden Grove",
    "NEW: Irvine": "Irvine (Spectrum / Irvine Business Complex)",
    "NEW: Playa del Rey": "Westchester",
    "NEW: Playa Vista": "Mar Vista / Del Rey",
}
# Findings that contradict each other across research batches, shown on the building.
REVIEW_NOTES = {
    name: "G.H. Palmer (GHP Management) deposit class action: one search found a $12.5M settlement, another says it "
          "fell apart and headed to trial. Status unconfirmed either way; ask how deposits and move-out charges are handled."
    for name in ("The Orsini", "Da Vinci", "The Piero")
}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60]


def norm_name(s):
    return (s or "").replace(" - ", " – ")


def destar(x):
    """Some research files kept the schema's ★ priority markers in key names; drop them."""
    if isinstance(x, dict):
        return {k.replace("★", "").strip(): destar(v) for k, v in x.items()}
    if isinstance(x, list):
        return [destar(v) for v in x]
    return x


def apply_verify(buildings, files):
    """Apply verification results (VERIFY2 schema): firm yes/no facts, size, rent and costs override older data."""
    by_id = {b["id"]: b for b in buildings}
    for f in files:
        for v in destar(json.loads(f.read_text())):
            b = by_id.get(v.get("id"))
            if not b:
                continue
            for src, key in (("washer_dryer", "wd"), ("central_ac", "ac"), ("dishwasher", "dw"), ("parking", "parking")):
                t = tri(v.get(src))
                if t in ("yes", "no"):
                    b["req"][key] = t
            pk = packages_tri(v.get("packages"))
            if pk in ("yes", "no"):
                b["req"]["packages"] = pk
            for k in ("sqft", "base_rent", "effective_rent", "parking_fee"):
                if isinstance(v.get(k), (int, float)):
                    b[k] = v[k]
            if v.get("base_rent") and not v.get("effective_rent"):
                b["effective_rent"] = v["base_rent"]
            if v.get("special"):
                b["special"] = v["special"]
            if v.get("central_ac_evidence"):
                b["ac_evidence"] = v["central_ac_evidence"]
            if v.get("packages_detail"):
                b["packages_detail"] = v["packages_detail"]
            d = b.setdefault("detail", {})
            costs = d.setdefault("costs", {})
            for k in ("deposit", "application_fee", "utilities"):
                if v.get(k) not in (None, ""):
                    costs[k] = v[k]
            if isinstance(v.get("parking_fee"), (int, float)):
                costs["parking_fee"] = v["parking_fee"]
            fees = [x for x in (v.get("required_fees") or []) if isinstance(x, dict) and isinstance(x.get("amount"), (int, float))]
            if fees:
                costs["required_fees"] = fees
                b["required_fees_total"] = round(sum(x["amount"] for x in fees), 2)
            note = " ".join(x for x in [v.get("seen_on") and "Verified " + v["seen_on"] + ".", v.get("evidence")] if x)
            if note:
                d["evidence"] = (note + " " + (d.get("evidence") or "")).strip()
            b["sources"] = list(dict.fromkeys((b.get("sources") or []) + (v.get("sources") or [])))
            b["checked_on"] = "2026-10-27"
            b["verified"] = True


def region_of(name):
    if name.startswith(("Long Beach", "Signal Hill")):
        return "Long Beach"
    la = ("Downtown LA", "Chinatown", "Little Tokyo", "Echo Park", "Historic Filipinotown",
          "Silver Lake", "Koreatown", "Mid-City", "Hollywood", "Culver City", "Westchester",
          "West Hollywood", "West LA", "Mar Vista", "Jefferson Park", "Los Feliz", "Atwater", "Highland Park")
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


def add_freeway_distance(buildings, areas, geo_name="geo.json"):
    """Approximate straight-line miles to the nearest freeway, from the map's (generalized) freeway lines."""
    import math, re
    geo_f = ROOT / "data" / geo_name
    if not geo_f.exists():
        return
    geo = json.loads(geo_f.read_text())
    W, E, S, N = geo["bounds"]
    MW, MH = geo["size"]
    segs = []
    for fw in geo["freeways"]:
        for part in re.split(r"(?=M)", fw["d"]):
            pts = [tuple(map(float, xy.split(","))) for xy in re.findall(r"-?[\d.]+,-?[\d.]+", part)]
            ll = [(W + x / MW * (E - W), N - y / MH * (N - S)) for x, y in pts]
            segs += [(fw["kind"], fw["ref"], ll[i], ll[i + 1]) for i in range(len(ll) - 1)]
    kx = math.cos(math.radians((S + N) / 2)) * 69.17  # miles per degree lng
    ky = 69.0                                    # miles per degree lat

    def dist(lng, lat, a, b):
        ax, ay, bx, by = a[0] * kx, a[1] * ky, b[0] * kx, b[1] * ky
        px, py = lng * kx, lat * ky
        dx, dy = bx - ax, by - ay
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy or 1)))
        return math.hypot(px - ax - t * dx, py - ay - t * dy)

    label = {"i": "I-", "us": "US-", "ca": "SR-"}
    for b in buildings:
        if b.get("lat") is None:
            continue
        best = min(segs, key=lambda sg: dist(b["lng"], b["lat"], sg[2], sg[3]))
        # Generalized freeway lines + estimated coordinates: only a coarse band is honest.
        d = dist(b["lng"], b["lat"], best[2], best[3])
        b["freeway_band"] = "under 1 mi" if d < 1 else "1–2 mi" if d < 2 else "over 2 mi"
    walk = {a["id"]: (a.get("walk") or {}).get("walk_score") for a in areas}
    for b in buildings:
        b["area_walk_score"] = walk.get(b.get("area_id"))


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
    reviews = {}
    for f in sorted(RESEARCH.glob("reviews_out_*.json")):
        for v in json.loads(f.read_text()):
            reviews[v["name"]] = v
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
    extras_f = RESEARCH / "areas_extras.json"
    extras = {norm_name(x["neighborhood"]): x.get("extras") for x in (json.loads(extras_f.read_text()) if extras_f.exists() else [])}
    for a in areas:
        if extras.get(a["name"]) and not a.get("extras"):
            a["extras"] = extras[a["name"]]
    fill_f = RESEARCH / "areas_fill.json"
    for x in json.loads(fill_f.read_text()) if fill_f.exists() else []:
        for a in areas:
            if a["name"] == norm_name(x["neighborhood"]):
                a.setdefault("extras", {})
                a["extras"].update({k: v for k, v in (x.get("extras") or {}).items() if v not in (None, "")})
    area_ids = {a["name"]: a["id"] for a in areas}

    # Round-3 listing detail, keyed by listing id (enrich_*.json) or embedded in find3_* candidates.
    enrich = {}
    for f in sorted(RESEARCH.glob("enrich_*.json")):
        for e in destar(json.loads(f.read_text())):
            enrich[e["id"]] = e

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
            "reviews": ({**reviews[r["name"]], "note": REVIEW_NOTES.get(r["name"], "")} if r["name"] in reviews else None),
            "checked_on": CHECKED_ON if v else "2026-10-14",
            "source": "claude",
            "landlord": "private" if r.get("tier") == "Single-unit benchmark" else "company",
            "my_status": "new",
            "my_note": "",
        })

    # New candidates from listing searches (find_*.json).
    def nearest_area(lat, lng):
        import math
        best = min((a for a in areas if a.get("lat") is not None),
                   key=lambda a: (a["lat"] - lat) ** 2 + ((a["lng"] - lng) * math.cos(math.radians(lat))) ** 2)
        return best
    seen = {b["name"].lower() for b in buildings}
    for f in sorted(RESEARCH.glob("find*.json")):
        for c in destar(json.loads(f.read_text())):
            if c["name"].lower() in seen:
                continue
            seen.add(c["name"].lower())
            area_name = norm_name(c.get("area") or "")
            if area_name.startswith("NEW: ") and area_name[5:] in area_ids:
                area_name = area_name[5:]
            for prefix, target in AREA_ALIAS.items():
                if area_name.startswith(prefix) and target in area_ids:
                    area_name = target
            loc_note = c.get("geocode_note") or ""
            if c.get("lat") is None and area_name in area_ids:
                ar = next(x for x in areas if x["name"] == area_name)
                if ar.get("lat") is not None:
                    h = sum(map(ord, c["name"])) % 997 / 997.0
                    c = {**c, "lat": ar["lat"] + (h - 0.5) * 0.008, "lng": ar["lng"] + ((h * 7) % 1 - 0.5) * 0.008}
                    loc_note = "Map position is approximate: placed near the center of " + area_name + ". " + loc_note
            if area_name not in area_ids and c.get("lat") is not None:
                near = nearest_area(c["lat"], c["lng"])
                loc_note = (f"{area_name.replace('NEW: ', '')} is not a scored neighborhood yet; "
                            f"using the nearest one, {near['name']}. ") + loc_note
                area_name = near["name"]
            reqv = {
                "wd": tri(c.get("washer_dryer")), "ac": tri(c.get("central_ac")), "dw": tri(c.get("dishwasher")),
                "parking": tri(c.get("parking")), "packages": packages_tri(c.get("packages")),
            }
            buildings.append({
                "id": slug(c["name"]), "name": c["name"], "address": c.get("address"),
                "area_id": area_ids.get(area_name), "region": region_of(area_name),
                "lat": c.get("lat"), "lng": c.get("lng"), "location_note": loc_note,
                "sqft": num(c.get("sqft")), "base_rent": num(c.get("base_rent")),
                "effective_rent": num(c.get("effective_rent")) or num(c.get("base_rent")),
                "special": c.get("special"), "parking_fee": num(c.get("parking_fee")),
                "year_built": c.get("year_built"), "req": reqv,
                "packages_detail": c.get("packages_detail"), "ac_evidence": c.get("central_ac_evidence"),
                "red_flags": c.get("red_flags") or "", "internet": None,
                "notes": " ".join(x for x in [c.get("floor_plan") and "Plan " + c["floor_plan"] + ".", c.get("units_note"), c.get("seen_on") and "Seen on " + c["seen_on"] + "."] if x),
                "listing_url": c.get("listing_url"), "sources": c.get("sources", []),
                "reviews": {"reputation_score": None, "confidence": "low", "management_company": c.get("management_company"),
                            "complaints": [], "praise": [], "dealbreakers": "", "recent_trend": "unknown",
                            "management": {"score": None, "summary": c.get("reputation_gist") or ""}},
                "checked_on": CHECKED_ON, "source": "claude", "my_status": "new", "my_note": "",
                "batch": "recent-oct26" if f.name.startswith(("find3", "find4")) else "private-oct15" if f.name.startswith("find_p") else "new-oct15",
                "landlord": c.get("landlord") or ("private" if f.name.startswith("find_p") else "company"),
                "owner_type": c.get("owner_type"), "platform": c.get("platform"),
                "hoa_amenities": c.get("hoa_amenities"), "rent_control": c.get("rent_control"),
                "scam_flags": c.get("scam_flags") or "",
            })
            if f.name.startswith(("find3", "find4")):
                enrich.setdefault(slug(c["name"]), {**c, "parking": c.get("parking_detail")})

    DETAIL_KEYS = ("costs", "pets", "parking", "building", "unit", "internet", "location", "availability", "evidence")
    for b in buildings:
        e = enrich.get(b["id"])
        if not e:
            continue
        b["detail"] = {k: e.get(k) for k in DETAIL_KEYS if e.get(k) is not None}
        b["detail_sources"] = [u for u in (e.get("sources") or []) if u not in b["sources"]]
        costs = e.get("costs") or {}
        fees = [x for x in (costs.get("required_fees") or []) if isinstance(x, dict) and isinstance(x.get("amount"), (int, float))]
        b["required_fees_total"] = round(sum(x["amount"] for x in fees), 2) if fees else None
        if b.get("parking_fee") is None and isinstance(costs.get("parking_fee"), (int, float)):
            b["parking_fee"] = costs["parking_fee"]
        bld = e.get("building") or {}
        if not b.get("year_built") and isinstance(bld.get("year_built"), (int, float)):
            b["year_built"] = int(bld["year_built"])
        if b.get("checked_on") and b["checked_on"] < "2026-10-26":
            b["checked_on"] = "2026-10-26"

    apply_verify(buildings, sorted(RESEARCH.glob("verify_*.json")))
    add_freeway_distance(buildings, areas)

    updates = RESEARCH / "updates.json"
    for u in json.loads(updates.read_text()) if updates.exists() else []:
        for b in buildings:
            if b["name"] != u["name"]:
                continue
            b["req"].update(u.get("req", {}))
            if u.get("landlord"):
                b["landlord"] = u["landlord"]
            for k in ("base_rent", "effective_rent", "sqft"):
                if k in u:
                    b[k] = u[k]
            if u.get("packages_detail"):
                b["packages_detail"] = u["packages_detail"]
            if u.get("note"):
                b["notes"] = u["note"] + "\n\n" + (b["notes"] or "")
            if u.get("note") or u.get("req"):
                b["checked_on"] = u.get("source", b["checked_on"])

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
