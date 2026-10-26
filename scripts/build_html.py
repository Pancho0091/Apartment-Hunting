"""Build the standalone tool: inlines src/* and data/*.json into one HTML file.

Usage: python3 -I scripts/build_html.py   ->  Apartment-Search-2027.html
"""
import datetime
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"

data = {
    "updated": datetime.date.today().strftime("%b %-d, %Y"),
    "buildings": json.loads((ROOT / "data/buildings.json").read_text()),
    "neighborhoods": json.loads((ROOT / "data/neighborhoods.json").read_text()),
    "geo": json.loads((ROOT / "data/geo.json").read_text()),
}
# Drop research-process remarks (geocoder access etc.) from location notes.
NOISE = re.compile(r"(geocod|sandbox|proxy|blocked|nominatim|census)", re.I)
for b in data["buildings"]:
    note = b.get("location_note") or ""
    b["location_note"] = " ".join(x for x in re.split(r"(?<=[.;])\s+", note) if x and not NOISE.search(x))

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
print(f"wrote {out.name}: {out.stat().st_size // 1024} KB, {len(data['buildings'])} listings")
