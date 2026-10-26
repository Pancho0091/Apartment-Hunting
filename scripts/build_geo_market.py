"""Build map layers for the Seattle and New York markets (data/geo-<market>.json).

Same output shape as scripts/build_geo.py (LA), so src/map.js can render any market.
Sources (downloaded separately, see README):
  - OSM land polygons, 100 m          (npm @geo-maps/earth-lands-100m, ODbL)
  - Neighborhoods                      (codeforgermany/click_that_hood: seattle, manhattan, brooklyn,
                                        queens, bronx, staten-island)
  - Lakes, freeways, rail              (Natural Earth 10m, public domain)

Usage: python scripts/build_geo_market.py <geo_source_dir> seattle|nyc   (needs shapely)
"""
import json
import math
import sys
from pathlib import Path

from shapely.geometry import box, shape, LineString, MultiLineString, Polygon, MultiPolygon, GeometryCollection
from shapely.ops import unary_union
import shapely

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1])
MARKET = sys.argv[2]

MARKETS = {
    "seattle": {
        "bounds": (-122.46, -122.0, 47.38, 47.86),
        "hoods": ["cth-seattle.geojson"],
        "county_from_hoods": True,   # Seattle city limits as the "county" line
        "places": [
            ("Downtown", -122.335, 47.607), ("Capitol Hill", -122.319, 47.623), ("Ballard", -122.384, 47.668),
            ("Fremont", -122.350, 47.651), ("University District", -122.313, 47.661), ("West Seattle", -122.387, 47.567),
            ("Columbia City", -122.286, 47.560), ("Northgate", -122.325, 47.708), ("Shoreline", -122.341, 47.756),
            ("Lynnwood", -122.315, 47.828), ("Bellevue", -122.200, 47.610), ("Kirkland", -122.209, 47.681),
            ("Redmond", -122.121, 47.674), ("Renton", -122.209, 47.483), ("Tukwila", -122.261, 47.474),
            ("Burien", -122.347, 47.470), ("Mercer Island", -122.227, 47.571), ("Bothell", -122.205, 47.760),
        ],
        "airports": [("SEA", -122.309, 47.449), ("BFI", -122.302, 47.530), ("PAE", -122.282, 47.906)],
        "credits": "Coastline © OpenStreetMap contributors (ODbL). Neighborhoods: City of Seattle via click_that_hood. Lakes, freeways and rail: Natural Earth.",
    },
    "nyc": {
        "bounds": (-74.27, -73.69, 40.49, 40.92),
        "hoods": ["cth-manhattan.geojson", "cth-brooklyn.geojson", "cth-queens.geojson", "cth-bronx.geojson", "cth-staten-island.geojson"],
        "county_file": "cth-new-york-city-boroughs.geojson",
        "places": [
            ("Midtown", -73.985, 40.755), ("Lower Manhattan", -74.010, 40.708), ("Harlem", -73.945, 40.811),
            ("Upper West Side", -73.975, 40.787), ("Williamsburg", -73.957, 40.714), ("Park Slope", -73.978, 40.671),
            ("Bushwick", -73.921, 40.694), ("Astoria", -73.920, 40.764), ("Long Island City", -73.947, 40.744),
            ("Flushing", -73.833, 40.767), ("Jamaica", -73.794, 40.702), ("Bay Ridge", -74.028, 40.626),
            ("Riverdale", -73.912, 40.890), ("Fordham", -73.890, 40.861), ("St. George", -74.077, 40.643),
            ("Jersey City", -74.070, 40.718), ("Hoboken", -74.032, 40.744), ("Coney Island", -73.986, 40.575),
        ],
        "airports": [("JFK", -73.779, 40.641), ("LGA", -73.874, 40.777), ("EWR", -74.175, 40.690)],
        "credits": "Coastline © OpenStreetMap contributors (ODbL). Neighborhoods and boroughs: NYC via click_that_hood. Lakes, freeways and rail: Natural Earth.",
    },
}
cfg = MARKETS[MARKET]
W, E, S, N = cfg["bounds"]
KX = math.cos(math.radians((S + N) / 2))
MW = 2000
MH = round(MW * (N - S) / ((E - W) * KX))
CLIP = box(W - 0.02, S - 0.02, E + 0.02, N + 0.02)
TOL = 0.0002  # ~20 m; these maps cover a smaller area than LA


def px(lng, lat):
    return (lng - W) / (E - W) * MW, (N - lat) / (N - S) * MH


