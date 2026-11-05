"""Clean the Downtown LA deep-dive listing files (data/research/dtla/find8_*.json) into data/research/.

- Drops entries that are not rentable listings (not found, not built, senior-only, furnished-only).
- Drops cross-file duplicates, keeping the more complete record.
- Turns range strings for sqft/rent ("924-1,180 (one source)") into a number: the smallest size
  of at least 700 sq ft (else the first number), keeping the original text in the plan note.
Usage: python3 -I scripts/clean_find8.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data/research/dtla"
DROP_FLAGS = ("NOT FOUND", "not yet built", "planned/entitled", "Senior", "55+", "furnished-only", "unfinished",
              "insufficient data")
# (file, name) pairs to drop because another file has the better record
DUPES = {("find8_fidi_citywest", "Eighth & Grand"), ("find8_southpark", "Atelier"),
         ("find8_fidi_citywest", "Verdosa (formerly Watermarke Tower)")}


# Hand-placed from the street grid (geocoders are not reachable from the research environment); approximate.
GRID = {"668 S Alameda": (34.0379, -118.2405), "236 S Los Angeles": (34.0503, -118.2433), "888 N Alameda": (34.0577, -118.2363),
        "900 N Broadway": (34.0646, -118.2381), "100 S Alameda": (34.0499, -118.2385), "420 S San Pedro": (34.0455, -118.2433),
        "601 E 2nd": (34.0466, -118.2386), "520 S Mateo": (34.0389, -118.2316), "652 Mateo": (34.0369, -118.2311),
        "510 S Hewitt": (34.0425, -118.2357), "500 Molino": (34.0414, -118.2337), "1855 Industrial": (34.0330, -118.2290),
        "331 E 1st": (34.0503, -118.2404), "200 Mesnager": (34.0663, -118.2307)}


def numbers(text):
    return [float(x.replace(",", "")) for x in re.findall(r"\d[\d,]*(?:\.\d+)?", str(text))]


def to_num(v, prefer_min=None):
    if v is None or isinstance(v, (int, float)):
        return v, None
    xs = numbers(v)
    if not xs:
        return None, str(v)
    if prefer_min:
        ok = [x for x in xs if x >= prefer_min]
        return (min(ok) if ok else xs[0]), str(v)
    return xs[0], str(v)


def main():
    for f in sorted(SRC.glob("find8_*.json")):
        out, dropped = [], []
        for c in json.loads(f.read_text()):
            flags = c.get("red_flags") or ""
            if any(k.lower() in flags.lower() for k in DROP_FLAGS) or (f.stem, c["name"]) in DUPES or not c.get("address") \
                    or c["address"].strip().lower() == "unknown":
                dropped.append(c["name"])
                continue
            if c.get("lat") is None:
                hit = next((xy for k, xy in GRID.items() if c["address"].startswith(k)), None)
                if hit:
                    c["lat"], c["lng"] = hit
                    c["geocode_note"] = "Approximate position, placed by hand from the street grid."
            notes = []
            for key, pm in (("sqft", 700), ("base_rent", None), ("effective_rent", None), ("parking_fee", None)):
                val, raw = to_num(c.get(key), pm)
                if raw is not None:
                    notes.append(f"{key.replace('_', ' ')}: {raw}")
                c[key] = val
            if notes:
                c["floor_plan"] = "; ".join(x for x in [c.get("floor_plan"), *notes] if x)
            out.append(c)
        (ROOT / "data/research" / f.name).write_text(json.dumps(out, indent=1, ensure_ascii=False))
        print(f"{f.name}: kept {len(out)}, dropped {dropped}")


if __name__ == "__main__":
    main()
