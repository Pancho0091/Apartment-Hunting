"""Build the map layers embedded in the tool (data/geo.json).

Sources (downloaded separately, see README):
  - OSM land polygons, 100 m   (npm @geo-maps/earth-lands-100m, ODbL)
  - LA County neighborhoods     (LA Times Mapping L.A., via codeforgermany/click_that_hood)
  - Long Beach neighborhoods    (codeforgermany/click_that_hood)
  - California counties         (codeforgermany/click_that_hood)
  - Freeways and rail           (Natural Earth 10m roads / railroads, public domain)

Usage: python scripts/build_geo.py <geo_source_dir>   (needs shapely)
Output paths are already projected to the tool's map coordinates.
"""
import json
import math
import sys
from pathlib import Path

from shapely.geometry import box, shape, mapping, LineString, MultiLineString, Polygon, MultiPolygon, GeometryCollection
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1])

W, E, S, N = -118.62, -117.55, 33.42, 34.17
KX = math.cos(math.radians(33.8))
MW = 2000
MH = round(MW * (N - S) / ((E - W) * KX))
CLIP = box(W - 0.02, S - 0.02, E + 0.02, N + 0.02)
TOL = 0.00035  # ~35 m


def px(lng, lat):
    return (lng - W) / (E - W) * MW, (N - lat) / (N - S) * MH


def ring_d(coords, close):
    pts = [px(x, y) for x, y in coords]
    if len(pts) < 2:
        return ""
    d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    return d + ("Z" if close else "")


def geom_d(g):
    if g.is_empty:
        return ""
    if isinstance(g, Polygon):
        return "".join(ring_d(r.coords, True) for r in [g.exterior, *g.interiors])
    if isinstance(g, LineString):
        return ring_d(g.coords, False)
    if isinstance(g, (MultiPolygon, MultiLineString, GeometryCollection)):
        return "".join(geom_d(x) for x in g.geoms)
    return ""


def load(name):
    return json.loads((SRC / name).read_text())


# Land (OSM coastline)
land = []
src = load("package/map.geo.json")
for geom in src.get("geometries") or [f["geometry"] for f in src["features"]]:
    g = shape(geom)
    for part in getattr(g, "geoms", [g]):
        if part.intersects(CLIP):
            land.append(part.intersection(CLIP))
land = unary_union(land)
# Drop tiny holes (reservoirs, slivers) that read as noise at this scale.
def fill_small(g, min_area=4e-5):
    if isinstance(g, Polygon):
        return Polygon(g.exterior, [r for r in g.interiors if Polygon(r).area >= min_area])
    return unary_union([fill_small(x, min_area) for x in getattr(g, "geoms", [])])
land = fill_small(land).simplify(TOL)
land_d = geom_d(land)

# Neighborhood outlines (LA County + Long Beach), as lines
hoods = []
excluded = []
SOUTH_BAY = {"Inglewood", "Hawthorne", "Lawndale", "Gardena", "Torrance", "Redondo Beach", "Hermosa Beach",
             "Manhattan Beach", "Carson", "Lennox", "Alondra Park", "West Athens", "Westmont", "El Camino Village",
             "Harbor Gateway", "Del Aire", "Wiseburn", "Ladera Heights", "View Park-Windsor Hills"}
for f in load("cth-los-angeles-county.geojson")["features"]:
    g = shape(f["geometry"]).intersection(CLIP)
    if g.is_empty:
        continue
    g = g.simplify(TOL)
    hoods.append(g.boundary)
    if f["properties"]["name"] in SOUTH_BAY:
        excluded.append(g)
for f in load("cth-long-beach.geojson")["features"]:
    g = shape(f["geometry"]).intersection(CLIP)
    if not g.is_empty:
        hoods.append(g.simplify(TOL).boundary)
hoods_d = geom_d(unary_union(hoods).intersection(land.buffer(0.001)))
excluded_d = geom_d(unary_union(excluded).intersection(land).simplify(TOL))

