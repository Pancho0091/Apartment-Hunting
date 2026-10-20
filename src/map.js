/* Map view. Owner: map pass.
   Contract: window.MapView = { render(root, list, ctx) }
   - root: element to render into (empty)
   - list: filtered, sorted listings (objects from data/buildings.json)
   - ctx: { geo, areas, verdict(b), rentOf(b), money(n), score(b), openBuilding(b), openArea(a), areaScore(a) }
   geo = data/geo.json (paths pre-projected to a {size[0]} x {size[1]} space; see scripts/build_geo.py; project(lng,lat) below).
*/
window.MapView = null; // app.js falls back to its built-in schematic map while this is null
