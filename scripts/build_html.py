"""Build the standalone tool: embeds data/*.json into app.template.html.

Usage: python3 -I scripts/build_html.py   ->  Apartment-Search-2027.html
"""
import datetime
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

data = {
    "updated": datetime.date.today().strftime("%b %-d, %Y"),
    "buildings": json.loads((ROOT / "data/buildings.json").read_text()),
    "neighborhoods": json.loads((ROOT / "data/neighborhoods.json").read_text()),
}
# Drop research-process remarks (geocoder access etc.) from location notes; keep the useful parts.
import re
NOISE = re.compile(r"(geocod|sandbox|proxy|blocked|nominatim|census)", re.I)
for b in data["buildings"]:
    note = b.get("location_note") or ""
    kept = [x for x in re.split(r"(?<=[.;])\s+", note) if x and not NOISE.search(x)]
    b["location_note"] = " ".join(kept)

# Keep the JSON safe inside a <script> element.
payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
template = (ROOT / "app.template.html").read_text()
assert "/*__DATA__*/" in template
out = ROOT / "Apartment-Search-2027.html"
out.write_text(template.replace("/*__DATA__*/", payload))
print(f"wrote {out.name}: {out.stat().st_size // 1024} KB, {len(data['buildings'])} listings, {len(data['neighborhoods'])} neighborhoods")