# County line between LA and Orange
cty = {f["properties"]["name"]: shape(f["geometry"]) for f in load("cth-ca-counties.geojson")["features"]}
la_oc = cty["Los Angeles"].boundary.intersection(cty["Orange"].buffer(0.01)).intersection(CLIP)
oc_outline = cty["Orange"].boundary.intersection(CLIP).intersection(land.buffer(-0.003))
county_d = geom_d(unary_union([la_oc, oc_outline]).simplify(TOL))

# Freeways
fw = {}
for f in load("ne_10m_roads.geojson")["features"]:
    p = f["properties"]
    if not f["geometry"] or p.get("type") != "Major Highway" or not p.get("name"):
        continue
    g = shape(f["geometry"]).intersection(CLIP)
    if g.is_empty:
        continue
    key = (p["name"], p.get("level") or "")
    fw.setdefault(key, []).append(g)
freeways = []
for (name, level), parts in fw.items():
    g = unary_union(parts)
    lines = [x for x in getattr(g, "geoms", [g]) if isinstance(x, LineString)]
    if not lines:
        continue
    longest = max(lines, key=lambda x: x.length)
    mid = longest.interpolate(0.5, normalized=True)
    freeways.append({
        "ref": name, "kind": {"Interstate": "i", "Federal": "us"}.get(level, "ca"),
        "d": geom_d(g), "label": [round(v, 1) for v in px(mid.x, mid.y)], "len": longest.length,
    })
freeways.sort(key=lambda x: -x["len"])

# Rail
rail = []
for f in load("ne_10m_railroads.geojson")["features"]:
    if f["geometry"]:
        g = shape(f["geometry"]).intersection(CLIP)
        if not g.is_empty:
            rail.append(g)
rail_d = geom_d(unary_union(rail)) if rail else ""

PLACES = [  # label anchors (approximate town centers)
    ("Santa Monica", -118.491, 34.019), ("Culver City", -118.396, 34.021), ("Hollywood", -118.327, 34.098),
    ("Downtown", -118.249, 34.049), ("Pasadena", -118.144, 34.148), ("Inglewood", -118.353, 33.962),
    ("Torrance", -118.341, 33.836), ("San Pedro", -118.292, 33.736), ("Long Beach", -118.193, 33.785),
    ("Lakewood", -118.133, 33.853), ("Whittier", -118.032, 33.979), ("Fullerton", -117.925, 33.870),
    ("Anaheim", -117.915, 33.836), ("Orange", -117.853, 33.788), ("Santa Ana", -117.868, 33.745),
    ("Garden Grove", -117.941, 33.774), ("Huntington Beach", -117.999, 33.660), ("Costa Mesa", -117.918, 33.641),
    ("Newport Beach", -117.873, 33.607), ("Irvine", -117.794, 33.684), ("Tustin", -117.826, 33.745),
    ("Laguna Beach", -117.783, 33.542), ("Mission Viejo", -117.672, 33.600), ("Marina del Rey", -118.452, 33.980),
]
places = [{"name": n, "xy": [round(v, 1) for v in px(lng, lat)]} for n, lng, lat in PLACES]
airports = [{"code": c, "xy": [round(v, 1) for v in px(lng, lat)]} for c, lng, lat in
            [("LAX", -118.408, 33.942), ("LGB", -118.152, 33.818), ("SNA", -117.868, 33.676), ("BUR", -118.358, 34.200)]]

out = {
    "bounds": [W, E, S, N], "size": [MW, MH], "kx": KX,
    "land": land_d, "hoods": hoods_d, "excluded": excluded_d, "county": county_d,
    "freeways": [{k: v for k, v in f.items() if k != "len"} for f in freeways], "rail": rail_d,
    "places": places, "airports": airports,
    "credits": "Coastline © OpenStreetMap contributors (ODbL). Neighborhoods: L.A. Times Mapping L.A. Freeways and rail: Natural Earth.",
}
dest = ROOT / "data/geo.json"
dest.write_text(json.dumps(out, separators=(",", ":")))
print(f"geo.json {dest.stat().st_size // 1024} KB · land {len(land_d) // 1024} KB · hoods {len(hoods_d) // 1024} KB · "
      f"{len(freeways)} freeways · rail {len(rail_d)} chars · size {MW}x{MH}")
