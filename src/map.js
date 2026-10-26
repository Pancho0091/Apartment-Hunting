/* Map view. Owner: map pass.
   Contract: window.MapView = { render(root, list, ctx) }
   - root: element to render into (empty)
   - list: filtered, sorted listings (objects from data/buildings.json)
   - ctx: { geo, areas, verdict(b), rentOf(b), money(n), score(b), openBuilding(b), openArea(a), areaScore(a) }
   geo = data/geo.json (paths pre-projected to a size[0] x size[1] space; see scripts/build_geo.py).

   Architecture: one persistent SVG per geo object. The heavy base layers (land, 296 neighbourhood outlines,
   freeways, rail) are parsed once and live in a "world" group that is moved with a single transform
   matrix. Everything that must keep a constant screen size (markers, shields, labels, airports, the frame
   band, graticule labels) lives in a screen-space overlay that is re-laid out each animation frame from a
   few hundred numbers. Re-rendering with a new list only rebuilds the markers and keeps the view.
*/
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const C = {
    paper: "#f3efe6", panel: "#fbf9f4", ink: "#1f1d1a", muted: "#6b655c", hair: "#d9d2c3",
    green: "#2f4b3c", amber: "#a8641f", verm: "#b8432f", sage: "#8a9a7b",
    land: "#f8f5ec", sea: "#e3e9e5", seaInk: "#4f6b74", road: "#ecd3a0", navy: "#26415a",
  };
  const VCOL = { all: C.green, check: C.amber, fail: C.verm };
  const VLABEL = { all: "Meets everything", check: "Needs checks", fail: "Fails a requirement" };
  const LAYERS = [
    ["heat", "Neighborhood scores"], ["hoods", "Neighborhood lines"], ["freeways", "Freeways"],
    ["rail", "Rail"], ["excluded", "Ruled-out South Bay"], ["labels", "Place names"],
  ];
  const WATER = [ // label anchors for water bodies and regions (cartographic furniture, not data)
    { t: "Pacific Ocean", lng: -118.33, lat: 33.5, cls: "water big" },
    { t: "Santa Monica Bay", lng: -118.555, lat: 33.885, cls: "water" },
    { t: "San Pedro Bay", lng: -118.175, lat: 33.712, cls: "water" },
    { t: "Los Angeles County", lng: -117.99, lat: 34.115, cls: "region", maxZ: 1.7 },
    { t: "Orange County", lng: -117.72, lat: 33.79, cls: "region", maxZ: 1.7 },
  ];
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function S(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function H(tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

  /* ---------- CSS (injected once) ---------- */
  const MAP_CSS = `
.mv{--mv-paper:#f3efe6;--mv-panel:#fbf9f4;--mv-ink:#1f1d1a;--mv-muted:#6b655c;--mv-hair:#d9d2c3;--mv-green:#2f4b3c;--mv-amber:#a8641f;--mv-verm:#b8432f;--mv-sage:#8a9a7b;
--mv-serif:"Instrument Serif",Georgia,"Times New Roman",serif;--mv-sans:Geist,-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;--mv-mono:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
position:relative;height:clamp(440px,78vh,760px);background:#ece6d8;border:1px solid var(--mv-hair);border-radius:3px;overflow:hidden;color:var(--mv-ink);font-family:var(--mv-sans);-webkit-user-select:none;user-select:none;isolation:isolate;contain:layout paint}
.mv::after{content:"";position:absolute;inset:5px;border:1px solid rgba(31,29,26,.28);border-radius:1px;pointer-events:none;z-index:1}
.mv-base{position:absolute;left:-25%;top:-25%;width:150%;height:150%;display:block;pointer-events:none;transform-origin:0 0;will-change:transform}
.mv-svg{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab;outline:none}
.mv-svg.is-area{cursor:pointer}
.mv-svg.is-drag{cursor:grabbing}
.mv-svg:focus-visible{box-shadow:inset 0 0 0 2px var(--mv-green)}
.mv text{font-kerning:normal}
.mv-halo{paint-order:stroke;stroke:#f8f5ec;stroke-width:3.2px;stroke-linejoin:round}
.mv-place{font:400 12px/1 var(--mv-serif);letter-spacing:.16em;text-transform:uppercase;fill:#2b2823}
.mv-place.major{font-size:13.5px;letter-spacing:.18em}
.mv-area{font:italic 400 13px/1 var(--mv-serif);fill:#3d4a3f;letter-spacing:.02em}
.mv-water{font:italic 400 13px/1 var(--mv-serif);letter-spacing:.32em;fill:#4f6b74;opacity:.85}
.mv-water.big{font-size:17px;letter-spacing:.6em}
.mv-region{font:400 15px/1 var(--mv-serif);letter-spacing:.55em;text-transform:uppercase;fill:#6b655c;opacity:.55}
.mv-excl{font:500 9.5px/1 var(--mv-mono);letter-spacing:.14em;text-transform:uppercase;fill:#8f3424}
.mv-grat{font:400 9px/1 var(--mv-mono);letter-spacing:.06em;fill:#6b655c}
.mv-shield text{font:700 9.5px/1 var(--mv-sans);letter-spacing:-.02em;text-anchor:middle}
.mv-air text{font:500 10px/1 var(--mv-mono);letter-spacing:.12em;fill:#1f1d1a}
.mv-mk{cursor:pointer;outline:none}
.mv-mk .mv-mk-in{transition:transform .16s cubic-bezier(.2,.7,.2,1);transform-box:fill-box;transform-origin:center}
.mv-mk:hover .mv-mk-in,.mv-mk:focus-visible .mv-mk-in,.mv-mk.is-hot .mv-mk-in{transform:scale(1.22)}
.mv-mk .mv-ring{opacity:0;transition:opacity .15s}
.mv-mk:focus-visible .mv-ring{opacity:1}
.mv-mk text{font:400 14px/1 var(--mv-serif);text-anchor:middle;fill:#1f1d1a}
.mv-heat circle{cursor:pointer}
.mv-noanim .mv-mk-in{transition:none}
.mv.no-hoods .mv-l-hoods,.mv.no-freeways .mv-l-freeways,.mv.no-rail .mv-l-rail,.mv.no-excluded .mv-l-excluded,.mv.no-heat .mv-l-heat,.mv.no-labels .mv-l-labels{display:none}
.mv-card{position:absolute;z-index:2;background:rgba(251,249,244,.95);border:1px solid var(--mv-hair);border-radius:3px;box-shadow:0 10px 30px -18px rgba(31,29,26,.45);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.mv-cart{left:14px;top:14px;padding:10px 12px 10px;max-width:250px}
.mv-cart h3{margin:0;font:400 21px/1.05 var(--mv-serif);letter-spacing:.005em;color:var(--mv-ink)}
.mv-cart h3 em{font-style:italic;color:var(--mv-green)}
.mv-kicker{font:500 9.5px/1.3 var(--mv-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--mv-muted);margin:0 0 4px}
.mv-cart .mv-sub{margin:6px 0 0;font:500 10px/1.45 var(--mv-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mv-muted)}
.mv-cart .mv-sub b{color:var(--mv-ink);font-weight:600}
.mv-layers{margin-top:9px;border-top:1px solid var(--mv-hair);padding-top:7px}
.mv-layers summary,.mv-legend summary{cursor:pointer;list-style:none;font:500 10px/1 var(--mv-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--mv-ink);display:flex;align-items:center;gap:6px;padding:3px 0;border-radius:2px}
.mv-layers summary::-webkit-details-marker,.mv-legend summary::-webkit-details-marker{display:none}
.mv-layers summary::after,.mv-legend summary::after{content:"";width:6px;height:6px;border-right:1.2px solid currentColor;border-bottom:1.2px solid currentColor;transform:rotate(45deg) translate(-2px,-2px);margin-left:auto;transition:transform .15s}
.mv-layers[open] summary::after,.mv-legend[open] summary::after{transform:rotate(-135deg) translate(-1px,-1px)}
.mv-layers summary:focus-visible,.mv-legend summary:focus-visible{outline:2px solid var(--mv-green);outline-offset:2px}
.mv-tog{display:flex;align-items:center;gap:8px;margin:6px 0 0;font:400 12.5px/1.2 var(--mv-sans);color:var(--mv-ink);cursor:pointer}
.mv-tog input{appearance:none;-webkit-appearance:none;margin:0;width:26px;height:15px;border-radius:8px;border:1px solid #b9b09d;background:#ebe5d8;position:relative;flex:none;cursor:pointer;transition:background .15s,border-color .15s}
.mv-tog input::after{content:"";position:absolute;top:1.5px;left:1.5px;width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 0 .5px rgba(0,0,0,.25);transition:transform .15s}
.mv-tog input:checked{background:var(--mv-green);border-color:var(--mv-green)}
.mv-tog input:checked::after{transform:translateX(11px)}
.mv-tog input:focus-visible{outline:2px solid var(--mv-green);outline-offset:2px}
.mv-tog i{font-style:normal;margin-left:auto;font:400 10px var(--mv-mono);color:var(--mv-muted)}
.mv-ctl{right:14px;top:104px;display:flex;flex-direction:column;overflow:hidden}
.mv-ctl button{all:unset;box-sizing:border-box;width:34px;height:34px;display:grid;place-items:center;cursor:pointer;color:var(--mv-ink);font:400 19px/1 var(--mv-serif)}
.mv-ctl button+button{border-top:1px solid var(--mv-hair)}
.mv-ctl button:hover{background:#efe9dc}
.mv-ctl button:focus-visible{outline:2px solid var(--mv-green);outline-offset:-3px}
.mv-ctl button[disabled]{color:#b9b09d;cursor:default;background:none}
.mv-ctl svg{width:16px;height:16px}
.mv-compass{position:absolute;right:12px;top:12px;width:84px;height:84px;z-index:2;color:var(--mv-ink);pointer-events:none;opacity:.92}
.mv-compass svg{width:100%;height:100%;display:block}
.mv-scale{position:absolute;right:14px;bottom:26px;z-index:2;pointer-events:none;background:rgba(251,249,244,.86);padding:3px 8px 2px 10px;border-radius:2px}
.mv-scale svg{display:block;overflow:visible}
.mv-scale text{font:400 9px/1 var(--mv-mono);letter-spacing:.06em;fill:#1f1d1a}
.mv-credit{position:absolute;left:auto;right:14px;max-width:calc(100% - 28px);bottom:9px;background:rgba(251,249,244,.86);padding:2px 6px;border-radius:2px;z-index:2;font:400 8.5px/1.2 var(--mv-mono);letter-spacing:.02em;color:#6b655c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:auto}
.mv-legend{left:14px;bottom:24px;padding:8px 12px 10px;width:250px}
.mv-lh{margin:9px 0 4px;font:500 9px/1.2 var(--mv-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--mv-muted)}
.mv-lh span{letter-spacing:.04em;text-transform:none}
.mv-lrow{display:grid;grid-template-columns:1fr;gap:3px}
.mv-lrow.two{grid-template-columns:1fr 1fr;gap:4px 8px}
.mv-li{display:flex;align-items:center;gap:7px;font:400 12px/1.2 var(--mv-sans);color:var(--mv-ink);min-width:0}
.mv-li>svg{flex:none;display:block;width:24px}
.mv-li>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-ramp{height:8px;border-radius:1px;border:1px solid rgba(31,29,26,.25);background:linear-gradient(90deg,#b8432f,#a8641f 35%,#8a9a7b 68%,#2f4b3c)}
.mv-ramp-l{display:flex;justify-content:space-between;font:400 9.5px var(--mv-mono);color:var(--mv-muted);margin-top:2px}
.mv-tip{position:absolute;z-index:3;left:0;top:0;width:236px;padding:10px 12px 10px;pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .12s,transform .12s}
.mv-tip.on{opacity:1;transform:none}
.mv-noanim .mv-tip{transition:none}
.mv-tip .k{font:500 9.5px/1.3 var(--mv-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--mv-muted);margin:0 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-tip .n{font:400 20px/1.1 var(--mv-serif);margin:0 0 8px;color:var(--mv-ink)}
.mv-tip .g{display:grid;grid-template-columns:1.25fr 1fr 1fr;border-top:1px solid var(--mv-hair);border-bottom:1px solid var(--mv-hair)}
.mv-tip .g span{padding:6px 0 5px 8px;border-left:1px solid var(--mv-hair)}
.mv-tip .g span:first-child{padding-left:0;border-left:0}
.mv-tip .g b{display:block;font:400 18px/1 var(--mv-serif);color:var(--mv-ink)}
.mv-tip .g i{display:block;font:500 8.5px/1.4 var(--mv-mono);font-style:normal;letter-spacing:.12em;text-transform:uppercase;color:var(--mv-muted);margin-top:3px}
.mv-tip .v{display:flex;align-items:center;gap:6px;margin-top:8px;font:500 10px/1 var(--mv-mono);letter-spacing:.1em;text-transform:uppercase}
.mv-tip .v::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor}
.mv-tip .v.cnt::before{display:none}
.mv-tip .v.cnt span:not(.hint){display:inline-flex;align-items:center;gap:4px;margin-right:6px}
.mv-tip .v.cnt span:not(.hint)::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.mv-tip .hint{margin-left:auto;color:var(--mv-muted);letter-spacing:.06em;text-transform:none;font-family:var(--mv-sans);font-size:11px}
.mv-tip .bar{display:flex;height:5px;margin:8px 0 2px;border-radius:1px;overflow:hidden}
.mv-tip ul{margin:6px 0 0;padding:0;list-style:none;font:400 12px/1.5 var(--mv-sans);color:var(--mv-ink)}
.mv-tip ul li{display:flex;gap:8px;justify-content:space-between;white-space:nowrap}
.mv-tip ul li span{overflow:hidden;text-overflow:ellipsis}
.mv-tip ul li em{font-style:normal;color:var(--mv-muted);font-family:var(--mv-mono);font-size:11px}
.mv-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.mv-empty{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;padding:12px 16px;font:400 13px/1.4 var(--mv-sans);text-align:center;pointer-events:none}
@media (max-width:720px){
 .mv{height:min(66vh,560px);min-height:420px}
 .mv-cart{left:10px;top:10px;right:auto;max-width:calc(100% - 82px);padding:8px 10px}
 .mv-cart h3{font-size:17px}
 .mv-cart .mv-sub,.mv-cart .mv-kicker{display:none}
 .mv-cart .mv-layers{margin-top:6px;padding-top:5px}
 .mv-compass{width:56px;height:56px;right:9px;top:9px}
 .mv-ctl{right:10px;top:72px}
 .mv-ctl button{width:40px;height:40px}
 .mv-layers summary,.mv-legend summary{min-height:34px}
 .mv-tog{min-height:32px;margin-top:2px}
 .mv-legend{left:10px;bottom:24px;width:auto;max-width:calc(100% - 20px);padding:7px 10px}
 .mv-legend[open]{width:250px}
 .mv-scale{right:10px;bottom:30px}
 .mv-credit{right:10px;bottom:10px;max-width:calc(100% - 20px)}
 .mv-tip{width:220px}
}
@media (pointer:coarse){.mv-hit{r:20px}}
@media (prefers-reduced-motion:reduce){.mv-mk .mv-mk-in,.mv-tip,.mv-tog input,.mv-tog input::after{transition:none}}
`;
  function injectCSS() {
    if (document.getElementById("map-css")) return;
    const st = document.createElement("style");
    st.id = "map-css";
    st.textContent = MAP_CSS;
    document.head.appendChild(st);
  }

  /* ---------- geometry helpers ---------- */
  function parseD(d) {
    const out = [];
    let cur = null;
    const toks = (d || "").match(/[MLZ][^MLZ]*/g) || [];
    for (const t of toks) {
      if (t[0] === "Z") { if (cur && cur.length) cur.push(cur[0].slice()); continue; }
      const n = t.slice(1).split(/[ ,]+/).filter(Boolean).map(Number);
      const p = [n[0], n[1]];
      if (t[0] === "M" || !cur) { cur = [p]; out.push(cur); } else cur.push(p);
    }
    return out;
  }
  const toD = lines => lines.map(l => "M" + l.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L")).join("");
  function measure(line) {
    const cum = [0];
    for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    return cum;
  }
  function at(line, cum, s) {
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m; else hi = m; }
    const seg = cum[hi] - cum[lo] || 1, t = (s - cum[lo]) / seg;
    return [line[lo][0] + (line[hi][0] - line[lo][0]) * t, line[lo][1] + (line[hi][1] - line[lo][1]) * t];
  }
  // Coastline = land outline minus the edges created by clipping the land polygon to the data box.
  function coastFromLand(land, size) {
    const ex = [-37.4, size[0] + 37.4], ey = [-45, size[1] + 45], on = (a, b) => Math.abs(a - b) < 0.6;
    const edge = (p, q) => (on(p[0], ex[0]) && on(q[0], ex[0])) || (on(p[0], ex[1]) && on(q[0], ex[1])) ||
      (on(p[1], ey[0]) && on(q[1], ey[0])) || (on(p[1], ey[1]) && on(q[1], ey[1]));
    const out = [];
    for (const ring of land) {
      let cur = [ring[0]];
      for (let i = 1; i < ring.length; i++) {
        if (edge(ring[i - 1], ring[i])) { if (cur.length > 1) out.push(cur); cur = [ring[i]]; }
        else cur.push(ring[i]);
      }
      if (cur.length > 1) out.push(cur);
    }
    return out;
  }
  function scoreColor(t) { // 0..1 -> vermilion, amber, sage, bottle green
    const stops = [[0, [184, 67, 47]], [0.35, [168, 100, 31]], [0.68, [138, 154, 123]], [1, [47, 75, 60]]];
    t = clamp(t, 0, 1);
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i], u = (t - a) / (b - a);
      return "rgb(" + ca.map((v, j) => Math.round(v + (cb[j] - v) * u)).join(",") + ")";
    }
    return "rgb(47,75,60)";
  }
  const shortArea = n => {
    let s = String(n || "");
    if (s.includes(" – ")) s = s.split(" – ").slice(1).join(" – ");
    return s.split(" / ")[0].split(" (")[0].replace(/ area$/, "").trim();
  };
  const fmtDeg = (v, pos, neg) => {
    const a = Math.abs(v), d = Math.floor(a + 1e-9), m = Math.round((a - d) * 60);
    return d + "°" + (m ? String(m).padStart(2, "0") + "′" : "") + (v < 0 ? neg : pos);
  };

  /* ---------- static SVG snippets ---------- */
  const PLANE = "M12 1.6c.9 0 1.4 1 1.4 2.1v5.2l7.8 4.6v2.1l-7.8-2.4v4.6l2.1 1.6v1.7L12 20.2l-3.5 1.1v-1.7l2.1-1.6V13.2l-7.8 2.4v-2.1l7.8-4.6V3.7c0-1.1.5-2.1 1.4-2.1z";
  const SHAPES = {
    i: "M2.2 3.2C6 1.5 9 1.5 12 3.4 15 1.5 18 1.5 21.8 3.2c.8 2.8.8 5.8.2 8.8C21 17.5 17 21 12 23.2 7 21 3 17.5 2 12c-.6-3-.6-6 .2-8.8z",
    iCrown: "M2.2 3.2C6 1.5 9 1.5 12 3.4 15 1.5 18 1.5 21.8 3.2c.4 1.6.6 3.2.6 4.8H1.6c0-1.6.2-3.2.6-4.8z",
    us: "M3.6 2h16.8c0 2 1 3.1 2.4 3.6 0 6.6-2 11.4-10.8 17.2C3.2 17 1.2 12.2 1.2 5.6 2.6 5.1 3.6 4 3.6 2z",
    ca: "M12 1.2c1.6 2 3.6 2.7 6 2.4 2.3-.3 4.4.8 4.6 3.4.3 5.2-4 10.6-10.6 15.8C5.4 17.6 1.1 12.2 1.4 7c.2-2.6 2.3-3.7 4.6-3.4 2.4.3 4.4-.4 6-2.4z",
  };
  function shieldMarkup(kind, ref) {
    const w = ref.length >= 3 ? 28 : 23, sx = w / 24;
    const tx = `transform="translate(${-w / 2} -12) scale(${sx} 1)"`;
    if (kind === "i") return { w, h: 24, svg:
      `<g ${tx}><path d="${SHAPES.i}" fill="${C.navy}" stroke="#f8f5ec" stroke-width="2.4" paint-order="stroke"/><path d="${SHAPES.iCrown}" fill="${C.verm}"/>` +
      `<path d="${SHAPES.i}" fill="none" stroke="#fff" stroke-width=".8" transform="translate(12 12.6) scale(.84) translate(-12 -12.6)"/></g>` +
      `<text y="4.6" fill="#fff">${esc(ref)}</text>` };
    if (kind === "us") return { w, h: 24, svg:
      `<g ${tx}><path d="${SHAPES.us}" fill="#fff" stroke="#f8f5ec" stroke-width="3" paint-order="stroke"/><path d="${SHAPES.us}" fill="none" stroke="${C.ink}" stroke-width="1.2"/></g>` +
      `<text y="2.6" fill="${C.ink}">${esc(ref)}</text>` };
    return { w, h: 24, svg:
      `<g ${tx}><path d="${SHAPES.ca}" fill="${C.green}" stroke="#f8f5ec" stroke-width="2.4" paint-order="stroke"/>` +
      `<path d="${SHAPES.ca}" fill="none" stroke="#fff" stroke-width=".8" transform="translate(12 12) scale(.84) translate(-12 -12)"/></g>` +
      `<text y="3.4" fill="#fff">${esc(ref)}</text>` };
  }
  function compassSVG() {
    try { if (window.Illus && typeof window.Illus.compass === "function") { const s = window.Illus.compass(); if (s && /<svg/i.test(s)) return s; } } catch { /* fall back */ }
    let ticks = "";
    for (let i = 0; i < 72; i++) {
      const a = i * 5 * Math.PI / 180, r1 = 46, r2 = i % 9 === 0 ? 40.5 : i % 3 === 0 ? 42.5 : 44;
      ticks += `M${(50 + Math.sin(a) * r1).toFixed(2)} ${(50 - Math.cos(a) * r1).toFixed(2)}L${(50 + Math.sin(a) * r2).toFixed(2)} ${(50 - Math.cos(a) * r2).toFixed(2)}`;
    }
    const pt = (ang, len, w) => { // one star point as two half-triangles (light + dark), engraved style
      const a = ang * Math.PI / 180, tip = [50 + Math.sin(a) * len, 50 - Math.cos(a) * len];
      const l = [50 + Math.sin(a - Math.PI / 2) * w, 50 - Math.cos(a - Math.PI / 2) * w], r = [50 + Math.sin(a + Math.PI / 2) * w, 50 - Math.cos(a + Math.PI / 2) * w];
      const f = p => p.map(v => v.toFixed(2)).join(" ");
      return `<path d="M50 50L${f(tip)}L${f(l)}Z" fill="#fbf9f4" stroke="currentColor" stroke-width=".7" stroke-linejoin="round"/><path d="M50 50L${f(tip)}L${f(r)}Z" fill="currentColor" stroke="currentColor" stroke-width=".7" stroke-linejoin="round"/>`;
    };
    let star = "";
    for (const a of [45, 135, 225, 315]) star += pt(a, 25, 4.2);
    for (const a of [0, 90, 180, 270]) star += pt(a, 37, 6);
    return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="47.5" fill="rgba(251,249,244,.82)" stroke="currentColor" stroke-width=".9"/>` +
      `<circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width=".35"/><path d="${ticks}" stroke="currentColor" stroke-width=".55"/>` +
      `<circle cx="50" cy="50" r="38.5" fill="none" stroke="currentColor" stroke-width=".35" stroke-dasharray="1 1.6"/><circle cx="50" cy="50" r="17" fill="none" stroke="currentColor" stroke-width=".45"/>` +
      star + `<circle cx="50" cy="50" r="2.2" fill="#fbf9f4" stroke="currentColor" stroke-width=".7"/>` +
      `<text x="50" y="11.6" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="11" fill="currentColor" stroke="#fbf9f4" stroke-width="3" paint-order="stroke">N</text></svg>`;
  }
  function markerMarkup(v, size) {
    const col = VCOL[v] || C.muted, r = size || 6.6;
    const glyph = v === "check" ? `<circle r="2.1" fill="#fff"/>` : v === "fail" ? `<path d="M-2.2-2.2L2.2 2.2M2.2-2.2L-2.2 2.2" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>` : `<path d="M-2.6 .1L-.8 1.9 2.7-1.7" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `<circle class="mv-ring" r="${r + 5.5}" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-dasharray="3 2.2"/>` +
      `<g class="mv-mk-in"><circle r="${r + 3}" fill="#f8f5ec" fill-opacity=".85"/><circle r="${r + 2.2}" fill="none" stroke="${C.ink}" stroke-width=".7" stroke-opacity=".55"/>` +
      `<circle r="${r}" fill="${col}" stroke="#fff" stroke-width="1.5"/>${glyph}</g>`;
  }
  function clusterMarkup(counts, n) {
    const r = 11 + Math.min(8, Math.sqrt(n) * 1.9), rr = r - 3, circ = 2 * Math.PI * rr;
    let off = 0, arcs = "";
    for (const v of ["all", "check", "fail"]) {
      const c = counts[v] || 0;
      if (!c) continue;
      const len = circ * c / n;
      arcs += `<circle r="${rr}" fill="none" stroke="${VCOL[v]}" stroke-width="4.4" stroke-dasharray="${Math.max(0, len - (n > c ? 1.2 : 0)).toFixed(2)} ${(circ - len + (n > c ? 1.2 : 0)).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90)"/>`;
      off += len;
    }
    return { r, svg: `<circle class="mv-ring" r="${r + 5}" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-dasharray="3 2.2"/>` +
      `<g class="mv-mk-in"><circle r="${r + 2.6}" fill="#f8f5ec" fill-opacity=".9" stroke="${C.ink}" stroke-width=".8"/>${arcs}` +
      `<circle r="${rr - 2.6}" fill="#fbf9f4" stroke="${C.ink}" stroke-width=".45"/><text y="4.6">${n}</text></g>` };
  }

  /* ---------- the map instance ---------- */
  function create(geo) {
    const [W, E, Sb, N] = geo.bounds, [MW, MH] = geo.size;
    const kx = geo.kx || Math.cos(33.8 * Math.PI / 180);
    const MPU = (E - W) * 69.172 * kx / MW; // miles per map unit
    const proj = (lng, lat) => [(lng - W) / (E - W) * MW, (N - lat) / (N - Sb) * MH];
    const layersOn = Object.assign({ heat: true, hoods: true, freeways: true, rail: true, excluded: true, labels: true }, lsGet("mv-layers-v1", {}));

    const el = H("div", "mv");
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Atlas of matching listings");
    const base = S("svg", { class: "mv-base", "aria-hidden": "true", focusable: "false" }, el);
    const svg = S("svg", { class: "mv-svg", tabindex: "0", role: "group", "aria-label": "Map. Drag or use arrow keys to pan, plus and minus to zoom, 0 to reset. Tab to reach listing markers." }, el);
    const defs = S("defs", null, base);
    defs.innerHTML =
      `<pattern id="mv-rule" patternUnits="userSpaceOnUse" width="8" height="4.2"><path d="M0 2.1H8" stroke="${C.seaInk}" stroke-width=".55" stroke-opacity=".32"/></pattern>` +
      `<pattern id="mv-hatch" patternUnits="userSpaceOnUse" width="5.5" height="5.5"><path d="M0 0V5.5" stroke="${C.verm}" stroke-width=".9" stroke-opacity=".5"/></pattern>` +
      `<pattern id="mv-dots" patternUnits="userSpaceOnUse" width="9" height="9"><circle cx="2" cy="2" r=".55" fill="${C.sage}" fill-opacity=".38"/><circle cx="6.5" cy="6.5" r=".45" fill="${C.sage}" fill-opacity=".28"/></pattern>` +
      `<clipPath id="mv-cw"><rect x="0" y="0" width="${MW}" height="${MH}"/></clipPath>`;
    const world = S("g", { class: "mv-world" }, base);
    const wc = S("g", { "clip-path": "url(#mv-cw)" }, world);

    // Ocean, ruling and coastal water-lines
    S("rect", { x: -60, y: -60, width: MW + 120, height: MH + 120, fill: C.sea }, wc);
    S("rect", { x: -60, y: -60, width: MW + 120, height: MH + 120, fill: "url(#mv-rule)" }, wc);
    const landLines = parseD(geo.land);
    const coastD = toD(coastFromLand(landLines, geo.size));
    S("path", { id: "mv-coast", d: coastD, fill: "none" }, defs);
    S("clipPath", { id: "mv-cl" }, defs).appendChild(S("path", { d: geo.land, "clip-rule": "evenodd" }));
    const ripG = S("g", { fill: "none", "stroke-linejoin": "round", "stroke-linecap": "butt" }, wc);
    const RIP = [2.6, 5.4, 8.6, 12.2, 16.4, 21.2, 26.8, 33.4];
    const ripples = [];
    for (let i = RIP.length - 1; i >= 0; i--) {
      const line = S("use", { href: "#mv-coast", stroke: C.seaInk, "stroke-opacity": (0.62 - i * 0.065).toFixed(2) }, ripG);
      const erase = S("use", { href: "#mv-coast", stroke: C.sea }, ripG);
      ripples.push([RIP[i], line, erase]);
    }
    // Land
    S("path", { d: geo.land, fill: C.land, "fill-rule": "evenodd" }, wc);
    const landTex = S("rect", { x: 0, y: 0, width: MW, height: MH, fill: "url(#mv-dots)", "clip-path": "url(#mv-cl)" }, wc);
    void landTex;
    const wash = S("use", { href: "#mv-coast", fill: "none", stroke: C.sage, "stroke-opacity": ".32", "clip-path": "url(#mv-cl)", "stroke-linejoin": "round" }, wc);
    // Graticule (0.1 degree)
    let gd = "";
    for (let lng = Math.ceil(W * 10) / 10; lng <= E + 1e-9; lng += 0.1) { const x = proj(lng, N)[0]; gd += `M${x.toFixed(1)},0V${MH}`; }
    for (let lat = Math.ceil(Sb * 10) / 10; lat <= N + 1e-9; lat += 0.1) { const y = proj(W, lat)[1]; gd += `M0,${y.toFixed(1)}H${MW}`; }
    S("path", { d: gd, fill: "none", stroke: C.seaInk, "stroke-opacity": ".22", "stroke-width": ".6", "vector-effect": "non-scaling-stroke", "stroke-dasharray": "2 3" }, wc);
    // Excluded South Bay
    const exG = S("g", { class: "mv-l-excluded" }, wc);
    const exFill = S("path", { d: geo.excluded, fill: "url(#mv-hatch)" }, exG);
    void exFill;
    S("path", { d: geo.excluded, fill: C.verm, "fill-opacity": ".05", stroke: C.verm, "stroke-opacity": ".7", "stroke-width": "1", "stroke-dasharray": "5 3", "vector-effect": "non-scaling-stroke" }, exG);
    // Neighbourhood outlines, county line, coast
    const hoods = S("path", { class: "mv-l-hoods", d: geo.hoods, fill: "none", stroke: "#5f5a50", "stroke-width": ".55", "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }, wc);
    S("path", { d: geo.county, fill: "none", stroke: "#f8f5ec", "stroke-width": "4", "stroke-opacity": ".9", "vector-effect": "non-scaling-stroke" }, wc);
    S("path", { d: geo.county, fill: "none", stroke: "#4a4339", "stroke-width": "1.3", "stroke-dasharray": "7 3 1.5 3", "vector-effect": "non-scaling-stroke" }, wc);
    S("path", { d: coastD, fill: "none", stroke: "#33464c", "stroke-width": "1.05", "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }, wc);
    // Rail: line with cross-ties
    const railG = S("g", { class: "mv-l-rail", fill: "none", "vector-effect": "non-scaling-stroke" }, wc);
    S("path", { d: geo.rail, stroke: "#f8f5ec", "stroke-width": "4", "vector-effect": "non-scaling-stroke" }, railG);
    S("path", { d: geo.rail, stroke: "#3b3630", "stroke-width": "4", "stroke-dasharray": "1 5", "vector-effect": "non-scaling-stroke" }, railG);
    S("path", { d: geo.rail, stroke: "#3b3630", "stroke-width": "1.1", "vector-effect": "non-scaling-stroke" }, railG);
    // Freeways: engraved double line (ink casing, amber-paper fill)
    const fwG = S("g", { class: "mv-l-freeways", fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, wc);
    const fwAll = (geo.freeways || []).map(f => f.d).join("");
    const fwCase = S("path", { d: fwAll, stroke: "#3a332a", "vector-effect": "non-scaling-stroke" }, fwG);
    const fwFill = S("path", { d: fwAll, stroke: C.road, "vector-effect": "non-scaling-stroke" }, fwG);
    const fwInter = S("path", { d: (geo.freeways || []).filter(f => f.kind === "i").map(f => f.d).join(""), stroke: "#e4bd78", "vector-effect": "non-scaling-stroke" }, fwG);
    // Heat rings (scored neighbourhoods)
    const heatG = S("g", { class: "mv-l-heat mv-heat" }, wc);
    // Neatline
    S("rect", { x: 0, y: 0, width: MW, height: MH, fill: "none", stroke: C.ink, "stroke-width": "1", "vector-effect": "non-scaling-stroke" }, world);

    // Screen-space overlay
    const ov = S("g", { class: "mv-ov" }, svg);
    const band = S("g", null, ov);
    const bandOut = S("path", { fill: "#fbf9f4", stroke: C.ink, "stroke-width": ".9" }, band);
    const bandKeys = S("path", { fill: C.ink }, band);
    const gratG = S("g", { class: "mv-grat" }, ov);
    const labG = S("g", { class: "mv-l-labels" }, ov);
    const shG = S("g", { class: "mv-l-freeways" }, ov);
    const airG = S("g", { class: "mv-air" }, ov);
    const spiderG = S("g", null, ov);
    const mkG = S("g", null, ov);

    // UI chrome
    const cart = H("div", "mv-card mv-cart", el);
    const compass = H("div", "mv-compass", el, compassSVG());
    const ctl = H("div", "mv-card mv-ctl", el);
    ctl.setAttribute("role", "group");
    ctl.setAttribute("aria-label", "Zoom");
    const btn = (label, html) => { const b = H("button", null, ctl, html); b.type = "button"; b.setAttribute("aria-label", label); b.title = label; return b; };
    const bIn = btn("Zoom in", "+"), bOut = btn("Zoom out", "−");
    const bReset = btn("Fit all listings", `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 5.5V2h3.5M10.5 2H14v3.5M14 10.5V14h-3.5M5.5 14H2v-3.5"/><circle cx="8" cy="8" r="1.6"/></svg>`);
    const scaleBox = H("div", "mv-scale", el);
    const credit = H("div", "mv-credit", el);
    credit.textContent = geo.credits || "";
    credit.title = geo.credits || "";
    const legend = H("details", "mv-card mv-legend", el);
    const tip = H("div", "mv-card mv-tip", el);
    tip.setAttribute("aria-hidden", "true");
    const live = H("div", "mv-sr", el);
    live.setAttribute("aria-live", "polite");
    const empty = H("div", "mv-card mv-empty", el);
    empty.hidden = true;

    const isSmall = () => el.clientWidth < 720;
    const chrome = [cart, compass, ctl, legend, scaleBox];
    let legendInit = false;
    legend.addEventListener("toggle", () => { if (legendInit) lsSet("mv-legend-open", legend.open); frame(); });

    /* ---------- state ---------- */
    const V = { k: 0.4, x: 0, y: 0 };
    let cw = 0, ch = 0, kMin = 0.1, kFit = 0.4;
    const kMax = 18;
    let ctx = null, pts = [], fitted = false, raf = 0, lastK = -1, anim = null;
    let clusters = [], sig = "", spider = null, hotKey = null;
    const areaInfo = [];

    // Freeway shield candidates
    const fwy = (geo.freeways || []).map((f, fi) => {
      const lines = parseD(f.d).map(l => ({ l, cum: measure(l) })).filter(o => o.cum[o.cum.length - 1] > 20);
      return { ref: String(f.ref), kind: f.kind, fi, lines, label: f.label, off: (fi * 37) % 64, mk: shieldMarkup(f.kind, String(f.ref)) };
    });
    const shieldCache = new Map();
    function shieldNode(f, key) {
      let g = shieldCache.get(key);
      if (!g) {
        g = S("g", { class: "mv-shield" }, shG);
        g.innerHTML = f.mk.svg;
        S("title", null, g).textContent = (f.kind === "i" ? "Interstate " : f.kind === "us" ? "US Route " : "State Route ") + f.ref;
        shieldCache.set(key, g);
      }
      return g;
    }

    // Labels
    const labels = [];
    const mkText = (cls, txt, g) => { const t = S("text", { class: cls + " mv-halo", "text-anchor": "middle" }, g || labG); t.textContent = txt; return t; };
    const MAJOR = new Set(["Downtown", "Long Beach", "Santa Ana", "Irvine", "Pasadena", "Santa Monica", "Anaheim", "Hollywood"]);
    for (const p of geo.places || []) {
      if (p.xy[0] < 0 || p.xy[1] < 0 || p.xy[0] > MW || p.xy[1] > MH) continue;
      const major = MAJOR.has(p.name);
      const fs = major ? 13.5 : 12, ls = major ? 0.18 : 0.16;
      labels.push({ kind: "place", wx: p.xy[0], wy: p.xy[1], dy: -9, pri: major ? 2 : 3, el: mkText("mv-place" + (major ? " major" : ""), p.name),
        w: p.name.length * fs * (0.7 + ls) + 6, h: fs + 4, dot: true });
    }
    const dotsG = S("g", null, labG);
    for (const l of labels) l.dotEl = S("circle", { r: 1.9, fill: C.ink, stroke: "#f8f5ec", "stroke-width": "1.2" }, dotsG);
    for (const w of WATER) {
      const [x, y] = proj(w.lng, w.lat), big = /big/.test(w.cls), reg = /region/.test(w.cls);
      const fs = big ? 17 : reg ? 15 : 13, lsp = big ? 0.6 : reg ? 0.55 : 0.32;
      labels.push({ kind: reg ? "region" : "water", wx: x, wy: y, dy: 0, pri: reg ? 9 : 6, maxZ: w.maxZ, el: mkText("mv-" + w.cls, reg ? w.t.toUpperCase() : w.t),
        w: w.t.length * fs * ((reg ? 0.72 : 0.5) + lsp), h: fs + 4 });
    }
    // Excluded label at the centroid of the excluded area's largest ring
    {
      const rings = parseD(geo.excluded);
      let best = null, ba = 0;
      for (const r of rings) { let a = 0; for (let i = 1; i < r.length; i++) a += r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1]; if (Math.abs(a) > ba) { ba = Math.abs(a); best = r; } }
      if (best) {
        let sx = 0, sy = 0; for (const p of best) { sx += p[0]; sy += p[1]; }
        const t = "Ruled out · South Bay";
        labels.push({ kind: "excl", wx: sx / best.length, wy: sy / best.length + 40, dy: 0, pri: 2.5, el: mkText("mv-excl", t, S("g", { class: "mv-l-excluded" }, labG)), w: t.length * 9.5 * 0.75 + 8, h: 13 });
      }
    }
    // Airports
    const airs = [];
    for (const a of geo.airports || []) {
      if (a.xy[0] < 0 || a.xy[1] < 0 || a.xy[0] > MW || a.xy[1] > MH) continue;
      const g = S("g", { class: "mv-airport" }, airG);
      g.innerHTML = `<circle r="10.5" fill="#fbf9f4" stroke="${C.ink}" stroke-width=".9"/><circle r="8.3" fill="none" stroke="${C.ink}" stroke-width=".4"/>` +
        `<path d="${PLANE}" fill="${C.ink}" transform="translate(-7.2 -7.2) scale(.6)"/><text x="15" y="3.6" class="mv-halo">${esc(a.code)}</text>`;
      S("title", null, g).textContent = a.code + " airport";
      airs.push({ wx: a.xy[0], wy: a.xy[1], el: g });
    }

    /* ---------- view math ---------- */
    const toScreen = (wx, wy) => [wx * V.k + V.x, wy * V.k + V.y];
    function constrain(v) {
      const k = clamp(v.k, kMin, kMax);
      return { k, x: clamp(v.x, cw * 0.5 - MW * k, cw * 0.5), y: clamp(v.y, ch * 0.5 - MH * k, ch * 0.5) };
    }
    function fitBox(x0, y0, x1, y1, pad) {
      const pl = pad.l, pr = pad.r, pt = pad.t, pb = pad.b;
      const bw = Math.max(x1 - x0, 1), bh = Math.max(y1 - y0, 1);
      const k = clamp(Math.min((cw - pl - pr) / bw, (ch - pt - pb) / bh), kMin, kMax);
      return constrain({ k, x: pl + (cw - pl - pr - bw * k) / 2 - x0 * k, y: pt + (ch - pt - pb - bh * k) / 2 - y0 * k });
    }
    const pads = () => isSmall() ? { l: 8, r: 8, t: 96, b: 64 } : { l: 290, r: 90, t: 50, b: 50 };
    function homeView() {
      const p = pts.length ? pts : [];
      if (!p.length) return fitBox(0, 0, MW, MH, pads());
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of p) { x0 = Math.min(x0, q.wx); y0 = Math.min(y0, q.wy); x1 = Math.max(x1, q.wx); y1 = Math.max(y1, q.wy); }
      const m = 40;
      return fitBox(x0 - m, y0 - m, x1 + m, y1 + m, pads());
    }
    function measureBox() {
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return false;
      const changed = r.width !== cw || r.height !== ch;
      cw = r.width; ch = r.height;
      kFit = Math.min(cw / MW, ch / MH);
      kMin = kFit * 0.85;
      return changed;
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
    function setView(v) { Object.assign(V, constrain(v)); schedule(); }
    function stopAnim() { if (anim) { cancelAnimationFrame(anim); anim = null; } }
    function animateTo(target, dur) {
      stopAnim();
      target = constrain(target);
      if (reduced() || !dur) { setView(target); return; }
      const a = { ...V }, t0 = performance.now();
      // Interpolate the screen-centre world point linearly and the zoom geometrically.
      const ca = [(cw / 2 - a.x) / a.k, (ch / 2 - a.y) / a.k], cb = [(cw / 2 - target.x) / target.k, (ch / 2 - target.y) / target.k];
      const step = now => {
        const t = clamp((now - t0) / dur, 0, 1), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const k = a.k * Math.pow(target.k / a.k, e);
        const cx = ca[0] + (cb[0] - ca[0]) * e, cy = ca[1] + (cb[1] - ca[1]) * e;
        Object.assign(V, { k, x: cw / 2 - cx * k, y: ch / 2 - cy * k });
        frame();
        anim = t < 1 ? requestAnimationFrame(step) : null;
        if (t >= 1) setView(target);
      };
      anim = requestAnimationFrame(step);
    }
    function zoomAt(px, py, f, dur) {
      const k = clamp(V.k * f, kMin, kMax), r = k / V.k;
      const target = { k, x: px - (px - V.x) * r, y: py - (py - V.y) * r };
      if (!dur || reduced()) { stopAnim(); setView(target); return; }
      stopAnim();
      const a = { ...V }, t0 = performance.now();
      const step = now => {
        const t = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - t, 3);
        const kk = a.k * Math.pow(k / a.k, e), rr = kk / a.k;
        Object.assign(V, constrain({ k: kk, x: px - (px - a.x) * rr, y: py - (py - a.y) * rr }));
        frame();
        anim = t < 1 ? requestAnimationFrame(step) : null;
      };
      anim = requestAnimationFrame(step);
    }

    /* ---------- clustering ---------- */
    function computeClusters() {
      const R = (isSmall() ? 26 : 28) / V.k, R2 = R * R, n = pts.length;
      const used = new Uint8Array(n), out = [];
      for (let i = 0; i < n; i++) {
        if (used[i]) continue;
        used[i] = 1;
        const mem = [pts[i]];
        for (let j = i + 1; j < n; j++) {
          if (used[j]) continue;
          const dx = pts[j].wx - pts[i].wx, dy = pts[j].wy - pts[i].wy;
          if (dx * dx + dy * dy < R2) { used[j] = 1; mem.push(pts[j]); }
        }
        let sx = 0, sy = 0; for (const m of mem) { sx += m.wx; sy += m.wy; }
        out.push({ mem, wx: sx / mem.length, wy: sy / mem.length, key: mem.map(m => m.id).sort().join("|") });
      }
      // Merge clusters whose bubbles would still overlap.
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j]; if (!a || !b) continue;
        const ra = a.mem.length > 1 ? 13 + Math.min(8, Math.sqrt(a.mem.length) * 1.9) : 9, rb = b.mem.length > 1 ? 13 + Math.min(8, Math.sqrt(b.mem.length) * 1.9) : 9;
        if (Math.hypot(a.wx - b.wx, a.wy - b.wy) * V.k < ra + rb - 2) {
          const mem = a.mem.concat(b.mem); let sx = 0, sy = 0; for (const m of mem) { sx += m.wx; sy += m.wy; }
          out[i] = { mem, wx: sx / mem.length, wy: sy / mem.length, key: mem.map(m => m.id).sort().join("|") }; out[j] = null;
        }
      }
      return out.filter(Boolean).sort((a, b) => a.wy - b.wy);
    }
    function nearestArea(wx, wy) {
      let best = null, bd = Infinity;
      for (const a of areaInfo) { const d = Math.hypot(a.wx - wx, a.wy - wy); if (d < bd) { bd = d; best = a; } }
      return best && bd < 90 ? best : null;
    }
    function buildMarkers() {
      const active = document.activeElement, activeKey = active && active.getAttribute && active.getAttribute("data-key");
      mkG.textContent = ""; spiderG.textContent = "";
      for (const c of clusters) {
        if (spider && spider.key === c.key) { buildSpider(c); continue; }
        const g = S("g", { class: "mv-mk", tabindex: "0", role: "button", "data-key": c.key }, mkG);
        c.el = g;
        if (c.mem.length === 1) {
          const p = c.mem[0];
          g.innerHTML = markerMarkup(p.v);
          g.setAttribute("aria-label", `${p.b.name}. ${VLABEL[p.v]}. Rent ${p.rent == null ? "not listed" : ctx.money(p.rent)}. ${p.b.sqft ? p.b.sqft + " square feet" : "Size not confirmed"}. Open details.`);
          g.setAttribute("data-listing-pin", p.id);
        } else {
          const counts = { all: 0, check: 0, fail: 0 };
          for (const m of c.mem) counts[m.v] = (counts[m.v] || 0) + 1;
          const cm = clusterMarkup(counts, c.mem.length);
          g.innerHTML = cm.svg;
          c.counts = counts;
          const na = nearestArea(c.wx, c.wy);
          c.near = na ? na.short : "";
          g.setAttribute("aria-label", `${c.mem.length} listings${c.near ? " near " + c.near : ""}: ${counts.all} meet everything, ${counts.check} need checks, ${counts.fail} fail. Press Enter to zoom in.`);
          g.setAttribute("data-cluster", c.mem.length);
        }
      }
      // invisible hit area: a finger-sized target around every marker (larger on touch screens, see .mv-hit)
      for (const g of mkG.querySelectorAll(".mv-mk")) g.insertAdjacentHTML("afterbegin", '<circle class="mv-hit" r="13" fill="transparent"/>');
      if (activeKey) { const back = mkG.querySelector(`[data-key="${CSS.escape(activeKey)}"]`); if (back) back.focus({ preventScroll: true }); }
    }
    function buildSpider(c) {
      const n = c.mem.length, rad = Math.max(30, 13 + n * 4.2);
      c.el = null;
      c.spider = c.mem.map((m, i) => {
        const a = -Math.PI / 2 + i * 2 * Math.PI / n;
        return { m, dx: Math.cos(a) * rad, dy: Math.sin(a) * rad };
      });
      const legs = S("path", { fill: "none", stroke: C.ink, "stroke-width": ".8", "stroke-opacity": ".6", "stroke-dasharray": "2 2" }, spiderG);
      const hub = S("circle", { r: 3.2, fill: C.ink, stroke: "#f8f5ec", "stroke-width": "1.4" }, spiderG);
      c.legs = legs; c.hub = hub;
      for (const s of c.spider) {
        const g = S("g", { class: "mv-mk", tabindex: "0", role: "button", "data-key": s.m.id, "data-listing-pin": s.m.id }, mkG);
        g.innerHTML = markerMarkup(s.m.v);
        g.setAttribute("aria-label", `${s.m.b.name}. ${VLABEL[s.m.v]}. Rent ${s.m.rent == null ? "not listed" : ctx.money(s.m.rent)}. Open details.`);
        s.el = g;
      }
    }
    function positionMarkers() {
      for (const c of clusters) {
        const [x, y] = toScreen(c.wx, c.wy);
        if (c.spider) {
          let d = "";
          for (const s of c.spider) { s.el.setAttribute("transform", `translate(${(x + s.dx).toFixed(1)} ${(y + s.dy).toFixed(1)})`); d += `M${x.toFixed(1)} ${y.toFixed(1)}l${s.dx.toFixed(1)} ${s.dy.toFixed(1)}`; }
          c.legs.setAttribute("d", d); c.hub.setAttribute("cx", x); c.hub.setAttribute("cy", y);
        } else if (c.el) c.el.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      }
      if (tipFor) placeTip();
    }

    /* ---------- labels, shields, frame ---------- */
    function layout() {
      const k = V.k, z = k / kFit, M = 30, placed = [];
      const fits = (x, y, w, h) => {
        const r = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
        if (r[0] < 8 || r[1] < 8 || r[2] > cw - 8 || r[3] > ch - 8) return false;
        for (const q of placed) if (r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) return false;
        placed.push(r); return true;
      };
      const inView = (x, y, m) => x > -m && y > -m && x < cw + m && y < ch + m;
      // reserve chrome
      for (const node of chrome) if (node.offsetParent) placed.push([node.offsetLeft - 4, node.offsetTop - 4, node.offsetLeft + node.offsetWidth + 4, node.offsetTop + node.offsetHeight + 4]);
      for (const c of clusters) {
        const [x, y] = toScreen(c.wx, c.wy), r = c.spider ? 0 : c.mem.length > 1 ? 16 + Math.min(8, Math.sqrt(c.mem.length) * 1.9) : 11;
        if (r && inView(x, y, 30)) placed.push([x - r, y - r, x + r, y + r]);
      }
      // airports first
      for (const a of airs) {
        const [x, y] = toScreen(a.wx, a.wy);
        const show = inView(x, y, 20) && fits(x + 10, y, 50, 24);
        a.el.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        a.el.style.display = show ? "" : "none";
      }
      const showLabels = layersOn.labels;
      // places and area names by priority
      const order = labels.slice().sort((a, b) => a.pri - b.pri);
      for (const l of order) {
        if (!showLabels) break;
        const [x, y] = toScreen(l.wx, l.wy);
        let ok = inView(x, y, 60) && !(l.maxZ && z > l.maxZ) && !(l.minZ && z < l.minZ);
        if (l.kind === "area" && !layersOn.heat && false) ok = false;
        if (l.kind === "excl" && !layersOn.excluded) ok = false;
        let tx = x, ty = y + (l.dy || 0) + (l.kind === "area" ? -(l.rw * k + 8) : 0), anchor = "middle";
        if (ok && l.kind === "place") {
          // try above, below, right, left of the town dot
          const opts = [[0, -9, "middle", 0], [0, 17, "middle", 0], [7, 4, "start", l.w / 2], [-7, 4, "end", -l.w / 2]];
          ok = false;
          for (const [ox, oy, an, cx] of opts) if (fits(x + cx + ox, y + oy - 4, l.w, l.h)) { tx = x + ox; ty = y + oy; anchor = an; ok = true; break; }
        } else if (ok && l.kind !== "region") ok = fits(x, ty - 4, l.w, l.h);
        else if (ok) ok = fits(x, ty - 5, l.w * 0.6, l.h);
        l.el.style.display = ok ? "" : "none";
        if (ok) { l.el.setAttribute("x", tx.toFixed(1)); l.el.setAttribute("y", ty.toFixed(1)); if (l.kind === "place") l.el.setAttribute("text-anchor", anchor); }
        if (l.dotEl) { l.dotEl.style.display = ok ? "" : "none"; if (ok) { l.dotEl.setAttribute("cx", x.toFixed(1)); l.dotEl.setAttribute("cy", y.toFixed(1)); } }
      }
      // shields
      const used = new Set();
      if (layersOn.freeways) {
        const S0 = isSmall() ? 200 : 250, sp = Math.pow(2, Math.ceil(Math.log2(S0 / k)));
        const cand = [];
        for (const f of fwy) {
          for (let li = 0; li < f.lines.length; li++) {
            const { l, cum } = f.lines[li], len = cum[cum.length - 1];
            const start = Math.ceil((sp * 0.25 - f.off) / sp);
            for (let n = Math.max(0, start); n * sp + f.off <= len - sp * 0.15; n++) {
              const s = n * sp + f.off, p = at(l, cum, s);
              if (p[0] < 4 || p[1] < 4 || p[0] > MW - 4 || p[1] > MH - 4) continue;
              const [x, y] = toScreen(p[0], p[1]);
              if (!inView(x, y, -14)) continue;
              cand.push({ f, key: f.fi + ":" + li + ":" + n + ":" + sp, x, y, pri: f.kind === "i" ? 0 : f.kind === "us" ? 1 : 2 });
            }
          }
        }
        cand.sort((a, b) => a.pri - b.pri);
        const perF = new Map();
        for (const c of cand) {
          if (!fits(c.x, c.y, c.f.mk.w + 8, 30)) continue;
          // same-number shields need generous spacing
          const prev = perF.get(c.f.ref) || [];
          if (prev.some(p => Math.hypot(p[0] - c.x, p[1] - c.y) < S0 * 0.8)) { placed.pop(); continue; }
          prev.push([c.x, c.y]); perF.set(c.f.ref, prev);
          const g = shieldNode(c.f, c.key);
          g.setAttribute("transform", `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`);
          g.style.display = ""; used.add(c.key);
        }
        // Short freeways: fall back to the precomputed label point.
        for (const f of fwy) {
          if (perF.has(f.ref) || !f.label) continue;
          const [x, y] = toScreen(f.label[0], f.label[1]);
          if (f.label[1] < 0 || f.label[0] < 0 || !inView(x, y, -14) || !fits(x, y, f.mk.w + 8, 30)) continue;
          const key = f.fi + ":label", g = shieldNode(f, key);
          g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`); g.style.display = ""; used.add(key);
          perF.set(f.ref, [[x, y]]);
        }
      }
      for (const [key, g] of shieldCache) if (!used.has(key)) { if (shieldCache.size > 260) { g.remove(); shieldCache.delete(key); } else g.style.display = "none"; }
    }
    function drawFrame() {
      const x0 = V.x, y0 = V.y, x1 = V.x + MW * V.k, y1 = V.y + MH * V.k, t = 6;
      bandOut.setAttribute("d", `M${x0 - t - 3} ${y0 - t - 3}H${x1 + t + 3}V${y1 + t + 3}H${x0 - t - 3}ZM${x0} ${y0}V${y1}H${x1}V${y0}Z`);
      bandOut.setAttribute("fill-rule", "evenodd");
      // piano keys every 0.05 degrees
      const step = 0.05, sx = MW * V.k / (E - W) * step, sy = MH * V.k / (N - Sb) * step;
      let d = "";
      const lng0 = Math.ceil(W / step) * step;
      let i = Math.round(lng0 / step);
      for (let lng = lng0; lng < E - 1e-9; lng += step, i++) {
        if (i % 2) continue;
        const a = x0 + (lng - W) / (E - W) * MW * V.k, b = Math.min(a + sx, x1);
        if (b < -10 || a > cw + 10) continue;
        d += `M${a.toFixed(1)} ${y0 - t}H${b.toFixed(1)}v${t}H${a.toFixed(1)}ZM${a.toFixed(1)} ${y1}H${b.toFixed(1)}v${t}H${a.toFixed(1)}Z`;
      }
      const lat0 = Math.ceil(Sb / step) * step;
      i = Math.round(lat0 / step);
      for (let lat = lat0; lat < N - 1e-9; lat += step, i++) {
        if (i % 2) continue;
        const b = y0 + (N - lat) / (N - Sb) * MH * V.k, a = Math.max(b - sy, y0);
        if (b < -10 || a > ch + 10) continue;
        d += `M${x0 - t} ${a.toFixed(1)}h${t}V${b.toFixed(1)}h${-t}ZM${x1} ${a.toFixed(1)}h${t}V${b.toFixed(1)}h${-t}Z`;
      }
      bandKeys.setAttribute("d", d);
      // graticule labels, clamped to the viewport edge
      const px01 = MW * V.k / (E - W) * 0.1;
      const lstep = px01 >= 90 ? 0.1 : px01 >= 45 ? 0.2 : 0.5;
      let html = "";
      const ty = clamp(y0 - 12, 13, ch - 6), lx = x0 - 12;
      for (let lng = Math.ceil(W / lstep) * lstep; lng <= E + 1e-9; lng += lstep) {
        const x = x0 + (lng - W) / (E - W) * MW * V.k;
        if (x < 300 * (isSmall() ? 0 : 1) && ty < 200 || x < 20 || x > cw - 110) continue;
        html += `<text x="${x.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" class="mv-halo">${fmtDeg(+lng.toFixed(2), "E", "W")}</text>`;
      }
      for (let lat = Math.ceil(Sb / lstep) * lstep; lat <= N + 1e-9; lat += lstep) {
        const y = y0 + (N - lat) / (N - Sb) * MH * V.k;
        if (y < 40 || y > ch - 60) continue;
        if (lx > 46) html += `<text x="${lx.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="mv-halo">${fmtDeg(+lat.toFixed(2), "N", "S")}</text>`;
        else if (y > (cart.offsetHeight + 30)) html += `<text x="12" y="${(y - 4).toFixed(1)}" text-anchor="start" class="mv-halo">${fmtDeg(+lat.toFixed(2), "N", "S")}</text>`;
      }
      gratG.innerHTML = html;
    }
    let lastScale = "";
    function drawScale() {
      const mpp = MPU / V.k, maxPx = isSmall() ? 110 : 140;
      const nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
      let mi = nice[0];
      for (const n of nice) if (n / mpp <= maxPx) mi = n;
      const w = mi / mpp, key = mi + ":" + w.toFixed(0);
      if (key === lastScale) return;
      lastScale = key;
      const seg = w / 4, lab = v => (Math.round(v * 100) / 100).toString();
      let keys = "";
      for (let i = 0; i < 4; i++) keys += `<rect x="${(i * seg).toFixed(1)}" y="14" width="${seg.toFixed(1)}" height="4" fill="${i % 2 ? "#fbf9f4" : C.ink}"/>`;
      scaleBox.innerHTML = `<svg width="${Math.ceil(w + 40)}" height="24" aria-label="Scale: ${w.toFixed(0)} pixels is ${lab(mi)} miles" role="img">` +
        `<rect x="-0.5" y="13.5" width="${(w + 1).toFixed(1)}" height="5" fill="#fbf9f4" stroke="${C.ink}" stroke-width=".8"/>${keys}` +
        `<text x="0" y="9" text-anchor="middle" class="mv-halo">0</text><text x="${(w / 2).toFixed(1)}" y="9" text-anchor="middle" class="mv-halo">${lab(mi / 2)}</text>` +
        `<text x="${w.toFixed(1)}" y="9" text-anchor="middle" class="mv-halo">${lab(mi)}</text><text x="${(w + 8).toFixed(1)}" y="19" class="mv-halo">MI</text></svg>`;
    }
    function zoomStyles() {
      const k = V.k, z = k / kFit;
      for (const [d, line, erase] of ripples) {
        line.setAttribute("stroke-width", (2 * d / k).toFixed(3));
        erase.setAttribute("stroke-width", ((2 * d - 1.25) / k).toFixed(3));
      }
      wash.setAttribute("stroke-width", (16 / k).toFixed(3));
      defs.querySelector("#mv-rule").setAttribute("patternTransform", `scale(${(1 / k).toFixed(4)})`);
      defs.querySelector("#mv-hatch").setAttribute("patternTransform", `rotate(45) scale(${(1 / k).toFixed(4)})`);
      defs.querySelector("#mv-dots").setAttribute("patternTransform", `scale(${(1 / k).toFixed(4)})`);
      hoods.setAttribute("stroke-opacity", clamp(0.5 + Math.log2(z) * 0.1, 0.5, 0.8).toFixed(2));
      hoods.setAttribute("stroke-width", clamp(0.55 + Math.log2(z) * 0.12, 0.55, 1).toFixed(2));
      const fw = clamp(1.4 + Math.log2(z) * 0.8, 1.4, 5);
      fwCase.setAttribute("stroke-width", (fw + 1.5).toFixed(2));
      fwFill.setAttribute("stroke-width", fw.toFixed(2));
      fwInter.setAttribute("stroke-width", fw.toFixed(2));
      const hz = clamp(1 - Math.log2(Math.max(z, 1)) / 4, 0.25, 1);
      heatG.style.setProperty("--hf1", (0.15 * hz).toFixed(3));
      heatG.style.setProperty("--hf2", (0.11 * hz).toFixed(3));
    }
    // Base layer: rendered crisply at a committed view (B); between commits it is moved with a
    // composited CSS transform so heavy strokes are not re-rasterised every frame.
    const B = { k: 0, x: 0, y: 0 };
    let settleT = 0;
    function commitBase() {
      settleT = 0;
      Object.assign(B, V);
      world.setAttribute("transform", `matrix(${V.k} 0 0 ${V.k} ${V.x + cw * 0.25} ${V.y + ch * 0.25})`);
      base.style.transform = "";
      zoomStyles();
    }
    function moveBase(now) {
      if (now || !B.k) { clearTimeout(settleT); commitBase(); return; }
      const sc = V.k / B.k, tx = V.x + cw * 0.25 - sc * (B.x + cw * 0.25), ty = V.y + ch * 0.25 - sc * (B.y + ch * 0.25);
      base.style.transform = `translate(${tx}px,${ty}px) scale(${sc})`;
      clearTimeout(settleT);
      settleT = setTimeout(() => { if (anim || pinch || (drag && moved)) { moveBase(false); return; } commitBase(); }, 140);
    }
    function frame(commit) {
      raf = 0;
      if (!cw) return;
      moveBase(commit === true);
      bIn.disabled = V.k >= kMax - 1e-6;
      bOut.disabled = V.k <= kMin + 1e-6;
      if (V.k !== lastK) {
        if (spider && Math.abs(Math.log(V.k / spider.k)) > 0.05) spider = null;
        const prev = new Map(clusters.map(c => [c.key, c]));
        clusters = computeClusters();
        const s = clusters.map(c => c.key).join(",") + "#" + (spider ? spider.key : "");
        if (s !== sig) { sig = s; buildMarkers(); }
        else for (const c of clusters) { const o = prev.get(c.key); if (o) { c.el = o.el; c.counts = o.counts; c.near = o.near; c.spider = o.spider; c.legs = o.legs; c.hub = o.hub; } }
        if (tipFor && tipFor.type === "cluster") { const nc = clusters.find(c => c.key === tipFor.c.key); if (nc) tipFor.c = nc; }
        lastK = V.k;
      }
      drawFrame();
      layout();
      positionMarkers();
      drawScale();
    }
    function rebuildAll() { lastK = -1; sig = ""; frame(true); }

    /* ---------- tooltip ---------- */
    let tipFor = null;
    function tipHTML(t) {
      if (t.type === "pin") {
        const p = t.p, b = p.b, sc = ctx.score ? ctx.score(b) : null, ar = p.area ? shortArea(p.area.name) : (b.region || "");
        return `<p class="k">Specimen · ${esc(ar)}</p><p class="n">${esc(b.name)}</p>` +
          `<div class="g"><span><b>${esc(ctx.money(p.rent))}</b><i>per month</i></span><span><b>${b.sqft ? esc(Math.round(b.sqft)) : "—"}</b><i>sq ft</i></span>` +
          `<span><b>${sc == null || isNaN(sc) ? "—" : Math.round(sc)}</b><i>match /100</i></span></div>` +
          `<p class="v" style="color:${VCOL[p.v]}">${VLABEL[p.v]}<span class="hint">${t.touch ? "" : "Click to open"}</span></p>`;
      }
      if (t.type === "cluster") {
        const c = t.c, n = c.mem.length, top = c.mem.slice().sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).slice(0, 4);
        const bar = ["all", "check", "fail"].map(v => c.counts[v] ? `<i style="flex:${c.counts[v]};background:${VCOL[v]}"></i>` : "").join("");
        return `<p class="k">Group${c.near ? " · near " + esc(c.near) : ""}</p><p class="n">${n} specimens</p>` +
          `<div class="bar">${bar}</div><ul>${top.map(m => `<li><span>${esc(m.b.name)}</span><em>${esc(ctx.money(m.rent))}</em></li>`).join("")}${n > 4 ? `<li><em>and ${n - 4} more</em></li>` : ""}</ul>` +
          `<p class="v cnt">${["all", "check", "fail"].map(v => `<span style="color:${VCOL[v]}" title="${VLABEL[v]}">${c.counts[v] || 0}</span>`).join("")}<span class="hint">${t.touch ? "Tap again to zoom" : "Click to zoom in"}</span></p>`;
      }
      const a = t.a, sc = a.score;
      return `<p class="k">Region of the atlas · ${esc(a.a.region || "")}</p><p class="n">${esc(a.a.name)}</p>` +
        `<div class="g" style="grid-template-columns:1fr 1fr"><span><b>${sc == null ? "—" : (Math.round(sc * 10) / 10).toFixed(1)}</b><i>area score / 10</i></span><span><b>${a.count}</b><i>listings shown</i></span></div>` +
        `<p class="v" style="color:${a.color}">Score with your weights<span class="hint">Click for report</span></p>`;
    }
    function showTip(t) {
      tipFor = t; tip.innerHTML = tipHTML(t); tip.classList.add("on"); placeTip();
    }
    function hideTip() { tipFor = null; tip.classList.remove("on"); }
    function placeTip() {
      const t = tipFor; if (!t) return;
      let x, y, r = 12;
      if (t.type === "pin" || t.type === "cluster") {
        const node = t.el; const tr = node && node.getAttribute("transform");
        const m = tr && tr.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
        if (!m) return;
        x = +m[1]; y = +m[2]; r = t.type === "cluster" ? 24 : 14;
      } else { [x, y] = toScreen(t.a.wx, t.a.wy); r = t.a.rw * V.k * 0.7; }
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let lx = x + r + 6, ly = y - h / 2;
      if (lx + w > cw - 10) lx = x - r - 6 - w;
      if (lx < 10) { lx = clamp(x - w / 2, 10, cw - w - 10); ly = y + r + 6; if (ly + h > ch - 10) ly = y - r - 6 - h; }
      ly = clamp(ly, 10, ch - h - 10);
      tip.style.transform = "";
      tip.style.left = lx.toFixed(0) + "px"; tip.style.top = ly.toFixed(0) + "px";
    }
    const findTarget = (node, pt) => {
      const g = node && node.closest && node.closest(".mv-mk");
      if (g) {
        const key = g.getAttribute("data-key");
        for (const c of clusters) {
          if (c.spider) { const s = c.spider.find(s => s.el === g); if (s) return { type: "pin", p: s.m, el: g }; }
          else if (c.el === g) return c.mem.length === 1 ? { type: "pin", p: c.mem[0], el: g } : { type: "cluster", c, el: g };
        }
        void key;
      }
      if (pt && layersOn.heat && node && !(node.closest && node.closest(".mv-card"))) {
        let best = null, bd = Infinity;
        for (const a of areaInfo) {
          const [x, y] = toScreen(a.wx, a.wy), d = Math.hypot(pt[0] - x, pt[1] - y);
          if (d < Math.max(a.rw * V.k, 9) && d < bd) { bd = d; best = a; }
        }
        if (best) return { type: "area", a: best };
      }
      return null;
    };
    function activate(t) {
      if (!t) return;
      if (t.type === "pin") { hideTip(); ctx.openBuilding(t.p.b); return; }
      if (t.type === "area") { hideTip(); ctx.openArea && ctx.openArea(t.a.a); return; }
      const c = t.c;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const m of c.mem) { x0 = Math.min(x0, m.wx); y0 = Math.min(y0, m.wy); x1 = Math.max(x1, m.wx); y1 = Math.max(y1, m.wy); }
      const ext = Math.max(x1 - x0, y1 - y0);
      hideTip();
      if (ext * kMax < 34 || V.k >= kMax * 0.98) {
        spider = { key: c.key, k: V.k }; sig = ""; lastK = -1; frame();
        live.textContent = `${c.mem.length} listings fanned out. Tab through them.`;
        const first = mkG.querySelector(".mv-mk"); if (first && t.kb) first.focus({ preventScroll: true });
        return;
      }
      const pad = Math.max(60, 120 / 1);
      const pd = isSmall() ? { l: 50, r: 70, t: 90, b: 80 } : { l: 300, r: 140, t: pad, b: pad };
      let target = fitBox(x0, y0, x1, y1, pd);
      if (target.k < V.k * 1.6) { // at least a meaningful step in
        const k = Math.min(kMax, V.k * 2.2), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        target = constrain({ k, x: cw / 2 - cx * k, y: ch / 2 - cy * k });
      }
      animateTo(target, 520);
      live.textContent = `Zoomed in on ${c.mem.length} listings${c.near ? " near " + c.near : ""}.`;
    }

    /* ---------- interaction ---------- */
    const pointers = new Map();
    let drag = null, moved = false, pinch = null, downTarget = null;
    const local = e => { const r = svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    svg.addEventListener("pointerdown", e => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      stopAnim();
      pointers.set(e.pointerId, local(e));
      moved = false;
      downTarget = findTarget(e.target, local(e));
      if (pointers.size === 1) drag = { p: local(e), v: { ...V }, id: e.pointerId };
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], v: { ...V } };
        drag = null; moved = true;
        try { for (const id of pointers.keys()) svg.setPointerCapture(id); } catch { /* ignore */ }
      }
    });
    svg.addEventListener("pointermove", e => {
      if (e.pointerType === "mouse" && !pointers.size) {
        const t = findTarget(e.target, local(e));
        const key = t ? (t.type === "area" ? "a" + t.a.i : t.el.getAttribute("data-key")) : null;
        svg.classList.toggle("is-area", !!t);
        if (key !== hotKey) { hotKey = key; if (t) showTip(t); else hideTip(); }
        return;
      }
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, local(e));
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const k = clamp(pinch.v.k * d / pinch.d, kMin, kMax), r = k / pinch.v.k;
        setView({ k, x: m[0] - (pinch.m[0] - pinch.v.x) * r, y: m[1] - (pinch.m[1] - pinch.v.y) * r });
        return;
      }
      if (drag && e.pointerId === drag.id) {
        const p = local(e), dx = p[0] - drag.p[0], dy = p[1] - drag.p[1];
        if (!moved && Math.hypot(dx, dy) > 5) {
          moved = true; svg.classList.add("is-drag"); hideTip();
          try { svg.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        }
        if (moved) setView({ k: drag.v.k, x: drag.v.x + dx, y: drag.v.y + dy });
      }
    });
    const up = e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 1 && !drag) { const [id, p] = [...pointers.entries()][0]; drag = { p, v: { ...V }, id }; }
      if (!pointers.size) {
        svg.classList.remove("is-drag");
        if (e.type === "pointerup" && !moved) {
          const t = findTarget(e.target, local(e)) || null;
          if (t && downTarget && (t.el ? t.el === downTarget.el : t.type === downTarget.type)) {
            if (e.pointerType !== "mouse" && t.type === "pin" && !(tipFor && tipFor.el === t.el)) { showTip({ ...t, touch: true }); }
            else activate(t);
          }
          else if (!t) { hideTip(); if (spider) { spider = null; sig = ""; lastK = -1; frame(); } }
        }
        drag = null;
      }
    };
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
    svg.addEventListener("pointerleave", e => { if (e.pointerType === "mouse" && !pointers.size) { hotKey = null; hideTip(); } });
    svg.addEventListener("wheel", e => {
      e.preventDefault();
      stopAnim();
      const [px, py] = local(e);
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? ch : 1;
      const dy = e.deltaY * unit, f = Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0022));
      zoomAt(px, py, clamp(f, 0.5, 2));
    }, { passive: false });
    svg.addEventListener("dblclick", e => {
      e.preventDefault();
      if (findTarget(e.target, local(e))) return;
      const [px, py] = local(e);
      zoomAt(px, py, e.shiftKey ? 0.5 : 2, 380);
    });
    svg.addEventListener("keydown", e => {
      const t = findTarget(e.target);
      if (t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); activate({ ...t, kb: true }); return; }
      if (e.key === "Escape") { hideTip(); if (spider) { spider = null; sig = ""; lastK = -1; frame(); } return; }
      const step = 90;
      const acts = {
        ArrowLeft: () => animateTo({ ...V, x: V.x + step }, 160), ArrowRight: () => animateTo({ ...V, x: V.x - step }, 160),
        ArrowUp: () => animateTo({ ...V, y: V.y + step }, 160), ArrowDown: () => animateTo({ ...V, y: V.y - step }, 160),
        "+": () => zoomAt(cw / 2, ch / 2, 1.6, 260), "=": () => zoomAt(cw / 2, ch / 2, 1.6, 260),
        "-": () => zoomAt(cw / 2, ch / 2, 1 / 1.6, 260), "_": () => zoomAt(cw / 2, ch / 2, 1 / 1.6, 260),
        "0": () => animateTo(homeView(), 520),
      };
      if (acts[e.key] && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); acts[e.key](); }
    });
    svg.addEventListener("focusin", e => { const t = findTarget(e.target); if (t && t.type !== "area") { showTip(t); hotKey = t.el.getAttribute("data-key"); } });
    svg.addEventListener("focusout", e => { if (!svg.contains(e.relatedTarget)) { hideTip(); hotKey = null; } });
    bIn.addEventListener("click", () => zoomAt(cw / 2, ch / 2, 2, 340));
    bOut.addEventListener("click", () => zoomAt(cw / 2, ch / 2, 0.5, 340));
    bReset.addEventListener("click", () => { spider = null; animateTo(homeView(), 600); });

    // Layer toggles
    function applyLayers() { for (const [k] of LAYERS) el.classList.toggle("no-" + k, !layersOn[k]); }
    applyLayers();

    // Resize
    const ro = new ResizeObserver(() => {
      if (!el.isConnected) return;
      const old = { cw, ch };
      if (!measureBox()) return;
      if (!fitted) { Object.assign(V, homeView()); fitted = true; }
      else if (old.cw) { // keep the centre point
        const cx = (old.cw / 2 - V.x) / V.k, cy = (old.ch / 2 - V.y) / V.k;
        Object.assign(V, constrain({ k: V.k, x: cw / 2 - cx * V.k, y: ch / 2 - cy * V.k }));
      }
      rebuildAll();
    });
    ro.observe(el);

    /* ---------- data update ---------- */
    function update(list, c) {
      ctx = c;
      el.classList.toggle("mv-noanim", reduced());
      const areas = (c.areas || []).filter(a => a && a.lat != null && a.lng != null);
      const byId = new Map(areas.map(a => [a.id, a]));
      pts = [];
      let unmapped = 0;
      for (const b of list || []) {
        if (b.lat == null || b.lng == null || isNaN(b.lat) || isNaN(b.lng)) { unmapped++; continue; }
        const [wx, wy] = proj(+b.lng, +b.lat);
        const sc = c.score ? c.score(b) : null;
        pts.push({ b, id: String(b.id || b.name), wx, wy, v: c.verdict(b), rent: c.rentOf(b), score: sc, area: byId.get(b.area_id) || null });
      }
      // Seeds for clustering: best match first, so top specimens surface as singles.
      pts.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

      // Heat rings and area labels
      heatG.textContent = "";
      areaInfo.length = 0;
      for (let i = labels.length - 1; i >= 0; i--) if (labels[i].kind === "area") { const e = labels[i].el, wrap = e.parentNode; (wrap && wrap.classList && wrap.classList.contains("mv-l-heat-lab") ? wrap : e).remove(); labels.splice(i, 1); }
      const scores = areas.map(a => c.areaScore ? c.areaScore(a) : null).filter(v => v != null && !isNaN(v));
      const lo = scores.length ? Math.min(...scores) : 0, hi = scores.length ? Math.max(...scores) : 10;
      const counts = new Map();
      for (const p of pts) if (p.area) counts.set(p.area.id, (counts.get(p.area.id) || 0) + 1);
      const rw = 0.85 / MPU;
      areas.forEach((a, i) => {
        const [wx, wy] = proj(+a.lng, +a.lat), sc = c.areaScore ? c.areaScore(a) : null;
        const t = sc == null ? 0.5 : hi > lo ? (sc - lo) / (hi - lo) : 0.5, col = sc == null ? C.muted : scoreColor(t);
        const info = { a, i, wx, wy, rw, score: sc, color: col, count: counts.get(a.id) || 0, short: shortArea(a.name) };
        areaInfo.push(info);
        const g = S("g", { "data-area": i }, heatG);
        S("circle", { cx: wx, cy: wy, r: rw, fill: col, style: "fill-opacity:var(--hf1,.13)", stroke: col, "stroke-width": "1.1", "stroke-opacity": ".85", "vector-effect": "non-scaling-stroke" }, g);
        S("circle", { cx: wx, cy: wy, r: rw * 0.7, fill: col, style: "fill-opacity:var(--hf2,.1)", stroke: col, "stroke-width": ".7", "stroke-opacity": ".6", "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, g);
        S("circle", { cx: wx, cy: wy, r: rw * 0.42, fill: col, style: "fill-opacity:var(--hf2,.12)", stroke: col, "stroke-width": ".5", "stroke-opacity": ".45", "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, g);
        
        const short = info.short;
        labels.push({ kind: "area", wx, wy, rw, dy: 0, pri: 4, minZ: 2.4, el: mkText("mv-area", short, S("g", { class: "mv-l-heat-lab" }, labG)), w: short.length * 13 * 0.5 + 8, h: 15 });
      });

      // Cartouche
      cart.innerHTML = `<p class="mv-kicker">Plate I · The search atlas</p><h3>Los Angeles <em>to</em> Orange County</h3>` +
        `<p class="mv-sub"><b>${pts.length}</b> specimen${pts.length === 1 ? "" : "s"} mapped${unmapped ? ` · <b>${unmapped}</b> without coordinates` : ""}</p>`;
      const det = H("details", "mv-layers", cart);
      det.open = !isSmall() && lsGet("mv-layers-open", false);
      det.addEventListener("toggle", () => { lsSet("mv-layers-open", det.open); frame(); });
      const sum = H("summary", null, det);
      const sumTxt = () => { sum.innerHTML = `Layers <span style="color:var(--mv-muted);letter-spacing:.08em">· ${LAYERS.filter(([k]) => layersOn[k]).length} of ${LAYERS.length} on</span>`; };
      sumTxt();
      for (const [k, label] of LAYERS) {
        const lab = H("label", "mv-tog", det);
        const inp = H("input", null, lab); inp.type = "checkbox"; inp.checked = !!layersOn[k];
        H("span", null, lab).textContent = label;
        inp.addEventListener("change", () => { layersOn[k] = inp.checked; lsSet("mv-layers-v1", layersOn); applyLayers(); sumTxt(); hideTip(); lastK = -1; frame(); });
      }

      // Legend
      const mk = v => `<svg width="22" height="22" viewBox="-11 -11 22 22">${markerMarkup(v, 5.4).replace('class="mv-ring"', 'opacity="0"')}</svg>`;
      const cl = clusterMarkup({ all: 2, check: 3, fail: 1 }, 6);
      const sh = (kind, ref) => { const m = shieldMarkup(kind, ref); return `<svg width="24" height="22" viewBox="-14 -13 28 26" class="mv-shield">${m.svg}</svg>`; };
      const item = (icon, label) => `<span class="mv-li">${icon}<span>${label}</span></span>`;
      legend.innerHTML = `<summary>Legend</summary>` +
        `<p class="mv-lh">Listings</p><div class="mv-lrow">${item(mk("all"), "Meets everything")}${item(mk("check"), "Needs checks")}${item(mk("fail"), "Fails a requirement")}` +
        item(`<svg width="24" height="24" viewBox="-12 -12 24 24"><g transform="scale(.56)">${cl.svg.replace('class="mv-ring"', 'opacity="0"')}</g></svg>`, "Group · click to zoom") + `</div>` +
        `<p class="mv-lh">Neighborhood score <span>(your weights)</span></p><div class="mv-ramp" aria-hidden="true"></div><div class="mv-ramp-l"><span>${scores.length ? lo.toFixed(1) : "—"} lower</span><span>higher ${scores.length ? hi.toFixed(1) : "—"}</span></div>` +
        `<div class="mv-lrow" style="margin-top:6px">${item(`<svg width="24" height="14" viewBox="0 0 24 14"><defs><pattern id="mv-lg-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><path d="M0 0V4" stroke="${C.verm}" stroke-width=".9" stroke-opacity=".6"/></pattern></defs><path d="M.5 .5H23.5V13.5H.5Z" fill="url(#mv-lg-hatch)" stroke="${C.verm}" stroke-dasharray="3 2"/></svg>`, "South Bay · ruled out")}</div>` +
        `<p class="mv-lh">Symbols</p><div class="mv-lrow two">` +
        item(sh("i", "5"), "Interstate") + item(sh("us", "101"), "US route") + item(sh("ca", "91"), "State route") +
        item(`<svg width="24" height="22" viewBox="-12 -11 24 22"><circle r="9.5" fill="#fbf9f4" stroke="${C.ink}" stroke-width=".9"/><path d="${PLANE}" fill="${C.ink}" transform="translate(-6.6 -6.6) scale(.55)"/></svg>`, "Airport") +
        item(`<svg width="24" height="8" viewBox="0 0 24 8"><path d="M0 4H24" stroke="#3b3630" stroke-width="1.1"/><path d="M1 4H24" stroke="#3b3630" stroke-width="4" stroke-dasharray="1 5"/></svg>`, "Rail") +
        item(`<svg width="24" height="8" viewBox="0 0 24 8"><path d="M0 4H24" stroke="#4a4339" stroke-width="1.3" stroke-dasharray="7 3 1.5 3"/></svg>`, "County line") + `</div>`;
      legend.querySelectorAll("summary").forEach(s => s.setAttribute("aria-label", "Legend"));

      empty.hidden = pts.length > 0;
      empty.textContent = list && list.length ? "None of the matching listings have map coordinates." : "No listings match the current filters.";

      measureBox();
      if (!legendInit && cw) { legend.open = !isSmall() && lsGet("mv-legend-open", true); legendInit = true; }
      if (!fitted && cw) { Object.assign(V, homeView()); fitted = true; }
      spider = null; hideTip();
      rebuildAll();
      // If a filter change leaves nothing in view, bring the remaining listings into frame.
      if (fitted && pts.length && !pts.some(q => { const [x, y] = toScreen(q.wx, q.wy); return x > 0 && y > 0 && x < cw && y < ch; })) animateTo(homeView(), 520);
    }

    return { el, update, geo, home: () => animateTo(homeView(), 0), _state: () => ({ ...V, kFit, kMin, kMax, cw, ch, clusters: clusters.map(c => c.mem.length) }) };
  }

  let inst = null;
  window.MapView = {
    render(root, list, ctx) {
      injectCSS();
      if (!inst || inst.geo !== ctx.geo) inst = create(ctx.geo);
      root.appendChild(inst.el);
      inst.update(list, ctx);
      return inst.el;
    },
    _debug: () => inst && inst._state(),
  };
})();
