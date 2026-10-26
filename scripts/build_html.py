"""Build the standalone tool: inlines src/* and data/*.json into one HTML file.

Usage: python3 -I scripts/build_html.py   ->  Apartment-Search-2027.html

Markets: data/buildings.json + data/neighborhoods.json are Los Angeles (records without a `market`
field count as "la"). Seattle and New York data are optional (data/buildings-seattle.json,
data/neighborhoods-seattle.json, data/buildings-nyc.json, data/neighborhoods-nyc.json); the build
works without them. A record whose `market` field names another market is filed under that market.
Embedded as DATA.markets = { la: {label, buildings, neighborhoods, geo}, seattle: {...}, nyc: {...} }.
"""
import datetime
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
DATA = ROOT / "data"

MARKETS = [  # key, label, buildings file, neighborhoods file, geo file
    ("la", "Los Angeles", "buildings.json", "neighborhoods.json", "geo.json"),
    ("seattle", "Seattle", "buildings-seattle.json", "neighborhoods-seattle.json", "geo-seattle.json"),
    ("nyc", "New York", "buildings-nyc.json", "neighborhoods-nyc.json", "geo-nyc.json"),
]


def load(name, default):
    p = DATA / name
    if not p.exists():
        return default
    return json.loads(p.read_text())


# Drop research-process remarks (geocoder access etc.) from location notes.
NOISE = re.compile(r"(geocod|sandbox|proxy|blocked|nominatim|census)", re.I)


def clean_note(note):
    return " ".join(x for x in re.split(r"(?<=[.;])\s+", note or "") if x and not NOISE.search(x))


def prune(v):
    """Drop null / empty values recursively (the app treats a missing key as unknown)."""
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            x = prune(x)
            if x is None or x == "" or x == [] or x == {}:
                continue
            out[k] = x
        return out
    if isinstance(v, list):
        return [prune(x) for x in v if x is not None]
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


markets = {k: {"label": label, "buildings": [], "neighborhoods": []} for k, label, *_ in MARKETS}
for key, label, bfile, nfile, gfile in MARKETS:
    for b in load(bfile, []):
        m = b.get("market") or key
        markets.setdefault(m, {"label": m, "buildings": [], "neighborhoods": []})["buildings"].append(b)
    for a in load(nfile, []):
        m = a.get("market") or key
        markets.setdefault(m, {"label": m, "buildings": [], "neighborhoods": []})["neighborhoods"].append(a)
    geo = load(gfile, None)
    if geo is not None:
        geo.setdefault("market", key)
        markets[key]["geo"] = geo

counts = {}
for key, m in markets.items():
    for b in m["buildings"]:
        b["market"] = key
        b["location_note"] = clean_note(b.get("location_note"))
    for a in m["neighborhoods"]:
        a["market"] = key
    m["buildings"] = [prune(b) for b in m["buildings"]]
    m["neighborhoods"] = [prune(a) for a in m["neighborhoods"]]
    counts[key] = len(m["buildings"])

data = {"updated": datetime.date.today().strftime("%b %-d, %Y"), "markets": markets}

payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
html = (SRC / "index.html").read_text()
parts = {
    "/*__CSS__*/": (SRC / "styles.css").read_text(),
    "/*__ILLUS__*/": (SRC / "illustrations.js").read_text(),
    "/*__MAP__*/": (SRC / "map.js").read_text(),
    "/*__APP__*/": (SRC / "app.js").read_text(),
    "/*__DATA__*/": payload,
}
for k, v in parts.items():
    assert k in html, k
    html = html.replace(k, v.replace("</script", "<\\/script") if k != "/*__CSS__*/" else v)
out = ROOT / "Apartment-Search-2027.html"
out.write_text(html)
print(f"wrote {out.name}: {out.stat().st_size // 1024} KB, listings " + ", ".join(f"{k} {n}" for k, n in counts.items()))
