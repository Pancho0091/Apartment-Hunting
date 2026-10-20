(() => {
  /* ==========================================================================
     Facts from the renewal letter
     ========================================================================== */
  const JAYNE = { allIn: 2726.83 };
  const DATES = [
    { label: "Renewal offer expires", date: "2026-11-13" },
    { label: "Written notice due", date: "2026-12-30" },
    { label: "Lease ends", date: "2027-01-29" },
  ];
  const RENT_CAP = 2300, MIN_SQFT = 700;

  /* ==========================================================================
     Scoring model
     ========================================================================== */
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
    { key: "ac", short: "AC", name: "Central AC" },
    { key: "dw", short: "DW", name: "Dishwasher" },
    { key: "parking", short: "Parking", name: "Parking" },
    { key: "packages", short: "Pkgs", name: "Package handling" },
  ];
  const REVIEW_PARTS = [["management", "Management"], ["maintenance", "Maintenance"], ["cleanliness", "Cleanliness"], ["noise", "Noise"], ["security", "Security"], ["pests", "Pests"], ["costs", "Fees and renewals"]];
  const STATUSES = [{ key: "new", name: "Not reviewed" }, { key: "watch", name: "Watching" }, { key: "tour", name: "Tour" }, { key: "applied", name: "Applied" }, { key: "pass", name: "Passed on" }];
  const REGIONS = ["Los Angeles", "Long Beach", "Orange County"];
  const VERDICTS = { all: "Meets everything", check: "Needs checks", fail: "Fails something" };
  const LANDLORDS = { company: "Management company", private: "Private owner" };
  const SORTS = [["score", "Best match"], ["value", "Best match per dollar"], ["rent", "Lowest rent"], ["sqft", "Largest"], ["ppsf", "Lowest $/sq ft"], ["reviews", "Best reviewed"], ["name", "Name"]];
  const VIEWS = [["list", "Specimens"], ["table", "Table"], ["map", "Map"], ["areas", "Neighborhoods"], ["compare", "Compare"], ["add", "Add"]];
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

  /* ==========================================================================
     Persistence
     ========================================================================== */
  const ls = {
    get(k, d) { try { const v = localStorage.getItem("aps27b:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("aps27b:" + k, JSON.stringify(v)); return true; } catch { return false; } },
  };
  const DEFAULT_FILTERS = {
    maxRent: RENT_CAP, minSqft: MIN_SQFT, minRep: 0,
    regions: REGIONS.slice(), verdicts: ["all", "check"], landlords: ["company", "private"],
    statuses: ["new", "watch", "tour", "applied"], mustHave: [], hideScam: true, newOnly: false,
  };
  const freshFilters = () => JSON.parse(JSON.stringify(DEFAULT_FILTERS));
  const defaultWeights = Object.fromEntries(FACTORS.concat(REP).map(f => [f.key, f.def]));
  const S = {
    buildings: [], areas: [], areaById: new Map(),
    f: Object.assign(freshFilters(), ls.get("filters", {})),
    weights: Object.assign({}, defaultWeights, ls.get("weights", {})),
    q: "", view: ls.get("view", "list"), sort: ls.get("sort", "score"),
    density: ls.get("density", "cards"),
    tsort: ls.get("tsort", { key: "score", dir: -1 }),
    compare: new Set(ls.get("compare", [])),
    rank: new Map(),
    db: null, canWrite: false, loaded: false,
  };
  if (!VIEWS.some(([k]) => k === S.view)) S.view = "list";
  const saveF = () => ls.set("filters", S.f);

  /* ==========================================================================
     Helpers
     ========================================================================== */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") { for (const [sk, sv] of Object.entries(v)) sk.startsWith("--") ? el.style.setProperty(sk, sv) : (el.style[sk] = sv); }
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const $ = id => document.getElementById(id);
  const money = n => n == null || isNaN(n) ? "—" : "$" + Math.round(n).toLocaleString("en-US");
  const f1 = n => n == null || isNaN(n) ? "—" : (Math.round(n * 10) / 10).toFixed(1);
  const pad2 = n => String(n).padStart(2, "0");
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + "s")}`;
  const linkOut = (url, text) => url ? h("a", { href: url, target: "_blank", rel: "noopener", text: text || prettyUrl(url) }) : null;
  const prettyUrl = u => { try { const x = new URL(u); return x.hostname.replace(/^www\./, "") + (x.pathname.length > 1 ? x.pathname.replace(/\/$/, "") : ""); } catch { return u; } };
  const ul = (items, cls) => items && items.length ? h("ul", { class: cls || "plainlist" }, ...items.map(t => h("li", { text: t }))) : null;
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function toast(msg) {
    const t = h("div", { class: "toast", role: "status", text: msg });
    document.body.append(t);
    requestAnimationFrame(() => t.classList.add("in"));
    setTimeout(() => { t.classList.remove("in"); setTimeout(() => t.remove(), 300); }, 2400);
  }

  /* Illustrations: window.Illus is owned by the illustration pass. Every call is defensive and memoized. */
  const illCache = new Map();
  function ill(fn, ...args) {
    const key = fn + "|" + JSON.stringify(args);
    if (illCache.has(key)) return illCache.get(key);
    let out = "";
    try { const I = window.Illus; if (I && typeof I[fn] === "function") out = String(I[fn](...args) || ""); } catch (e) { out = ""; }
    if (out && !/<svg[\s>]/i.test(out)) out = "";
    illCache.set(key, out);
    return out;
  }
  const art = (cls, markup) => markup ? h("span", { class: "art " + cls, "aria-hidden": "true", html: markup }) : null;
  const reqIcon = key => art("ico-req", ill("req", key));
  const factorIcon = key => art("ico-factor", ill("factor", key));
  const regionEmblem = (name, cls) => art("emblem " + (cls || ""), ill("region", name));
  function jar(s, cls) {
    const v = s == null ? 0 : Math.max(0, Math.min(1, s / 10));
    const m = ill("jar", Math.round(v * 20) / 20, { tint: "green" });
    return m ? art("jar " + (cls || ""), m) : h("span", { class: "meter " + (cls || ""), "aria-hidden": "true" }, h("i", { style: { "--w": v * 100 + "%" } }));
  }
  const seal = () => art("seal", ill("seal", "Meets everything"));

  /* ==========================================================================
     Derived values
     ========================================================================== */
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
  function failReasons(b) {
    const out = [], rent = rentOf(b);
    if (b.sqft != null && b.sqft < MIN_SQFT) out.push(`Under ${MIN_SQFT} sq ft`);
    if (rent != null && rent > RENT_CAP) out.push(`Over ${money(RENT_CAP)}`);
    for (const r of REQS) if (reqVal(b, r.key) === "no") out.push("No " + r.name.charAt(0).toLowerCase() + r.name.slice(1));
    return out;
  }
  const regionOf = b => { const a = S.areaById.get(b.area_id); return (a && a.region) || b.region || "Los Angeles"; };
  const areaName = b => { const a = S.areaById.get(b.area_id); return a ? a.name : ""; };
  const isNew = b => b.batch === "new-oct15" || b.batch === "private-oct15";
  const statusName = k => (STATUSES.find(s => s.key === (k || "new")) || STATUSES[0]).name;
  const savingsOf = b => { const c = allIn(b); return c == null ? null : JAYNE.allIn - c; };

  function haystack(b) {
    const r = b.reviews || {};
    return [b.name, b.address, areaName(b), regionOf(b), b.notes, b.special, b.packages_detail, b.owner_type, b.platform,
      r.management_company, b.landlord === "private" ? "private owner condo" : "management company", b.hoa_amenities, b.my_note]
      .filter(Boolean).join(" ").toLowerCase();
  }
  function matchesWith(b, f, q) {
    const rent = rentOf(b);
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
    if (q) { const hs = haystack(b); for (const t of q.split(/\s+/)) if (t && !hs.includes(t)) return false; }
    return true;
  }
  const matches = b => matchesWith(b, S.f, S.q);
  function sorted(list) {
    const k = S.sort;
    const key = {
      score: b => -(score(b) ?? -1), value: b => -((score(b) ?? 0) / (rentOf(b) || 9e9)), rent: b => rentOf(b) ?? 9e9,
      sqft: b => -(b.sqft ?? 0), ppsf: b => ppsf(b) ?? 9e9, reviews: b => -(repScore(b) ?? -1), name: b => b.name.toLowerCase(),
    }[k] || (b => 0);
    return list.slice().sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : (rentOf(a) ?? 0) - (rentOf(b) ?? 0); });
  }
  const visible = () => sorted(S.buildings.filter(matches));
  const median = xs => { const v = xs.filter(x => x != null).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };

  /* ==========================================================================
     Masthead: deadlines + summary ledger
     ========================================================================== */
  function renderDates() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    $("dates").replaceChildren(...DATES.map((d, i) => {
      const dt = new Date(d.date + "T00:00:00"), days = Math.round((dt - today) / 864e5);
      const tone = days < 0 ? "past" : days <= 14 ? "urgent" : days <= 30 ? "soon" : "calm";
      const span = Math.max(0, Math.min(1, days / 120));
      return h("li", { class: "deadline " + tone },
        h("div", { class: "deadline-top" }, h("span", { class: "deadline-no", text: "No. " + ROMAN[i] }), h("span", { class: "deadline-date", text: dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) })),
        h("p", { class: "deadline-days" }, days >= 0 ? h("b", { text: days }) : h("b", { text: "—" }), h("span", { text: days >= 0 ? (days === 1 ? " day" : " days") : " passed" })),
        h("p", { class: "deadline-label", text: d.label }),
        h("span", { class: "measure", "aria-hidden": "true", style: { "--p": (span * 100).toFixed(1) + "%" } }));
    }));
  }
  function renderStats(list) {
    const meet = list.filter(b => verdict(b) === "all").length;
    const med = median(list.map(rentOf));
    const top = list.find(b => verdict(b) !== "fail") || list[0];
    const cell = (label, value, sub, extra) => h("div", { class: "ledger-cell" + (extra ? " " + extra : "") }, h("dt", { text: label }), h("dd", null, value, sub ? h("small", { text: sub }) : null));
    $("stats").replaceChildren(
      cell("In view", h("b", { text: S.loaded ? list.length : "—" }), S.loaded ? `of ${S.buildings.length} listings` : ""),
      cell("Meet everything", h("b", { text: meet }), "all five confirmed"),
      cell("Median rent", h("b", { text: money(med) }), "per month, in view"),
      cell("Renewal baseline", h("b", { text: "$" + JAYNE.allIn.toLocaleString("en-US", { minimumFractionDigits: 2 }) }), "The Jayne, all-in"),
      cell("Top pick", top ? h("button", { class: "toppick", type: "button", onclick: () => openBuilding(top) }, h("b", { text: top.name }), h("span", { class: "arrow", "aria-hidden": "true", text: "→" })) : h("b", { text: "—" }),
        top ? [areaName(top), money(rentOf(top)), "match " + f1(score(top))].filter(Boolean).join(" · ") : "", "wide"));
  }

  /* ==========================================================================
     Quick filter chips
     ========================================================================== */
  const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  const CHIPS = [
    { k: "all", t: "Meets everything", on: f => sameSet(f.verdicts, ["all"]), set: (f, on) => { f.verdicts = on ? ["all"] : DEFAULT_FILTERS.verdicts.slice(); } },
    { k: "ac", t: "Central AC confirmed", on: f => f.mustHave.includes("ac"), set: (f, on) => toggleIn(f.mustHave, "ac", on) },
    { k: "wd", t: "Washer/dryer confirmed", on: f => f.mustHave.includes("wd"), set: (f, on) => toggleIn(f.mustHave, "wd", on) },
    { k: "private", t: "Private owner", on: f => sameSet(f.landlords, ["private"]), set: (f, on) => { f.landlords = on ? ["private"] : ["company", "private"]; } },
    { k: "cheap", t: "Under $2,100", on: f => f.maxRent <= 2100, set: (f, on) => { f.maxRent = on ? 2100 : RENT_CAP; } },
    { k: "rep", t: "Best reviewed", note: "7+", on: f => f.minRep >= 7, set: (f, on) => { f.minRep = on ? 7 : 0; } },
    { k: "new", t: "Recent finds", on: f => f.newOnly, set: (f, on) => { f.newOnly = on; } },
  ];
  function renderChips() {
    $("chips").replaceChildren(...CHIPS.map(c => {
      const on = c.on(S.f);
      const trial = JSON.parse(JSON.stringify(S.f)); c.set(trial, !on);
      const n = S.buildings.filter(b => matchesWith(b, trial, S.q)).length;
      return h("button", { type: "button", class: "chip" + (on ? " on" : ""), "aria-pressed": on ? "true" : "false",
        title: on ? "Remove this filter" : `Show ${n} listing${n === 1 ? "" : "s"}`,
        onclick: () => { c.set(S.f, !on); saveF(); renderFilters(); renderResults(); } },
        h("span", { class: "chip-mark", "aria-hidden": "true" }),
        c.t, c.note ? h("span", { class: "chip-note", text: c.note }) : null,
        h("span", { class: "chip-n", text: on ? "×" : n, "aria-hidden": "true" }));
    }));
  }

  /* ==========================================================================
     Filters sidebar
     ========================================================================== */
  function counts(keyFn) { const m = {}; for (const b of S.buildings) { const k = keyFn(b); m[k] = (m[k] || 0) + 1; } return m; }
  function toggleIn(arr, key, on) { const i = arr.indexOf(key); if (on && i < 0) arr.push(key); if (!on && i >= 0) arr.splice(i, 1); }
  function activeFilterCount() {
    const f = S.f, d = DEFAULT_FILTERS; let n = 0;
    if (f.maxRent !== d.maxRent) n++; if (f.minSqft !== d.minSqft) n++; if (f.minRep !== d.minRep) n++;
    for (const k of ["regions", "verdicts", "landlords", "statuses"]) if (!sameSet(f[k], d[k])) n++;
    n += f.mustHave.length; if (f.hideScam !== d.hideScam) n++; if (f.newOnly) n++;
    return n;
  }
  function tagList(id, items, arr, onChange, countMap, iconFn) {
    return h("div", { class: "tagchecks" }, ...items.map(([key, name]) => {
      const cid = id + "-" + key;
      return h("label", { class: "tagcheck", for: cid },
        h("input", { type: "checkbox", id: cid, checked: arr.includes(key), onchange: e => onChange(key, e.target.checked) }),
        iconFn ? iconFn(key) : null,
        h("span", { class: "tagcheck-name", text: name }),
        countMap ? h("span", { class: "tagcheck-n", text: countMap[key] || 0 }) : null);
    }));
  }
  function toggleRow(id, label, checked, n, onChange) {
    return h("label", { class: "switch", for: id },
      h("input", { type: "checkbox", role: "switch", id, checked, onchange: e => onChange(e.target.checked) }),
      h("span", { class: "switch-track", "aria-hidden": "true" }),
      h("span", { class: "switch-name", text: label }), h("span", { class: "tagcheck-n", text: n }));
  }
  function range(id, label, min, max, step, value, fmt, onInput, ends) {
    const out = h("output", { for: id, text: fmt(value) });
    const pct = v => ((v - min) / (max - min) * 100).toFixed(2) + "%";
    const input = h("input", { type: "range", class: "range", id, min, max, step, value, style: { "--p": pct(value) },
      oninput: e => { const v = +e.target.value; e.target.style.setProperty("--p", pct(v)); out.textContent = fmt(v); onInput(v); } });
    return h("div", { class: "rangefield" },
      h("div", { class: "rangefield-head" }, h("label", { for: id, text: label }), out),
      input,
      ends ? h("div", { class: "rangefield-ends", "aria-hidden": "true" }, h("span", { text: ends[0] }), h("span", { text: ends[1] })) : null);
  }
  function group(title, open, ...body) {
    return h("details", { class: "fgroup", open: open || null },
      h("summary", null, h("span", { class: "fgroup-title", text: title }), h("span", { class: "fgroup-caret", "aria-hidden": "true" })),
      h("div", { class: "fgroup-body" }, ...body));
  }
  let lightRefresh = 0;
  function refreshFromRange() { saveF(); cancelAnimationFrame(lightRefresh); lightRefresh = requestAnimationFrame(() => { renderResults(); renderChips(); updateBadge(); }); }
  function renderFilters() {
    const f = S.f;
    const rerender = () => { saveF(); renderFilters(); renderResults(); };
    const totalW = FACTORS.concat(REP).reduce((t, x) => t + (Number(S.weights[x.key]) || 0), 0) || 1;
    const nActive = activeFilterCount();
    const openState = id => { const el = document.querySelector(`#filters details[data-g="${id}"]`); return el ? el.open : null; };
    const g = (id, title, defOpen, ...body) => { const st = openState(id); const d = group(title, st == null ? defOpen : st, ...body); d.dataset.g = id; return d; };
    $("filters").replaceChildren(
      h("div", { class: "filters-head" },
        h("p", { class: "mono-label" }, "Refine", h("span", { class: "filters-active", id: "filtersActive", text: nActive ? ` · ${nActive} active` : "" })),
        h("button", { class: "linkbtn", id: "clearAll", type: "button", disabled: !nActive && !S.q, text: "Clear all", onclick: clearAll })),
      h("div", { class: "fgroup fgroup-flat" },
        range("f-rent", "Max rent", 1500, 2600, 25, f.maxRent, money, v => { f.maxRent = v; refreshFromRange(); }, ["$1,500", "$2,600"]),
        range("f-sqft", "Min size", 600, 1000, 10, f.minSqft, v => v + " sq ft", v => { f.minSqft = v; refreshFromRange(); }, ["600", "1,000 sq ft"]),
        range("f-rep", "Min review score", 0, 9, 1, f.minRep, v => v ? v + "+ / 10" : "Any", v => { f.minRep = v; refreshFromRange(); }, ["Any", "9 / 10"])),
      g("must", "Must be confirmed", true,
        tagList("mh", REQS.map(r => [r.key, r.name]), f.mustHave, (k, on) => { toggleIn(f.mustHave, k, on); rerender(); },
          Object.fromEntries(REQS.map(r => [r.key, S.buildings.filter(b => reqVal(b, r.key) === "yes").length])), k => reqIcon(k) || h("span", { class: "ico-fallback", "aria-hidden": "true" }))),
      g("region", "Region", true,
        tagList("rg", REGIONS.map(r => [r, r]), f.regions, (k, on) => { toggleIn(f.regions, k, on); rerender(); }, counts(regionOf))),
      g("verdict", "Requirements", true,
        tagList("vd", Object.entries(VERDICTS), f.verdicts, (k, on) => { toggleIn(f.verdicts, k, on); rerender(); }, counts(verdict), k => h("span", { class: "vdot " + k, "aria-hidden": "true" }))),
      g("landlord", "Landlord", true,
        tagList("ll", Object.entries(LANDLORDS), f.landlords, (k, on) => { toggleIn(f.landlords, k, on); rerender(); }, counts(b => b.landlord || "company")),
        h("div", { class: "switches" },
          toggleRow("f-scam", "Hide likely scams", f.hideScam, S.buildings.filter(b => b.scam_flags).length, on => { f.hideScam = on; rerender(); }),
          toggleRow("f-new", "Only recent finds", f.newOnly, S.buildings.filter(isNew).length, on => { f.newOnly = on; rerender(); }))),
      g("status", "My status", false,
        tagList("st", STATUSES.map(s => [s.key, s.name]), f.statuses, (k, on) => { toggleIn(f.statuses, k, on); rerender(); }, counts(b => b.my_status || "new"))),
      g("weights", "Ranking weights", false,
        h("p", { class: "hint", text: "How much each factor counts toward Best match." }),
        h("div", { class: "weights" }, ...FACTORS.concat(REP).map(x => {
          const id = "w-" + x.key, share = Math.round((S.weights[x.key] || 0) / totalW * 100);
          return h("div", { class: "weight" },
            h("div", { class: "rangefield-head" }, h("label", { for: id }, factorIcon(x.key), h("span", { text: x.name })), h("output", { for: id, "data-w": x.key, text: share + "%" })),
            h("input", { type: "range", class: "range thin", id, min: 0, max: 50, value: S.weights[x.key] || 0, style: { "--p": ((S.weights[x.key] || 0) / 50 * 100) + "%" },
              oninput: e => {
                S.weights[x.key] = +e.target.value; e.target.style.setProperty("--p", (+e.target.value / 50 * 100) + "%"); ls.set("weights", S.weights);
                const tw = FACTORS.concat(REP).reduce((t, y) => t + (Number(S.weights[y.key]) || 0), 0) || 1;
                document.querySelectorAll("#filters output[data-w]").forEach(o => { o.textContent = Math.round((S.weights[o.dataset.w] || 0) / tw * 100) + "%"; });
                cancelAnimationFrame(lightRefresh); lightRefresh = requestAnimationFrame(() => renderResults());
              } }));
        })),
        h("button", { class: "linkbtn", type: "button", text: "Reset weights", onclick: () => { S.weights = Object.assign({}, defaultWeights); ls.set("weights", S.weights); renderFilters(); renderResults(); } })),
    );
    renderChips();
    updateBadge();
  }
  function updateBadge() {
    const n = activeFilterCount(), b = $("filterBadge");
    if ($("filtersActive")) { $("filtersActive").textContent = n ? ` · ${n} active` : ""; $("clearAll").disabled = !n && !S.q; }
    b.hidden = !n; b.textContent = n;
    $("toggleFilters").setAttribute("aria-label", n ? `Filters, ${n} active` : "Filters");
  }
  function clearAll() { S.f = freshFilters(); S.q = ""; $("q").value = ""; saveF(); renderFilters(); renderResults(); toast("Filters cleared"); }

  /* Mobile filter sheet */
  const sheetMQ = matchMedia("(max-width: 920px)");
  function setSheet(open) {
    const sb = $("sidebar"), scrim = $("sheetScrim");
    document.documentElement.classList.toggle("sheet-open", open);
    sb.classList.toggle("open", open);
    $("toggleFilters").setAttribute("aria-expanded", open ? "true" : "false");
    if (open) { scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add("in")); setTimeout(() => $("closeFilters").focus(), 30); }
    else { scrim.classList.remove("in"); setTimeout(() => { if (!sb.classList.contains("open")) scrim.hidden = true; }, 320); }
  }
  $("toggleFilters").addEventListener("click", () => setSheet(!$("sidebar").classList.contains("open")));
  $("closeFilters").addEventListener("click", () => { setSheet(false); $("toggleFilters").focus(); });
  $("applyFilters").addEventListener("click", () => { setSheet(false); $("results").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" }); });
  $("sheetScrim").addEventListener("click", () => setSheet(false));
  sheetMQ.addEventListener("change", () => { if (!sheetMQ.matches) setSheet(false); });

  /* ==========================================================================
     Toolbar + search
     ========================================================================== */
  function renderToolbar() {
    $("views").replaceChildren(...VIEWS.map(([k, name]) => h("button", { type: "button", class: "seg-btn", "data-view": k, "aria-pressed": S.view === k ? "true" : "false",
      onclick: () => { S.view = k; ls.set("view", k); renderToolbar(); renderResults(); } },
      name, k === "compare" && S.compare.size ? h("span", { class: "seg-n", text: S.compare.size }) : null)));
    $("sort").replaceChildren(...SORTS.map(([v, t]) => h("option", { value: v, selected: S.sort === v, text: t })));
    $("sort").disabled = !["list", "table"].includes(S.view);
    $("sort").closest(".sortctl").hidden = !["list", "table"].includes(S.view);
    const dens = $("density");
    dens.hidden = S.view !== "list";
    dens.replaceChildren(...[["cards", "Cards", "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"], ["rows", "Rows", "M4 6h16M4 12h16M4 18h16"]].map(([k, t, d]) =>
      h("button", { type: "button", class: "iconbtn", "aria-pressed": S.density === k ? "true" : "false", "aria-label": t + " layout", title: t,
        html: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="${d}"/></svg>`,
        onclick: () => { S.density = k; ls.set("density", k); renderToolbar(); renderResults(); } })));
  }
  $("sort").addEventListener("change", e => { S.sort = e.target.value; ls.set("sort", S.sort); renderResults(); });
  let qTimer; $("q").addEventListener("input", e => { clearTimeout(qTimer); qTimer = setTimeout(() => { S.q = e.target.value.trim().toLowerCase(); renderResults(); renderChips(); updateBadge(); }, 120); });
  $("q").addEventListener("keydown", e => { if (e.key === "Escape" && e.target.value) { e.stopPropagation(); e.target.value = ""; S.q = ""; renderResults(); renderChips(); } });
  document.addEventListener("keydown", e => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
    if ($("drawerRoot").childElementCount) return;
    e.preventDefault();
    const q = $("q"); q.focus({ preventScroll: true }); q.select();
    q.closest(".searchband").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
  });

  /* ==========================================================================
     Shared listing bits
     ========================================================================== */
  const REQ_WORD = { yes: "Confirmed", no: "Missing", unclear: "Not confirmed" };
  function reqRow(b, cls) {
    return h("ul", { class: "reqs " + (cls || ""), "aria-label": "Requirements" }, ...REQS.map(r => {
      const v = reqVal(b, r.key);
      return h("li", { class: "req " + v, title: `${r.name}: ${REQ_WORD[v].toLowerCase()}` },
        reqIcon(r.key) || h("span", { class: "req-glyph", "aria-hidden": "true", text: v === "yes" ? "✓" : v === "no" ? "✕" : "?" }),
        h("span", { class: "req-name", text: r.short }),
        h("span", { class: "sr", text: ": " + REQ_WORD[v].toLowerCase() }));
    }));
  }
  function savingsEl(b, cls) {
    const d = savingsOf(b); if (d == null) return null;
    return h("span", { class: "save " + (d >= 0 ? "pos" : "neg") + (cls ? " " + cls : ""), title: "Rent plus parking, compared with renewing at The Jayne" },
      h("span", { class: "save-k", text: d >= 0 ? "Saves" : "Costs" }), h("b", { text: money(Math.abs(d)) }), h("span", { class: "save-k", text: "/mo" }));
  }
  function flagTags(b, withStatus) {
    return [
      b.landlord === "private" ? h("span", { class: "tag", text: "Private owner" }) : null,
      isNew(b) ? h("span", { class: "tag amber", text: "Recent find" }) : null,
      b.scam_flags ? h("span", { class: "tag bad", title: b.scam_flags, text: "Scam risk" }) : null,
      b.reviews && b.reviews.dealbreakers ? h("span", { class: "tag bad", title: b.reviews.dealbreakers, text: "Review red flags" }) : null,
      withStatus && b.my_status && b.my_status !== "new" ? h("span", { class: "tag ink status-" + b.my_status, text: statusName(b.my_status) }) : null,
    ].filter(Boolean);
  }
  const listingAttrs = b => ({ "data-listing": b.id, tabindex: 0, role: "button", "aria-label": "Open " + b.name,
    onclick: () => openBuilding(b), onkeydown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBuilding(b); } } });

  /* ==========================================================================
     Views: specimens (cards / rows)
     ========================================================================== */
  function renderList(root, list) {
    if (!list.length) return root.append(emptyState());
    if (S.density === "rows") return renderRows(root, list);
    root.append(h("div", { class: "specimens" }, ...list.map((b, i) => specimenCard(b, i))));
  }
  function specimenCard(b, i) {
    const v = verdict(b), rep = repScore(b), sc = score(b), p = ppsf(b), fails = v === "fail" ? failReasons(b) : [];
    return h("article", { class: "specimen v-" + v, ...listingAttrs(b), style: { "--i": Math.min(i, 24) } },
      h("div", { class: "specimen-frame" },
        h("header", { class: "specimen-head" },
          h("span", { class: "specimen-no" }, h("span", { class: "k", text: "No." }), pad2(i + 1)),
          h("span", { class: "specimen-where" }, regionEmblem(regionOf(b), "sm"), h("span", { text: areaName(b) || regionOf(b) }))),
        v === "all" ? (seal() || h("span", { class: "seal-fallback", text: "Meets everything" })) : null,
        h("div", { class: "specimen-title" },
          h("h3", { class: "specimen-name", text: b.name }),
          h("p", { class: "specimen-addr", text: b.address || "Address not listed" })),
        h("div", { class: "specimen-figures" },
          h("div", { class: "fig fig-rent" },
            h("span", { class: "fig-k" }, "Rent", b.base_rent && rentOf(b) < b.base_rent ? h("s", { title: "List rent before specials", text: money(b.base_rent) }) : null),
            h("span", { class: "fig-v serif", text: money(rentOf(b)) })),
          h("div", { class: "fig" }, h("span", { class: "fig-k", text: "Sq ft" }), h("span", { class: "fig-v", text: b.sqft ? Math.round(b.sqft) : "—" })),
          h("div", { class: "fig" }, h("span", { class: "fig-k", text: "$/sq ft" }), h("span", { class: "fig-v", text: p ? p.toFixed(2) : "—" })),
          h("div", { class: "fig" }, h("span", { class: "fig-k", text: "Reviews" }), h("span", { class: "fig-v", text: rep == null ? "—" : rep + "/10" }))),
        reqRow(b),
        fails.length ? h("p", { class: "specimen-fails", text: fails.join(" · ") }) : null,
        h("footer", { class: "specimen-foot" },
          h("div", { class: "match", title: "Best-match score out of 10, using your ranking weights" }, jar(sc), h("span", { class: "match-k", text: "Match" }), h("b", { class: "match-v", text: f1(sc) })),
          savingsEl(b)),
        (() => { const t = flagTags(b, true); return t.length ? h("div", { class: "tags" }, ...t) : null; })()));
  }
  function renderRows(root, list) {
    root.append(h("div", { class: "rows", role: "list" },
      h("div", { class: "rows-head", "aria-hidden": "true" }, ...["No.", "Specimen", "Requirements", "Rent", "Size", "Match", "vs. Jayne"].map(t => h("span", { text: t }))),
      ...list.map((b, i) => {
        const v = verdict(b), sc = score(b);
        return h("article", { class: "rowitem v-" + v, ...listingAttrs(b) },
          h("span", { class: "rowitem-no", text: pad2(i + 1) }),
          h("div", { class: "rowitem-main" },
            h("h3", { class: "rowitem-name" }, b.name, v === "all" ? h("span", { class: "tick", title: "Meets everything", text: " ●" }) : null),
            h("p", { class: "rowitem-sub", text: [areaName(b), regionOf(b)].filter(Boolean).join(" · ") }),
            (() => { const t = flagTags(b, true); return t.length ? h("div", { class: "tags sm" }, ...t) : null; })()),
          reqRow(b, "compact"),
          h("span", { class: "rowitem-rent", text: money(rentOf(b)) }),
          h("span", { class: "rowitem-num rowitem-size", text: b.sqft ? Math.round(b.sqft) + " ft²" : "—" }),
          h("span", { class: "rowitem-match" }, jar(sc, "xs"), h("b", { text: f1(sc) })),
          savingsEl(b, "rowitem-save") || h("span", { class: "rowitem-num", text: "—" }));
      })));
  }

  /* ==========================================================================
     Views: table
     ========================================================================== */
  const TCOLS = [
    { k: "name", t: "Building", v: b => b.name.toLowerCase(), cell: b => h("td", { class: "t-name" }, h("span", { class: "t-title", text: b.name }), h("span", { class: "t-sub", text: areaName(b) || regionOf(b) })) },
    { k: "rent", t: "Rent", num: true, v: rentOf, cell: b => h("td", { class: "num strong", text: money(rentOf(b)) }) },
    { k: "sqft", t: "Sq ft", num: true, v: b => b.sqft, cell: b => h("td", { class: "num", text: b.sqft != null ? Math.round(b.sqft) : "—" }) },
    { k: "ppsf", t: "$/sq ft", num: true, v: ppsf, cell: b => h("td", { class: "num", text: ppsf(b) ? ppsf(b).toFixed(2) : "—" }) },
    { k: "save", t: "vs. Jayne", num: true, v: savingsOf, cell: b => { const d = savingsOf(b); return h("td", { class: "num " + (d == null ? "" : d >= 0 ? "pos" : "neg"), text: d == null ? "—" : (d >= 0 ? "+" : "−") + money(Math.abs(d)) }); } },
    { k: "score", t: "Match", num: true, v: score, cell: b => h("td", { class: "num" }, h("span", { class: "t-match" }, h("span", { class: "meter xs", "aria-hidden": "true" }, h("i", { style: { "--w": (score(b) || 0) * 10 + "%" } })), f1(score(b)))) },
    { k: "rep", t: "Reviews", num: true, v: repScore, cell: b => h("td", { class: "num", text: repScore(b) ?? "—" }) },
    { k: "req", t: "Requirements", v: b => REQS.filter(r => reqVal(b, r.key) === "yes").length, cell: b => h("td", null, h("span", { class: "dots" }, ...REQS.map(r => h("i", { class: reqVal(b, r.key), title: r.name + ": " + REQ_WORD[reqVal(b, r.key)].toLowerCase() })))) },
    { k: "landlord", t: "Landlord", v: b => b.landlord || "company", cell: b => h("td", { class: "t-text", text: b.landlord === "private" ? "Private" : "Company" }) },
    { k: "status", t: "Status", v: b => b.my_status || "new", cell: b => h("td", { class: "t-text", text: statusName(b.my_status) }) },
  ];
  function renderTable(root, list) {
    if (!list.length) return root.append(emptyState());
    const col = TCOLS.find(c => c.k === S.tsort.key) || TCOLS.find(c => c.k === "score");
    const rows = list.slice().sort((a, b) => { const x = col.v(a), y = col.v(b); if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * S.tsort.dir; });
    root.append(h("div", { class: "tablewrap" }, h("table", { class: "ledger-table" },
      h("caption", { class: "sr", text: `${rows.length} listings. Select a column heading to sort.` }),
      h("thead", null, h("tr", null, h("th", { class: "num t-no", scope: "col", text: "No." }), ...TCOLS.map(c => h("th", { class: c.num ? "num" : null, scope: "col", "aria-sort": S.tsort.key === c.k ? (S.tsort.dir > 0 ? "ascending" : "descending") : null },
        h("button", { type: "button", class: "th-btn" + (S.tsort.key === c.k ? " on" : ""), onclick: () => { S.tsort = { key: c.k, dir: S.tsort.key === c.k ? -S.tsort.dir : (c.num && !["rent", "ppsf"].includes(c.k) ? -1 : 1) }; ls.set("tsort", S.tsort); renderResults(); } },
          c.t, h("span", { class: "th-arrow", "aria-hidden": "true", text: S.tsort.key === c.k ? (S.tsort.dir > 0 ? "↑" : "↓") : "↕" })))))),
      h("tbody", null, ...rows.map((b, i) => h("tr", { class: "v-" + verdict(b), tabindex: 0, "data-listing": b.id, "aria-label": "Open " + b.name, onclick: () => openBuilding(b), onkeydown: e => { if (e.key === "Enter") openBuilding(b); } },
        h("td", { class: "num t-no", text: pad2(i + 1) }), ...TCOLS.map(c => c.cell(b))))))));
  }

  /* ==========================================================================
     Views: map (MapView contract owned by the map pass; schematic fallback below)
     ========================================================================== */
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
  const dotColor = v => v === "all" ? "var(--ok)" : v === "check" ? "var(--warn)" : "var(--bad)";
  function renderMap(root, list) {
    if (window.MapView && typeof window.MapView.render === "function") {
      try {
        return window.MapView.render(root, list, { geo: DATA.geo, areas: S.areas, verdict, rentOf, money, score, areaScore, openBuilding, openArea });
      } catch (err) { console.error(err); root.replaceChildren(); }
    }
    const wrap = h("div", { class: "mapwrap" }), tip = h("div", { class: "tip", hidden: true });
    const svg = s("svg", { viewBox: `0 0 ${MW} ${MH}`, role: "img", "aria-label": "Map of matching listings" });
    svg.append(s("rect", { x: 0, y: 0, width: MW, height: MH, fill: "var(--panel)" }));
    const ocean = COAST.map(c => px(...c)).concat([px(-117.55, 33.40), px(-118.65, 33.40), px(-118.65, 34.035)]);
    svg.append(s("polygon", { points: ocean.map(p => p.join(",")).join(" "), fill: "var(--water)", stroke: "var(--hairline-strong)", "stroke-width": 1 }));
    for (const [n, pts] of FREEWAYS) {
      const p = pts.map(c => px(...c));
      svg.append(s("polyline", { points: p.map(q => q.join(",")).join(" "), fill: "none", stroke: "var(--hairline-strong)", "stroke-width": 1.5, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      const m = p[Math.floor(p.length / 2)];
      svg.append(s("text", { x: m[0] + 6, y: m[1] - 6, "font-size": 11, fill: "var(--muted)", "font-family": "var(--font-mono)" }, n));
    }
    for (const [code, lng, lat] of AIRPORTS) { const [x, y] = px(lng, lat); svg.append(s("text", { x, y, "text-anchor": "middle", "font-size": 11, "letter-spacing": "1.2", fill: "var(--muted)", "font-family": "var(--font-mono)" }, code)); }
    const show = (e, text) => { const r = wrap.getBoundingClientRect(); tip.textContent = text; tip.hidden = false; tip.style.left = Math.max(4, Math.min(e.clientX - r.left + 12, r.width - 250)) + "px"; tip.style.top = (e.clientY - r.top + 12) + "px"; };
    for (const b of list) {
      if (b.lat == null) continue;
      const [x, y] = px(b.lng, b.lat), v = verdict(b);
      const c = s("circle", { cx: x, cy: y, r: 5.5, fill: dotColor(v), stroke: "var(--panel)", "stroke-width": 1.5, style: "cursor:pointer", tabindex: 0, "aria-label": b.name });
      c.addEventListener("mousemove", e => show(e, `${b.name} · ${money(rentOf(b))} · ${b.sqft || "?"} sq ft`));
      c.addEventListener("mouseleave", () => tip.hidden = true);
      c.addEventListener("click", () => openBuilding(b));
      c.addEventListener("keydown", e => { if (e.key === "Enter") openBuilding(b); });
      svg.append(c);
    }
    wrap.append(h("div", { class: "mapscroll" }, svg), tip);
    root.append(wrap, h("div", { class: "legend" },
      h("span", null, h("i", { style: { background: "var(--ok)" } }), "Meets everything"),
      h("span", null, h("i", { style: { background: "var(--warn)" } }), "Needs checks"),
      h("span", null, h("i", { style: { background: "var(--bad)" } }), "Fails something"),
      h("span", { class: "legend-note", text: `${plural(list.length, "listing")} in view. Coast and freeways are approximate.` })));
  }

  /* ==========================================================================
     Views: neighborhoods (atlas index)
     ========================================================================== */
  function factorBars(a, cls) {
    return h("ul", { class: "factors " + (cls || "") }, ...FACTORS.map(f => {
      const v = factorScore(a, f);
      return h("li", { class: "factorbar" },
        factorIcon(f.key) || h("span", { class: "ico-fallback", "aria-hidden": "true" }),
        h("span", { class: "factorbar-name", text: f.name }),
        h("span", { class: "factorbar-track", "aria-hidden": "true" }, h("i", { style: { "--w": v == null ? "0%" : v * 10 + "%" } })),
        h("span", { class: "factorbar-v", text: f1(v) }));
    }));
  }
  function renderAreas(root) {
    const list = S.areas.filter(a => S.f.regions.includes(a.region)).map(a => ({ a, sc: areaScore(a) })).sort((x, y) => (y.sc ?? -1) - (x.sc ?? -1));
    if (!list.length) return root.append(emptyState(S.loaded ? "No neighborhoods in the selected regions." : "Loading…"));
    root.append(
      h("div", { class: "viewhead" },
        h("h2", { class: "viewhead-title" }, "Atlas of neighborhoods"),
        h("p", { class: "viewhead-sub", text: `${plural(list.length, "region")} of the atlas, ranked by your weights. Listing counts follow the current filters.` })),
      h("div", { class: "atlas" }, ...list.map(({ a, sc }, i) => {
        const n = S.buildings.filter(b => b.area_id === a.id && matches(b)).length;
        return h("article", { class: "plate", tabindex: 0, role: "button", "aria-label": `Open ${a.name} neighborhood report`, style: { "--i": Math.min(i, 24) }, onclick: () => openArea(a), onkeydown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openArea(a); } } },
          h("header", { class: "plate-head" },
            h("span", { class: "plate-no", text: "Plate " + pad2(i + 1) }),
            h("span", { class: "plate-region", text: a.region })),
          h("div", { class: "plate-title" },
            regionEmblem(a.region, "md") || h("span", { class: "emblem-fallback", "aria-hidden": "true", text: a.region.split(" ").map(w => w[0]).join("") }),
            h("div", null, h("h3", { class: "plate-name", text: a.name }), h("p", { class: "plate-count", text: n ? plural(n, "listing") + " in view" : "No listings in view" })),
            h("div", { class: "plate-score" }, h("b", { text: f1(sc) }), h("span", { text: "/ 10" }))),
          factorBars(a));
      })));
  }

  /* ==========================================================================
     Views: compare
     ========================================================================== */
  function renderCompare(root) {
    const picks = S.buildings.filter(b => S.compare.has(b.id));
    if (!picks.length) return root.append(emptyState("Open any listing and choose Compare to line up to four side by side.", "Nothing on the bench yet", true));
    const rows = [
      ["Neighborhood", areaName],
      ["Best match", b => f1(score(b)), score, 1],
      ["Rent", b => money(rentOf(b)), rentOf, -1],
      ["Size", b => b.sqft ? Math.round(b.sqft) + " sq ft" : "—", b => b.sqft, 1],
      ["$ per sq ft", b => ppsf(b) ? "$" + ppsf(b).toFixed(2) : "—", ppsf, -1],
      ["Saves vs. The Jayne", b => allIn(b) == null ? "—" : money(JAYNE.allIn - allIn(b)) + "/mo", b => allIn(b) == null ? null : JAYNE.allIn - allIn(b), 1],
      ["Reviews", b => repScore(b) == null ? "—" : repScore(b) + "/10", repScore, 1],
      ...REQS.map(r => [r.name, b => reqVal(b, r.key), null, 0, r.key]),
      ...FACTORS.map(f => [f.name, b => f1(factorScore(S.areaById.get(b.area_id), f)), b => factorScore(S.areaById.get(b.area_id), f), 1]),
      ["Landlord", b => b.landlord === "private" ? "Private owner" : ((b.reviews && b.reviews.management_company) || "Company")],
      ["Special", b => b.special || "—"],
      ["Red flags", b => (b.reviews && b.reviews.dealbreakers) || b.red_flags || "—"],
    ];
    root.append(
      h("div", { class: "viewhead" },
        h("h2", { class: "viewhead-title" }, "On the bench"),
        h("p", { class: "viewhead-sub", text: `${plural(picks.length, "specimen")} side by side${picks.length < 4 ? ` · room for ${4 - picks.length} more` : ""}. The best value in each row is marked.` })),
      h("div", { class: "tablewrap compare-wrap" }, h("table", { class: "compare", style: { "--cols": picks.length } },
        h("thead", null, h("tr", null, h("th", { class: "compare-corner", scope: "col" }, h("span", { class: "sr", text: "Attribute" })), ...picks.map(b => h("th", { scope: "col" },
          h("div", { class: "compare-head" },
            h("span", { class: "mono-label", text: areaName(b) || regionOf(b) }),
            h("button", { class: "compare-name", type: "button", text: b.name, onclick: () => openBuilding(b) }),
            verdict(b) === "all" ? h("span", { class: "tag ok", text: "Meets everything" }) : null,
            h("button", { class: "linkbtn sm", type: "button", "aria-label": "Remove " + b.name, text: "Remove", onclick: () => { S.compare.delete(b.id); ls.set("compare", [...S.compare]); renderToolbar(); renderResults(); } })))))),
        h("tbody", null, ...rows.map(([label, fmt, val, dir, reqKey]) => {
          let best = -1;
          if (val && picks.length > 1) { const vs = picks.map(val), ok = vs.filter(x => x != null); if (ok.length) best = vs.indexOf(dir > 0 ? Math.max(...ok) : Math.min(...ok)); }
          return h("tr", null, h("th", { scope: "row", class: "compare-k" }, reqKey ? reqIcon(reqKey) : null, label), ...picks.map((b, i) => {
            const t = String(fmt(b));
            if (reqKey) return h("td", null, h("span", { class: "reqword " + t }, h("i", { "aria-hidden": "true" }), REQ_WORD[t]));
            return h("td", { class: i === best ? "best" : null }, t, i === best ? h("span", { class: "sr", text: " (best)" }) : null);
          }));
        })))));
  }

  /* ==========================================================================
     Views: add a listing
     ========================================================================== */
  function renderAdd(root) {
    const tri = r => h("fieldset", { class: "tri" },
      h("legend", null, reqIcon(r.key), r.name),
      h("div", { class: "tri-opts" }, ...[["unclear", "Not sure"], ["yes", "Yes"], ["no", "No"]].map(([v, t], i) =>
        h("label", { class: "tri-opt " + v }, h("input", { type: "radio", name: "a-" + r.key, value: v, checked: i === 0 }), h("span", { text: t })))));
    const field = (id, label, input, hint) => h("div", { class: "field" }, h("label", { for: id, text: label }), input, hint ? h("p", { class: "hint", text: hint }) : null);
    const num = (id, ph) => h("input", { id, type: "number", min: 0, inputmode: "numeric", placeholder: ph || "" });
    const form = h("form", { class: "accession" },
      h("header", { class: "accession-head" },
        h("p", { class: "mono-label", text: "Accession form" }),
        h("h2", { class: "accession-title", text: "Add a specimen" }),
        h("p", { class: "accession-lede", text: "Found something on Zillow, Craigslist or a walk around the block? Add it and it will be scored with its neighborhood." })),
      h("div", { class: "accession-section" },
        h("p", { class: "section-k" }, h("span", { text: "I" }), "Where"),
        field("a-name", "Building or address", h("input", { id: "a-name", required: true, autocomplete: "off" })),
        field("a-area", "Neighborhood", h("select", { id: "a-area", class: "select", required: true }, h("option", { value: "", text: "Choose…" }),
          ...REGIONS.map(r => h("optgroup", { label: r }, ...S.areas.filter(a => a.region === r).map(a => h("option", { value: a.id, text: a.name }))))))),
      h("div", { class: "accession-section" },
        h("p", { class: "section-k" }, h("span", { text: "II" }), "Measures"),
        h("div", { class: "grid2" },
          field("a-base", "List rent ($/mo)", num("a-base")),
          field("a-eff", "Rent after specials", num("a-eff", "Same as list"), "Leave blank if there is no special."),
          field("a-sqft", "Size (sq ft)", num("a-sqft")),
          field("a-park", "Parking ($/mo)", num("a-park", "0 if included")))),
      h("div", { class: "accession-section" },
        h("p", { class: "section-k" }, h("span", { text: "III" }), "Requirements"),
        h("div", { class: "tris" }, ...REQS.map(tri)),
        field("a-landlord", "Landlord", h("select", { id: "a-landlord", class: "select" }, h("option", { value: "company", text: "Management company" }), h("option", { value: "private", text: "Private owner" })))),
      h("div", { class: "accession-section" },
        h("p", { class: "section-k" }, h("span", { text: "IV" }), "Notes"),
        field("a-url", "Listing link", h("input", { id: "a-url", type: "url", placeholder: "https://" })),
        field("a-note", "Notes", h("textarea", { id: "a-note", rows: 3 }))),
      h("div", { class: "accession-foot" },
        h("button", { class: "btn", type: "submit", disabled: !S.loaded, text: "Add listing" }),
        h("p", { class: "hint", text: "Saved in this browser only. Export notes to back it up." })));
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const v = id => form.querySelector("#" + id).value.trim(), n = id => v(id) === "" ? null : Number(v(id));
      const radio = name => { const r = form.querySelector(`input[name="${name}"]:checked`); return r ? r.value : "unclear"; };
      const area = S.areaById.get(v("a-area")), j = () => (Math.random() - .5) * .01;
      const b = { id: "you-" + Date.now().toString(36), name: v("a-name"), area_id: area ? area.id : null, region: area ? area.region : null,
        lat: area ? area.lat + j() : null, lng: area ? area.lng + j() : null, base_rent: n("a-base"), effective_rent: n("a-eff") ?? n("a-base"),
        sqft: n("a-sqft"), parking_fee: n("a-park"), req: Object.fromEntries(REQS.map(r => [r.key, radio("a-" + r.key)])), landlord: v("a-landlord"),
        listing_url: v("a-url") || null, notes: v("a-note"), source: "you", my_status: "watch", added_at: new Date().toISOString() };
      if (await saveBuilding(b, true)) { form.reset(); S.view = "list"; ls.set("view", "list"); renderToolbar(); renderResults(); openBuilding(b); toast("Listing added"); }
    });
    root.append(form);
  }

  /* ==========================================================================
     Empty state
     ========================================================================== */
  function emptyState(msg, title, noClear) {
    const loading = !S.loaded;
    return h("div", { class: "empty" },
      art("empty-art", ill("empty")) || h("span", { class: "empty-art empty-fallback", "aria-hidden": "true" }),
      h("p", { class: "empty-title", text: loading ? "Loading listings…" : title || "Nothing in the cabinet" }),
      loading ? null : h("p", { class: "empty-text", text: msg || "No listing matches this search and these filters. Try a broader search, or start over." }),
      loading || noClear ? null : h("button", { class: "btn ghost", type: "button", text: "Clear all filters", onclick: clearAll }));
  }

  /* ==========================================================================
     Render loop
     ========================================================================== */
  function renderResults() {
    const list = visible();
    S.rank = new Map(list.map((b, i) => [b.id, i + 1]));
    const meet = list.filter(b => verdict(b) === "all").length;
    $("count").replaceChildren(S.loaded
      ? h("span", { class: "count-inner" }, h("b", { text: list.length }), h("span", { class: "count-of", text: ` of ${S.buildings.length} listings` }), S.q ? h("span", { class: "count-q", text: ` matching “${S.q}”` }) : null, h("span", { class: "count-meet", text: ` · ${meet} meet everything` }))
      : "Loading…");
    renderStats(list);
    const root = $("view");
    root.replaceChildren();
    root.dataset.view = S.view;
    root.classList.remove("enter"); void root.offsetWidth; root.classList.add("enter");
    ({ list: renderList, table: renderTable, map: renderMap, areas: renderAreas, compare: renderCompare, add: renderAdd }[S.view] || renderList)(root, list);
  }

  /* ==========================================================================
     Drawer (dossier)
     ========================================================================== */
  let drawerState = null;
  function drawer(title, ...content) {
    const root = $("drawerRoot");
    const body = h("div", { class: "drawer-body" }, ...content);
    if (drawerState) { // already open: swap contents in place
      drawerState.panel.querySelector(".drawer-body").replaceWith(body);
      drawerState.panel.querySelector(".drawer-bar-title").textContent = title;
      drawerState.panel.scrollTop = 0;
      body.classList.add("swap");
      drawerState.panel.querySelector(".drawer-close").focus();
      return;
    }
    const prevFocus = document.activeElement;
    const closeBtn = h("button", { class: "iconbtn drawer-close", type: "button", "aria-label": "Close", html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>' });
    const panel = h("div", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-labelledby": "drawerTitle", tabindex: -1 },
      h("div", { class: "drawer-bar" }, h("p", { class: "drawer-bar-title mono-label", text: title }), closeBtn), body);
    const scrim = h("div", { class: "scrim" });
    const close = () => {
      if (!drawerState) return;
      document.removeEventListener("keydown", onKey);
      root.classList.remove("is-open");
      document.documentElement.classList.remove("drawer-open");
      drawerState = null;
      const done = () => { if (!drawerState) root.replaceChildren(); };
      reduceMotion() ? done() : setTimeout(done, 380);
      if (prevFocus && prevFocus.isConnected) prevFocus.focus({ preventScroll: true });
    };
    const onKey = e => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "Tab") {
        const f = [...panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]')].filter(x => x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    closeBtn.addEventListener("click", close);
    scrim.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    root.replaceChildren(scrim, panel);
    document.documentElement.classList.add("drawer-open");
    drawerState = { panel, close };
    void panel.offsetWidth;
    requestAnimationFrame(() => root.classList.add("is-open"));
    closeBtn.focus({ preventScroll: true });
  }
  function kv(pairs) {
    const rows = pairs.filter(([, v]) => v != null && v !== "" && v !== false);
    return rows.length ? h("dl", { class: "kv" }, ...rows.flatMap(([k, v]) => [h("dt", { text: k }), v instanceof Node ? h("dd", null, v) : h("dd", { text: String(v) })])) : null;
  }
  const section = (title, ...body) => h("section", { class: "dsec" }, h("h3", { class: "dsec-title" }, h("span", { text: title })), ...body);
  function sources(list, label) {
    if (!list || !list.length) return null;
    return h("details", { class: "srcs" }, h("summary", null, h("span", { text: `${label || "Sources"} (${list.length})` })), h("ol", null, ...list.map(u => h("li", null, linkOut(u)))));
  }
  function reviewSection(b) {
    const r = b.reviews;
    if (!r || (r.reputation_score == null && !(r.complaints || []).length && !(r.praise || []).length && !(r.management && r.management.summary)))
      return section("What residents say", h("p", { class: "muted", text: "No resident reviews found yet." }));
    const parts = REVIEW_PARTS.filter(([k]) => r[k] && (r[k].summary || r[k].score != null));
    return section("What residents say",
      h("div", { class: "rev-head" },
        h("div", { class: "rev-score" }, h("b", { text: r.reputation_score != null ? r.reputation_score : "—" }), h("span", { text: "/ 10" })),
        h("div", { class: "rev-meta" },
          r.management_company ? h("p", { class: "rev-co", text: r.management_company }) : null,
          h("p", { class: "muted small", text: [r.confidence && r.confidence + " confidence", r.recent_trend].filter(Boolean).join(" · ") }))),
      r.ratings && r.ratings.length ? h("ul", { class: "ratings" }, ...r.ratings.map(x => h("li", null, h("span", { class: "ratings-site", text: x.site }), h("b", { text: x.rating ?? "—" }), x.count ? h("span", { class: "ratings-n", text: x.count + " reviews" }) : null))) : null,
      r.note ? h("p", { class: "callout warn", text: r.note }) : null,
      r.dealbreakers ? h("p", { class: "callout bad" }, h("b", { text: "Red flags. " }), r.dealbreakers) : null,
      (r.praise && r.praise.length) || (r.complaints && r.complaints.length) ? h("div", { class: "procon" },
        r.praise && r.praise.length ? h("div", null, h("p", { class: "mono-label ok-ink", text: "Praise" }), ul(r.praise, "ticklist pro")) : null,
        r.complaints && r.complaints.length ? h("div", null, h("p", { class: "mono-label bad-ink", text: "Complaints" }), ul(r.complaints, "ticklist con")) : null) : null,
      parts.length ? h("div", { class: "subscores" }, ...parts.map(([k, label]) =>
        h("div", { class: "subscore" },
          h("div", { class: "subscore-head" }, h("span", { text: label }), h("span", { class: "subscore-v" }, r[k].score != null ? h("span", { class: "meter xs", "aria-hidden": "true" }, h("i", { style: { "--w": r[k].score * 10 + "%" } })) : null, r[k].score != null ? r[k].score + "/10" : "")),
          r[k].summary ? h("p", { text: r[k].summary }) : null))) : null,
      sources(r.sources, "Review sources"));
  }
  const REQ_DETAIL = {
    wd: b => null,
    ac: b => b.ac_evidence,
    dw: b => null,
    parking: b => b.parking_fee ? money(b.parking_fee) + "/mo" : reqVal(b, "parking") === "yes" ? "Available, fee unknown" : null,
    packages: b => b.packages_detail,
  };
  function openBuilding(b) {
    const a = S.areaById.get(b.area_id), v = verdict(b), c = allIn(b), d = savingsOf(b), sc = score(b), rank = S.rank.get(b.id), p = ppsf(b);
    const statusGroup = h("div", { class: "statuses", role: "radiogroup", "aria-label": "Status" }, ...STATUSES.map(st =>
      h("label", { class: "status-opt" },
        h("input", { type: "radio", name: "d-status", value: st.key, checked: (b.my_status || "new") === st.key, disabled: !S.canWrite,
          onchange: e => { b = { ...b, my_status: e.target.value }; saveBuilding(b).then(ok => ok && toast("Saved")); } }),
        h("span", { text: st.name }))));
    const note = h("textarea", { id: "d-note", rows: 4, disabled: !S.canWrite, placeholder: "Tour impressions, questions for the leasing office…" }, b.my_note || "");
    let t; note.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { b = { ...b, my_note: note.value }; saveBuilding(b).then(ok => ok && toast("Note saved")); }, 900); });
    const cmpBtn = h("button", { class: "btn ghost sm", type: "button", disabled: !S.compare.has(b.id) && S.compare.size >= 4,
      text: S.compare.has(b.id) ? "Remove from compare" : "Add to compare",
      onclick: e => { S.compare.has(b.id) ? S.compare.delete(b.id) : S.compare.add(b.id); ls.set("compare", [...S.compare]); e.currentTarget.textContent = S.compare.has(b.id) ? "Remove from compare" : "Add to compare"; renderToolbar(); renderResults(); } });
    drawer(rank ? `Specimen No. ${pad2(rank)} of ${S.rank.size}` : "Specimen",
      h("header", { class: "dossier-head" + (v === "all" && ill("seal", "Meets everything") ? " has-seal" : "") },
        h("div", { class: "dossier-kicker" }, regionEmblem(regionOf(b), "sm"), h("span", { text: [a && a.name, regionOf(b)].filter(Boolean).join(" · ") })),
        h("h2", { class: "dossier-name", id: "drawerTitle", text: b.name }),
        b.address ? h("p", { class: "dossier-addr", text: b.address }) : null,
        h("div", { class: "dossier-verdict" },
          h("span", { class: "tag " + (v === "all" ? "ok" : v === "fail" ? "bad" : "amber"), text: VERDICTS[v] }),
          ...flagTags(b, false),
          v === "fail" ? h("span", { class: "muted small", text: failReasons(b).join(" · ") }) : null),
        v === "all" ? seal() : null),
      h("div", { class: "hero-figs" },
        h("div", { class: "hero-fig" }, h("span", { class: "fig-k", text: "Rent" }), h("b", { class: "serif", text: money(rentOf(b)) }), h("span", { class: "hero-sub", text: b.base_rent && rentOf(b) < b.base_rent ? money(b.base_rent) + " list" : "per month" })),
        h("div", { class: "hero-fig" }, h("span", { class: "fig-k", text: "Size" }), h("b", { class: "serif", text: b.sqft ? Math.round(b.sqft) : "—" }), h("span", { class: "hero-sub", text: p ? "sq ft · $" + p.toFixed(2) + "/ft²" : "sq ft" })),
        h("div", { class: "hero-fig" }, h("span", { class: "fig-k", text: "Match" }), h("b", { class: "serif" }, f1(sc)), h("span", { class: "hero-sub" }, jar(sc, "xs"), "of 10, your weights")),
        h("div", { class: "hero-fig " + (d == null ? "" : d >= 0 ? "pos" : "neg") }, h("span", { class: "fig-k", text: d == null || d >= 0 ? "Saves vs. The Jayne" : "Costs vs. The Jayne" }), h("b", { class: "serif", text: d == null ? "—" : money(Math.abs(d)) }), h("span", { class: "hero-sub", text: d == null ? "rent unknown" : `a month · ${money(Math.abs(d) * 12)} a year, with parking` }))),
      b.scam_flags ? h("p", { class: "callout bad" }, h("b", { text: "Scam warning. " }), b.scam_flags) : null,
      h("div", { class: "dossier-actions" }, cmpBtn,
        b.listing_url ? h("a", { class: "btn ghost sm", href: b.listing_url, target: "_blank", rel: "noopener" }, "Open listing", h("span", { "aria-hidden": "true", text: " ↗" })) : null,
        a ? h("button", { class: "btn ghost sm", type: "button", text: "Neighborhood report", onclick: () => openArea(a) }) : null),
      section("Requirements",
        h("ul", { class: "checklist" }, ...REQS.map(r => {
          const x = reqVal(b, r.key), det = REQ_DETAIL[r.key](b);
          return h("li", { class: "check-row " + x },
            h("span", { class: "check-ico" }, reqIcon(r.key) || h("span", { class: "req-glyph", "aria-hidden": "true", text: x === "yes" ? "✓" : x === "no" ? "✕" : "?" })),
            h("div", { class: "check-main" }, h("p", { class: "check-name", text: r.name }), det ? h("p", { class: "check-det", text: det }) : null),
            h("span", { class: "reqword " + x }, h("i", { "aria-hidden": "true" }), REQ_WORD[x]));
        }))),
      section("My notes",
        h("div", { class: "notes-card" },
          h("p", { class: "mono-label", id: "d-status-l", text: "Status" }), statusGroup,
          h("label", { class: "mono-label", for: "d-note", text: "Notes" }), note,
          h("p", { class: "hint", text: "Saved in this browser. Use Export notes at the bottom of the page to back up." }))),
      section("Particulars",
        kv([
          ["List rent", b.base_rent ? money(b.base_rent) : null], ["Special", b.special || "None listed"],
          ["All-in", c == null ? null : money(c) + "/mo with parking"],
          ["Built", b.year_built], ["Landlord", b.landlord === "private" ? [b.owner_type || "Private owner", b.platform && "on " + b.platform].filter(Boolean).join(", ") : (b.reviews && b.reviews.management_company) || "Management company"],
          ["Rent control", b.rent_control], ["Complex", b.hoa_amenities],
          ["Internet", b.internet], ["Location", b.location_note], ["Watch out for", b.red_flags], ["Last checked", b.checked_on],
        ]),
        b.notes ? h("p", { class: "research-note", text: b.notes }) : null),
      reviewSection(b),
      a ? section("Neighborhood",
        h("div", { class: "nb-head" }, h("p", null, h("b", { class: "serif nb-name", text: a.name }), h("span", { class: "muted small", text: " · score " + f1(areaScore(a)) + " / 10" }))),
        factorBars(a, "in-drawer"),
        h("button", { class: "linkbtn", type: "button", text: "Open the full neighborhood report →", onclick: () => openArea(a) })) : null,
      sources(b.sources));
  }
  const AREA_ICON = { Freeways: "drive", Traffic: "drive", "Specialty coffee": "coffee", Walkability: "coffee", Quiet: "quiet", Safety: "safety", LAX: "lax", Nightlife: "extras", Gyms: "extras", Errands: "extras", Rail: "drive" };
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
    const sc = areaScore(a);
    drawer("Atlas · " + a.region,
      h("header", { class: "dossier-head area-head" },
        regionEmblem(a.region, "lg"),
        h("div", { class: "dossier-kicker" }, h("span", { text: a.region })),
        h("h2", { class: "dossier-name", id: "drawerTitle", text: a.name })),
      h("div", { class: "hero-figs two" },
        h("div", { class: "hero-fig" }, h("span", { class: "fig-k", text: "Neighborhood score" }), h("b", { class: "serif", text: f1(sc) }), h("span", { class: "hero-sub" }, jar(sc, "xs"), "of 10, your weights")),
        h("div", { class: "hero-fig" }, h("span", { class: "fig-k", text: "Listings here" }), h("b", { class: "serif", text: bs.length }), h("span", { class: "hero-sub", text: bs.filter(matches).length + " in view" }))),
      a.summary ? h("p", { class: "dossier-summary", text: a.summary }) : null,
      factorBars(a, "in-drawer"),
      a.airports_other ? h("p", { class: "muted small", text: "Other airports: " + a.airports_other }) : null,
      bs.length ? section(`Listings here`,
        h("ul", { class: "minilist" }, ...bs.map(b => h("li", null, h("button", { type: "button", class: "minilist-btn v-" + verdict(b), onclick: () => openBuilding(b) },
          h("span", { class: "minilist-name", text: b.name }), h("span", { class: "minilist-rent", text: money(rentOf(b)) }), h("span", { class: "minilist-arrow", "aria-hidden": "true", text: "→" })))))) : null,
      section("Field notes",
        h("div", { class: "fieldnotes" }, ...blocks.map(([name, x, extra]) => h("div", { class: "fieldnote" },
          h("header", { class: "fieldnote-head" }, factorIcon(AREA_ICON[name]), h("span", { class: "fieldnote-name", text: name }), h("span", { class: "fieldnote-v" }, x.score != null ? h("span", { class: "meter xs", "aria-hidden": "true" }, h("i", { style: { "--w": x.score * 10 + "%" } })) : null, x.score != null ? x.score + "/10" : "—")),
          extra ? extra(x) : null, x.note ? h("p", { class: "fieldnote-note", text: x.note }) : null)))),
      sources(a.sources));
  }

  /* ==========================================================================
     Data (embedded; personal edits live in this browser)
     ========================================================================== */
  const DATA = JSON.parse(document.getElementById("data").textContent);
  async function saveBuilding(b, isNew) {
    const i = S.buildings.findIndex(x => x.id === b.id);
    if (i >= 0) S.buildings[i] = b; else S.buildings.push(b);
    const local = ls.get("edits", {});
    local[b.id] = isNew ? b : { ...(local[b.id] || {}), my_status: b.my_status, my_note: b.my_note };
    if (!ls.set("edits", local)) { toast("Couldn't save in this browser. Use Export to keep a copy."); }
    renderResults(); renderChips();
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

  function renderArt() {
    const hero = ill("hero");
    if (hero) { $("heroArt").innerHTML = hero; document.body.classList.add("has-hero"); }
    const orn = ill("ornament");
    if (orn) $("ornament").innerHTML = orn;
  }
  function boot() {
    renderArt();
    renderDates();
    setData(DATA.buildings, DATA.neighborhoods);
    applyEdits(ls.get("edits", {}));
    S.canWrite = true;
    $("dataDate").textContent = "Data updated " + DATA.updated;
    $("mastDate").textContent = "Updated " + DATA.updated;
    renderAll();
  }
  function renderAll() { renderFilters(); renderToolbar(); renderResults(); }
  boot();
})();