def ring_d(coords, close):
    pts = [px(x, y) for x, y in coords]
    if len(pts) < 2:
        return ""
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + ("Z" if close else "")


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


def clipped(features):
    for f in features:
        if f.get("geometry"):
            g = shape(f["geometry"])
            if not g.is_valid:
                g = g.buffer(0)
            g = g.intersection(CLIP)
            if not g.is_empty:
                yield f, g


# Land minus inland lakes (Lake Washington, Lake Union, Sammamish...)
src = load("package/map.geo.json")
land = []
for geom in src.get("geometries") or [f["geometry"] for f in src["features"]]:
    g = shape(geom)
    for part in getattr(g, "geoms", [g]):
        if part.intersects(CLIP):
            # clip_by_rect is fast and tolerates invalid input; repair only the small clipped piece.
            piece = shapely.clip_by_rect(part, *CLIP.bounds)
            if not piece.is_valid:
                piece = piece.buffer(0)
            land.append(piece)
land = unary_union(land)
# Keep only large lakes (Lake Washington, Sammamish); Natural Earth's small lakes are coarse triangles.
lakes = unary_union([g for _, g in clipped(load("ne_10m_lakes.geojson")["features"]) if g.area >= 0.003])
if not lakes.is_empty:
    land = land.difference(lakes)


def fill_small(g, min_area=6e-5):
    if isinstance(g, Polygon):
        return Polygon(g.exterior, [r for r in g.interiors if Polygon(r).area >= min_area])
    return unary_union([fill_small(x, min_area) for x in getattr(g, "geoms", [])])


land = fill_small(land).simplify(TOL)

# Neighborhood outlines
hood_polys = []
for name in cfg["hoods"]:
    for _, g in clipped(load(name)["features"]):
        hood_polys.append(g.simplify(TOL))
hoods_d = geom_d(unary_union([g.boundary for g in hood_polys]).intersection(land.buffer(0.0008)))

# "County" line: NYC borough boundaries / Seattle city limits
if cfg.get("county_file"):
    county = unary_union([g.boundary for _, g in clipped(load(cfg["county_file"])["features"])])
elif cfg.get("county_from_hoods"):
    # Dissolve neighborhoods into one outline (close tiny gaps first) so only the city limit is drawn.
    county = unary_union([g.buffer(0.0004) for g in hood_polys]).buffer(-0.0004).boundary
else:
    county = GeometryCollection()
county_d = geom_d(county.intersection(land.buffer(-0.0015)).simplify(TOL))

# Freeways
fw = {}
for f, g in clipped(load("ne_10m_roads.geojson")["features"]):
    p = f["properties"]
    if p.get("type") != "Major Highway" or not p.get("name"):
        continue
    fw.setdefault((p["name"], p.get("level") or ""), []).append(g)
freeways = []
for (name, level), parts in fw.items():
    g = unary_union(parts)
    lines = [x for x in getattr(g, "geoms", [g]) if isinstance(x, LineString)]
    if not lines:
        continue
    longest = max(lines, key=lambda x: x.length)
    mid = longest.interpolate(0.5, normalized=True)
    freeways.append({"ref": name, "kind": {"Interstate": "i", "Federal": "us"}.get(level, "ca"),
                     "d": geom_d(g), "label": [round(v, 1) for v in px(mid.x, mid.y)], "len": longest.length})
freeways.sort(key=lambda x: -x["len"])

rail = [g for _, g in clipped(load("ne_10m_railroads.geojson")["features"])]
rail_d = geom_d(unary_union(rail)) if rail else ""

out = {
    "market": MARKET, "bounds": [W, E, S, N], "size": [MW, MH], "kx": KX,
    "land": geom_d(land), "hoods": hoods_d, "excluded": "", "county": county_d,
    "freeways": [{k: v for k, v in f.items() if k != "len"} for f in freeways], "rail": rail_d,
    "places": [{"name": n, "xy": [round(v, 1) for v in px(lng, lat)]} for n, lng, lat in cfg["places"]],
    "airports": [{"code": c, "xy": [round(v, 1) for v in px(lng, lat)]} for c, lng, lat in cfg["airports"]],
    "credits": cfg["credits"],
}
dest = ROOT / f"data/geo-{MARKET}.json"
dest.write_text(json.dumps(out, separators=(",", ":")))
print(f"{dest.name} {dest.stat().st_size // 1024} KB · {len(freeways)} freeways · {len(hood_polys)} hoods · size {MW}x{MH}")
