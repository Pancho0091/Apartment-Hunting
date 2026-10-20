(() => {
  /* ---------------- Facts from the renewal letter ---------------- */
  const JAYNE = { allIn: 2726.83 };
  const DATES = [
    { label: "Renewal offer expires", date: "2026-11-13" },
    { label: "Written notice due", date: "2026-12-30" },
    { label: "Lease ends", date: "2027-01-29" },
  ];
  const RENT_CAP = 2300, MIN_SQFT = 700;

  /* ---------------- Scoring model ---------------- */
  const FACTORS = [
    { key: "drive",  name: "Freeway and traffic",  parts: ["freeway", "traffic"], def: 30 },
    { key: "coffee", name: "Coffee and walking",   parts: ["coffee", "walk"], def: 30 },
    { key: "quiet",  name: "Quiet",                parts: ["quiet"], def: 15 },
    { key: "safety", name: "Safety",               parts: ["safety"], def: 15 },
    { key: "lax",    name: "LAX",                  parts: ["lax"], def: 5 },
    { key: "extras", name: "Nightlife, gyms, errands", parts: ["nightlife", "gyms", "services"], def: 5 },
  ];
  const REP = { key: "rep", name: "Building reviews", def: 20 };
  const REQS = [
    { key: "wd", short: "W/D", name: "In-unit washer/dryer" },
    { key: "ac", short: "Central AC", name: "Central AC" },
    { key: "dw", short: "Dishwasher", name: "Dishwasher" },
    { key: "parking", short: "Parking", name: "Parking" },
    { key: "packages", short: "Packages", name: "Package handling" },
  ];
  const REVIEW_PARTS = [["management", "Management"], ["maintenance", "Maintenance"], ["cleanliness", "Cleanliness"], ["noise", "Noise"], ["security", "Security"], ["pests", "Pests"], ["costs", "Fees and renewals"]];
  const STATUSES = [{ key: "new", name: "Not reviewed" }, { key: "watch", name: "Watching" }, { key: "tour", name: "Tour" }, { key: "applied", name: "Applied" }, { key: "pass", name: "Passed on" }];
  const REGIONS = ["Los Angeles", "Long Beach", "Orange County"];
  const VERDICTS = { all: "Meets everything", check: "Needs checks", fail: "Fails something" };
  const LANDLORDS = { company: "Management company", private: "Private owner" };
  const SORTS = [["score", "Best match"], ["value", "Best match per dollar"], ["rent", "Lowest rent"], ["sqft", "Largest"], ["ppsf", "Lowest $/sq ft"], ["reviews", "Best reviewed"], ["name", "Name"]];
  const VIEWS = [["list", "List"], ["table", "Table"], ["map", "Map"], ["areas", "Neighborhoods"], ["compare", "Compare"], ["add", "Add"]];

  /* ---------------- Persistence for filters ---------------- */
  const ls = {
    get(k, d) { try { const v = localStorage.getItem("aps27b:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("aps27b:" + k, JSON.stringify(v)); return true; } catch { return false; } },
  };
  const DEFAULT_FILTERS = {
    maxRent: RENT_CAP, minSqft: MIN_SQFT, minRep: 0,
    regions: REGIONS.slice(), verdicts: ["all", "check"], landlords: ["company", "private"],
    statuses: ["new", "watch", "tour", "applied"], mustHave: [], hideScam: true, newOnly: false,
  };
  const defaultWeights = Object.fromEntries(FACTORS.concat(REP).map(f => [f.key, f.def]));
  const S = {
    buildings: [], areas: [], areaById: new Map(),
    f: Object.assign({}, DEFAULT_FILTERS, ls.get("filters", {})),
    weights: Object.assign({}, defaultWeights, ls.get("weights", {})),
    q: "", view: ls.get("view", "list"), sort: ls.get("sort", "score"),
    tsort: ls.get("tsort", { key: "score", dir: -1 }),
    compare: new Set(ls.get("compare", [])),
    db: null, canWrite: false, loaded: false,
  };
  const saveF = () => ls.set("filters", S.f);

  /* ---------------- Helpers ---------------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const $ = id => document.getElementById(id);
  const money = n => n == null || isNaN(n) ? "—" : "$" + Math.round(n).toLocaleString("en-US");
  const f1 = n => n == null || isNaN(n) ? "—" : (Math.round(n * 10) / 10).toFixed(1);
  const toast = msg => { const t = h("div", { class: "toast", role: "status", text: msg }); document.body.append(t); setTimeout(() => t.remove(), 2400); };
  const linkOut = (url, text) => url ? h("a", { href: url, target: "_blank", rel: "noopener", text: text || url }) : null;
  const ul = items => items && items.length ? h("ul", null, ...items.map(t => h("li", { text: t }))) : null;

  /* ---------------- Derived values ---------------- */
  const factorScore = (a, f) => { const v = f.parts.map(p => a && a[p] && Number(a[p].score)).filter(x => typeof x === "number" && !isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  function areaScore(a) {
    if (!a) return null; let t = 0, w = 0;
    for (const f of FACTORS) { const s = factorScore(a, f), wt = Number(S.weights[f.key]) || 0; if (s == null || !wt) continue; t += s * wt; w += wt; }
    return w ? t / w : null;
  }
  const repScore = b => b.reviews && typeof b.reviews.reputation_score === "number" ? b.reviews.reputation_score : null;
  function score(b) {
    const a = areaScore(S.areaById.get(b.area_id)), r = repScore(b);
    const wa = FACTORS.reduce((t, f) => t + (Number(S.weights[f.key]) || 0), 0), wr = Number(S.weights.rep) || 0;
    if (a == null) return r; if (r == null || !wr) return a;
    return (a * wa + r * wr) / (wa + wr);
  }
  const rentOf = b => b.effective_rent ?? b.base_rent;
  const allIn = b => { const r = rentOf(b); return r == null ? null : r + (Number(b.parking_fee) || 0); };
  const ppsf = b => rentOf(b) && b.sqft ? rentOf(b) / b.sqft : null;
  const reqVal = (b, k) => { const v = b.req && b.req[k]; return v === "yes" || v === "no" ? v : "unclear"; };
  function verdict(b) {
    const v = REQS.map(r => reqVal(b, r.key)), rent = rentOf(b);
    if ((b.sqft != null && b.sqft < MIN_SQFT) || (rent != null && rent > RENT_CAP) || v.includes("no")) return "fail";
    return v.every(x => x === "yes") ? "all" : "check";
  }
  const regionOf = b => { const a = S.areaById.get(b.area_id); return (a && a.region) || b.region || "Los Angeles"; };
  const areaName = b => { const a = S.areaById.get(b.area_id); return a ? a.name : ""; };
  const isNew = b => b.batch === "new-oct15" || b.batch === "private-oct15";

  function haystack(b) {
    const r = b.reviews || {};
    return [b.name, b.address, areaName(b), regionOf(b), b.notes, b.special, b.packages_detail, b.owner_type, b.platform,
      r.management_company, b.landlord === "private" ? "private owner condo" : "management company", b.hoa_amenities, b.my_note]
      .filter(Boolean).join(" ").toLowerCase();
  }
  function matches(b) {
    const f = S.f, rent = rentOf(b);
    if (!f.regions.includes(regionOf(b))) return false;
    if (!f.verdicts.includes(verdict(b))) return false;
    if (!f.landlords.includes(b.landlord || "company")) return false;
    if (!f.statuses.includes(b.my_status || "new")) return false;
    if (rent != null && rent > f.maxRent) return false;
    if (b.sqft != null && b.sqft < f.minSqft) return false;
    if (f.minRep > 0 && !(repScore(b) >= f.minRep)) return false;
    if (f.hideScam && b.scam_flags) return false;
    if (f.newOnly && !isNew(b)) return false;
    for (const k of f.mustHave) if (reqVal(b, k) !== "yes") return false;
    if (S.q) { const hs = haystack(b); for (const t of S.q.split(/\s+/)) if (t && !hs.includes(t)) return false; }
    return true;
  }
  function sorted(list) {
    const k = S.sort;
    const key = {
      score: b => -(score(b) ?? -1), value: b => -((score(b) ?? 0) / (rentOf(b) || 9e9)), rent: b => rentOf(b) ?? 9e9,
      sqft: b => -(b.sqft ?? 0), ppsf: b => ppsf(b) ?? 9e9, reviews: b => -(repScore(b) ?? -1), name: b => b.name.toLowerCase(),
    }[k] || (b => 0);
    return list.slice().sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : (rentOf(a) ?? 0) - (rentOf(b) ?? 0); });
  }
  const visible = () => sorted(S.buildings.filter(matches));

  /* ---------------- Header ---------------- */
  function renderDates() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    $("dates").replaceChildren(...DATES.map(d => {
      const dt = new Date(d.date + "T00:00:00"), days = Math.round((dt - today) / 864e5);
      return h("div", { class: "date" + (days >= 0 && days <= 21 ? " soon" : "") },
        h("b", { text: days >= 0 ? days + " days" : "Passed" }),
        h("span", { text: d.label + " · " + dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) }));
    }));
    $("baseline").textContent = `Renewing at The Jayne costs ${money(JAYNE.allIn)}/mo all-in`;
  }

  /* ---------------- Filters ---------------- */
  function counts(keyFn) { const m = {}; for (const b of S.buildings) { const k = keyFn(b); m[k] = (m[k] || 0) + 1; } return m; }
  function checkList(id, items, arr, onChange, countMap) {
    return h("div", { class: "checks" }, ...items.map(([key, name]) => {
      const cid = id + "-" + key;
      return h("label", { class: "check", for: cid },
        h("input", { type: "checkbox", id: cid, checked: arr.includes(key), onchange: e => { onChange(key, e.target.checked); } }),
        name, countMap ? h("small", { text: countMap[key] || 0 }) : null);
    }));
  }
  function toggleIn(arr, key, on) { const i = arr.indexOf(key); if (on && i < 0) arr.push(key); if (!on && i >= 0) arr.splice(i, 1); }
  function group(title, open, ...body) {
    return h("details", { class: "fgroup", open: open || null }, h("summary", null, h("span", { class: "label", text: title })), ...body);
  }
  function renderFilters() {
    const f = S.f;
    const rerender = () => { saveF(); renderFilters(); renderResults(); };
    const rentOut = h("output", { for: "f-rent", text: money(f.maxRent) });
    const sqOut = h("output", { for: "f-sqft", text: f.minSqft + " sq ft" });
    const repOut = h("output", { for: "f-rep", text: f.minRep ? f.minRep + "+ / 10" : "Any" });
    const totalW = FACTORS.concat(REP).reduce((t, x) => t + (Number(S.weights[x.key]) || 0), 0) || 1;
    $("filters").replaceChildren(
      h("div", { class: "fgroup" },
        h("div", { class: "fhead" }, h("label", { class: "label", for: "f-rent", text: "Max rent" }), rentOut),
        h("input", { type: "range", id: "f-rent", min: 1500, max: 2600, step: 25, value: f.maxRent, oninput: e => { f.maxRent = +e.target.value; rentOut.textContent = money(f.maxRent); saveF(); renderResults(); } }),
        h("div", { class: "fhead" }, h("label", { class: "label", for: "f-sqft", text: "Min size" }), sqOut),
        h("input", { type: "range", id: "f-sqft", min: 600, max: 1000, step: 10, value: f.minSqft, oninput: e => { f.minSqft = +e.target.value; sqOut.textContent = f.minSqft + " sq ft"; saveF(); renderResults(); } }),
        h("div", { class: "fhead" }, h("label", { class: "label", for: "f-rep", text: "Min review score" }), repOut),
        h("input", { type: "range", id: "f-rep", min: 0, max: 9, step: 1, value: f.minRep, oninput: e => { f.minRep = +e.target.value; repOut.textContent = f.minRep ? f.minRep + "+ / 10" : "Any"; saveF(); renderResults(); } }),
      ),
      group("Must be confirmed", true,
        checkList("mh", REQS.map(r => [r.key, r.name]), f.mustHave, (k, on) => { toggleIn(f.mustHave, k, on); rerender(); }, Object.fromEntries(REQS.map(r => [r.key, S.buildings.filter(b => reqVal(b, r.key) === "yes").length])))),
      group("Region", true,
        checkList("rg", REGIONS.map(r => [r, r]), f.regions, (k, on) => { toggleIn(f.regions, k, on); rerender(); }, counts(regionOf))),
      group("Requirements", true,
        checkList("vd", Object.entries(VERDICTS), f.verdicts, (k, on) => { toggleIn(f.verdicts, k, on); rerender(); }, counts(verdict))),
      group("Landlord", true,
        checkList("ll", Object.entries(LANDLORDS), f.landlords, (k, on) => { toggleIn(f.landlords, k, on); rerender(); }, counts(b => b.landlord || "company")),
        h("label", { class: "check", for: "f-scam" }, h("input", { type: "checkbox", id: "f-scam", checked: f.hideScam, onchange: e => { f.hideScam = e.target.checked; rerender(); } }), "Hide likely scams", h("small", { text: S.buildings.filter(b => b.scam_flags).length })),
        h("label", { class: "check", for: "f-new" }, h("input", { type: "checkbox", id: "f-new", checked: f.newOnly, onchange: e => { f.newOnly = e.target.checked; rerender(); } }), "Only recent finds", h("small", { text: S.buildings.filter(isNew).length }))),
      group("My status", false,
        checkList("st", STATUSES.map(s => [s.key, s.name]), f.statuses, (k, on) => { toggleIn(f.statuses, k, on); rerender(); }, counts(b => b.my_status || "new"))),
      group("Ranking weights", false,
        h("p", { class: "muted", style: { fontSize: ".84rem" }, text: "How much each factor counts toward Best match." }),
        ...FACTORS.concat(REP).map(x => {
          const id = "w-" + x.key, out = h("output", { for: id, text: Math.round((S.weights[x.key] || 0) / totalW * 100) + "%" });
          return h("div", { style: { display: "grid", gap: "2px" } },
            h("div", { class: "fhead" }, h("label", { for: id, style: { fontSize: ".9rem" }, text: x.name }), out),
            h("input", { type: "range", id, min: 0, max: 50, value: S.weights[x.key] || 0, oninput: e => { S.weights[x.key] = +e.target.value; ls.set("weights", S.weights); renderFilters(); renderResults(); } }));
        }),
        h("button", { class: "linkbtn", type: "button", text: "Reset weights", onclick: () => { S.weights = Object.assign({}, defaultWeights); ls.set("weights", S.weights); renderFilters(); renderResults(); } })),
      h("div", { class: "fgroup" }, h("button", { class: "linkbtn", type: "button", text: "Clear all filters", onclick: () => { S.f = JSON.parse(JSON.stringify(DEFAULT_FILTERS)); S.q = ""; $("q").value = ""; rerender(); } })),
    );
  }

  /* ---------------- Toolbar ---------------- */
  function renderToolbar() {
    $("views").replaceChildren(...VIEWS.map(([k, name]) => h("button", { type: "button", "data-view": k, "aria-pressed": S.view === k ? "true" : "false", text: name + (k === "compare" && S.compare.size ? ` (${S.compare.size})` : ""),
      onclick: () => { S.view = k; ls.set("view", k); renderToolbar(); renderResults(); } })));
    $("sort").replaceChildren(...SORTS.map(([v, t]) => h("option", { value: v, selected: S.sort === v, text: t })));
    $("sort").disabled = !["list", "table"].includes(S.view);
  }
  $("sort").addEventListener("change", e => { S.sort = e.target.value; ls.set("sort", S.sort); renderResults(); });
  let qTimer; $("q").addEventListener("input", e => { clearTimeout(qTimer); qTimer = setTimeout(() => { S.q = e.target.value.trim().toLowerCase(); renderResults(); }, 120); });
  $("toggleFilters").addEventListener("click", e => {
    const fl = $("filters"), open = fl.dataset.collapsed === "true";
    fl.dataset.collapsed = open ? "false" : "true"; e.target.setAttribute("aria-expanded", open); e.target.textContent = open ? "Hide filters" : "Show filters";
  });

  /* ---------------- Shared bits ---------------- */
  const reqTags = b => REQS.map(r => { const v = reqVal(b, r.key); return h("span", { class: "tag " + v, title: `${r.name}: ${v === "unclear" ? "not confirmed" : v}`, text: r.short + (v === "unclear" ? "?" : v === "no" ? " ✕" : "") }); });
  const scoreBar = s => h("span", { class: "score", title: "Best-match score out of 10, using your ranking weights" }, "Match", h("i", { style: { "--w": s == null ? "0%" : s * 10 + "%" } }), h("b", { text: f1(s) }));
  function savings(b) { const c = allIn(b); if (c == null) return null; const d = JAYNE.allIn - c; return h("span", { class: "save " + (d >= 0 ? "pos" : "neg"), text: (d >= 0 ? "Saves " : "Costs ") + money(Math.abs(d)) + "/mo" }); }

  /* ---------------- Views ---------------- */
  function renderList(root, list) {
    if (!list.length) return root.append(emptyState());
    root.append(h("div", { class: "list" }, ...list.map((b, i) => {
      const v = verdict(b), rep = repScore(b);
      return h("article", { class: "row" + (v === "fail" ? " fails" : ""), "data-listing": b.id, tabindex: 0, role: "button", "aria-label": "Open " + b.name,
        onclick: () => openBuilding(b), onkeydown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBuilding(b); } } },
        h("span", { class: "rank", text: i + 1 }),
        h("div", { style: { minWidth: 0 } },
          h("h3", { text: b.name }),
          h("p", { class: "where", text: [areaName(b), b.address].filter(Boolean).join(" · ") }),
          h("div", { class: "facts" },
            b.sqft ? h("span", null, h("b", { text: b.sqft }), " sq ft") : null,
            ppsf(b) ? h("span", null, h("b", { text: "$" + ppsf(b).toFixed(2) }), " / sq ft") : null,
            b.year_built ? h("span", null, "Built ", h("b", { text: b.year_built })) : null,
            h("span", null, "Reviews ", h("b", { text: rep == null ? "—" : rep + "/10" })),
            scoreBar(score(b))),
          h("div", { class: "tags" },
            v === "all" ? h("span", { class: "tag dark", text: "Meets everything" }) : null,
            ...reqTags(b),
            b.landlord === "private" ? h("span", { class: "tag", text: "Private owner" }) : null,
            isNew(b) ? h("span", { class: "tag blue", text: "Recent find" }) : null,
            b.scam_flags ? h("span", { class: "tag no", title: b.scam_flags, text: "Scam risk" }) : null,
            b.reviews && b.reviews.dealbreakers ? h("span", { class: "tag no", title: b.reviews.dealbreakers, text: "Review red flags" }) : null,
            b.my_status && b.my_status !== "new" ? h("span", { class: "tag blue", text: STATUSES.find(s => s.key === b.my_status).name }) : null)),
        h("div", { class: "price" },
          h("b", { text: money(rentOf(b)) }),
          b.base_rent && rentOf(b) < b.base_rent ? h("s", { text: money(b.base_rent) + " list" }) : null,
          savings(b)));
    })));
  }

  const TCOLS = [
    { k: "name", t: "Building", v: b => b.name.toLowerCase(), cell: b => h("td", { class: "wrap" }, h("div", { style: { fontWeight: 500 }, text: b.name }), h("div", { class: "muted", style: { fontSize: ".8rem" }, text: areaName(b) })) },
    { k: "rent", t: "Rent", num: true, v: rentOf, cell: b => h("td", { class: "num", text: money(rentOf(b)) }) },
    { k: "sqft", t: "Sq ft", num: true, v: b => b.sqft, cell: b => h("td", { class: "num", text: b.sqft ?? "—" }) },
    { k: "ppsf", t: "$/sq ft", num: true, v: ppsf, cell: b => h("td", { class: "num", text: ppsf(b) ? ppsf(b).toFixed(2) : "—" }) },
    { k: "score", t: "Match", num: true, v: score, cell: b => h("td", { class: "num", text: f1(score(b)) }) },
    { k: "rep", t: "Reviews", num: true, v: repScore, cell: b => h("td", { class: "num", text: repScore(b) ?? "—" }) },
    { k: "req", t: "W/D · AC · DW · P · Pkg", v: b => REQS.filter(r => reqVal(b, r.key) === "yes").length, cell: b => h("td", null, h("span", { class: "dots" }, ...REQS.map(r => h("i", { class: reqVal(b, r.key), title: r.name + ": " + reqVal(b, r.key) })))) },
    { k: "landlord", t: "Landlord", v: b => b.landlord || "company", cell: b => h("td", { text: b.landlord === "private" ? "Private" : "Company" }) },
    { k: "status", t: "Status", v: b => b.my_status || "new", cell: b => h("td", { text: (STATUSES.find(s => s.key === (b.my_status || "new")) || {}).name }) },
  ];
  function renderTable(root, list) {
    if (!list.length) return root.append(emptyState());
    const col = TCOLS.find(c => c.k === S.tsort.key) || TCOLS[4];
    const rows = list.slice().sort((a, b) => { const x = col.v(a), y = col.v(b); if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * S.tsort.dir; });
    root.append(h("div", { class: "tablewrap" }, h("table", null,
      h("thead", null, h("tr", null, ...TCOLS.map(c => h("th", { class: c.num ? "num" : null, scope: "col", "aria-sort": S.tsort.key === c.k ? (S.tsort.dir > 0 ? "ascending" : "descending") : null },
        h("button", { type: "button", onclick: () => { S.tsort = { key: c.k, dir: S.tsort.key === c.k ? -S.tsort.dir : (c.num && c.k !== "rent" && c.k !== "ppsf" ? -1 : 1) }; ls.set("tsort", S.tsort); renderResults(); } },
          c.t + (S.tsort.key === c.k ? (S.tsort.dir > 0 ? " ↑" : " ↓") : "")))))),
      h("tbody", null, ...rows.map(b => h("tr", { tabindex: 0, onclick: () => openBuilding(b), onkeydown: e => { if (e.key === "Enter") openBuilding(b); } }, ...TCOLS.map(c => c.cell(b))))))));
  }

  /* Map: schematic coast, freeways and airports drawn from approximate coordinates. */
  const BOUNDS = { w: -118.62, e: -117.55, s: 33.42, n: 34.17 };
  const KX = Math.cos(33.8 * Math.PI / 180);
  const MW = 1000, MH = Math.round(MW * (BOUNDS.n - BOUNDS.s) / ((BOUNDS.e - BOUNDS.w) * KX));
  const px = (lng, lat) => [((lng - BOUNDS.w) / (BOUNDS.e - BOUNDS.w)) * MW, ((BOUNDS.n - lat) / (BOUNDS.n - BOUNDS.s)) * MH];
  const COAST = [[-118.62,34.035],[-118.56,34.04],[-118.50,34.01],[-118.48,33.99],[-118.46,33.975],[-118.445,33.955],[-118.42,33.91],[-118.41,33.885],[-118.395,33.845],[-118.39,33.81],[-118.42,33.78],[-118.40,33.745],[-118.35,33.73],[-118.30,33.71],[-118.27,33.725],[-118.25,33.75],[-118.21,33.755],[-118.19,33.765],[-118.15,33.76],[-118.11,33.745],[-118.10,33.735],[-118.06,33.71],[-118.00,33.655],[-117.95,33.63],[-117.90,33.60],[-117.87,33.59],[-117.83,33.57],[-117.78,33.54],[-117.74,33.50],[-117.70,33.46],[-117.66,33.43],[-117.62,33.41]];
  const FREEWAYS = [
    ["405", [[-118.475,34.17],[-118.475,34.13],[-118.45,34.06],[-118.42,34.00],[-118.39,33.95],[-118.37,33.92],[-118.33,33.87],[-118.25,33.84],[-118.18,33.81],[-118.10,33.78],[-118.00,33.74],[-117.92,33.70],[-117.87,33.68],[-117.80,33.66],[-117.73,33.635]]],
    ["5", [[-118.25,34.17],[-118.22,34.08],[-118.21,34.03],[-118.17,34.01],[-118.10,33.96],[-118.03,33.91],[-117.95,33.86],[-117.91,33.81],[-117.87,33.77],[-117.83,33.74],[-117.75,33.68],[-117.69,33.62],[-117.66,33.56],[-117.62,33.45]]],
    ["10", [[-118.50,34.015],[-118.40,34.03],[-118.33,34.035],[-118.27,34.03],[-118.22,34.04],[-118.15,34.06],[-117.95,34.07],[-117.55,34.07]]],
    ["110", [[-118.22,34.10],[-118.24,34.07],[-118.27,34.04],[-118.28,34.00],[-118.28,33.93],[-118.285,33.86],[-118.29,33.78],[-118.29,33.73]]],
    ["710", [[-118.17,34.08],[-118.17,33.98],[-118.18,33.90],[-118.20,33.82],[-118.20,33.77]]],
    ["105", [[-118.40,33.93],[-118.28,33.93],[-118.17,33.91],[-118.09,33.91]]],
    ["605", [[-118.02,34.10],[-118.07,33.97],[-118.09,33.86],[-118.10,33.79]]],
    ["101", [[-118.24,34.06],[-118.29,34.08],[-118.33,34.10],[-118.36,34.13],[-118.40,34.16]]],
    ["91", [[-118.29,33.875],[-118.20,33.87],[-118.10,33.87],[-117.98,33.86],[-117.90,33.85],[-117.80,33.86],[-117.70,33.87],[-117.55,33.88]]],
    ["55", [[-117.83,33.84],[-117.84,33.78],[-117.86,33.73],[-117.88,33.68],[-117.91,33.64]]],
    ["22", [[-118.10,33.78],[-117.98,33.775],[-117.90,33.78],[-117.84,33.78]]],
    ["57", [[-117.88,33.78],[-117.88,33.85],[-117.86,33.95]]],
    ["73", [[-117.88,33.665],[-117.84,33.63],[-117.75,33.57],[-117.68,33.53]]],
  ];
  const AIRPORTS = [["LAX", -118.408, 33.942], ["LGB", -118.152, 33.818], ["SNA", -117.868, 33.676]];
  const NS = "http://www.w3.org/2000/svg";
  const s = (tag, attrs, ...kids) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v); for (const c of kids) el.append(c instanceof Node ? c : document.createTextNode(String(c))); return el; };
  const dotColor = v => v === "all" ? "var(--ok)" : v === "check" ? "var(--accent)" : "var(--bad)";
  function renderMap(root, list) {
    if (window.MapView && typeof window.MapView.render === "function") {
      try {
        return window.MapView.render(root, list, { geo: DATA.geo, areas: S.areas, verdict, rentOf, money, score, areaScore, openBuilding, openArea });
      } catch (err) { console.error(err); root.replaceChildren(); }
    }
    const wrap = h("div", { class: "mapwrap" }), tip = h("div", { class: "tip", hidden: true });
    const svg = s("svg", { viewBox: `0 0 ${MW} ${MH}`, role: "img", "aria-label": "Map of matching listings" });
    svg.append(s("rect", { x: 0, y: 0, width: MW, height: MH, fill: "var(--land)" }));
    const ocean = COAST.map(c => px(...c)).concat([px(-117.55, 33.40), px(-118.65, 33.40), px(-118.65, 34.035)]);
    svg.append(s("polygon", { points: ocean.map(p => p.join(",")).join(" "), fill: "var(--water)" }));
    for (const [n, pts] of FREEWAYS) {
      const p = pts.map(c => px(...c));
      svg.append(s("polyline", { points: p.map(q => q.join(",")).join(" "), fill: "none", stroke: "var(--road)", "stroke-width": 2.5, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      const m = p[Math.floor(p.length / 2)];
      svg.append(s("text", { x: m[0] + 6, y: m[1] - 6, "font-size": 12, fill: "var(--faint)", "font-family": "var(--font)" }, n));
    }
    for (const [code, lng, lat] of AIRPORTS) { const [x, y] = px(lng, lat); svg.append(s("text", { x, y, "text-anchor": "middle", "font-size": 12, "font-weight": 600, "letter-spacing": "1", fill: "var(--muted)", "font-family": "var(--font)" }, "✈ " + code)); }
    const show = (e, text) => { const r = wrap.getBoundingClientRect(); tip.textContent = text; tip.hidden = false; tip.style.left = Math.max(4, Math.min(e.clientX - r.left + 12, r.width - 250)) + "px"; tip.style.top = (e.clientY - r.top + 12) + "px"; };
    for (const b of list) {
      if (b.lat == null) continue;
      const [x, y] = px(b.lng, b.lat), v = verdict(b);
      const c = s("circle", { cx: x, cy: y, r: 6, fill: dotColor(v), stroke: "var(--surface)", "stroke-width": 2, style: "cursor:pointer", tabindex: 0 });
      c.addEventListener("mousemove", e => show(e, `${b.name} · ${money(rentOf(b))} · ${b.sqft || "?"} sq ft`));
      c.addEventListener("mouseleave", () => tip.hidden = true);
      c.addEventListener("click", () => openBuilding(b));
      c.addEventListener("keydown", e => { if (e.key === "Enter") openBuilding(b); });
      svg.append(c);
    }
    wrap.append(h("div", { style: { overflowX: "auto" } }, svg), tip);
    root.append(wrap, h("div", { class: "legend", style: { marginTop: "10px" } },
      h("span", null, h("i", { style: { background: "var(--ok)" } }), "Meets everything"),
      h("span", null, h("i", { style: { background: "var(--accent)" } }), "Needs checks"),
      h("span", null, h("i", { style: { background: "var(--bad)" } }), "Fails something"),
      h("span", { text: `Showing ${list.length} filtered listings. Coast and freeways are approximate.` })));
  }

  function renderAreas(root) {
    const list = S.areas.filter(a => S.f.regions.includes(a.region)).map(a => ({ a, sc: areaScore(a) })).sort((x, y) => (y.sc ?? -1) - (x.sc ?? -1));
    if (!list.length) return root.append(h("div", { class: "empty", text: S.loaded ? "No neighborhoods in the selected regions." : "Loading…" }));
    root.append(h("div", { class: "areas" }, ...list.map(({ a, sc }) => {
      const n = S.buildings.filter(b => b.area_id === a.id && matches(b)).length;
      return h("article", { class: "area", tabindex: 0, role: "button", onclick: () => openArea(a), onkeydown: e => { if (e.key === "Enter") openArea(a); } },
        h("header", null, h("div", null, h("h3", { text: a.name }), h("p", { class: "muted", style: { fontSize: ".82rem" }, text: `${a.region} · ${n} listing${n === 1 ? "" : "s"}` })), h("span", { class: "big", text: f1(sc) })),
        h("div", { class: "bars" }, ...FACTORS.flatMap(f => { const v = factorScore(a, f); return [h("span", { text: f.name }), h("i", { style: { "--w": v == null ? "0%" : v * 10 + "%" } }), h("span", { text: f1(v) })]; })));
    })));
  }

  function renderCompare(root) {
    const picks = S.buildings.filter(b => S.compare.has(b.id));
    if (!picks.length) return root.append(h("div", { class: "empty", text: "Open any listing and choose “Compare” to line up to four side by side." }));
    const rows = [
      ["Neighborhood", areaName],
      ["Best match", b => f1(score(b)), score, 1],
      ["Rent", b => money(rentOf(b)), rentOf, -1],
      ["Size", b => b.sqft ? b.sqft + " sq ft" : "—", b => b.sqft, 1],
      ["$ per sq ft", b => ppsf(b) ? "$" + ppsf(b).toFixed(2) : "—", ppsf, -1],
      ["Saves vs. The Jayne", b => allIn(b) == null ? "—" : money(JAYNE.allIn - allIn(b)) + "/mo", b => allIn(b) == null ? null : JAYNE.allIn - allIn(b), 1],
      ["Reviews", b => repScore(b) == null ? "—" : repScore(b) + "/10", repScore, 1],
      ...REQS.map(r => [r.name, b => reqVal(b, r.key)]),
      ...FACTORS.map(f => [f.name, b => f1(factorScore(S.areaById.get(b.area_id), f)), b => factorScore(S.areaById.get(b.area_id), f), 1]),
      ["Landlord", b => b.landlord === "private" ? "Private owner" : ((b.reviews && b.reviews.management_company) || "Company")],
      ["Special", b => b.special || "—"],
      ["Red flags", b => (b.reviews && b.reviews.dealbreakers) || b.red_flags || "—"],
    ];
    root.append(h("div", { class: "tablewrap" }, h("table", { class: "compare" },
      h("thead", null, h("tr", null, h("th", null), ...picks.map(b => h("th", { style: { whiteSpace: "normal" } }, b.name, " ",
        h("button", { class: "linkbtn", type: "button", "aria-label": "Remove " + b.name, text: "remove", onclick: () => { S.compare.delete(b.id); ls.set("compare", [...S.compare]); renderToolbar(); renderResults(); } }))))),
      h("tbody", null, ...rows.map(([label, fmt, val, dir]) => {
        let best = -1;
        if (val && picks.length > 1) { const vs = picks.map(val), ok = vs.filter(x => x != null); if (ok.length) best = vs.indexOf(dir > 0 ? Math.max(...ok) : Math.min(...ok)); }
        return h("tr", { style: { cursor: "default" } }, h("td", { class: "muted", text: label }), ...picks.map((b, i) => {
          const t = String(fmt(b)), isReq = ["yes", "no", "unclear"].includes(t);
          return h("td", { class: (i === best ? "best " : "") + "wrap" }, isReq ? h("span", { class: "tag " + t, text: t === "unclear" ? "not confirmed" : t }) : t);
        }));
      })))));
  }

  function renderAdd(root) {
    const tri = key => h("select", { id: "a-" + key }, ...[["unclear", "Not sure"], ["yes", "Yes"], ["no", "No"]].map(([v, t]) => h("option", { value: v, text: t })));
    const form = h("form", { style: { display: "grid", gap: "16px", maxWidth: "620px" } },
      h("p", { class: "muted", text: "Found something on Zillow, Craigslist or a walk around the block? Add it and it will be scored with its neighborhood." }),
      h("div", { class: "field" }, h("label", { for: "a-name", text: "Building or address" }), h("input", { id: "a-name", required: true })),
      h("div", { class: "field" }, h("label", { for: "a-area", text: "Neighborhood" }), h("select", { id: "a-area", required: true }, h("option", { value: "", text: "Choose…" }),
        ...REGIONS.map(r => h("optgroup", { label: r }, ...S.areas.filter(a => a.region === r).map(a => h("option", { value: a.id, text: a.name })))))),
      h("div", { class: "grid2" },
        h("div", { class: "field" }, h("label", { for: "a-base", text: "List rent" }), h("input", { id: "a-base", type: "number", min: 0, inputmode: "numeric" })),
        h("div", { class: "field" }, h("label", { for: "a-eff", text: "Rent after specials" }), h("input", { id: "a-eff", type: "number", min: 0, inputmode: "numeric" })),
        h("div", { class: "field" }, h("label", { for: "a-sqft", text: "Size (sq ft)" }), h("input", { id: "a-sqft", type: "number", min: 0, inputmode: "numeric" })),
        h("div", { class: "field" }, h("label", { for: "a-park", text: "Parking ($/mo)" }), h("input", { id: "a-park", type: "number", min: 0, inputmode: "numeric" })),
        ...REQS.map(r => h("div", { class: "field" }, h("label", { for: "a-" + r.key, text: r.name }), tri(r.key))),
        h("div", { class: "field" }, h("label", { for: "a-landlord", text: "Landlord" }), h("select", { id: "a-landlord" }, h("option", { value: "company", text: "Management company" }), h("option", { value: "private", text: "Private owner" })))),
      h("div", { class: "field" }, h("label", { for: "a-url", text: "Listing link" }), h("input", { id: "a-url", type: "url", placeholder: "https://" })),
      h("div", { class: "field" }, h("label", { for: "a-note", text: "Notes" }), h("textarea", { id: "a-note", rows: 3 })),
      h("div", null, h("button", { class: "btn", type: "submit", disabled: !S.loaded, text: "Add listing" })));
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const v = id => form.querySelector("#" + id).value.trim(), n = id => v(id) === "" ? null : Number(v(id));
      const area = S.areaById.get(v("a-area")), j = () => (Math.random() - .5) * .01;
      const b = { id: "you-" + Date.now().toString(36), name: v("a-name"), area_id: area ? area.id : null, region: area ? area.region : null,
        lat: area ? area.lat + j() : null, lng: area ? area.lng + j() : null, base_rent: n("a-base"), effective_rent: n("a-eff") ?? n("a-base"),
        sqft: n("a-sqft"), parking_fee: n("a-park"), req: Object.fromEntries(REQS.map(r => [r.key, v("a-" + r.key)])), landlord: v("a-landlord"),
        listing_url: v("a-url") || null, notes: v("a-note"), source: "you", my_status: "watch", added_at: new Date().toISOString() };
      if (await saveBuilding(b, true)) { form.reset(); S.view = "list"; ls.set("view", "list"); renderToolbar(); renderResults(); openBuilding(b); toast("Listing added"); }
    });
    root.append(form);
  }

  function emptyState() {
    return h("div", { class: "empty" }, S.loaded ? "Nothing matches. Try a broader search or " : "Loading listings…",
      S.loaded ? h("button", { class: "linkbtn", type: "button", text: "clear all filters", onclick: () => { S.f = JSON.parse(JSON.stringify(DEFAULT_FILTERS)); S.q = ""; $("q").value = ""; saveF(); renderFilters(); renderResults(); } }) : null,
      S.loaded ? "." : null);
  }

  function renderResults() {
    const list = visible();
    const live = S.buildings.filter(b => verdict(b) !== "fail");
    $("count").replaceChildren(S.loaded ? h("span", null, h("b", { text: list.length }), ` of ${S.buildings.length} listings`, S.q ? ` matching “${S.q}”` : "", ` · ${live.filter(b => verdict(b) === "all").length} meet everything`) : "Loading…");
    const root = $("view"); root.replaceChildren();
    ({ list: renderList, table: renderTable, map: renderMap, areas: renderAreas, compare: renderCompare, add: renderAdd }[S.view] || renderList)(root, list);
  }

  /* ---------------- Drawers ---------------- */
  function drawer(...content) {
    const root = $("drawerRoot");
    const close = () => { root.replaceChildren(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    const panel = h("div", { class: "drawer", role: "dialog", "aria-modal": "true" }, h("button", { class: "btn ghost close", type: "button", text: "Close", onclick: close }), ...content);
    root.replaceChildren(h("div", { class: "scrim", onclick: close }), panel);
    panel.querySelector(".close").focus();
  }
  function kv(pairs) { return h("dl", { class: "kv" }, ...pairs.filter(([, v]) => v != null && v !== "" && v !== false).flatMap(([k, v]) => [h("dt", { text: k }), v instanceof Node ? h("dd", null, v) : h("dd", { text: String(v) })])); }
  function reviewSection(b) {
    const r = b.reviews;
    if (!r || (r.reputation_score == null && !(r.complaints || []).length && !(r.praise || []).length && !(r.management && r.management.summary)))
      return h("section", { class: "section" }, h("h3", { text: "What residents say" }), h("p", { class: "muted", text: "No resident reviews found yet." }));
    return h("section", { class: "section" },
      h("h3", { text: "What residents say" }),
      h("p", null, h("span", { class: "big", text: r.reputation_score != null ? r.reputation_score + "/10" : "—" }), " ",
        h("span", { class: "muted", text: [r.management_company, r.confidence && r.confidence + " confidence", r.recent_trend].filter(Boolean).join(" · ") })),
      r.note ? h("p", { class: "note warn", text: r.note }) : null,
      r.dealbreakers ? h("p", { class: "note bad", text: r.dealbreakers }) : null,
      r.ratings && r.ratings.length ? h("div", { class: "tags", style: { display: "flex", flexWrap: "wrap", gap: "5px" } }, ...r.ratings.map(x => h("span", { class: "tag", text: `${x.site} ${x.rating ?? "?"}${x.count ? " · " + x.count : ""}` }))) : null,
      r.praise && r.praise.length ? h("div", null, h("p", { class: "label", text: "Praise" }), ul(r.praise)) : null,
      r.complaints && r.complaints.length ? h("div", null, h("p", { class: "label", text: "Complaints" }), ul(r.complaints)) : null,
      h("div", null, ...REVIEW_PARTS.filter(([k]) => r[k] && (r[k].summary || r[k].score != null)).map(([k, label]) =>
        h("div", { class: "factor" }, h("header", null, h("span", { text: label }), h("span", { text: r[k].score != null ? r[k].score + "/10" : "" })), r[k].summary ? h("p", { text: r[k].summary }) : null))),
      r.sources && r.sources.length ? h("details", { class: "srcs" }, h("summary", { text: `Review sources (${r.sources.length})` }), h("ul", null, ...r.sources.map(u => h("li", null, linkOut(u))))) : null);
  }
  function openBuilding(b) {
    const a = S.areaById.get(b.area_id), v = verdict(b), c = allIn(b), inCmp = S.compare.has(b.id);
    const status = h("select", { id: "d-status", disabled: !S.canWrite }, ...STATUSES.map(st => h("option", { value: st.key, selected: (b.my_status || "new") === st.key, text: st.name })));
    const note = h("textarea", { id: "d-note", rows: 3, disabled: !S.canWrite }, b.my_note || "");
    status.addEventListener("change", () => saveBuilding({ ...b, my_status: status.value }).then(ok => ok && toast("Saved")));
    let t; note.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => saveBuilding({ ...b, my_note: note.value }).then(ok => ok && toast("Note saved")), 900); });
    drawer(
      h("div", { style: { display: "grid", gap: "6px" } }, h("p", { class: "label", text: a ? `${a.name} · ${a.region}` : "" }), h("h2", { text: b.name }), h("p", { class: "muted", text: b.address || "" })),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: "5px" } }, h("span", { class: "tag " + (v === "all" ? "dark" : v === "fail" ? "no" : "unclear"), text: VERDICTS[v] }), ...reqTags(b)),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: "28px" } },
        h("div", null, h("p", { class: "label", text: "Rent" }), h("p", { class: "big", text: money(rentOf(b)) })),
        h("div", null, h("p", { class: "label", text: "Size" }), h("p", { class: "big", text: b.sqft ? b.sqft + " sq ft" : "—" })),
        h("div", null, h("p", { class: "label", text: "Match" }), h("p", { class: "big", text: f1(score(b)) }))),
      b.scam_flags ? h("p", { class: "note bad", text: "Scam warning: " + b.scam_flags }) : null,
      kv([
        ["List rent", b.base_rent ? money(b.base_rent) : null], ["Special", b.special || "None listed"],
        ["Parking", b.parking_fee ? money(b.parking_fee) + "/mo" : reqVal(b, "parking") === "yes" ? "Available, fee unknown" : "Not confirmed"],
        ["vs. The Jayne", c == null ? null : `${money(JAYNE.allIn - c)}/mo less, about ${money((JAYNE.allIn - c) * 12)} a year`],
        ["Built", b.year_built], ["Landlord", b.landlord === "private" ? [b.owner_type || "Private owner", b.platform && "on " + b.platform].filter(Boolean).join(", ") : (b.reviews && b.reviews.management_company) || "Management company"],
        ["Packages", b.packages_detail], ["AC evidence", b.ac_evidence], ["Rent control", b.rent_control], ["Complex", b.hoa_amenities],
        ["Internet", b.internet], ["Location", b.location_note], ["Watch out for", b.red_flags], ["Last checked", b.checked_on],
        ["Listing", b.listing_url ? linkOut(b.listing_url, "Open listing ↗") : null],
      ]),
      b.notes ? h("p", { style: { fontSize: ".9rem", color: "var(--muted)", whiteSpace: "pre-line" }, text: b.notes }) : null,
      h("section", { class: "section" }, h("h3", { text: "My notes" }),
        h("div", { class: "field" }, h("label", { for: "d-status", text: "Status" }), status),
        h("div", { class: "field" }, h("label", { for: "d-note", text: "Notes" }), note),
        h("p", { class: "muted", style: { fontSize: ".82rem" }, text: "Saved in this browser. Use Export at the bottom of the page to back up." }),
        h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
          h("button", { class: "btn ghost", type: "button", disabled: !inCmp && S.compare.size >= 4, text: inCmp ? "Remove from compare" : "Compare",
            onclick: e => { S.compare.has(b.id) ? S.compare.delete(b.id) : S.compare.add(b.id); ls.set("compare", [...S.compare]); e.target.textContent = S.compare.has(b.id) ? "Remove from compare" : "Compare"; renderToolbar(); renderResults(); } }),
          a ? h("button", { class: "btn ghost", type: "button", text: "Neighborhood report", onclick: () => openArea(a) }) : null)),
      reviewSection(b),
      a ? h("section", { class: "section" }, h("h3", { text: "Neighborhood" }), h("div", { class: "bars" }, ...FACTORS.flatMap(f => { const x = factorScore(a, f); return [h("span", { text: f.name }), h("i", { style: { "--w": x == null ? "0%" : x * 10 + "%" } }), h("span", { text: f1(x) })]; }))) : null,
      b.sources && b.sources.length ? h("details", { class: "srcs" }, h("summary", { text: `Sources (${b.sources.length})` }), h("ul", null, ...b.sources.map(u => h("li", null, linkOut(u))))) : null);
  }
  function openArea(a) {
    const bs = S.buildings.filter(b => b.area_id === a.id);
    const blocks = [
      ["Freeways", a.freeway, x => ul(x.nearest)], ["Traffic", a.traffic], ["Specialty coffee", a.coffee, x => ul(x.cafes)],
      ["Walkability", a.walk, x => x.walk_score != null ? h("p", { text: "Walk Score " + x.walk_score }) : null], ["Quiet", a.quiet],
      ["Safety", a.safety, x => h("p", { text: [x.violent_per_1k != null && `Violent ${x.violent_per_1k}/1k`, x.property_per_1k != null && `Property ${x.property_per_1k}/1k`, x.year, x.source].filter(Boolean).join(" · ") })],
      ["LAX", a.lax, x => h("p", { text: `${x.minutes_offpeak ?? "?"} min off-peak · ${x.minutes_peak ?? "?"} min at peak` })],
      ["Nightlife", a.nightlife, x => h("p", { text: [x.nearest_district, x.drive_minutes != null && x.drive_minutes + " min drive"].filter(Boolean).join(" · ") })],
      ["Gyms", a.gyms, x => ul(x.examples)], ["Errands", a.services], ["Rail", a.rail, x => h("p", { text: [x.nearest_station, x.line].filter(Boolean).join(" · ") })],
    ].filter(([, x]) => x);
    drawer(
      h("div", { style: { display: "grid", gap: "6px" } }, h("p", { class: "label", text: a.region }), h("h2", { text: a.name })),
      h("p", null, h("span", { class: "big", text: f1(areaScore(a)) }), h("span", { class: "muted", text: "  neighborhood score with your weights" })),
      a.summary ? h("p", { text: a.summary }) : null,
      a.airports_other ? h("p", { class: "muted", text: "Other airports: " + a.airports_other }) : null,
      bs.length ? h("section", { class: "section" }, h("h3", { text: `Listings here (${bs.length})` }),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } }, ...bs.map(b => h("button", { class: "btn ghost", type: "button", style: { fontSize: ".84rem", padding: "5px 10px" }, text: `${b.name} · ${money(rentOf(b))}`, onclick: () => openBuilding(b) })))) : null,
      h("section", { class: "section" }, h("h3", { text: "Details" }),
        h("div", null, ...blocks.map(([name, x, extra]) => h("div", { class: "factor" },
          h("header", null, h("span", { text: name }), h("span", { text: x.score != null ? x.score + "/10" : "—" })),
          extra ? extra(x) : null, x.note ? h("p", { text: x.note }) : null)))),
      a.sources && a.sources.length ? h("details", { class: "srcs" }, h("summary", { text: `Sources (${a.sources.length})` }), h("ul", null, ...a.sources.map(u => h("li", null, linkOut(u))))) : null);
  }

  /* ---------------- Data (embedded; personal edits live in this browser) ---------------- */
  const DATA = JSON.parse(document.getElementById("data").textContent);
  async function saveBuilding(b, isNew) {
    const i = S.buildings.findIndex(x => x.id === b.id);
    if (i >= 0) S.buildings[i] = b; else S.buildings.push(b);
    const local = ls.get("edits", {});
    local[b.id] = isNew ? b : { ...(local[b.id] || {}), my_status: b.my_status, my_note: b.my_note };
    if (!ls.set("edits", local)) { toast("Couldn't save in this browser. Use Export to keep a copy."); }
    renderResults();
    return true;
  }
  function applyEdits(edits) {
    for (const [id, p] of Object.entries(edits || {})) {
      const i = S.buildings.findIndex(x => x.id === id);
      if (i >= 0) S.buildings[i] = { ...S.buildings[i], ...p };
      else if (p && p.name) S.buildings.push(p);
    }
  }
  function setData(buildings, areas) {
    S.areas = areas.slice().sort((a, b) => a.name.localeCompare(b.name));
    S.areaById = new Map(S.areas.map(a => [a.id, a]));
    S.buildings = buildings.map(b => ({ ...b })); S.loaded = true;
  }
  function exportEdits() {
    const blob = new Blob([JSON.stringify({ app: "apartment-search-2027", exported: new Date().toISOString(), edits: ls.get("edits", {}), compare: [...S.compare] }, null, 1)], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: "apartment-search-notes-" + new Date().toISOString().slice(0, 10) + ".json" });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast("Notes exported");
  }
  function importEdits(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || typeof d.edits !== "object") throw new Error("bad file");
        const merged = Object.assign(ls.get("edits", {}), d.edits);
        ls.set("edits", merged);
        setData(DATA.buildings, DATA.neighborhoods); applyEdits(merged);
        if (Array.isArray(d.compare)) { S.compare = new Set(d.compare); ls.set("compare", d.compare); }
        renderAll(); toast("Notes imported");
      } catch { toast("That file isn't an Apartment Search export."); }
    };
    r.readAsText(file);
  }
  $("exportBtn").addEventListener("click", exportEdits);
  $("importFile").addEventListener("change", e => { if (e.target.files[0]) importEdits(e.target.files[0]); e.target.value = ""; });
  function boot() {
    renderDates();
    setData(DATA.buildings, DATA.neighborhoods);
    applyEdits(ls.get("edits", {}));
    S.canWrite = true;
    $("dataDate").textContent = "Data updated " + DATA.updated;
    renderAll();
  }
  function renderAll() { renderFilters(); renderToolbar(); renderResults(); }
  boot();
})();
