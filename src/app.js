(() => {
  /* ==========================================================================
     Facts from the renewal letter
     ========================================================================== */
  const JAYNE = { allIn: 2726.83 };
  const DATES = [
    { id: "renewal", label: "Renewal offer expires", date: "2026-11-13" },
    { id: "notice", label: "Written notice due", date: "2026-12-30" },
    { id: "lease", label: "Lease ends", date: "2027-01-29" },
  ];
  /* Timeline (shared by every market): the fixed dates, then the recommended steps. */
  const TL = { start: "2026-10-26", end: "2027-02-28" };
  const HARD = [
    { id: "renewal", label: "Renewal offer expires", short: "Renewal expires", date: "2026-11-13", basis: "Renewal letter" },
    { id: "notice", label: "Written notice due", short: "Notice due", date: "2026-12-30", basis: "Renewal letter" },
    { id: "lease", label: "Lease ends", short: "Lease ends", date: "2027-01-29", basis: "Renewal letter" },
    { id: "deposit", label: "Deposit return deadline", short: "Deposit due", date: "2027-02-19", basis: "21 days after move-out, Civ. Code 1950.5" },
  ];
  const PHASES = [
    { id: "shortlist", title: "Shortlist", start: "2026-10-26", end: "2026-11-15",
      why: "Narrow the list while nothing is urgent. Two requirements are rarely stated in listings, so confirm them by phone before spending a weekend on tours.",
      tasks: [["narrow", "Narrow the list to the buildings worth touring"], ["ac", "Call to confirm central AC"], ["wd", "Call to confirm the in-unit washer/dryer"], ["status", "Set a status on every listing you keep"]] },
    { id: "renewal", title: "Let the renewal offer lapse", date: "2026-11-13", hard: "renewal",
      why: "The renewal offer ($2,726.83 a month, all-in) expires on Nov 13. Let it lapse as a decision, not by accident.",
      tasks: [["decide", "Decide not to renew at $2,726.83"], ["mtm", "Optional fallback: ask The Jayne for its month-to-month or short-term rate, in writing"]] },
    { id: "listings", title: "Late-January listings appear", start: "2026-12-01", end: "2027-01-01",
      why: "Most buildings list a unit 30 to 60 days before it is ready, so units for a late-January move-in appear through December.",
      tasks: [["alerts", "Set saved-search alerts for a Jan 30 move-in"], ["recheck", "Recheck shortlisted buildings for new units each week"]] },
    { id: "tour", title: "Tour window", start: "2026-12-01", end: "2026-12-14",
      why: "Tour while the late-January units are new. Have the application packet ready by Dec 1 so you can apply the day you tour.",
      tasks: [["id", "Packet: photo ID"], ["income", "Packet: pay stubs or offer letter"], ["bank", "Packet: bank statements"], ["credit", "Packet: a credit report"], ["refs", "Packet: references"], ["insurance", "Packet: a renters-insurance quote"], ["book", "Book the tours"]] },
    { id: "negotiate", title: "Negotiation window", start: "2026-12-15", end: "2026-12-23",
      why: "Leasing offices have year-end occupancy goals. Ask for more than the posted special, and judge offers on net-effective rent.",
      tasks: [["special", "Ask for the current special"], ["fees", "Ask to waive application and admin fees"], ["parking", "Ask for free parking"], ["net", "Compare net-effective rent against base rent"]] },
    { id: "sign", title: "Target signing date", date: "2026-12-23",
      why: "Signing by Dec 23 leaves a week's buffer before written notice is due.",
      tasks: [["sign", "Sign the new lease"], ["movein", "Get the move-in date (about Jan 30) in writing"]] },
    { id: "notice", title: "Written notice to The Jayne", date: "2026-12-30", hard: "notice",
      why: "Notice is due by Dec 30. Send it in writing and keep proof that it was delivered.",
      tasks: [["send", "Send written notice"], ["proof", "Keep proof of delivery"]] },
    { id: "logistics", title: "Move logistics", start: "2027-01-02", end: "2027-01-25",
      why: "Book what has lead times first: movers, the internet install and the elevator or loading dock.",
      tasks: [["movers", "Book movers"], ["utilities", "Set up utilities"], ["internet", "Schedule the internet install"], ["insurance", "Start renters insurance"], ["usps", "Forward mail with USPS"], ["permit", "Get a parking permit"], ["dock", "Book the elevator or loading dock"]] },
    { id: "inspection", title: "Pre-move-out inspection", date: "2027-01-15",
      why: "California lets you ask for an inspection about two weeks before move-out, so you can fix what it lists before the deposit is assessed (Civ. Code 1950.5(f)).",
      tasks: [["request", "Request the inspection in writing"], ["inspect", "Do the inspection, about Jan 15"]] },
    { id: "move", title: "Lease ends; move in", start: "2027-01-29", end: "2027-01-30", hard: "lease",
      why: "The Jayne lease ends Jan 29; move in around Jan 30. Photograph both units.",
      tasks: [["photo-old", "Photograph The Jayne unit, empty"], ["photo-new", "Photograph the new unit before unpacking"]] },
    { id: "deposit", title: "Deposit back", date: "2027-02-19", hard: "deposit",
      why: "The deposit, with an itemized statement for any deductions, is due within 21 days of move-out (Civ. Code 1950.5).",
      tasks: [["forward", "Give The Jayne a forwarding address"], ["received", "Deposit received by Feb 19"]] },
  ];
  PHASES.forEach((p, i) => { p.n = i + 1; });
  const RENT_CAP = 2300, MIN_SQFT = 700;

  /* ==========================================================================
     Scoring model
     ========================================================================== */
  const FACTORS = [
    // pw: optional per-part weights inside a factor (default: equal). Freeway access matters more than traffic.
    { key: "drive",  name: "Freeway and traffic",  parts: ["freeway", "traffic"], pw: [0.8, 0.2], def: 25 },  // name follows the market (setMarket)
    { key: "coffee", name: "Coffee and walking",   parts: ["coffee", "walk"], def: 45 },
    { key: "quiet",  name: "Quiet",                parts: ["quiet"], def: 5 },
    { key: "safety", name: "Safety",               parts: ["safety"], def: 5 },
    { key: "lax",    name: "LAX",                  parts: ["lax"], def: 5 },
    { key: "extras", name: "Nightlife, gyms, errands", parts: ["nightlife", "gyms", "services"], def: 15 },
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
  /* Markets. Requirements, deadlines, the Jayne baseline, weights and statuses are shared;
     listings, neighborhoods, map, regions and match scaling belong to each market. */
  const MARKET_INFO = {
    la: { name: "Los Angeles", numeral: "I", regions: ["Los Angeles", "Long Beach", "Orange County"], roads: "Freeway and traffic", roadsShort: "Freeways", airport: "LAX" },
    seattle: { name: "Seattle", numeral: "II", regions: ["Seattle", "Eastside", "North & South suburbs"], roads: "Highways and traffic", roadsShort: "Highways", airport: "Airport (SEA)" },
    nyc: { name: "New York", numeral: "III", regions: ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island", "New Jersey"], roads: "Highways and traffic", roadsShort: "Highways", airport: "Airport (JFK · LGA · EWR)" },
  };
  let REGIONS = MARKET_INFO.la.regions.slice();   // regions present in the current market (setMarket)
  const VERDICTS = { all: "Meets everything", check: "Needs checks", fail: "Fails a requirement" };
  const FWY_BANDS = [["under 1 mi", "Under 1 mi"], ["1–2 mi", "1 to 2 mi"], ["over 2 mi", "Over 2 mi"], ["unknown", "Not found"]];
  /* Three-state filters where "not confirmed" matters: any / confirmed yes / yes or not confirmed. */
  const TRI_MODES = [["any", "Any"], ["yes", "Yes"], ["maybe", "Not ruled out"]];
  const LANDLORDS = { company: "Management company", private: "Private owner" };
  const SORTS = [["score", "Best match"], ["value", "Best match per dollar"], ["rent", "Lowest rent"], ["cost", "Lowest true monthly cost"], ["sqft", "Largest"], ["ppsf", "Lowest $/sq ft"], ["reviews", "Best reviewed"], ["name", "Name"]];
  const VIEWS = [["list", "Specimens"], ["table", "Table"], ["map", "Map"], ["areas", "Neighborhoods"], ["compare", "Compare"], ["timeline", "Timeline"], ["add", "Add"]];
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

  /* ==========================================================================
     Persistence
     ========================================================================== */
  const ls = {
    get(k, d) { try { const v = localStorage.getItem("aps27b:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("aps27b:" + k, JSON.stringify(v)); return true; } catch { return false; } },
  };
  const COST_MAX = 3000, YEAR_MIN = 1920, HEAT_MAX = 100;
  const DEFAULT_FILTERS = {
    maxRent: RENT_CAP, minSqft: MIN_SQFT, minRep: 0, maxCost: COST_MAX,
    hideRegions: [], verdicts: ["all", "check"], landlords: ["company", "private"],
    statuses: ["new", "watch", "tour", "applied"], mustHave: [], hideScam: true, newOnly: false,
    cats: "any", dogs: "any", garage: "any", ev: "any", gym: "any", pool: "any", elevator: "any", access: "any", balcony: "any",
    minYear: YEAR_MIN, yearUnknown: true, fwy: FWY_BANDS.map(([k]) => k), maxHeat: HEAT_MAX, minWalk: 0, walkUnknown: true, minDoc: 0,
    specials: "any",
  };
  const freshFilters = () => JSON.parse(JSON.stringify(DEFAULT_FILTERS));
  /* Saved filters from earlier versions kept an allow-list of LA regions; keep only what is hidden,
     so a region that does not exist in another market can never filter everything out. */
  function loadFilters() {
    const saved = ls.get("filters", {}) || {};
    if (Array.isArray(saved.regions)) { if (!saved.hideRegions) saved.hideRegions = MARKET_INFO.la.regions.filter(r => !saved.regions.includes(r)); delete saved.regions; }
    const f = Object.assign(freshFilters(), saved);
    for (const k of Object.keys(DEFAULT_FILTERS)) if (Array.isArray(DEFAULT_FILTERS[k]) && !Array.isArray(f[k])) f[k] = DEFAULT_FILTERS[k].slice();
    return f;
  }
  const defaultWeights = Object.fromEntries(FACTORS.concat(REP).map(f => [f.key, f.def]));
  /* Weights v2 (quiet, safety and traffic lowered): a new key, so weights saved under the old
     defaults do not override the new ones. Reset weights restores these defaults. */
  const WEIGHTS_KEY = "weights-v2";
  const S = {
    buildings: [], areas: [], areaById: new Map(), market: ls.get("market", "la"),
    f: loadFilters(),
    weights: Object.assign({}, defaultWeights, ls.get(WEIGHTS_KEY, {})),
    q: "", view: ls.get("view", "list"), sort: ls.get("sort", "score"),
    density: ls.get("density", "cards"),
    tsort: ls.get("tsort", { key: "score", dir: -1 }),
    tcols: ls.get("tcols", null),
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
  const RM = matchMedia("(prefers-reduced-motion: reduce)");
  const reduceMotion = () => RM.matches;

  /* ==========================================================================
     Motion kit. Transforms and opacity only; everything is skipped under
     prefers-reduced-motion. Content is never left hidden: entrances are short
     and only run for elements that are on screen when they start.
     ========================================================================== */
  const EASE = { out: "cubic-bezier(.2,.7,.2,1)", quint: "cubic-bezier(.22,1,.36,1)", spring: "cubic-bezier(.3,1.3,.4,1)", inOut: "cubic-bezier(.65,0,.35,1)", in: "cubic-bezier(.4,0,1,1)" };
  function anim(el, frames, opts) {
    if (reduceMotion() || !el || typeof el.animate !== "function") return null;
    try { return el.animate(frames, Object.assign({ duration: 240, easing: EASE.out }, opts)); } catch { return null; }
  }
  const onScreen = (r, pad = 80) => r && r.bottom > -pad && r.top < innerHeight + pad && r.right > -pad && r.left < innerWidth + pad && r.width > 0;
  /* Tween a number shown as text (not used inside live regions). */
  function tween(el, to, fmt, dur = 520) {
    if (!el) return;
    const from = el._tv == null ? to : el._tv;
    cancelAnimationFrame(el._raf); el._tv = to;
    if (from === to || to == null || from == null || isNaN(from) || isNaN(to) || reduceMotion() || document.hidden) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = fmt(k >= 1 ? to : from + (to - from) * e);
      if (k < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  }
  /* One toast at a time; a second message replaces the text with a small bump. */
  let toastEl = null, toastTimer = 0;
  function toast(msg) {
    clearTimeout(toastTimer);
    if (toastEl && toastEl.isConnected) {
      toastEl.textContent = msg; toastEl.classList.add("in");
      anim(toastEl, [{ transform: "translate(-50%, 0) scale(.96)" }, { transform: "translate(-50%, 0) scale(1)" }], { duration: 260, easing: EASE.spring });
    } else {
      toastEl = h("div", { class: "toast", role: "status", text: msg });
      document.body.append(toastEl);
      void toastEl.offsetWidth;
      toastEl.classList.add("in");
    }
    const t = toastEl;
    toastTimer = setTimeout(() => { t.classList.remove("in"); setTimeout(() => { if (!t.classList.contains("in")) { t.remove(); if (toastEl === t) toastEl = null; } }, 320); }, 2400);
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
  // Liquid travel inside the jar's 36x48 grid (top 18.5 → bottom 42.9).
  const JAR_TRAVEL = 24.4;
  function jar(s, cls, max = 100) {
    const v = s == null ? 0 : Math.max(0, Math.min(1, s / max)), q = Math.round(v * 20) / 20;
    const m = ill("jar", q, { tint: "green" });
    if (!m) return h("span", { class: "meter " + (cls || ""), "aria-hidden": "true" }, h("i", { style: { "--w": v * 100 + "%" } }));
    const el = art("jar " + (cls || ""), m);
    el.style.setProperty("--lift", (q * JAR_TRAVEL + 1).toFixed(1) + "px");
    el.dataset.v = q;
    return el;
  }
  const seal = () => art("seal", ill("seal", "Meets everything"));

  /* ==========================================================================
     Derived values
     ========================================================================== */
  /* Weighted mean of a factor's parts that have a score (part weights renormalize when one is missing). */
  const factorScore = (a, f) => {
    let t = 0, w = 0;
    f.parts.forEach((p, i) => { const x = a && a[p] && Number(a[p].score); if (typeof x !== "number" || isNaN(x)) return; const pw = f.pw ? f.pw[i] : 1; t += x * pw; w += pw; });
    return w ? t / w : null;
  };
  function areaScore(a) {
    if (!a) return null; let t = 0, w = 0;
    for (const f of FACTORS) { const s = factorScore(a, f), wt = Number(S.weights[f.key]) || 0; if (s == null || !wt) continue; t += s * wt; w += wt; }
    return w ? t / w : null;
  }
  const repScore = b => b.reviews && typeof b.reviews.reputation_score === "number" ? b.reviews.reputation_score : null;
  // Weighted 0–10 blend of neighborhood factors and building reviews.
  function rawScore(b) {
    const a = areaScore(S.areaById.get(b.area_id)), r = repScore(b);
    const wa = FACTORS.reduce((t, f) => t + (Number(S.weights[f.key]) || 0), 0), wr = Number(S.weights.rep) || 0;
    if (a == null) return r; if (r == null || !wr) return a;
    return (a * wa + r * wr) / (wa + wr);
  }
  // Match: rawScore rescaled to 0–100 across every listing (best = 100, lowest = 0), so small
  // differences in neighborhood scores become readable. Recomputed when weights or listings change.
  let matchCache = { key: "", list: null, min: 0, max: 0 };
  function matchRange() {
    const key = JSON.stringify(S.weights);
    if (matchCache.key !== key || matchCache.list !== S.buildings || matchCache.n !== S.buildings.length) {
      const vals = S.buildings.map(rawScore).filter(v => v != null && !isNaN(v));
      matchCache = { key, list: S.buildings, n: S.buildings.length, min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 0 };
    }
    return matchCache;
  }
  function score(b) {
    const r = rawScore(b);
    if (r == null || isNaN(r)) return null;
    const { min, max } = matchRange();
    return max > min ? ((r - min) / (max - min)) * 100 : 100;
  }
  const fm = n => n == null || isNaN(n) ? "—" : String(Math.round(n));
  const rentOf = b => b.effective_rent ?? b.base_rent;
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
    if (rent != null && rent > RENT_CAP) out.push(`Rent ${money(rent)} > ${money(RENT_CAP)}`);
    for (const r of REQS) if (reqVal(b, r.key) === "no") out.push("No " + r.name.charAt(0).toLowerCase() + r.name.slice(1));
    return out;
  }
  /* Fails only on rent: still a real candidate if the budget stretches. */
  const overBudgetOnly = b => { const r = failReasons(b); return r.length === 1 && r[0].startsWith("Rent "); };
  const verdictLabel = b => { const v = verdict(b); return v === "fail" && overBudgetOnly(b) ? "Over budget" : VERDICTS[v]; };
  const regionOf = b => { const a = S.areaById.get(b.area_id); return (a && a.region) || b.region || ""; };
  const areaName = b => { const a = S.areaById.get(b.area_id); return a ? a.name : ""; };
  /* Shown place name; never guesses a region the listing does not have (regionOf defaults for filtering only). */
  const whereText = b => areaName(b) || b.region || "Neighborhood not set";
  const isNew = b => b.batch === "new-oct15" || b.batch === "private-oct15";
  const statusName = k => (STATUSES.find(s => s.key === (k || "new")) || STATUSES[0]).name;
  /* Specials history (concessions research, LA): how often this building has run a special. */
  const PATTERN_WORD = { often: "Often", sometimes: "Sometimes", rarely: "Rarely", unknown: "—" };
  const patternOf = b => { const p = b.concessions && b.concessions.pattern; return PATTERN_WORD[p] ? p : "unknown"; };
  const SPEC_MODES = [["any", "Any"], ["some", "Often or sometimes"], ["often", "Often"]];

  /* ---- listing particulars (detail.*) ---------------------------------------------------- */
  const D = b => b.detail || {};
  const dget = (b, g, k) => { const o = D(b)[g]; const v = o ? o[k] : undefined;
    if (v == null && g === "costs" && k === "parking_fee") return b.parking_fee;
    if (v == null && g === "building" && k === "year_built") return b.year_built;
    return v; };
  const isKnown = v => !(v == null || v === "" || v === "unclear" || (Array.isArray(v) && !v.length));
  const triOf = v => v === "yes" || v === "no" ? v : "unclear";
  const parkType = b => dget(b, "parking", "type") || "unclear";
  const garageOf = b => { const t = parkType(b); return t === "garage" || t === "covered" ? "yes" : t === "unclear" ? "unclear" : "no"; };
  const areaOf = b => S.areaById.get(b.area_id) || null;
  const extrasOf = a => (a && a.extras) || {};
  const yearOf = b => { const y = dget(b, "building", "year_built"); return y == null || isNaN(+y) ? null : +y; };
  const summerHigh = b => { const v = extrasOf(areaOf(b)).summer_high_f; return v == null ? null : +v; };
  const typicalRent = b => { const v = extrasOf(areaOf(b)).median_1br_rent; return v == null ? null : +v; };
  const fwyBand = b => b.freeway_band || "unknown";
  /* Walk Score: the address score when research found one, else the neighborhood's. */
  function walkOf(b) {
    const own = dget(b, "location", "walk_score");
    if (own != null) return { v: +own, src: "address" };
    const a = areaOf(b), av = b.area_walk_score ?? (a && a.walk && a.walk.walk_score);
    return av != null ? { v: +av, src: "area" } : { v: null, src: null };
  }
  /* True monthly cost = rent after specials + parking fee + required monthly fees, when known.
     Unknown parts are listed, never guessed; the total then is a floor ("at least"). */
  const costCache = new WeakMap();
  function costOf(b) {
    if (costCache.has(b)) return costCache.get(b);
    const rent = rentOf(b), c = D(b).costs || {}, missing = [];
    let park = dget(b, "costs", "parking_fee");
    park = park == null || isNaN(+park) ? null : +park;
    let noPark = false;
    if (park == null) { if (reqVal(b, "parking") === "no" || parkType(b) === "street") { park = 0; noPark = true; } else missing.push("parking fee"); }
    const list = Array.isArray(c.required_fees) ? c.required_fees : [];
    let fees = null;
    if (b.required_fees_total != null && !isNaN(+b.required_fees_total)) { fees = +b.required_fees_total; if (list.some(x => x.amount == null)) missing.push("some fees"); }
    else if (list.length && list.some(x => x.amount != null)) { fees = list.reduce((t, x) => t + (+x.amount || 0), 0); if (list.some(x => x.amount == null)) missing.push("some fees"); }
    else missing.push("required fees");
    const out = { rent, park, fees, list, missing, noPark, total: rent == null ? null : rent + (park || 0) + (fees || 0) };
    costCache.set(b, out);
    return out;
  }
  const trueCost = b => costOf(b).total;
  const compareCount = () => S.buildings.filter(b => S.compare.has(b.id)).length;
  const savingsOf = b => { const c = trueCost(b); return c == null ? null : JAYNE.allIn - c; };
  const allIn = trueCost;
  /* Particulars: the dossier fields, grouped. The completeness meter is the share of these found. */
  const fmtMoney = v => money(v);
  const fmtMo = v => money(v) + "/mo";
  const fmtMin = v => Math.round(v) + " min";
  const fmtMi = v => (Math.round(v * 10) / 10) + " mi";
  const PARTICULARS = [
    ["costs", "Costs", [["required_fees", "Required fees"], ["utilities", "Utilities"], ["deposit", "Deposit", fmtMoney], ["application_fee", "Application fee", fmtMoney], ["admin_fee", "Admin fee", fmtMoney], ["parking_fee", "Parking fee", fmtMo], ["lease_terms", "Lease terms"]]],
    ["pets", "Pets", [["cats", "Cats", "tri"], ["dogs", "Dogs", "tri"], ["pet_rent", "Pet rent", fmtMo], ["pet_deposit", "Pet deposit", fmtMoney], ["limits", "Limits"]]],
    ["parking", "Parking", [["type", "Type"], ["ev_charging", "EV charging", "tri"], ["guest_parking", "Guest parking", "tri"]]],
    ["building", "Building", [["units", "Units"], ["stories", "Stories"], ["year_built", "Year built"], ["renovated", "Renovated"], ["elevator", "Elevator", "tri"], ["gym", "Gym", "tri"], ["pool", "Pool", "tri"], ["coworking", "Coworking", "tri"], ["rooftop_or_courtyard", "Roof deck or courtyard", "tri"], ["controlled_access", "Controlled access", "tri"], ["onsite_management", "On-site management", "tri"], ["smoke_free", "Smoke-free", "tri"]]],
    ["unit", "Unit", [["balcony", "Balcony", "tri"], ["storage", "Storage", "tri"], ["floors_available", "Floors available"], ["features", "Features"]]],
    ["internet", "Internet", [["fiber", "Fiber", "tri"], ["providers", "Providers"]]],
    ["location", "Location", [["walk_score", "Walk Score"], ["transit_score", "Transit Score"], ["bike_score", "Bike Score"], ["nearest_onramp", "Nearest on-ramp"], ["onramp_miles", "On-ramp distance", fmtMi], ["freeway_within_500ft", "Freeway within 500 ft", "tri"], ["nearest_specialty_cafe", "Specialty cafe"], ["cafe_walk_min", "Cafe walk", fmtMin], ["nearest_grocery", "Grocery"], ["grocery_walk_min", "Grocery walk", fmtMin], ["nearest_metro", "Rail station"], ["metro_walk_min", "Station walk", fmtMin], ["nearest_gym", "Gym nearby"], ["gym_minutes", "Gym trip", fmtMin], ["lax_drive_min_offpeak", "Airport drive, off-peak", fmtMin]]],
    ["availability", "Availability", [["units_note", "Units seen"], ["website", "Website", "url"], ["leasing_phone", "Leasing phone", "tel"]]],
  ];
  const DOC_TOTAL = PARTICULARS.reduce((t, g) => t + g[2].length, 0);
  const docCache = new WeakMap();
  function docShare(b) {
    if (docCache.has(b)) return docCache.get(b);
    let k = 0;
    for (const [g, , fields] of PARTICULARS) for (const [f] of fields) if (isKnown(dget(b, g, f))) k++;
    const v = k / DOC_TOTAL;
    docCache.set(b, v);
    return v;
  }
  const docPct = b => Math.round(docShare(b) * 100);

  const hayCache = new WeakMap();
  function haystack(b) {
    if (hayCache.has(b)) return hayCache.get(b);
    const r = b.reviews || {};
    const s = [b.name, b.address, areaName(b), regionOf(b), b.notes, b.special, b.packages_detail, b.owner_type, b.platform,
      r.management_company, b.landlord === "private" ? "private owner condo" : "management company", b.hoa_amenities, b.my_note]
      .filter(Boolean).join(" ").toLowerCase();
    hayCache.set(b, s);
    return s;
  }
  function matchesWith(b, f, q) {
    const rent = rentOf(b);
    if (f.hideRegions.length && f.hideRegions.includes(regionOf(b))) return false;
    if (!f.verdicts.includes(verdict(b))) return false;
    if (!f.landlords.includes(b.landlord || "company")) return false;
    if (!f.statuses.includes(b.my_status || "new")) return false;
    if (rent != null && rent > f.maxRent) return false;
    if (b.sqft != null && b.sqft < f.minSqft) return false;
    if (f.minRep > 0 && !(repScore(b) >= f.minRep)) return false;
    if (f.hideScam && b.scam_flags) return false;
    if (f.newOnly && !isNew(b)) return false;
    for (const k of f.mustHave) if (reqVal(b, k) !== "yes") return false;
    if (f.maxCost < COST_MAX) { const c = trueCost(b); if (c != null && c > f.maxCost) return false; }
    for (const t of TRI_FILTERS) { const m = f[t.k]; if (m !== "any") { const v = t.v(b); if (m === "yes" ? v !== "yes" : v === "no") return false; } }
    if (f.minYear > YEAR_MIN) { const y = yearOf(b); if (y == null ? !f.yearUnknown : y < f.minYear) return false; }
    if (f.fwy.length < FWY_BANDS.length && !f.fwy.includes(fwyBand(b))) return false;
    if (f.maxHeat < HEAT_MAX) { const t = summerHigh(b); if (t != null && t > f.maxHeat) return false; }
    if (f.minWalk > 0) { const w = walkOf(b).v; if (w == null ? !f.walkUnknown : w < f.minWalk) return false; }
    if (f.minDoc > 0 && docPct(b) < f.minDoc) return false;
    if (f.specials !== "any" && S.hasConc) { const p = patternOf(b); if (f.specials === "often" ? p !== "often" : p !== "often" && p !== "sometimes") return false; }
    if (q) { const hs = haystack(b); for (const t of q.split(/\s+/)) if (t && !hs.includes(t)) return false; }
    return true;
  }
  const matches = b => matchesWith(b, S.f, S.q);
  const TRI_FILTERS = [
    { k: "cats", name: "Cats allowed", g: "pets", v: b => triOf(dget(b, "pets", "cats")) },
    { k: "dogs", name: "Dogs allowed", g: "pets", v: b => triOf(dget(b, "pets", "dogs")) },
    { k: "garage", name: "Garage or covered parking", g: "parking", v: garageOf },
    { k: "ev", name: "EV charging", g: "parking", v: b => triOf(dget(b, "parking", "ev_charging")) },
    { k: "gym", name: "Gym", g: "building", v: b => triOf(dget(b, "building", "gym")) },
    { k: "pool", name: "Pool", g: "building", v: b => triOf(dget(b, "building", "pool")) },
    { k: "elevator", name: "Elevator", g: "building", v: b => triOf(dget(b, "building", "elevator")) },
    { k: "access", name: "Controlled access", g: "building", v: b => triOf(dget(b, "building", "controlled_access")) },
    { k: "balcony", name: "Balcony", g: "building", v: b => triOf(dget(b, "unit", "balcony")) },
  ];
  function sorted(list) {
    const k = S.sort;
    const key = {
      score: b => -(score(b) ?? -1), value: b => -((score(b) ?? 0) / (rentOf(b) || 9e9)), rent: b => rentOf(b) ?? 9e9, cost: b => trueCost(b) ?? 9e9,
      sqft: b => -(b.sqft ?? 0), ppsf: b => ppsf(b) ?? 9e9, reviews: b => -(repScore(b) ?? -1), name: b => b.name.toLowerCase(),
    }[k] || (b => 0);
    // decorate once, so the comparator does not recompute scores
    return list.map(b => [key(b), rentOf(b) ?? 0, b]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]).map(x => x[2]);
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
        h("p", { class: "deadline-days" }, days >= 0 ? h("b", { text: days, "data-n": days }) : h("b", { text: "—" }), h("span", { text: days >= 0 ? (days === 1 ? " day" : " days") : " passed" })),
        h("p", { class: "deadline-label", text: d.label }),
        h("span", { class: "measure", "aria-hidden": "true", style: { "--p": (span * 100).toFixed(1) + "%", "--k": span.toFixed(3), "--i": i } }),
        h("a", { class: "deadline-link", href: "#results", "aria-label": `${d.label}, ${dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}${days >= 0 ? ", " + relDays(days) : ", passed"}. Open the timeline.`,
          onclick: e => { e.preventDefault(); goTimeline(d.id); } }));
    }));
    // count the days up once on load; the gauges fill in CSS (section 18)
    if (!reduceMotion()) $("dates").querySelectorAll("b[data-n]").forEach((b, i) => { const n = +b.dataset.n; b._tv = 0; b.textContent = "0"; setTimeout(() => tween(b, n, v => String(Math.round(v)), 760), 140 + i * 70); });
  }
  /* Ledger: built once, then values tween in place. */
  let ledger = null;
  function renderStats(list) {
    const meet = list.filter(b => verdict(b) === "all").length;
    const med = median(list.map(rentOf));
    const top = list.find(b => verdict(b) !== "fail") || list[0];
    if (!ledger) {
      const cell = (label, value, sub, extra) => h("div", { class: "ledger-cell" + (extra ? " " + extra : "") }, h("dt", { text: label }), h("dd", null, value, sub));
      ledger = { inView: h("b", { class: "tnum" }), inViewSub: h("small"), meet: h("b", { class: "tnum" }), med: h("b", { class: "tnum" }), topSlot: h("span", { class: "toppick-slot" }), topSub: h("small") };
      $("stats").replaceChildren(
        cell("In view", ledger.inView, ledger.inViewSub),
        cell("Meet everything", ledger.meet, h("small", { text: "all five confirmed" })),
        cell("Median rent", ledger.med, h("small", { text: "per month, in view" })),
        cell("Renewal baseline", h("b", { text: "$" + JAYNE.allIn.toLocaleString("en-US", { minimumFractionDigits: 2 }) }), h("small", { text: "The Jayne, all-in" })),
        cell("Top pick", ledger.topSlot, ledger.topSub, "wide"));
      // first paint counts up from zero (only once, on load)
      if (S.loaded && !reduceMotion()) { ledger.inView._tv = 0; ledger.meet._tv = 0; ledger.med._tv = med ? Math.round(med * .9) : null; }
    }
    const int = v => String(Math.round(v));
    if (S.loaded) tween(ledger.inView, list.length, int, 620); else ledger.inView.textContent = "—";
    ledger.inViewSub.textContent = S.loaded ? `of ${S.buildings.length} listings` : "";
    tween(ledger.meet, meet, int, 620);
    if (med == null) { cancelAnimationFrame(ledger.med._raf); ledger.med._tv = null; ledger.med.textContent = "—"; } else tween(ledger.med, Math.round(med), money, 620);
    const topId = top ? top.id + "|" + fm(score(top)) : "";
    if (ledger.topId !== topId) {
      const first = ledger.topId == null;
      ledger.topId = topId;
      const node = top ? h("button", { class: "toppick", type: "button", onclick: () => openBuilding(top) }, h("b", { text: top.name }), h("span", { class: "arrow", "aria-hidden": "true", text: "→" })) : h("b", { text: "—" });
      const hadFocus = ledger.topSlot.contains(document.activeElement);
      ledger.topSlot.replaceChildren(node);
      if (hadFocus && node.focus) node.focus({ preventScroll: true });
      ledger.topSub.textContent = top ? [areaName(top), money(rentOf(top)), "match " + fm(score(top))].filter(Boolean).join(" · ") : "";
      if (!first) [node, ledger.topSub].forEach((el, i) => anim(el, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 320, delay: i * 40, easing: EASE.quint, fill: "backwards" }));
    }
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
  const CHECK_SVG = '<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path pathLength="1" d="M2.6 6.3l2.3 2.3 4.6-5"/></svg>';
  let chipEls = null;
  function renderChips() {
    if (!chipEls) {
      chipEls = CHIPS.map(c => {
        const n = h("span", { class: "chip-n", "aria-hidden": "true" });
        const el = h("button", { type: "button", class: "chip",
          onclick: () => { c.set(S.f, !c.on(S.f)); saveF(); syncFilters(); renderResults(); } },
          h("span", { class: "chip-mark", "aria-hidden": "true", html: CHECK_SVG }),
          c.t, c.note ? h("span", { class: "chip-note", text: c.note }) : null, n);
        return { c, el, n };
      });
      $("chips").replaceChildren(...chipEls.map(x => x.el));
    }
    for (const { c, el, n: nEl } of chipEls) {
      const on = c.on(S.f);
      const trial = JSON.parse(JSON.stringify(S.f)); c.set(trial, !on);
      const n = S.buildings.filter(b => matchesWith(b, trial, S.q)).length;
      el.classList.toggle("on", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
      el.title = on ? "Remove this filter" : `Show ${n} listing${n === 1 ? "" : "s"}`;
      const wasOn = nEl.dataset.mode === "x";
      nEl.dataset.mode = on ? "x" : "n";
      if (on) { nEl._tv = null; nEl.textContent = "×"; }
      else if (wasOn || nEl._tv == null) { nEl._tv = n; nEl.textContent = n; }
      else tween(nEl, n, v => String(Math.round(v)), 360);
      if (wasOn !== on && nEl.dataset.ready) anim(nEl, [{ transform: "scale(.6)", opacity: .2 }, { transform: "scale(1)", opacity: 1 }], { duration: 260, easing: EASE.spring });
      nEl.dataset.ready = "1";
    }
  }

  /* ==========================================================================
     Filters sidebar
     ========================================================================== */
  function counts(keyFn) { const m = {}; for (const b of S.buildings) { const k = keyFn(b); m[k] = (m[k] || 0) + 1; } return m; }
  function toggleIn(arr, key, on) { const i = arr.indexOf(key); if (on && i < 0) arr.push(key); if (!on && i >= 0) arr.splice(i, 1); }
  function activeFilterCount() {
    const f = S.f, d = DEFAULT_FILTERS; let n = 0;
    for (const k of ["maxRent", "minSqft", "minRep", "maxCost", "minYear", "maxHeat", "minWalk", "minDoc"]) if (f[k] !== d[k]) n++;
    for (const k of ["verdicts", "landlords", "statuses", "fwy"]) if (!sameSet(f[k], d[k])) n++;
    n += f.hideRegions.filter(r => REGIONS.includes(r)).length ? 1 : 0;
    for (const t of TRI_FILTERS) if (f[t.k] !== "any") n++;
    n += f.mustHave.length; if (f.hideScam !== d.hideScam) n++; if (f.newOnly) n++;
    if (f.specials !== "any" && S.hasConc) n++;
    return n;
  }
  function tagList(id, items, arr, onChange, countMap, iconFn, field) {
    return h("div", { class: "tagchecks" }, ...items.map(([key, name]) => {
      const cid = id + "-" + key;
      return h("label", { class: "tagcheck", for: cid },
        h("input", { type: "checkbox", id: cid, checked: arr.includes(key), "data-arr": field, "data-key": key, onchange: e => onChange(key, e.target.checked) }),
        iconFn ? iconFn(key) : null,
        h("span", { class: "tagcheck-name", text: name }),
        countMap ? h("span", { class: "tagcheck-n", text: countMap[key] || 0 }) : null);
    }));
  }
  function toggleRow(id, label, checked, n, onChange, field) {
    return h("label", { class: "switch", for: id },
      h("input", { type: "checkbox", role: "switch", id, checked, "data-bool": field, onchange: e => onChange(e.target.checked) }),
      h("span", { class: "switch-track", "aria-hidden": "true" }),
      h("span", { class: "switch-name", text: label }), h("span", { class: "tagcheck-n", text: n }));
  }
  /* Three-state filter: Any / Yes / Not ruled out (yes or not confirmed). A small stacked bar shows
     how the current market splits (confirmed yes, not confirmed, confirmed no). */
  function triRow(t, onChange) {
    const c = { yes: 0, unclear: 0, no: 0 };
    for (const b of S.buildings) c[t.v(b)]++;
    const n = S.buildings.length || 1, name = "tri-" + t.k;
    const pct = k => (c[k] / n * 100).toFixed(1) + "%";
    return h("fieldset", { class: "trif" },
      h("legend", { class: "trif-head" },
        h("span", { class: "trif-name", text: t.name }),
        h("span", { class: "trif-n", title: `${c.yes} yes, ${c.unclear} not confirmed, ${c.no} no` },
          h("span", { class: "trif-bar", "aria-hidden": "true" }, h("i", { class: "y", style: { width: pct("yes") } }), h("i", { class: "u", style: { width: pct("unclear") } }), h("i", { class: "n", style: { width: pct("no") } })),
          h("span", { class: "sr", text: `: ${c.yes} yes, ${c.unclear} not confirmed, ${c.no} no.` }),
          h("span", { "aria-hidden": "true", text: c.yes + " yes" }))),
      h("div", { class: "trif-opts" }, ...TRI_MODES.map(([m, label]) =>
        h("label", { class: "trif-opt", title: m === "maybe" ? "Yes or not confirmed: hides only a confirmed no" : m === "yes" ? "Confirmed yes only" : "No filter" },
          h("input", { type: "radio", name, value: m, checked: S.f[t.k] === m, "data-tri": t.k, onchange: () => onChange(m) }),
          h("span", { text: label })))));
  }
  /* Specials history: Any / Often or sometimes / Often, with how the market splits. */
  function specRow(onChange) {
    const c = { often: 0, sometimes: 0, rarely: 0, unknown: 0 };
    for (const b of S.buildings) c[patternOf(b)]++;
    const n = S.buildings.length || 1, pct = k => (c[k] / n * 100).toFixed(1) + "%";
    return h("fieldset", { class: "trif" },
      h("legend", { class: "trif-head" },
        h("span", { class: "trif-name", text: "Has run specials" }),
        h("span", { class: "trif-n", title: `${c.often} often, ${c.sometimes} sometimes, ${c.rarely} rarely, ${c.unknown} not known` },
          h("span", { class: "trif-bar", "aria-hidden": "true" }, h("i", { class: "y", style: { width: pct("often") } }), h("i", { class: "u", style: { width: pct("sometimes") } }), h("i", { class: "n", style: { width: pct("rarely") } })),
          h("span", { class: "sr", text: `: ${c.often} often, ${c.sometimes} sometimes, ${c.rarely} rarely, ${c.unknown} not known.` }),
          h("span", { "aria-hidden": "true", text: c.often + " often" }))),
      h("div", { class: "trif-opts" }, ...SPEC_MODES.map(([m, label]) =>
        h("label", { class: "trif-opt" },
          h("input", { type: "radio", name: "spec-mode", value: m, checked: S.f.specials === m, "data-spec": "1", onchange: () => onChange(m) }),
          h("span", { text: label })))),
      h("p", { class: "hint", text: "From the concessions research: how often each building has offered a special. Listings it did not cover count as not known." }));
  }
  function range(id, label, min, max, step, value, fmt, onInput, ends, field, hint) {
    const out = h("output", { for: id, text: fmt(value) });
    const pct = v => ((v - min) / (max - min) * 100).toFixed(2) + "%";
    const input = h("input", { type: "range", class: "range", id, min, max, step, value, "data-num": field, "aria-describedby": hint ? id + "-hint" : null, style: { "--p": pct(value) },
      oninput: e => { const v = +e.target.value; e.target.style.setProperty("--p", pct(v)); out.textContent = fmt(v); onInput(v); },
      onchange: () => settleRange() });
    input._sync = v => { input.value = v; input.style.setProperty("--p", pct(v)); out.textContent = fmt(v); };
    return h("div", { class: "rangefield" },
      h("div", { class: "rangefield-head" }, h("label", { for: id, text: label }), out),
      input,
      ends ? h("div", { class: "rangefield-ends", "aria-hidden": "true" }, h("span", { text: ends[0] }), h("span", { text: ends[1] })) : null,
      hint ? h("p", { class: "hint", id: id + "-hint", text: hint }) : null);
  }
  function group(title, open, ...body) {
    return h("details", { class: "fgroup", open: open || null },
      h("summary", null, h("span", { class: "fgroup-title", text: title }), h("span", { class: "fgroup-caret", "aria-hidden": "true" })),
      h("div", { class: "fgroup-body" }, ...body));
  }
  let lightRefresh = 0;
  /* Sliders: numbers (count, ledger, chips) follow the thumb every frame; the
     grid itself morphs once the value rests, so a drag reads as one calm move
     instead of a storm of half-finished ones. */
  let restTimer = 0;
  function refreshFromRange() {
    saveF(); cancelAnimationFrame(lightRefresh);
    lightRefresh = requestAnimationFrame(() => { renderResults({ summaryOnly: true }); renderChips(); updateBadge(); });
    clearTimeout(restTimer); restTimer = setTimeout(() => renderResults(), 160);
  }
  function settleRange() { clearTimeout(restTimer); cancelAnimationFrame(lightRefresh); renderResults(); renderChips(); updateBadge(); }
  function renderFilters() {
    const f = S.f;
    // Toggles change state in place (so their transitions play) instead of rebuilding the panel.
    const rerender = () => { saveF(); updateBadge(); renderChips(); renderResults(); };
    const totalW = FACTORS.concat(REP).reduce((t, x) => t + (Number(S.weights[x.key]) || 0), 0) || 1;
    const nActive = activeFilterCount();
    const openState = id => { const el = document.querySelector(`#filters details[data-g="${id}"]`); return el ? el.open : null; };
    const g = (id, title, defOpen, ...body) => { const st = openState(id); const d = group(title, st == null ? defOpen : st, ...body); d.dataset.g = id; return d; };
    const anyLbl = (v, off, fmt) => v === off ? "Any" : fmt(v);
    const triFor = g => TRI_FILTERS.filter(t => t.g === g).map(t => triRow(t, m => { f[t.k] = m; rerender(); }));
    const known = fn => S.buildings.filter(b => fn(b) != null).length;
    const nB = S.buildings.length;
    $("filters").replaceChildren(
      h("div", { class: "filters-head" },
        h("p", { class: "mono-label" }, "Refine", h("span", { class: "filters-active", id: "filtersActive", text: nActive ? ` · ${nActive} active` : "" })),
        h("button", { class: "linkbtn", id: "clearAll", type: "button", disabled: !nActive && !S.q, text: "Clear all", onclick: clearAll })),
      h("div", { class: "fgroup fgroup-flat" },
        range("f-rent", "Max rent", 1500, 2600, 25, f.maxRent, money, v => { f.maxRent = v; refreshFromRange(); }, ["$1,500", "$2,600"], "maxRent"),
        range("f-cost", "Max true monthly cost", 1500, COST_MAX, 25, f.maxCost, v => anyLbl(v, COST_MAX, money), v => { f.maxCost = v; refreshFromRange(); }, ["$1,500", "Any"], "maxCost",
          "Rent after specials, plus parking and required fees where known. Unknown parts count as $0 here."),
        range("f-sqft", "Min size", 600, 1000, 10, f.minSqft, v => v + " sq ft", v => { f.minSqft = v; refreshFromRange(); }, ["600", "1,000 sq ft"], "minSqft"),
        range("f-rep", "Min review score", 0, 9, 1, f.minRep, v => v ? v + "+ / 10" : "Any", v => { f.minRep = v; refreshFromRange(); }, ["Any", "9 / 10"], "minRep")),
      g("must", "Must be confirmed", true,
        tagList("mh", REQS.map(r => [r.key, r.name]), f.mustHave, (k, on) => { toggleIn(f.mustHave, k, on); rerender(); },
          Object.fromEntries(REQS.map(r => [r.key, S.buildings.filter(b => reqVal(b, r.key) === "yes").length])), k => reqIcon(k) || h("span", { class: "ico-fallback", "aria-hidden": "true" }), "mustHave")),
      REGIONS.length > 1 ? g("region", "Region", true,
        tagList("rg", REGIONS.map(r => [r, r]), REGIONS.filter(r => !f.hideRegions.includes(r)), (k, on) => { toggleIn(f.hideRegions, k, !on); rerender(); }, counts(regionOf), null, "regionsShown")) : null,
      g("verdict", "Requirements", true,
        tagList("vd", Object.entries(VERDICTS), f.verdicts, (k, on) => { toggleIn(f.verdicts, k, on); rerender(); }, counts(verdict), k => h("span", { class: "vdot " + k, "aria-hidden": "true" }), "verdicts"),
        h("p", { class: "hint", text: "Listings over the rent cap fail only on rent; raise Max rent to see them (labeled Over budget)." })),
      g("pets", "Pets", false, ...triFor("pets")),
      g("parking", "Parking", false, ...triFor("parking")),
      g("building", "Building and unit", false, ...triFor("building"),
        range("f-year", "Built in or after", YEAR_MIN, 2025, 5, f.minYear, v => anyLbl(v, YEAR_MIN, String), v => { f.minYear = v; refreshFromRange(); }, ["Any", "2025"], "minYear"),
        toggleRow("f-yearu", "Keep listings with year not found", f.yearUnknown, nB - known(yearOf), on => { f.yearUnknown = on; rerender(); }, "yearUnknown")),
      g("location", "Location", false,
        h("p", { class: "mono-label sub-k", text: "Distance to a freeway (rough)" }),
        tagList("fw", FWY_BANDS, f.fwy, (k, on) => { toggleIn(f.fwy, k, on); rerender(); }, counts(fwyBand), null, "fwy"),
        range("f-heat", "Neighborhood summer high at most", 70, HEAT_MAX, 1, f.maxHeat, v => anyLbl(v, HEAT_MAX, x => x + "°F"), v => { f.maxHeat = v; refreshFromRange(); }, ["70°F", "Any"], "maxHeat",
          "Average August high for the neighborhood."),
        range("f-walk", "Walk Score at least", 0, 100, 5, f.minWalk, v => anyLbl(v, 0, String), v => { f.minWalk = v; refreshFromRange(); }, ["Any", "100"], "minWalk",
          "The address's Walk Score where research found one, otherwise the neighborhood's."),
        toggleRow("f-walku", "Keep listings with no Walk Score", f.walkUnknown, nB - known(b => walkOf(b).v), on => { f.walkUnknown = on; rerender(); }, "walkUnknown")),
      g("docs", "Documentation", false,
        range("f-doc", "Well documented, at least", 0, 60, 5, f.minDoc, v => anyLbl(v, 0, x => x + "% known"), v => { f.minDoc = v; refreshFromRange(); }, ["Any", "60%"], "minDoc",
          `Share of the ${DOC_TOTAL} particulars (costs, pets, parking, building, unit, internet, location, availability) that research found.`)),
      S.hasConc ? g("specials", "Specials history", false, specRow(m => { f.specials = m; rerender(); })) : null,
      g("landlord", "Landlord", false,
        tagList("ll", Object.entries(LANDLORDS), f.landlords, (k, on) => { toggleIn(f.landlords, k, on); rerender(); }, counts(b => b.landlord || "company"), null, "landlords"),
        h("div", { class: "switches" },
          toggleRow("f-scam", "Hide likely scams", f.hideScam, S.buildings.filter(b => b.scam_flags).length, on => { f.hideScam = on; rerender(); }, "hideScam"),
          toggleRow("f-new", "Only recent finds", f.newOnly, S.buildings.filter(isNew).length, on => { f.newOnly = on; rerender(); }, "newOnly"))),
      g("status", "My status", false,
        tagList("st", STATUSES.map(s => [s.key, s.name]), f.statuses, (k, on) => { toggleIn(f.statuses, k, on); rerender(); }, counts(b => b.my_status || "new"), null, "statuses")),
      g("weights", "Ranking weights", false,
        h("p", { class: "hint", text: `How much each factor counts toward Best match. Shared by every market. Within ${FACTORS[0].name.toLowerCase()}, freeway access counts ${Math.round(FACTORS[0].pw[0] * 100)}% and traffic ${Math.round(FACTORS[0].pw[1] * 100)}%.` }),
        h("div", { class: "weights" }, ...FACTORS.concat(REP).map(x => {
          const id = "w-" + x.key, share = Math.round((S.weights[x.key] || 0) / totalW * 100);
          return h("div", { class: "weight" },
            h("div", { class: "rangefield-head" }, h("label", { for: id }, factorIcon(x.key), h("span", { text: x.name })), h("output", { for: id, "data-w": x.key, text: share + "%" })),
            h("input", { type: "range", class: "range thin", id, min: 0, max: 50, value: S.weights[x.key] || 0, style: { "--p": ((S.weights[x.key] || 0) / 50 * 100) + "%" },
              oninput: e => {
                S.weights[x.key] = +e.target.value; e.target.style.setProperty("--p", (+e.target.value / 50 * 100) + "%"); ls.set(WEIGHTS_KEY, S.weights);
                const tw = FACTORS.concat(REP).reduce((t, y) => t + (Number(S.weights[y.key]) || 0), 0) || 1;
                document.querySelectorAll("#filters output[data-w]").forEach(o => { o.textContent = Math.round((S.weights[o.dataset.w] || 0) / tw * 100) + "%"; });
                cancelAnimationFrame(lightRefresh); lightRefresh = requestAnimationFrame(() => renderResults({ summaryOnly: true }));
                clearTimeout(restTimer); restTimer = setTimeout(() => renderResults(), 160);
              }, onchange: () => settleRange() }));
        })),
        h("button", { class: "linkbtn", type: "button", text: "Reset weights", onclick: () => { S.weights = Object.assign({}, defaultWeights); ls.set(WEIGHTS_KEY, S.weights); renderFilters(); renderResults(); } })),
    );
    renderChips();
    updateBadge();
  }
  /* Bring the existing filter controls in line with S.f (after chips or Clear all). */
  function syncFilters() {
    const root = $("filters"), f = S.f;
    root.querySelectorAll("input[data-arr]").forEach(i => { i.checked = i.dataset.arr === "regionsShown" ? !f.hideRegions.includes(i.dataset.key) : f[i.dataset.arr].includes(i.dataset.key); });
    root.querySelectorAll("input[data-tri]").forEach(i => { i.checked = f[i.dataset.tri] === i.value; });
    root.querySelectorAll("input[data-spec]").forEach(i => { i.checked = f.specials === i.value; });
    root.querySelectorAll("input[data-bool]").forEach(i => { i.checked = !!f[i.dataset.bool]; });
    root.querySelectorAll("input[data-num]").forEach(i => { if (+i.value !== f[i.dataset.num] && i._sync) i._sync(f[i.dataset.num]); });
    renderChips(); updateBadge();
  }
  function updateBadge() {
    const n = activeFilterCount(), b = $("filterBadge");
    if ($("filtersActive")) { $("filtersActive").textContent = n ? ` · ${n} active` : ""; $("clearAll").disabled = !n && !S.q; }
    if (b.hidden !== !n || b.textContent !== String(n)) {
      const appear = b.hidden && n;
      b.hidden = !n; b.textContent = n;
      if (n) anim(b, appear ? [{ transform: "scale(.4)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }] : [{ transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 300, easing: EASE.spring });
    }
    $("toggleFilters").setAttribute("aria-label", n ? `Filters, ${n} active` : "Filters");
  }
  function clearAll() { Object.assign(S.f, freshFilters()); // in place: filter controls hold a reference to S.f
    S.q = ""; $("q").value = ""; saveF(); syncFilters(); renderResults(); toast("Filters cleared"); }

  /* Mobile filter sheet */
  const sheetMQ = matchMedia("(max-width: 920px)");
  function setSheet(open) {
    const sb = $("sidebar"), scrim = $("sheetScrim");
    document.documentElement.classList.toggle("sheet-open", open);
    sb.classList.toggle("open", open);
    $("toggleFilters").setAttribute("aria-expanded", open ? "true" : "false");
    // the open sheet is modal: keep keyboard and screen-reader focus inside it
    document.querySelectorAll(".skip, .mast, .searchband, #results, .colophon").forEach(el => { el.inert = open; });
    if (open) { sb.setAttribute("role", "dialog"); sb.setAttribute("aria-modal", "true"); } else { sb.removeAttribute("role"); sb.removeAttribute("aria-modal"); }
    if (open) { scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add("in")); setTimeout(() => $("closeFilters").focus(), 30); }
    else { scrim.classList.remove("in"); setTimeout(() => { if (!sb.classList.contains("open")) scrim.hidden = true; }, 320); }
  }
  $("toggleFilters").addEventListener("click", () => setSheet(!$("sidebar").classList.contains("open")));
  $("closeFilters").addEventListener("click", () => { setSheet(false); $("toggleFilters").focus(); });
  $("applyFilters").addEventListener("click", () => { setSheet(false); $("results").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" }); });
  $("sheetScrim").addEventListener("click", () => { setSheet(false); $("toggleFilters").focus({ preventScroll: true }); });
  sheetMQ.addEventListener("change", () => { if (!sheetMQ.matches) setSheet(false); });
  $("sidebar").addEventListener("keydown", e => { if (e.key === "Escape" && $("sidebar").classList.contains("open")) { setSheet(false); $("toggleFilters").focus(); } });
  /* Drag the sheet's head down to dismiss it. Follows the finger, then either
     springs back or closes based on distance and release velocity. */
  (() => {
    const sb = $("sidebar"), head = sb.querySelector(".sheet-head"), scrim = $("sheetScrim");
    let y0 = 0, dy = 0, t0 = 0, lastY = 0, lastT = 0, v = 0, dragging = false;
    head.addEventListener("pointerdown", e => {
      if (!sheetMQ.matches || !sb.classList.contains("open") || e.target.closest("button")) return;
      dragging = true; y0 = lastY = e.clientY; t0 = lastT = performance.now(); dy = 0; v = 0;
      head.setPointerCapture(e.pointerId); sb.classList.add("dragging");
    });
    head.addEventListener("pointermove", e => {
      if (!dragging) return;
      const raw = e.clientY - y0;
      dy = raw < 0 ? raw / 6 : raw;                       // resist upward pulls
      const now = performance.now(); v = (e.clientY - lastY) / Math.max(1, now - lastT); lastY = e.clientY; lastT = now;
      sb.style.transform = `translateY(${dy}px)`;
      scrim.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / (sb.offsetHeight || 600)));
    });
    const end = () => {
      if (!dragging) return; dragging = false;
      sb.classList.remove("dragging"); scrim.style.opacity = "";
      const close = dy > 110 || (v > .55 && dy > 16);
      sb.style.transform = "";
      if (close) setSheet(false);
    };
    head.addEventListener("pointerup", end); head.addEventListener("pointercancel", end);
  })();

  /* ==========================================================================
     Toolbar + search
     ========================================================================== */
  /* Toolbar: controls are built once; state changes move a sliding indicator. */
  let tb = null;
  function setView(k) {
    if (S.view === k) return;
    const from = VIEWS.findIndex(([x]) => x === S.view), to = VIEWS.findIndex(([x]) => x === k);
    S.view = k; ls.set("view", k);
    renderToolbar(); renderResults({ dir: Math.sign(to - from) || 1 });
  }
  function placeIndicator(group, ind, animate) {
    const btn = group.querySelector('[aria-pressed="true"]');
    if (!btn || !group.offsetParent) { ind.style.opacity = "0"; ind._x = null; return; }
    const x = btn.offsetLeft, w = btn.offsetWidth, y = btn.offsetTop, hgt = btn.offsetHeight;
    if (ind._x === x && ind._w === w && ind._y === y) return;
    const fresh = ind._x == null || !animate || reduceMotion();
    ind.classList.toggle("no-anim", fresh);
    ind.style.opacity = "1";
    ind.style.transform = `translate(${x}px, ${y}px)`; ind.style.width = w + "px"; ind.style.height = hgt + "px";
    ind._x = x; ind._w = w; ind._y = y;
    if (fresh) { void ind.offsetWidth; ind.classList.remove("no-anim"); }
  }
  function renderToolbar() {
    if (!tb) {
      const views = $("views"), dens = $("density");
      const segInd = h("span", { class: "seg-ind", "aria-hidden": "true" }), densInd = h("span", { class: "seg-ind", "aria-hidden": "true" });
      const viewBtns = VIEWS.map(([k, name]) => h("button", { type: "button", class: "seg-btn", "data-view": k, onclick: () => setView(k) }, h("span", { class: "seg-label", text: name })));
      views.replaceChildren(segInd, ...viewBtns);
      const densBtns = [["cards", "Cards", "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"], ["rows", "Rows", "M4 6h16M4 12h16M4 18h16"]].map(([k, t, d]) =>
        h("button", { type: "button", class: "iconbtn", "data-density": k, "aria-label": t + " layout", title: t,
          html: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="${d}"/></svg>`,
          onclick: () => { if (S.density === k) return; S.density = k; ls.set("density", k); renderToolbar(); renderResults({ fade: true }); } }));
      dens.replaceChildren(densInd, ...densBtns);
      // arrow keys move between views, like a tab strip
      views.addEventListener("keydown", e => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        const i = viewBtns.indexOf(document.activeElement); if (i < 0) return;
        e.preventDefault();
        const j = e.key === "Home" ? 0 : e.key === "End" ? viewBtns.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + viewBtns.length) % viewBtns.length;
        viewBtns[j].focus(); setView(VIEWS[j][0]);
      });
      $("sort").replaceChildren(...SORTS.map(([v, t]) => h("option", { value: v, text: t })));
      tb = { views, dens, segInd, densInd, viewBtns, densBtns };
      const re = () => { placeIndicator(views, segInd, false); placeIndicator(dens, densInd, false); };
      if (window.ResizeObserver) new ResizeObserver(re).observe(views);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(re);
      addEventListener("resize", re);
    }
    document.documentElement.classList.toggle("view-timeline", S.view === "timeline");
    tb.viewBtns.forEach((btn, i) => {
      const k = VIEWS[i][0], on = S.view === k;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (k === "compare") {
        let n = btn.querySelector(".seg-n");
        const nc = compareCount();
        if (nc) {
          if (!n) { n = h("span", { class: "seg-n" }); btn.append(n); anim(n, [{ transform: "scale(.3)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 320, easing: EASE.spring }); }
          else if (n.textContent !== String(nc)) anim(n, [{ transform: "scale(1.35)" }, { transform: "none" }], { duration: 320, easing: EASE.spring });
          n.textContent = nc;
        } else if (n) n.remove();
      }
    });
    tb.densBtns.forEach(btn => btn.setAttribute("aria-pressed", S.density === btn.dataset.density ? "true" : "false"));
    $("sort").value = S.sort;
    // the table sorts by its own column headings, so the Sort menu only applies to the specimen list
    $("sort").disabled = S.view !== "list";
    $("sort").closest(".sortctl").hidden = S.view !== "list";
    tb.dens.hidden = S.view !== "list";
    placeIndicator(tb.views, tb.segInd, true);
    placeIndicator(tb.dens, tb.densInd, true);
    const act = tb.views.querySelector('[aria-pressed="true"]');
    if (act && tb.views.scrollWidth > tb.views.clientWidth) {
      const l = act.offsetLeft - 8, r = act.offsetLeft + act.offsetWidth + 8;
      if (l < tb.views.scrollLeft || r > tb.views.scrollLeft + tb.views.clientWidth) tb.views.scrollTo({ left: Math.max(0, l - 24), behavior: reduceMotion() ? "auto" : "smooth" });
    }
  }
  /* Sticky toolbar gets a soft shadow once it is actually stuck. */
  (() => {
    const bar = document.querySelector(".toolbar"), sentinel = $("toolbarSentinel");
    if (!bar || !sentinel || !window.IntersectionObserver) return;
    new IntersectionObserver(([e]) => bar.classList.toggle("stuck", !e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 }).observe(sentinel);
  })();
  $("sort").addEventListener("change", e => { S.sort = e.target.value; ls.set("sort", S.sort); renderResults(); });
  /* The full placeholder is cut mid-word on phones; use a shorter one there. */
  (() => { const q = $("q"), long = q.placeholder, mq = matchMedia("(max-width: 900px)"); const set = () => { q.placeholder = mq.matches ? "Search name, street, neighborhood" : long; }; set(); mq.addEventListener("change", set); })();
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
  /* Savings vs The Jayne use the true monthly cost. With unknown parts the cost is a floor, so a
     saving is "up to" and an extra cost is "at least". */
  function savingsEl(b, cls) {
    const d = savingsOf(b); if (d == null) return null;
    const part = costOf(b).missing.length > 0;
    const k = d >= 0 ? (part ? "Saves ≤" : "Saves") : (part ? "Costs ≥" : "Costs");
    return h("span", { class: "save " + (d >= 0 ? "pos" : "neg") + (cls ? " " + cls : ""),
      title: `True monthly cost compared with renewing at The Jayne (${money(JAYNE.allIn)})` + (part ? `. Not found: ${costOf(b).missing.join(", ")}.` : "") },
      h("span", { class: "save-k", text: k }), h("b", { text: money(Math.abs(d)) }), h("span", { class: "save-k", text: "/mo" }));
  }
  /* "True monthly $2,221+" with the parts that make it up; "+" marks a floor. */
  const costParts = c => [c.park != null && c.park > 0 ? money(c.park) + " parking" : c.park === 0 ? (c.noPark ? "no parking" : "parking included") : null,
    c.fees != null && c.fees > 0 ? money(c.fees) + " fees" : null].filter(Boolean);
  const costNote = c => c.missing.length ? c.missing.join(" and ") + " not found" : "all parts known";
  function costValue(b, cls) {
    const c = costOf(b);
    if (c.total == null) return h("span", { class: "cost-v " + (cls || ""), text: "—" });
    return h("span", { class: "cost-v " + (cls || "") }, money(c.total), c.missing.length ? h("span", { class: "cost-plus", "aria-hidden": "true", text: "+" }) : null,
      c.missing.length ? h("span", { class: "sr", text: " or more" }) : null);
  }
  function costLine(b) {
    const c = costOf(b);
    const parts = ["rent " + money(c.rent), ...costParts(c)].join(" + ");
    return h("div", { class: "costline" },
      h("div", { class: "costline-main" },
        h("span", { class: "fig-k", text: "True monthly" }),
        costValue(b, "serif"),
        h("span", { class: "costline-parts", text: c.total == null ? "rent not listed" : parts + (c.missing.length ? " · " + costNote(c) : "") })),
      docMeter(b));
  }
  /* Data completeness: a ten-tick measure, like a graduated cylinder lying down. */
  function docMeter(b, cls) {
    const p = docPct(b);
    return h("span", { class: "doc " + (cls || ""), role: "img", "aria-label": `Documented: ${p}% of ${DOC_TOTAL} particulars found`, title: `${p}% of ${DOC_TOTAL} particulars found` },
      h("span", { class: "doc-k", "aria-hidden": "true", text: "Documented" }),
      h("span", { class: "doc-bar", "aria-hidden": "true" }, h("i", { style: { "--w": p + "%" } })),
      h("span", { class: "doc-v", "aria-hidden": "true", text: p + "%" }));
  }
  function flagTags(b, withStatus) {
    return [
      b.landlord === "private" ? h("span", { class: "tag", text: "Private owner" }) : null,
      isNew(b) ? h("span", { class: "tag amber", text: "Recent find" }) : null,
      patternOf(b) === "often" ? h("span", { class: "tag spec", title: "Specials history: this building often runs specials", text: "Specials often" }) : null,
      b.scam_flags ? h("span", { class: "tag bad", title: b.scam_flags, text: "Scam risk" }) : null,
      b.reviews && b.reviews.dealbreakers ? h("span", { class: "tag bad", title: b.reviews.dealbreakers, text: "Review red flags" }) : null,
      withStatus && b.my_status && b.my_status !== "new" ? h("span", { class: "tag ink status-" + b.my_status, text: statusName(b.my_status) }) : null,
    ].filter(Boolean);
  }
  /* The whole card is clickable with a pointer; keyboard and screen readers get a
     real button inside the heading (its click bubbles to the card handler). */
  const listingAttrs = b => ({ "data-listing": b.id, onclick: () => openBuilding(b) });
  const openBtn = (text, label) => h("button", { type: "button", class: "card-open", "aria-label": label || null, text });

  /* ==========================================================================
     Views: specimens (cards / rows)
     ========================================================================== */
  /* Cards and rows are cached per listing so a filter or sort change can move
     the existing elements (FLIP) instead of re-parsing every illustration. */
  const listCache = { cards: new Map(), rows: new Map() };
  function keyedListing(mode, b, i) {
    const cache = listCache[mode], sc = score(b), scK = fm(sc);
    const c = cache.get(b.id);
    if (c && c.b === b && c.sc === scK) {
      if (c.i !== i) { c.i = i; c.num.textContent = pad2(i + 1); }
      c.el._fresh = false;
      return c.el;
    }
    const el = mode === "cards" ? specimenCard(b, i) : rowItem(b, i);
    const num = el.querySelector(mode === "cards" ? ".specimen-no-n" : ".rowitem-no");
    if (c) { const j = el.querySelector(".jar"); if (j && c.v != null) j._from = c.v; }
    const jv = el.querySelector(".jar");
    cache.set(b.id, { el, b, sc: scK, i, num, v: jv ? +jv.dataset.v : null });
    el._fresh = !c;
    return el;
  }
  function renderList(root, list, ctx) {
    if (!list.length) {
      if (!root.querySelector(":scope > .empty")) { root.replaceChildren(emptyState()); if (!ctx.switching) fadeIn(root.firstChild); }
      return;
    }
    const mode = S.density === "rows" ? "rows" : "cards";
    let box = root.querySelector(mode === "cards" ? ":scope > .specimens" : ":scope > .rows");
    const fresh = !box;
    if (fresh) {
      box = mode === "cards" ? h("div", { class: "specimens" })
        : h("div", { class: "rows" }, h("div", { class: "rows-head", "aria-hidden": "true" }, ...["No.", "Specimen", "Requirements", "Rent", "Size", "Match", "vs. Jayne"].map(t => h("span", { text: t }))));
      root.replaceChildren(box);
    }
    const els = list.map((b, i) => keyedListing(mode, b, i));
    morph(box, els, {
      after: mode === "rows" ? box.firstElementChild : null,
      lazy: !ctx.initial,
      enter: ctx.initial ? "stagger" : fresh ? "none" : "pop",
      onEnter: (el, delay) => { if (el._fresh) playIntro(el, delay); },
      onSettle: el => { const j = el.querySelector(".jar"); if (j && j._from != null) { jarFromTo(j, j._from); j._from = null; } },
    });
  }
  /* Jar liquid rises to its level; the seal stamps in. Runs once per element. */
  function playIntro(el, delay) {
    if (reduceMotion()) return;
    el.style.setProperty("--d", (delay || 0) + "ms");
    el.classList.remove("intro"); void el.offsetWidth; el.classList.add("intro");
    clearTimeout(el._introT); el._introT = setTimeout(() => el.classList.remove("intro"), 1300 + (delay || 0));
  }
  function jarFromTo(j, from) {
    const to = +j.dataset.v; if (from === to) return;
    const g = j.querySelector("g[clip-path]"); if (!g) return;
    const dy = ((to - from) * JAR_TRAVEL).toFixed(1);
    for (const kid of g.children) anim(kid, [{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 640, easing: EASE.quint });
  }
  function specimenCard(b, i) {
    const v = verdict(b), rep = repScore(b), sc = score(b), p = ppsf(b), fails = v === "fail" ? failReasons(b) : [];
    return h("article", { class: "specimen v-" + v, ...listingAttrs(b), style: { "--i": Math.min(i, 24) } },
      h("div", { class: "specimen-frame" },
        h("header", { class: "specimen-head" },
          h("span", { class: "specimen-no" }, h("span", { class: "k", text: "No." }), h("span", { class: "specimen-no-n", text: pad2(i + 1) })),
          h("span", { class: "specimen-where" }, regionEmblem(regionOf(b), "sm"), h("span", { text: whereText(b) }))),
        v === "all" ? (seal() || h("span", { class: "seal-fallback", text: "Meets everything" })) : null,
        h("div", { class: "specimen-title" },
          h("h3", { class: "specimen-name" }, openBtn(b.name)),
          h("p", { class: "specimen-addr", text: b.address || "Address not listed" })),
        h("div", { class: "specimen-figures" },
          h("div", { class: "fig fig-rent" },
            h("span", { class: "fig-k" }, "Rent", b.base_rent && rentOf(b) < b.base_rent ? h("s", { title: "List rent before specials", text: money(b.base_rent) }) : null),
            h("span", { class: "fig-v serif", text: money(rentOf(b)) })),
          h("div", { class: "fig" }, h("span", { class: "fig-k", text: "Sq ft" }), h("span", { class: "fig-v", text: b.sqft ? Math.round(b.sqft) : "—" })),
          h("div", { class: "fig" }, h("span", { class: "fig-k", text: "$/sq ft" }), h("span", { class: "fig-v", text: p ? p.toFixed(2) : "—" })),
          h("div", { class: "fig" }, h("span", { class: "fig-k", text: "Reviews" }), h("span", { class: "fig-v", text: rep == null ? "—" : rep + "/10" }))),
        reqRow(b),
        fails.length ? h("p", { class: "specimen-fails" }, overBudgetOnly(b) ? h("span", { class: "tag bad", text: "Over budget" }) : null, fails.join(" · ")) : null,
        costLine(b),
        h("footer", { class: "specimen-foot" },
          h("div", { class: "match", title: "Match out of 100 against all listings, using your ranking weights. Best = 100, lowest = 0." }, jar(sc), h("span", { class: "match-k", text: "Match" }), h("b", { class: "match-v", text: fm(sc) })),
          savingsEl(b)),
        (() => { const t = flagTags(b, true); return t.length ? h("div", { class: "tags" }, ...t) : null; })()));
  }
  function rowItem(b, i) {
    const v = verdict(b), sc = score(b);
    return h("article", { class: "rowitem v-" + v, ...listingAttrs(b) },
      h("span", { class: "rowitem-no", text: pad2(i + 1) }),
      h("div", { class: "rowitem-main" },
        h("h3", { class: "rowitem-name" }, openBtn(b.name), v === "all" ? h("span", { class: "tick", title: "Meets everything", text: " ●" }) : null),
        h("p", { class: "rowitem-sub", text: [areaName(b), S.areaById.get(b.area_id) ? regionOf(b) : b.region].filter(Boolean).join(" · ") || "Neighborhood not set" }),
        (() => { const t = flagTags(b, true); return t.length ? h("div", { class: "tags sm" }, ...t) : null; })()),
      reqRow(b, "compact"),
      h("span", { class: "rowitem-rent", text: money(rentOf(b)) }),
      h("span", { class: "rowitem-num rowitem-size", text: b.sqft ? Math.round(b.sqft) + " ft²" : "—" }),
      h("span", { class: "rowitem-match" }, jar(sc, "xs"), h("b", { text: fm(sc) })),
      savingsEl(b, "rowitem-save") || h("span", { class: "rowitem-num", text: "—" }));
  }

  /* ==========================================================================
     Views: table
     ========================================================================== */
  const triWord = v => v === "yes" ? "Yes" : v === "no" ? "No" : "?";
  const triCell = v => h("td", { class: "t-tri " + v, title: v === "unclear" ? "Not confirmed" : null }, h("span", { class: "sr", text: v === "unclear" ? "not confirmed" : "" }), h("span", { "aria-hidden": v === "unclear" ? "true" : null, text: triWord(v) }));
  const petsKey = b => { const c = triOf(dget(b, "pets", "cats")), d = triOf(dget(b, "pets", "dogs")); return (c === "yes") + (d === "yes") * 2 - (c === "no") - (d === "no"); };
  const numCell = (v, f) => h("td", { class: "num" + (v == null ? " unk" : ""), text: v == null ? "—" : f ? f(v) : v });
  const PARK_WORD = { garage: "Garage", covered: "Covered", surface: "Surface", tandem: "Tandem", street: "Street", unclear: "—" };
  /* Table columns. `fixed` cannot be hidden; `def` is on by default; the picker remembers the rest. */
  const TCOLS = [
    { k: "name", t: "Building", fixed: true, v: b => b.name.toLowerCase(), cell: b => h("td", { class: "t-name" }, h("span", { class: "t-title" }, openBtn(b.name)), h("span", { class: "t-sub", text: whereText(b) })) },
    { k: "rent", t: "Rent", grp: "Cost", def: true, num: true, v: rentOf, cell: b => h("td", { class: "num strong", text: money(rentOf(b)) }) },
    { k: "cost", t: "True monthly", grp: "Cost", def: true, num: true, v: trueCost, cell: b => { const c = costOf(b); return h("td", { class: "num strong", title: c.total == null ? null : ["rent " + money(c.rent), ...costParts(c)].join(" + ") + (c.missing.length ? ". " + costNote(c) + "." : "") }, costValue(b)); } },
    { k: "save", t: "vs. Jayne", grp: "Cost", def: true, num: true, v: savingsOf, cell: b => { const d = savingsOf(b), part = costOf(b).missing.length; return h("td", { class: "num " + (d == null ? "" : d >= 0 ? "pos" : "neg"), title: part ? (d >= 0 ? "Up to this much saved; some costs not found" : "At least this much more; some costs not found") : null, text: d == null ? "—" : (part ? (d >= 0 ? "≤ " : "≥ ") : "") + (d >= 0 ? "+" : "−") + money(Math.abs(d)) }); } },
    { k: "spec", t: "Specials history", grp: "Cost", v: b => ({ often: 3, sometimes: 2, rarely: 1 })[patternOf(b)] ?? null, cell: b => { const p = patternOf(b); return h("td", { class: "t-text" + (p === "unknown" ? " unk" : ""), title: p === "unknown" ? "Not known" : null, text: PATTERN_WORD[p] }); } },
    { k: "deposit", t: "Deposit", grp: "Cost", num: true, v: b => dget(b, "costs", "deposit"), cell: b => numCell(dget(b, "costs", "deposit"), money) },
    { k: "sqft", t: "Sq ft", grp: "Unit", def: true, num: true, v: b => b.sqft, cell: b => numCell(b.sqft, Math.round) },
    { k: "ppsf", t: "$/sq ft", grp: "Unit", num: true, v: ppsf, cell: b => numCell(ppsf(b), x => x.toFixed(2)) },
    { k: "score", t: "Match", grp: "Ranking", def: true, num: true, v: score, cell: b => h("td", { class: "num" }, h("span", { class: "t-match" }, score(b) == null ? null : h("span", { class: "meter xs", "aria-hidden": "true" }, h("i", { style: { "--w": score(b) + "%" } })), fm(score(b)))) },
    { k: "rep", t: "Reviews", grp: "Ranking", num: true, v: repScore, cell: b => numCell(repScore(b)) },
    { k: "req", t: "Requirements", grp: "Ranking", def: true, v: b => REQS.filter(r => reqVal(b, r.key) === "yes").length, cell: b => h("td", null, h("span", { class: "dots" }, ...REQS.map(r => h("i", { class: reqVal(b, r.key), title: r.name + ": " + REQ_WORD[reqVal(b, r.key)].toLowerCase() })))) },
    { k: "pets", t: "Cats · Dogs", grp: "Building", def: true, v: petsKey, cell: b => { const c = triOf(dget(b, "pets", "cats")), d = triOf(dget(b, "pets", "dogs")); return h("td", { class: "t-pets", title: `Cats: ${REQ_WORD[c].toLowerCase()}. Dogs: ${REQ_WORD[d].toLowerCase()}.` }, h("span", { class: "pill " + c, text: "Cats " + triWord(c) }), h("span", { class: "pill " + d, text: "Dogs " + triWord(d) })); } },
    { k: "park", t: "Parking", grp: "Building", def: true, v: b => { const c = costOf(b); return (parkType(b) === "unclear" ? "z" : parkType(b)) + (c.park == null ? 9999 : c.park); }, cell: b => { const c = costOf(b), t = parkType(b); return h("td", { class: "t-text" + (t === "unclear" && c.park == null ? " unk" : "") }, PARK_WORD[t] || t, h("span", { class: "t-sub", text: c.park == null ? "fee not found" : c.park === 0 ? (c.noPark ? "no parking" : "included") : money(c.park) + "/mo" })); } },
    { k: "year", t: "Built", grp: "Building", def: true, num: true, v: yearOf, cell: b => numCell(yearOf(b)) },
    { k: "units", t: "Units", grp: "Building", num: true, v: b => dget(b, "building", "units"), cell: b => numCell(dget(b, "building", "units")) },
    { k: "amen", t: "Gym · Pool", grp: "Building", v: b => (dget(b, "building", "gym") === "yes") + (dget(b, "building", "pool") === "yes"), cell: b => { const g = triOf(dget(b, "building", "gym")), q = triOf(dget(b, "building", "pool")); return h("td", { class: "t-pets" }, h("span", { class: "pill " + g, text: "Gym " + triWord(g) }), h("span", { class: "pill " + q, text: "Pool " + triWord(q) })); } },
    { k: "fwy", t: "Freeway", grp: "Location", def: true, v: b => ({ "under 1 mi": 1, "1–2 mi": 2, "over 2 mi": 3 })[fwyBand(b)] ?? null, cell: b => { const f = fwyBand(b); return h("td", { class: "t-text" + (f === "unknown" ? " unk" : ""), title: "Rough distance to the nearest freeway" }, f === "unknown" ? "—" : f); } },
    { k: "walk", t: "Walk", grp: "Location", def: true, num: true, v: b => walkOf(b).v, cell: b => { const w = walkOf(b); return h("td", { class: "num" + (w.v == null ? " unk" : ""), title: w.src === "area" ? "Neighborhood Walk Score" : w.src ? "Address Walk Score" : null }, w.v == null ? "—" : String(w.v), w.src === "area" ? h("span", { class: "t-src", text: "area" }) : null); } },
    { k: "heat", t: "Summer high", grp: "Location", num: true, v: summerHigh, cell: b => numCell(summerHigh(b), x => Math.round(x) + "°F") },
    { k: "typ", t: "Area 1BR", grp: "Location", num: true, v: typicalRent, cell: b => numCell(typicalRent(b), money) },
    { k: "doc", t: "Documented", grp: "Ranking", def: true, num: true, v: docPct, cell: b => h("td", { class: "num" }, h("span", { class: "t-match" }, h("span", { class: "meter xs doc-meter", "aria-hidden": "true" }, h("i", { style: { "--w": docPct(b) + "%" } })), docPct(b) + "%")) },
    { k: "landlord", t: "Landlord", grp: "Other", v: b => b.landlord || "company", cell: b => h("td", { class: "t-text", text: b.landlord === "private" ? "Private" : "Company" }) },
    { k: "status", t: "Status", grp: "Other", def: true, v: b => b.my_status || "new", cell: b => h("td", { class: "t-text", text: statusName(b.my_status) }) },
  ];
  const TCOL_DEFAULT = TCOLS.filter(c => c.def).map(c => c.k);
  const shownCols = () => { const on = Array.isArray(S.tcols) ? S.tcols : TCOL_DEFAULT; return TCOLS.filter(c => c.fixed || on.includes(c.k)); };
  /* Column picker: a popover of checkboxes, grouped; choices persist. */
  function colPicker() {
    const on = new Set(shownCols().map(c => c.k));
    const nOpt = TCOLS.filter(c => !c.fixed).length, nOn = TCOLS.filter(c => !c.fixed && on.has(c.k)).length;
    const det = h("details", { class: "colpick" },
      h("summary", { class: "btn ghost sm", html: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 5h4v14H4zM10 5h4v14h-4zM16 5h4v14h-4z"/></svg>Columns' },
        h("span", { class: "colpick-n", text: `${nOn} of ${nOpt}` })));
    const groups = [...new Set(TCOLS.filter(c => !c.fixed).map(c => c.grp))];
    const pop = h("div", { class: "colpick-pop", role: "group", "aria-label": "Table columns" },
      ...groups.map(gname => h("fieldset", { class: "colpick-g" }, h("legend", { class: "mono-label", text: gname }),
        ...TCOLS.filter(c => !c.fixed && c.grp === gname).map(c => h("label", { class: "colpick-opt" },
          h("input", { type: "checkbox", checked: on.has(c.k), onchange: e => {
            const cur = shownCols().filter(x => !x.fixed).map(x => x.k);
            toggleIn(cur, c.k, e.target.checked);
            S.tcols = TCOLS.filter(x => cur.includes(x.k)).map(x => x.k); ls.set("tcols", S.tcols);
            det.querySelector(".colpick-n").textContent = `${S.tcols.length} of ${nOpt}`;
            renderResults();
          } }), h("span", { text: c.t }))))),
      h("div", { class: "colpick-foot" }, h("button", { type: "button", class: "linkbtn sm", text: "Default columns", onclick: () => { S.tcols = null; ls.set("tcols", null); det.open = false; renderResults(); } })));
    det.append(pop);
    det.addEventListener("keydown", e => { if (e.key === "Escape" && det.open) { e.stopPropagation(); det.open = false; det.querySelector("summary").focus(); } });
    return det;
  }
  document.addEventListener("click", e => { document.querySelectorAll(".colpick[open]").forEach(d => { if (!d.contains(e.target)) d.open = false; }); });
  function renderTable(root, list, ctx) {
    if (!list.length) {
      if (!root.querySelector(":scope > .empty")) { root.replaceChildren(emptyState()); if (!ctx.switching) fadeIn(root.firstChild); }
      return;
    }
    const COLS = shownCols();
    const col = COLS.find(c => c.k === S.tsort.key) || TCOLS.find(c => c.k === "score");
    const rows = list.slice().sort((a, b) => { const x = col.v(a), y = col.v(b); if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * S.tsort.dir; });
    const head = h("thead", null, h("tr", null, h("th", { class: "num t-no", scope: "col", text: "No." }), ...COLS.map(c => h("th", { class: c.num ? "num" : null, scope: "col", "aria-sort": S.tsort.key === c.k ? (S.tsort.dir > 0 ? "ascending" : "descending") : null },
      h("button", { type: "button", class: "th-btn" + (S.tsort.key === c.k ? " on" : ""), "data-col": c.k, onclick: () => {
          S.tsort = { key: c.k, dir: S.tsort.key === c.k ? -S.tsort.dir : (c.num && !["rent", "ppsf"].includes(c.k) ? -1 : 1) }; ls.set("tsort", S.tsort); renderResults();
          const again = document.querySelector(`.th-btn[data-col="${c.k}"]`); if (again) again.focus({ preventScroll: true });
        } },
        c.t, h("span", { class: "th-arrow", "aria-hidden": "true", text: S.tsort.key === c.k ? (S.tsort.dir > 0 ? "↑" : "↓") : "↕" }))))));
    const trs = rows.map((b, i) => h("tr", { class: "v-" + verdict(b), "data-listing": b.id, onclick: () => openBuilding(b) },
      h("td", { class: "num t-no", text: pad2(i + 1) }), ...COLS.map(c => c.cell(b))));
    const cap = h("caption", { class: "sr", text: `${rows.length} listings. Select a column heading to sort.` });
    const colKey = COLS.map(c => c.k).join(",");
    const table = root.querySelector(":scope > .tablewrap > table");
    if (!table || table.dataset.cols !== colKey) {
      const bar = root.querySelector(":scope > .tablebar") || h("div", { class: "tablebar" },
        h("p", { class: "tablebar-note", text: "Unknown values show as — or ?. A + after a cost means some parts were not found." }), colPicker());
      const sx = table ? table.parentNode.scrollLeft : 0;
      const wrap = h("div", { class: "tablewrap" }, h("table", { class: "ledger-table", "data-cols": colKey }, cap, head, h("tbody", null, ...trs)));
      root.replaceChildren(bar, wrap);
      if (sx) wrap.scrollLeft = sx;
      return;
    }
    // Same table: keep the scroll box (and its scroll position), move rows with FLIP.
    table.querySelector("caption").replaceWith(cap);
    table.querySelector("thead").replaceWith(head);
    morph(table.querySelector("tbody"), trs, { ghosts: false, order: false, enter: "pop", maxEnter: 6 });
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
  function renderMap(view, list) {
    // The atlas draws its own frame; it gets a bare slot, and the same element is re-attached on updates.
    let root = view.querySelector(":scope > .mapslot");
    if (!root) { root = h("div", { class: "mapslot" }); view.replaceChildren(root); }
    if (window.MapView && typeof window.MapView.render === "function") {
      try {
        const M = marketData(), mi = marketInfo();
        return window.MapView.render(root, list, { geo: M.geo, areas: S.areas, verdict, rentOf, money, score, areaScore, openBuilding, openArea,
          surveyed: S.buildings.length > 0, emptyNote: S.buildings.length ? null : `No ${mi.name} listings yet. The atlas is ready for them.` });
      } catch (err) { console.error(err); root.replaceChildren(); }
    }
    root.replaceChildren();
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
      h("span", null, h("i", { style: { background: "var(--bad)" } }), "Fails a requirement"),
      h("span", { class: "legend-note", text: `${plural(list.length, "listing")} in view. Coast and freeways are approximate.` })));
  }

  /* ==========================================================================
     Views: neighborhoods (atlas index)
     ========================================================================== */
  function factorBars(a, cls) {
    return h("ul", { class: "factors " + (cls || "") }, ...FACTORS.map((f, i) => {
      const v = factorScore(a, f);
      return h("li", { class: "factorbar", style: { "--bi": i } },
        factorIcon(f.key) || h("span", { class: "ico-fallback", "aria-hidden": "true" }),
        h("span", { class: "factorbar-name", title: f.name, text: f.name }),
        h("span", { class: "factorbar-track", "aria-hidden": "true" }, h("i", { style: { "--w": v == null ? "0%" : v * 10 + "%" } })),
        h("span", { class: "factorbar-v", text: f1(v) }));
    }));
  }
  function renderAreas(root, _list, ctx) {
    if (S.loaded && !S.areas.length) { if (!root.querySelector(":scope > .unsurveyed")) root.replaceChildren(marketEmpty("areas")); return; }
    const list = S.areas.filter(a => !S.f.hideRegions.includes(a.region)).map(a => ({ a, sc: areaScore(a) })).sort((x, y) => (y.sc ?? -1) - (x.sc ?? -1));
    if (!list.length) { root.replaceChildren(emptyState(S.loaded ? "No neighborhoods in the selected regions." : "Loading…")); return; }
    const mkt = median(S.buildings.map(rentOf));
    const inView = new Map();
    for (const b of S.buildings) if (matches(b)) inView.set(b.area_id, (inView.get(b.area_id) || 0) + 1);
    const plates = list.map(({ a, sc }, i) => {
        const n = inView.get(a.id) || 0;
        return h("article", { class: "plate", "data-key": a.id, style: { "--i": Math.min(i, 24) }, onclick: () => openArea(a) },
          h("header", { class: "plate-head" },
            h("span", { class: "plate-no", text: "Plate " + pad2(i + 1) }),
            h("span", { class: "plate-region", text: a.region })),
          h("div", { class: "plate-title" },
            regionEmblem(a.region, "md") || h("span", { class: "emblem-fallback", "aria-hidden": "true", text: a.region.split(" ").map(w => w[0]).join("") }),
            h("div", null, h("h3", { class: "plate-name" }, openBtn(a.name, a.name + ", neighborhood report")), h("p", { class: "plate-count", text: n ? plural(n, "listing") + " in view" : "No listings in view" })),
            h("div", { class: "plate-score" }, h("b", { text: f1(sc) }), h("span", { text: "/ 10" }))),
          plateExtras(a, mkt),
          a.concessions ? h("div", { class: "plate-conc" }, h("span", { class: "fig-k", text: "Concessions" }), levelPips(a.concessions.level),
            h("p", { class: "plate-conc-t", text: [a.concessions.typical_offer, a.concessions.driver].filter(v => v && v !== "unknown").map(firstSentence).join(" · ") || "Offer and driver not found" }),
            srcLinks(a.concessions.sources)) : null,
          factorBars(a));
    });
    const sub = `${plural(list.length, "region")} of the atlas, ranked by your weights. Listing counts follow the current filters.`;
    const atlas = root.querySelector(":scope > .atlas");
    if (atlas) { root.querySelector(".viewhead-sub").textContent = sub; morph(atlas, plates, { enter: "pop" }); return; }
    root.replaceChildren(
      h("div", { class: "viewhead" },
        h("h2", { class: "viewhead-title" }, "Atlas of neighborhoods"),
        h("p", { class: "viewhead-sub", text: sub })),
      h("div", { class: "atlas" }, ...plates));
    if (ctx.switching) growBars(root);
  }
  /* Three measures from the neighborhood extras: typical 1BR rent (vs. listings in this market),
     summer high, Walk Score. Unknown shows as a dash. */
  function plateExtras(a, mkt) {
    const x = extrasOf(a), r = x.median_1br_rent, t = x.summer_high_f, w = a.walk && a.walk.walk_score;
    const diff = r != null && mkt != null ? r - mkt : null;
    const cell = (k, v, sub, cls) => h("div", { class: "px " + (cls || "") }, h("dt", { class: "fig-k", text: k }), h("dd", null, h("b", { text: v }), sub ? h("span", { text: sub }) : null));
    return h("dl", { class: "plate-extras" },
      cell("Typical 1BR", r == null ? "—" : money(r), diff == null ? "not found" : diff >= 0 ? `${money(diff)} above listing median` : `${money(-diff)} below listing median`),
      cell("Summer high", t == null ? "—" : Math.round(t) + "°F", t == null ? "not found" : t >= 90 ? "hot" : t >= 84 ? "warm" : "mild", t >= 90 ? "hot" : ""),
      cell("Walk Score", w == null ? "—" : String(w), w == null ? "not found" : "neighborhood"));
  }
  /* Factor bars draw out from zero when a view or dossier first appears. */
  function growBars(scope) {
    if (reduceMotion()) return;
    scope.classList.add("grow");
    setTimeout(() => scope.classList.remove("grow"), 1100);
  }

  /* ==========================================================================
     Views: compare
     ========================================================================== */
  function renderCompare(root) {
    root.replaceChildren();
    if (S.loaded && !S.buildings.length) return root.append(marketEmpty("compare"));
    const picks = S.buildings.filter(b => S.compare.has(b.id));
    if (!picks.length) return root.append(emptyState("Open any listing and choose Compare to line up to four side by side.", "Nothing on the bench yet", true));
    const tri = (g, k) => b => triOf(dget(b, g, k));
    const rows = [
      ["Neighborhood", b => areaName(b) || "—"],
      ["Match (of 100)", b => fm(score(b)), score, 1],
      ["Rent", b => money(rentOf(b)), rentOf, -1],
      ["Size", b => b.sqft ? Math.round(b.sqft) + " sq ft" : "—", b => b.sqft, 1],
      ["$ per sq ft", b => ppsf(b) ? "$" + ppsf(b).toFixed(2) : "—", ppsf, -1],
      ["True monthly cost", b => { const c = costOf(b); return c.total == null ? "—" : money(c.total) + (c.missing.length ? "+ (" + costNote(c) + ")" : ""); }, trueCost, -1],
      ["Saves vs. The Jayne", b => { const d = savingsOf(b); return d == null ? "—" : (costOf(b).missing.length ? "up to " : "") + money(d) + "/mo"; }, savingsOf, 1],
      ["Deposit", b => dget(b, "costs", "deposit") == null ? "—" : money(dget(b, "costs", "deposit")), b => dget(b, "costs", "deposit"), -1],
      ["Documented", b => docPct(b) + "% of particulars", docPct, 1],
      ["Reviews", b => repScore(b) == null ? "—" : repScore(b) + "/10", repScore, 1],
      ...REQS.map(r => [r.name, b => reqVal(b, r.key), null, 0, r.key]),
      ["Cats", tri("pets", "cats"), null, 0, "tri"], ["Dogs", tri("pets", "dogs"), null, 0, "tri"],
      ["Parking", b => { const c = costOf(b), t = parkType(b); return (t === "unclear" ? "Type not found" : PARK_WORD[t]) + " · " + (c.park == null ? "fee not found" : c.park === 0 ? (c.noPark ? "no parking" : "included") : money(c.park) + "/mo"); }],
      ["Year built", b => yearOf(b) ?? "—", yearOf, 1],
      ["Units", b => dget(b, "building", "units") ?? "—"],
      ["Gym", tri("building", "gym"), null, 0, "tri"], ["Pool", tri("building", "pool"), null, 0, "tri"],
      ["Freeway distance", b => fwyBand(b) === "unknown" ? "—" : fwyBand(b) + " (rough)"],
      ["Walk Score", b => { const w = walkOf(b); return w.v == null ? "—" : w.v + (w.src === "area" ? " (neighborhood)" : " (address)"); }, b => walkOf(b).v, 1],
      ["Summer high", b => summerHigh(b) == null ? "—" : Math.round(summerHigh(b)) + "°F", summerHigh, -1],
      ["Area typical 1BR", b => typicalRent(b) == null ? "—" : money(typicalRent(b))],
      ...FACTORS.map(f => [f.name, b => f1(factorScore(S.areaById.get(b.area_id), f)), b => factorScore(S.areaById.get(b.area_id), f), 1]),
      ["Landlord", b => b.landlord === "private" ? "Private owner" : ((b.reviews && b.reviews.management_company) || "Company")],
      ["Special", b => b.special || "—"],
      ["Specials history", b => { const p = patternOf(b), c = b.concessions || {}, last = (c.seen || []).filter(x => x && x.offer).slice(-1)[0]; return p === "unknown" ? "—" : PATTERN_WORD[p] + (last ? ` · last seen: ${last.offer}` + (last.when ? ` (${last.when})` : "") : ""); }, b => ({ often: 3, sometimes: 2, rarely: 1 })[patternOf(b)] ?? null, 1],
      ["Red flags", b => (b.reviews && b.reviews.dealbreakers) || b.red_flags || "—"],
    ];
    root.append(
      h("div", { class: "viewhead" },
        h("h2", { class: "viewhead-title" }, "On the bench"),
        h("p", { class: "viewhead-sub", text: `${plural(picks.length, "specimen")} side by side${picks.length < 4 ? ` · room for ${4 - picks.length} more` : ""}. The best value in each row is marked; — means research did not find it.` })),
      h("div", { class: "tablewrap compare-wrap" }, h("table", { class: "compare", style: { "--cols": picks.length } },
        h("thead", null, h("tr", null, h("th", { class: "compare-corner", scope: "col" }, h("span", { class: "sr", text: "Attribute" })), ...picks.map(b => h("th", { scope: "col" },
          h("div", { class: "compare-head" },
            h("span", { class: "mono-label", text: whereText(b) }),
            h("button", { class: "compare-name", type: "button", text: b.name, onclick: () => openBuilding(b) }),
            verdict(b) === "all" ? h("span", { class: "tag ok", text: "Meets everything" }) : overBudgetOnly(b) ? h("span", { class: "tag bad", text: "Over budget" }) : null,
            h("button", { class: "linkbtn sm", type: "button", "aria-label": "Remove " + b.name, text: "Remove", onclick: () => { S.compare.delete(b.id); ls.set("compare", [...S.compare]); renderToolbar(); renderResults(); } })))))),
        h("tbody", null, ...rows.map(([label, fmt, val, dir, reqKey]) => {
          // mark the best value (all ties, judged on the shown value); no mark when every column shows the same
          const bestSet = new Set();
          if (val && picks.length > 1) {
            const vs = picks.map(val), ok = vs.filter(x => x != null);
            if (ok.length >= 2) {               // a lone known value is not "best"
              const shown = picks.map(b => String(fmt(b))), top = shown[vs.indexOf(dir > 0 ? Math.max(...ok) : Math.min(...ok))];
              const tied = shown.map((t, i) => vs[i] != null && t === top);
              if (tied.filter(Boolean).length < picks.length) tied.forEach((t, i) => t && bestSet.add(i));
            }
          }
          return h("tr", null, h("th", { scope: "row", class: "compare-k" }, reqKey && reqKey !== "tri" ? reqIcon(reqKey) : null, label), ...picks.map((b, i) => {
            const t = String(fmt(b));
            if (reqKey) return h("td", null, h("span", { class: "reqword " + t }, h("i", { "aria-hidden": "true" }), reqKey === "tri" ? ({ yes: "Yes", no: "No", unclear: "Not confirmed" })[t] : REQ_WORD[t]));
            return h("td", { class: bestSet.has(i) ? "best" : null }, t, bestSet.has(i) ? h("span", { class: "sr", text: " (best)" }) : null);
          }));
        })))));
  }

  /* ==========================================================================
     Views: add a listing
     ========================================================================== */
  function renderAdd(root, _list, ctx) {
    if (!ctx.switching && root.querySelector(":scope > .accession")) return; // keep what is being typed
    root.replaceChildren();
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
        h("p", { class: "accession-lede", text: `Found something in ${marketInfo().name} on Zillow, Craigslist or a walk around the block? Add it and it will be scored with its neighborhood.` })),
      h("div", { class: "accession-section" },
        h("p", { class: "section-k" }, h("span", { text: "I" }), "Where"),
        field("a-name", "Building or address", h("input", { id: "a-name", required: true, autocomplete: "off" })),
        S.areas.length
          ? field("a-area", "Neighborhood", h("select", { id: "a-area", class: "select", required: true }, h("option", { value: "", text: "Choose…" }),
              ...REGIONS.map(r => h("optgroup", { label: r }, ...S.areas.filter(a => a.region === r).map(a => h("option", { value: a.id, text: a.name }))))))
          : field("a-area", "Neighborhood", h("select", { id: "a-area", class: "select", disabled: true }, h("option", { value: "", text: "No neighborhoods surveyed yet" })),
              `${marketInfo().name} neighborhoods have not been surveyed, so this listing will not be scored or mapped yet.`)),
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
        listing_url: v("a-url") || null, notes: v("a-note"), source: "you", my_status: "watch", added_at: new Date().toISOString(), market: S.market };
      const saved = await saveBuilding(b, true);
      form.reset(); S.view = "list"; ls.set("view", "list"); renderToolbar(); renderResults(); openBuilding(b);
      if (saved) toast("Listing added");
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

  /* When nothing in a market meets every requirement, say so above the results and offer the
     near-misses (listings that fail, most often only on rent) instead of an empty-looking list. */
  function renderNote(list) {
    const el = $("viewNote");
    const show = S.loaded && S.buildings.length && ["list", "table", "map"].includes(S.view) && !S.buildings.some(b => verdict(b) === "all");
    if (!show) { el.hidden = true; el.replaceChildren(); return; }
    const mi = marketInfo(), n = { check: 0, fail: 0, over: 0 };
    for (const b of S.buildings) { const v = verdict(b); n[v]++; if (v === "fail" && overBudgetOnly(b)) n.over++; }
    const hidden = S.buildings.length - list.length;
    const nearOff = !S.f.verdicts.includes("fail") || S.f.maxRent < 2600;
    el.hidden = false;
    el.replaceChildren(
      h("span", { class: "viewnote-mark", "aria-hidden": "true", text: "0" }),
      h("div", { class: "viewnote-body" },
        h("p", { class: "viewnote-title", text: `No ${mi.name} listing meets every requirement yet.` }),
        h("p", { class: "viewnote-text", text: `${plural(n.check, "listing")} could, once the leasing office confirms what research could not find. ${n.fail ? `${n.fail} fail${n.over ? `, ${n.over} only on rent` : ""}.` : ""}${hidden ? ` ${hidden} hidden by your filters.` : ""}` })),
      nearOff && n.fail ? h("button", { class: "btn ghost sm", type: "button", text: "Show near-misses too", onclick: () => {
        if (!S.f.verdicts.includes("fail")) S.f.verdicts.push("fail"); S.f.maxRent = 2600; saveF(); syncFilters(); renderResults(); toast("Showing listings that fail a requirement, up to $2,600");
      } }) : null);
  }
  /* A market whose research has not run: say so plainly, show what it will be checked against. */
  const REQ_LIST = () => [
    ["sqft", `${MIN_SQFT}+ sq ft`, "One bedroom"], ["rent", `Rent ≤ ${money(RENT_CAP)}`, "after specials"],
    ...REQS.map(r => [r.key, r.name, "confirmed by research"]),
  ];
  function marketEmpty(where) {
    const mi = marketInfo(), nA = S.areas.length;
    const title = where === "areas" ? `${mi.name} neighborhoods haven't been surveyed yet` : `${mi.name} research hasn't run yet`;
    const text = where === "areas"
      ? `There are no neighborhood reports for ${mi.name} yet. When they arrive, each one is scored on the same factors and weights as Los Angeles.`
      : `No ${mi.name} listings have been gathered${nA ? `, though ${plural(nA, "neighborhood")} ${nA === 1 ? "is" : "are"} surveyed` : ""}. When they arrive, each listing is checked against the same requirements:`;
    return h("section", { class: "unsurveyed", "aria-labelledby": "unsurveyedTitle" },
      h("div", { class: "unsurveyed-art" }, art("empty-art", ill("empty")) || h("span", { class: "empty-art empty-fallback", "aria-hidden": "true" }),
        h("p", { class: "mono-label", text: `Drawer ${mi.numeral} · ${mi.name}` })),
      h("div", { class: "unsurveyed-body" },
        h("p", { class: "eyebrow", text: "Not yet surveyed" }),
        h("h2", { class: "unsurveyed-title", id: "unsurveyedTitle", text: title }),
        h("p", { class: "unsurveyed-text", text: text }),
        where === "areas" ? null : h("ul", { class: "unsurveyed-reqs", "aria-label": "Requirements" }, ...REQ_LIST().map(([k, name, sub]) =>
          h("li", null, reqIcon(k) || h("span", { class: "unsurveyed-glyph", "aria-hidden": "true", text: k === "rent" ? "$" : "ft²" }), h("span", null, h("b", { text: name }), h("small", { text: sub }))))),
        where === "areas" ? null : h("p", { class: "unsurveyed-text small", text: `Ranked with your weights and compared with renewing at The Jayne ($${JAYNE.allIn.toLocaleString("en-US", { minimumFractionDigits: 2 })} a month), the same as every market.` }),
        h("div", { class: "unsurveyed-actions" },
          S.view !== "map" ? h("button", { class: "btn", type: "button", text: `Open the ${mi.name} atlas`, onclick: () => setView("map") }) : null,
          h("button", { class: "btn ghost", type: "button", text: "Back to Los Angeles", onclick: () => setMarket("la") }))));
  }

  /* ==========================================================================
     Views: timeline (shared by every market) + rent timing research (LA)
     ========================================================================== */
  const dOf = t => { const [y, m, d] = String(t).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const dayDiff = (a, b) => Math.round((b - a) / 864e5);
  const fmtDay = (d, yr) => d.toLocaleDateString("en-US", yr ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
  const todayDate = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const pStart = p => dOf(p.start || p.date), pEnd = p => dOf(p.end || p.date);
  const pWhen = p => p.date ? fmtDay(dOf(p.date)) : `${fmtDay(dOf(p.start))} – ${fmtDay(dOf(p.end))}`;
  const hardOf = id => HARD.find(x => x.id === id);
  const relDays = n => n === 0 ? "today" : n === 1 ? "tomorrow" : n > 0 ? `in ${n} days` : n === -1 ? "yesterday" : `${-n} days ago`;

  /* Checklist: one localStorage entry per item ("check:<phase>.<task>"), mirrored in memory so
     Export still works when this browser blocks storage. */
  const taskKey = (p, t) => p.id + "." + t[0];
  const TASK_KEYS = new Set(PHASES.flatMap(p => p.tasks.map(t => taskKey(p, t))));
  const TASK_TOTAL = TASK_KEYS.size;
  const CHECKS = {};
  function loadChecks() { for (const k of TASK_KEYS) { if (ls.get("check:" + k, false)) CHECKS[k] = true; else delete CHECKS[k]; } }
  function setCheck(k, on) { if (!TASK_KEYS.has(k)) return; if (on) CHECKS[k] = true; else delete CHECKS[k]; ls.set("check:" + k, !!on); }
  const phaseDone = p => p.tasks.filter(t => CHECKS[taskKey(p, t)]).length;
  const allDone = () => PHASES.reduce((n, p) => n + phaseDone(p), 0);

  /* Add to calendar: an .ics built here, all-day events. Fixed dates carry a two-day reminder;
     steps tied to a fixed date are folded into that date's event so nothing appears twice. */
  function icsText() {
    const esc = t => String(t).replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
    const ymd = d => d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
    const fold = l => { const out = []; for (let i = 0; i < l.length; i += 60) out.push((i ? " " : "") + l.slice(i, i + 60)); return out.join("\r\n"); };
    const now = new Date(), stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Apartment Search 2027//Timeline//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Apartment search 2027"];
    const ev = (uid, title, a, b, desc, alarm) => {
      lines.push("BEGIN:VEVENT", "UID:" + uid + "@apartment-search-2027", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + ymd(a), "DTEND;VALUE=DATE:" + ymd(addDays(b, 1)),
        "SUMMARY:" + esc(title), "DESCRIPTION:" + esc(desc), "TRANSP:TRANSPARENT");
      if (alarm) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc(title), "TRIGGER:-P2D", "END:VALARM");
      lines.push("END:VEVENT");
    };
    const tasks = p => p.tasks.map(t => "- " + t[1]).join("\n");
    for (const x of HARD) {
      const p = PHASES.find(q => q.hard === x.id);
      ev("deadline-" + x.id, "Deadline: " + x.label, dOf(x.date), dOf(x.date), [x.label + " (" + x.basis + ").", p ? p.title + ". " + p.why + "\n" + tasks(p) : ""].filter(Boolean).join("\n\n"), true);
    }
    for (const p of PHASES) if (!p.hard) ev("step-" + p.id, (p.date ? "" : "Window: ") + p.title, pStart(p), pEnd(p), p.why + "\n" + tasks(p), false);
    lines.push("END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  }
  function downloadIcs() {
    const blob = new Blob([icsText()], { type: "text/calendar;charset=utf-8" });
    const a = h("a", { href: URL.createObjectURL(blob), download: "apartment-search-2027-timeline.ics" });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast(`Calendar file saved: ${HARD.length} fixed dates and ${PHASES.filter(p => !p.hard).length} steps`);
  }

  /* Progress readouts update in place when a box is ticked. */
  function updateProgress(root) {
    root = root || document;
    for (const p of PHASES) {
      const d = phaseDone(p), n = p.tasks.length, w = (d / n * 100).toFixed(1) + "%";
      root.querySelectorAll(`[data-prog="${p.id}"]`).forEach(el => { el.textContent = `${d}/${n}`; el.classList.toggle("full", d === n); });
      root.querySelectorAll(`[data-progbar="${p.id}"]`).forEach(el => el.style.setProperty("--w", w));
      root.querySelectorAll(`[data-progtext="${p.id}"]`).forEach(el => { el.textContent = d === n ? "All done" : `${d} of ${n} done`; });
      const item = root.querySelector(`.tl-item[data-phase="${p.id}"]`); if (item) item.classList.toggle("complete", d === n);
    }
    const all = allDone();
    root.querySelectorAll("[data-prog-all]").forEach(el => { el.textContent = all; });
    root.querySelectorAll("[data-progbar-all]").forEach(el => el.style.setProperty("--w", (all / TASK_TOTAL * 100).toFixed(1) + "%"));
  }

  function tlChart(today) {
    const t0 = dOf(TL.start), t1 = addDays(dOf(TL.end), 1), span = dayDiff(t0, t1);
    const at = d => Math.max(0, Math.min(span, dayDiff(t0, d))) / span * 100;
    const pc = d => at(d).toFixed(3) + "%";
    const months = []; for (let d = new Date(t0.getFullYear(), t0.getMonth() + 1, 1); d < t1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);
    const weeks = []; for (let d = addDays(t0, 7); d < t1; d = addDays(d, 7)) weeks.push(d);
    const inRange = today >= t0 && today < t1;
    const mLabel = d => d.toLocaleDateString("en-US", { month: "short" }) + (d.getMonth() === 0 ? " " + d.getFullYear() : "");
    const axis = h("div", { class: "tl-row tl-row-axis", "aria-hidden": "true" },
      h("div", { class: "tl-lab" }, h("span", { class: "mono-label", text: "2026 – 27" })),
      h("div", { class: "tl-track" }, h("span", { class: "tl-month first", style: { left: "0%" }, text: "Oct" }),
        ...months.map(d => h("span", { class: "tl-month", style: { left: pc(d) }, text: mLabel(d) }))),
      h("div", { class: "tl-prog-h mono-label", text: "Done" }));
    const flags = h("div", { class: "tl-row tl-row-hard" },
      h("div", { class: "tl-lab" }, h("span", { class: "tl-lab-k" }, h("i", { class: "tl-hard-key", "aria-hidden": "true" }), "Fixed dates")),
      h("div", { class: "tl-track" }, ...HARD.map((x, i) => {
        const d = dOf(x.date), left = at(d);
        return h("span", { class: "tl-flag tier-" + (i % 2) + (left > 78 ? " end" : ""), "data-hard": x.id, style: { left: pc(d) } },
          h("b", { text: fmtDay(d) }), h("span", { text: x.short }), h("span", { class: "sr", text: `: ${x.label}, ${relDays(dayDiff(today, d))}.` }));
      })),
      h("div", { class: "tl-prog" }));
    const rows = PHASES.map(p => {
      const a = pStart(p), b = addDays(pEnd(p), 1), d = phaseDone(p), n = p.tasks.length;
      const mark = p.date
        ? h("span", { class: "tl-ms" + (p.hard ? " hard" : ""), style: { left: pc(a) }, title: `${p.title}: ${pWhen(p)}` })
        : h("span", { class: "tl-bar" + (p.hard ? " hard" : ""), style: { left: pc(a), width: Math.max(.9, at(b) - at(a)).toFixed(3) + "%" }, title: `${p.title}: ${pWhen(p)}` },
            h("i", { "data-progbar": p.id, style: { "--w": (d / n * 100).toFixed(1) + "%" } }));
      return h("div", { class: "tl-row" + (pEnd(p) < today ? " past" : ""), "data-phase": p.id },
        h("div", { class: "tl-lab" }, h("button", { type: "button", class: "tl-lab-btn", "aria-label": `Step ${p.n}: ${p.title}, ${pWhen(p)}. Show checklist.`, onclick: () => focusPhase(p.id) },
          h("span", { class: "tl-n", text: pad2(p.n) }), h("span", { class: "tl-lab-main" }, h("span", { class: "tl-lab-t", text: p.title }), h("span", { class: "tl-lab-d", text: pWhen(p) })))),
        h("div", { class: "tl-track", "aria-hidden": "true" }, mark),
        h("div", { class: "tl-prog", "data-prog": p.id, title: "Checklist items done", text: `${d}/${n}` }));
    });
    const overlay = h("div", { class: "tl-overlay", "aria-hidden": "true" },
      ...weeks.map(d => h("i", { class: "tl-week", style: { left: pc(d) } })),
      ...months.map(d => h("i", { class: "tl-grid", style: { left: pc(d) } })),
      ...HARD.map(x => h("i", { class: "tl-hardline", "data-hard": x.id, style: { left: pc(dOf(x.date)) } })),
      inRange ? h("i", { class: "tl-todayline", style: { left: pc(today) } }, h("span", { text: "Today" })) : null);
    return h("div", { class: "tl-chart", role: "group", "aria-label": "Timeline from Oct 26, 2026 to Feb 28, 2027" }, overlay, axis, flags, ...rows);
  }

  function tlAgenda(today) {
    const items = [];
    let placed = false;
    const todayItem = () => {
      const next = HARD.map(x => ({ x, n: dayDiff(today, dOf(x.date)) })).find(o => o.n >= 0);
      return h("li", { class: "tl-item tl-today" },
        h("div", { class: "tl-when" }, h("b", { text: fmtDay(today) }), h("small", { text: "Today" })),
        h("span", { class: "tl-node today", "aria-hidden": "true" }),
        h("p", { class: "tl-today-text" }, h("b", { text: "You are here. " }), next ? `${next.x.label} ${relDays(next.n)} (${fmtDay(dOf(next.x.date))}).` : "Every fixed date has passed."));
    };
    for (const p of PHASES) {
      if (!placed && pEnd(p) >= today) { items.push(todayItem()); placed = true; }
      const a = pStart(p), b = pEnd(p), d = phaseDone(p), n = p.tasks.length;
      const st = b < today ? "past" : a <= today ? "now" : "next";
      const hard = p.hard && hardOf(p.hard);
      const rel = st === "now" ? "Now" : st === "past" ? "Passed" : relDays(dayDiff(today, a));
      items.push(h("li", { class: `tl-item ${st}` + (d === n ? " complete" : ""), id: "tl-" + p.id, "data-phase": p.id, tabindex: -1 },
        h("div", { class: "tl-when" }, h("b", { text: fmtDay(a) }), p.date ? null : h("span", { text: "to " + fmtDay(b) }), h("small", { text: rel })),
        h("span", { class: "tl-node" + (hard ? " hard" : "") + (p.date ? " ms" : ""), "aria-hidden": "true" }),
        h("article", { class: "tl-card", "aria-labelledby": "tlh-" + p.id },
          h("header", { class: "tl-card-head" },
            h("span", { class: "tl-card-no", text: "Step " + pad2(p.n) }),
            hard ? h("span", { class: "tag bad", text: "Fixed date · " + hard.short }) : null,
            st === "now" ? h("span", { class: "tag ok", text: "Now" }) : null),
          h("h3", { class: "tl-card-title", id: "tlh-" + p.id, text: p.title }),
          h("p", { class: "tl-card-when mono-label", text: pWhen(p) + (hard ? " · " + hard.basis : "") }),
          h("p", { class: "tl-card-why", text: p.why }),
          h("ul", { class: "tl-checks", "aria-label": p.title + " checklist" }, ...p.tasks.map(t => {
            const k = taskKey(p, t), id = "chk-" + k.replace(/\W/g, "-");
            return h("li", null, h("label", { class: "tl-check", for: id },
              h("input", { type: "checkbox", id, "data-task": k, checked: !!CHECKS[k], onchange: e => { setCheck(k, e.target.checked); updateProgress(); } }),
              h("span", { class: "tl-box", "aria-hidden": "true", html: CHECK_SVG }),
              h("span", { class: "tl-check-t", text: t[1] })));
          })),
          h("footer", { class: "tl-card-foot" },
            h("span", { class: "tl-pbar", "aria-hidden": "true" }, h("i", { "data-progbar": p.id, style: { "--w": (d / n * 100).toFixed(1) + "%" } })),
            h("span", { class: "tl-ptext", "data-progtext": p.id, text: d === n ? "All done" : `${d} of ${n} done` })))));
    }
    if (!placed) items.push(todayItem());
    return h("ol", { class: "tl-agenda", "aria-label": "Steps, in order" }, ...items);
  }

  function tlSummary(today) {
    const all = allDone();
    return h("div", { class: "tl-summary" },
      h("div", { class: "tl-sum-prog" },
        h("p", { class: "mono-label", text: "Checklist" }),
        h("p", { class: "tl-sum-n" }, h("b", { "data-prog-all": "", text: all }), h("span", { text: ` of ${TASK_TOTAL} done` })),
        h("span", { class: "tl-pbar lg", "aria-hidden": "true" }, h("i", { "data-progbar-all": "", style: { "--w": (all / TASK_TOTAL * 100).toFixed(1) + "%" } }))),
      h("ul", { class: "tl-sum-dates" }, ...HARD.map(x => {
        const d = dOf(x.date), n = dayDiff(today, d);
        return h("li", { class: n < 0 ? "past" : n <= 14 ? "urgent" : "" }, h("span", { class: "tl-sum-d", text: fmtDay(d) }), h("span", { class: "tl-sum-l", text: x.label }), h("span", { class: "tl-sum-r", text: n < 0 ? "passed" : relDays(n) }));
      })),
      h("button", { class: "btn block", type: "button", id: "icsBtn", onclick: downloadIcs },
        h("span", { "aria-hidden": "true", html: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="1.5"/><path d="M4 10h16M9 3v4M15 3v4M12 13v5M9.5 15.5h5"/></svg>' }),
        "Add to calendar"),
      h("p", { class: "hint", text: `Downloads an .ics file with the ${HARD.length} fixed dates (each with a two-day reminder) and every step. Checkmarks are saved in this browser and included in Export notes.` }));
  }

  function focusPhase(id) {
    const el = document.getElementById("tl-" + id); if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
    el.focus({ preventScroll: true });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  }
  /* Masthead deadline cards land here. */
  function goTimeline(hardId) {
    setView("timeline");
    requestAnimationFrame(() => {
      const chart = document.querySelector(".tl-chart");
      if (chart && chart.offsetParent) {
        $("results").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
        document.querySelectorAll(`.tl-flag[data-hard="${hardId}"], .tl-hardline[data-hard="${hardId}"]`).forEach(el => { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); });
      } else { const p = PHASES.find(q => q.hard === hardId); if (p) focusPhase(p.id); }
    });
  }

  function renderTimeline(root, _list, ctx) {
    if (!ctx.switching && root.querySelector(":scope > .tl")) return;
    const today = todayDate();
    root.replaceChildren(h("div", { class: "tl" },
      h("div", { class: "viewhead tl-head" },
        h("p", { class: "eyebrow", text: "Shared by every market" }),
        h("h2", { class: "viewhead-title", text: "The move, in order" }),
        h("p", { class: "viewhead-sub", text: `Four fixed dates and ${PHASES.length} steps, from today to the deposit deadline. Select a step to see its checklist.` })),
      tlChart(today),
      h("div", { class: "tl-body" }, tlSummary(today), tlAgenda(today)),
      timingResearch()));
  }

  /* ---- Rent timing research ------------------------------------------------------------- */
  const hostOf = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.hostname.replace(/^www\./, "") : null; } catch { return null; } };
  function srcLinks(list) {
    list = [...new Set((Array.isArray(list) ? list : [list]).filter(x => x != null && x !== "").map(String))];
    if (!list.length) return null;
    // one label per host; further pages on the same host are numbered
    const byHost = new Map();
    for (const u of list) { const k = hostOf(u) || "\u0000" + u; if (!byHost.has(k)) byHost.set(k, []); byHost.get(k).push(u); }
    return h("p", { class: "srcl" }, h("span", { class: "srcl-k", text: list.length === 1 ? "Source" : "Sources" }),
      ...[...byHost].map(([host, us]) => host.startsWith("\u0000") ? h("span", { class: "srcl-t", text: us[0] })
        : h("span", { class: "srcl-h" }, h("a", { href: us[0], target: "_blank", rel: "noopener", title: us[0], text: host }),
          ...us.slice(1).map((u, i) => h("a", { class: "srcl-n", href: u, target: "_blank", rel: "noopener", title: u, "aria-label": `${host}, page ${i + 2}`, text: String(i + 2) })))));
  }
  const unk = () => h("span", { class: "pv unk", title: "Not found" }, "—", h("span", { class: "sr", text: "not found" }));
  const vOr = v => v == null || v === "" || v === "unknown" ? unk() : h("span", { text: String(v) });
  const STRENGTH = { strong: [3, "Strong evidence"], moderate: [2, "Moderate evidence"], weak: [1, "Weak evidence"], anecdotal: [0, "Anecdotal"] };
  function strengthTag(sv) {
    const x = STRENGTH[sv]; if (!x) return h("span", { class: "strength unk", text: "Strength —" });
    if (!x[0]) return h("span", { class: "strength anec", text: "Anecdotal" });
    return h("span", { class: "strength", title: x[1] }, h("span", { class: "pips", "aria-hidden": "true" }, ...[1, 2, 3].map(i => h("i", { class: i <= x[0] ? "on" : "" }))), h("span", { text: x[1] }));
  }
  const LEVEL = { high: [3, "High"], medium: [2, "Medium"], low: [1, "Low"] };
  function levelPips(lv, withWord = true) {
    const x = LEVEL[lv];
    return h("span", { class: "lvl lvl-" + (x ? lv : "unknown"), title: x ? x[1] + " concessions" : "Concession level not found" },
      h("span", { class: "pips", "aria-hidden": "true" }, ...[1, 2, 3].map(i => h("i", { class: x && i <= x[0] ? "on" : "" }))),
      withWord ? h("span", { class: "lvl-w", text: x ? x[1] : "—" }) : h("span", { class: "sr", text: x ? x[1] : "not found" }));
  }
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const firstSentence = t => String(t || "").split(/(?<=[.!?])\s+(?=[A-Z("'])/)[0].trim();

  /* A chart that redraws when its box changes width (fixed-size text at any width). */
  function sized(host, draw) {
    let w = 0;
    const go = () => { const nw = Math.round(host.clientWidth); if (nw && Math.abs(nw - w) > 6) { w = nw; draw(nw); } };
    if (window.ResizeObserver) new ResizeObserver(go).observe(host);
    requestAnimationFrame(go);
  }
  function chartTip(wrap) {
    const tip = h("div", { class: "ctip", hidden: true });
    wrap.append(tip);
    return {
      show(x, y, ...kids) {
        tip.replaceChildren(...kids.filter(Boolean)); tip.hidden = false;
        const W = wrap.clientWidth, tw = tip.offsetWidth;
        tip.style.left = Math.max(0, Math.min(W - tw, x - tw / 2)) + "px"; tip.style.top = Math.max(0, y - tip.offsetHeight - 10) + "px";
      },
      hide() { tip.hidden = true; },
    };
  }

  /* Seasonality: concession level by month as a stepped column per month (an ordinal scale: one hue,
     light to dark), months July to June so the Dec–Jan move window sits together. A rent panel is
     drawn below only for months where research found a percentage; none are invented. */
  const ORDER = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
  const WINDOW = [12, 1];
  function seasonChart(sea) {
    const mm = new Map((sea.months || []).filter(x => x && x.m).map(x => [+x.m, x]));
    const pctOf = m => { const v = mm.get(m) && mm.get(m).rent_vs_avg_pct; return v == null || isNaN(+v) ? null : +v; };
    const hasPct = ORDER.some(m => pctOf(m) != null);
    const wrap = h("div", { class: "schart" });
    const host = h("div", { class: "schart-plot" });
    const live = h("p", { class: "sr", "aria-live": "polite" });
    const legend = h("div", { class: "clegend", "aria-hidden": "true" },
      h("span", { class: "clegend-k", text: "Concession level" }),
      ...["low", "medium", "high"].map(l => h("span", null, h("i", { class: "sw lvl-" + l }), LEVEL[l][1])),
      h("span", null, h("i", { class: "sw none" }), "Not found"),
      hasPct ? h("span", null, h("i", { class: "sw cobalt" }), "Rent below average") : null,
      hasPct ? h("span", null, h("i", { class: "sw amberc" }), "Rent above average") : null,
      h("span", null, h("i", { class: "sw window" }), "Your move window"));
    wrap.append(legend, host, live);
    const tip = chartTip(wrap);
    let sel = -1, geo = null;
    const readout = i => {
      const m = ORDER[i], r = mm.get(m) || {}, lv = LEVEL[r.concessions], p = pctOf(m);
      return { m, r, text: `${MONTHS[m - 1]}: concessions ${lv ? lv[1].toLowerCase() : "not found"}${p != null ? `, rent ${p > 0 ? "+" : ""}${p}% vs. the annual average` : ""}. ${r.note ? firstSentence(r.note) : ""}` };
    };
    const showSel = i => {
      if (!geo) return;
      sel = i;
      geo.selRect.setAttribute("x", geo.x(i) - 1); geo.selRect.setAttribute("opacity", i < 0 ? 0 : 1);
      if (i < 0) { tip.hide(); return; }
      const { m, r } = readout(i), lv = LEVEL[r.concessions], p = pctOf(m);
      tip.show(geo.x(i) + geo.band / 2, geo.top,
        h("p", { class: "ctip-k", text: MONTHS[m - 1] + (WINDOW.includes(m) ? " · move window" : "") }),
        h("p", { class: "ctip-v" }, h("b", { text: lv ? lv[1] + " concessions" : "Concessions not found" })),
        p != null ? h("p", { class: "ctip-v" }, h("b", { text: `${p > 0 ? "+" : ""}${p}%` }), " rent vs. annual average") : null,
        r.note ? h("p", { class: "ctip-note", text: firstSentence(r.note) }) : null);
      live.textContent = readout(i).text;
    };
    sized(host, W => {
      const narrow = W < 560, padL = narrow ? 58 : 70, padR = 6, top = 26, colH = narrow ? 120 : 150, gapX = 26;
      const band = (W - padL - padR) / 12, x = i => padL + i * band;
      const pctH = hasPct ? (narrow ? 90 : 110) : 0, pctTop = top + colH + gapX + (hasPct ? 18 : 0);
      const H = top + colH + gapX + (hasPct ? 18 + pctH + 8 : 0);
      const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: "schart-svg", tabindex: 0, role: "group",
        "aria-label": "Concession level by month, July to June. Use the left and right arrow keys to read each month." });
      // move window band
      const wi = ORDER.indexOf(12);
      svg.append(s("rect", { x: x(wi) + 1, y: 4, width: band * 2 - 2, height: H - 4, fill: "var(--window)", rx: 3 }),
        s("text", { x: x(wi) + band, y: 16, "text-anchor": "middle", class: "c-wlab" }, narrow ? "Move" : "Move window"));
      // ordinal gridlines + labels
      const yL = lv => top + colH - lv / 3 * colH;
      for (const [k, [lv, word]] of Object.entries(LEVEL)) {
        svg.append(s("line", { x1: padL, x2: W - padR, y1: yL(lv), y2: yL(lv), class: "c-grid" }),
          s("text", { x: padL - 8, y: yL(lv) + 4, "text-anchor": "end", class: "c-tick" }, word));
        void k;
      }
      const base = top + colH;
      svg.append(s("line", { x1: padL, x2: W - padR, y1: base, y2: base, class: "c-base" }));
      const bw = Math.min(narrow ? 18 : 24, band - 4);
      ORDER.forEach((m, i) => {
        const r = mm.get(m) || {}, lv = LEVEL[r.concessions], cx = x(i) + band / 2;
        if (lv) {
          const y1 = yL(lv[0]), r4 = 4, x0 = cx - bw / 2;
          svg.append(s("path", { class: "c-col lvl-" + r.concessions, d: `M${x0},${base} V${y1 + r4} Q${x0},${y1} ${x0 + r4},${y1} H${x0 + bw - r4} Q${x0 + bw},${y1} ${x0 + bw},${y1 + r4} V${base} Z` }));
        } else svg.append(s("text", { x: cx, y: base - 6, "text-anchor": "middle", class: "c-tick" }, "—"));
        svg.append(s("text", { x: cx, y: base + 17, "text-anchor": "middle", class: "c-mon" + (WINDOW.includes(m) ? " on" : "") }, narrow ? MONTHS[m - 1][0] : MONTHS[m - 1].slice(0, 3)));
      });
      if (hasPct) {
        const vals = ORDER.map(pctOf), mx = Math.max(...vals.filter(v => v != null).map(Math.abs), .5);
        const step = [.5, 1, 2, 2.5, 5, 10].find(st => mx / st <= 2) || 10, dom = Math.ceil(mx / step) * step;
        const yP = v => pctTop + pctH / 2 - v / dom * pctH / 2;
        svg.append(s("text", { x: padL, y: pctTop - 6, class: "c-sub" }, "Rent vs. annual average"));
        for (let v = -dom; v <= dom + 1e-9; v += step) svg.append(s("line", { x1: padL, x2: W - padR, y1: yP(v), y2: yP(v), class: Math.abs(v) < 1e-9 ? "c-base" : "c-grid" }),
          s("text", { x: padL - 8, y: yP(v) + 4, "text-anchor": "end", class: "c-tick" }, (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(+v.toFixed(1)) + "%"));
        const ext = [vals.indexOf(Math.max(...vals.filter(v => v != null))), vals.indexOf(Math.min(...vals.filter(v => v != null)))];
        vals.forEach((v, i) => {
          const cx = x(i) + band / 2, x0 = cx - bw / 2, y0 = yP(0);
          if (v == null) { svg.append(s("text", { x: cx, y: y0 + 4, "text-anchor": "middle", class: "c-tick" }, "—")); return; }
          const y1 = yP(v), r4 = Math.min(4, Math.abs(y1 - y0)), up = v > 0;
          const d = up ? `M${x0},${y0} V${y1 + r4} Q${x0},${y1} ${x0 + r4},${y1} H${x0 + bw - r4} Q${x0 + bw},${y1} ${x0 + bw},${y1 + r4} V${y0} Z`
            : `M${x0},${y0} V${y1 - r4} Q${x0},${y1} ${x0 + r4},${y1} H${x0 + bw - r4} Q${x0 + bw},${y1} ${x0 + bw},${y1 - r4} V${y0} Z`;
          svg.append(s("path", { d, class: "c-pct " + (up ? "up" : "down") }));
          if (ext.includes(i)) svg.append(s("text", { x: cx, y: up ? y1 - 5 : y1 + 13, "text-anchor": "middle", class: "c-val" }, (v > 0 ? "+" : "") + v + "%"));
        });
      }
      const selRect = s("rect", { x: 0, y: top - 4, width: band + 2, height: H - top + 2, class: "c-sel", opacity: 0, rx: 3 });
      svg.insertBefore(selRect, svg.children[2]);
      ORDER.forEach((m, i) => {
        const hit = s("rect", { x: x(i), y: 0, width: band, height: H, fill: "transparent", class: "c-hit" });
        hit.addEventListener("pointerenter", () => showSel(i));
        hit.addEventListener("click", () => showSel(i));
        svg.append(hit);
      });
      svg.addEventListener("pointerleave", () => { if (document.activeElement !== svg) showSel(-1); });
      svg.addEventListener("focus", () => showSel(sel < 0 ? wi : sel));
      svg.addEventListener("blur", () => showSel(-1));
      svg.addEventListener("keydown", e => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); showSel(((sel < 0 ? wi : sel) + (e.key === "ArrowRight" ? 1 : -1) + 12) % 12); }
        else if (e.key === "Escape") showSel(-1);
      });
      geo = { x, band, top, selRect };
      host.replaceChildren(svg);
      if (sel >= 0) showSel(sel);
    });
    const table = h("details", { class: "srcs ctable" }, h("summary", null, h("span", { text: "Month-by-month notes and sources (12)" })),
      h("div", { class: "tablewrap" }, h("table", { class: "mini-table" },
        h("caption", { class: "sr", text: "Concession level and research notes by month" }),
        h("thead", null, h("tr", null, ...["Month", "Concessions", ...(hasPct ? ["Rent vs. avg."] : []), "Note"].map(t => h("th", { scope: "col", text: t })))),
        h("tbody", null, ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
          const r = mm.get(m) || {}, p = pctOf(m);
          return h("tr", { class: WINDOW.includes(m) ? "win" : null }, h("th", { scope: "row", text: MONTHS[m - 1] }), h("td", null, levelPips(r.concessions)),
            hasPct ? h("td", { class: "num" }, p == null ? unk() : (p > 0 ? "+" : "") + p + "%") : null,
            h("td", null, r.note ? h("p", { text: r.note }) : unk(), srcLinks(r.sources)));
        })))));
    return h("div", { class: "schart-box" }, wrap,
      hasPct ? null : h("p", { class: "schart-note" }, h("b", { text: "No rent curve. " }), "No reliable month-by-month rent index for Los Angeles was found, so the chart shows concession levels only. Each month's direction is in its note."),
      table);
  }

  /* Share of listings or units with a concession, one small chart per source group,
     all on the same 0–max scale and the same time axis so they compare honestly. */
  const shareGroup = geo => { const g = String(geo || "Unknown"), place = g.split(" (")[0].trim(), src = (g.match(/\(([A-Za-z]+)/) || [])[1]; return src ? `${place} · ${src}` : place; };
  function parsePeriod(p) {
    const t = String(p || ""), m = t.match(/^(\d{4})-(\d{2})/);
    if (m) return { y: +m[1], mo: +m[2], flag: t.length > 7 ? t.slice(7).replace(/^\s*\(?|\)?\s*$/g, "") : "" };
    const l = t.match(/^(\d{4})-(late|mid|early)/i);
    if (l) return { y: +l[1], mo: { early: 2, mid: 6, late: 11 }[l[2].toLowerCase()], flag: t.slice(5) };
    return null;
  }
  const monthName = (y, mo) => new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  function shareCharts(rows) {
    const pts = rows.filter(r => r && r.share_pct != null && !isNaN(+r.share_pct)).map(r => ({ ...r, g: shareGroup(r.geo), t: parsePeriod(r.period) }));
    const groups = new Map();
    for (const p of pts) { if (!groups.has(p.g)) groups.set(p.g, []); groups.get(p.g).push(p); }
    const charted = [...groups].filter(([, l]) => l.filter(p => p.t).length >= 3).sort((a, b) => (b[0].startsWith("Los Angeles") - a[0].startsWith("Los Angeles")) || b[1].length - a[1].length);
    const rest = [...groups].filter(([g]) => !charted.some(([c]) => c === g));
    const tv = t => t.y * 12 + t.mo - 1;
    const all = pts.filter(p => p.t);
    const tMin = Math.min(...all.map(p => tv(p.t))), tMax = Math.max(...all.map(p => tv(p.t)));
    const yMax = Math.max(10, Math.ceil(Math.max(...all.map(p => +p.share_pct)) / 10) * 10);
    const card = ([g, list]) => {
      const L = list.filter(p => p.t).sort((a, b) => tv(a.t) - tv(b.t));
      const box = h("figure", { class: "share" }), host = h("div", { class: "share-plot" }), live = h("p", { class: "sr", "aria-live": "polite" });
      box.append(h("figcaption", { class: "share-cap" }, h("b", { text: g }), h("span", { text: `${L.length} readings · ${monthName(L[0].t.y, L[0].t.mo)} to ${monthName(L[L.length - 1].t.y, L[L.length - 1].t.mo)}` })), host, live);
      const tip = chartTip(box);
      sized(host, W => {
        const padL = 34, padR = 44, top = 12, ph = 96, H = top + ph + 24;
        const X = t => padL + (tMax > tMin ? (tv(t) - tMin) / (tMax - tMin) : .5) * (W - padL - padR), Y = v => top + ph - v / yMax * ph;
        const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: "share-svg", tabindex: 0, role: "group", "aria-label": `${g}: share with a concession over time. Arrow keys read each point.` });
        for (const v of [0, yMax / 2, yMax]) svg.append(s("line", { x1: padL, x2: W - padR, y1: Y(v), y2: Y(v), class: v ? "c-grid" : "c-base" }), s("text", { x: padL - 6, y: Y(v) + 4, "text-anchor": "end", class: "c-tick" }, v + "%"));
        for (let y = Math.floor(tMin / 12) + 1; y * 12 <= tMax; y++) svg.append(s("text", { x: X({ y, mo: 1 }), y: H - 6, "text-anchor": "middle", class: "c-tick" }, String(y)));
        svg.append(s("polyline", { points: L.map(p => X(p.t) + "," + Y(+p.share_pct)).join(" "), class: "c-line" }));
        const cross = s("line", { y1: top, y2: top + ph, class: "c-cross", opacity: 0 });
        svg.append(cross);
        L.forEach(p => svg.append(s("circle", { cx: X(p.t), cy: Y(+p.share_pct), r: 4, class: "c-dot" + (p.t.flag ? " derived" : "") })));
        const last = L[L.length - 1];
        svg.append(s("text", { x: X(last.t) + 8, y: Y(+last.share_pct) + 4, class: "c-val" }, Math.round(+last.share_pct * 10) / 10 + "%"));
        let sel = -1;
        const show = i => {
          sel = i;
          if (i < 0) { cross.setAttribute("opacity", 0); tip.hide(); return; }
          const p = L[i], cx = X(p.t);
          cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("opacity", 1);
          tip.show(cx, Y(+p.share_pct) + 26, h("p", { class: "ctip-v" }, h("b", { text: p.share_pct + "%" }), " with a concession"),
            h("p", { class: "ctip-k", text: monthName(p.t.y, p.t.mo) + (p.t.flag ? " · " + p.t.flag : "") }),
            h("p", { class: "ctip-note", text: p.geo + (hostOf(p.source) ? " · " + hostOf(p.source) : "") }));
          live.textContent = `${monthName(p.t.y, p.t.mo)}: ${p.share_pct}%${p.t.flag ? " (" + p.t.flag + ")" : ""}.`;
        };
        svg.addEventListener("pointermove", e => {
          const r = svg.getBoundingClientRect(), mx = e.clientX - r.left;
          let best = 0; L.forEach((p, i) => { if (Math.abs(X(p.t) - mx) < Math.abs(X(L[best].t) - mx)) best = i; });
          show(best);
        });
        svg.addEventListener("pointerleave", () => show(-1));
        svg.addEventListener("focus", () => show(sel < 0 ? L.length - 1 : sel));
        svg.addEventListener("blur", () => show(-1));
        svg.addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); show(Math.max(0, Math.min(L.length - 1, (sel < 0 ? L.length - 1 : sel) + (e.key === "ArrowRight" ? 1 : -1)))); } });
        host.replaceChildren(svg);
      });
      return box;
    };
    const anyDerived = all.some(p => p.t.flag);
    return h("div", { class: "shares" },
      charted.length ? h("div", { class: "share-grid" }, ...charted.map(card)) : null,
      anyDerived && charted.length ? h("p", { class: "hint share-key" }, h("i", { class: "share-hollow", "aria-hidden": "true" }), "Hollow points are derived or have an inferred date. Zillow counts listings; RealPage counts stabilized units, so their levels differ.") : null,
      rest.length ? h("ul", { class: "share-rest" }, ...rest.map(([g, l]) => h("li", null, h("b", { text: g + ": " }), l.map(p => `${p.share_pct}% (${p.period})`).join(", "), " ", srcLinks([...new Set(l.map(p => p.source).filter(Boolean))])))) : null,
      h("details", { class: "srcs ctable" }, h("summary", null, h("span", { text: `All ${pts.length} readings as a table` })),
        h("div", { class: "tablewrap" }, h("table", { class: "mini-table" },
          h("thead", null, h("tr", null, ...["Period", "Geography and source", "Share", "Source"].map(t => h("th", { scope: "col", text: t })))),
          h("tbody", null, ...pts.slice().sort((a, b) => (a.t ? tv(a.t) : 0) - (b.t ? tv(b.t) : 0)).map(p => h("tr", null, h("td", { text: p.period }), h("td", { text: p.geo || "—" }), h("td", { class: "num", text: p.share_pct + "%" }), h("td", null, srcLinks(p.source) || unk()))))))));
  }

  /* Research text sometimes names a data field; say it plainly. Long summaries open with two sentences. */
  const tidyResearch = t => String(t).replace(/,? so rent_vs_avg_pct is null for every month rather than estimated\./, ", so no monthly rent change is shown rather than an estimate.");
  function lede(t) {
    t = tidyResearch(t);
    const parts = t.split(/(?<=[.!?])\s+(?=[A-Z("'(])/);
    if (t.length < 420 || parts.length < 4) return h("p", { class: "rsec-lede", text: t });
    return h("div", { class: "rsec-lede" }, h("p", { text: parts.slice(0, 2).join(" ") }),
      h("details", { class: "srcs more" }, h("summary", null, h("span", { text: "Read the full summary" })), h("p", { text: parts.slice(2).join(" ") })));
  }
  function rsec(id, k, title, ledeText, ...body) {
    return h("section", { class: "rsec", id: "tr-" + id, "aria-labelledby": "trh-" + id },
      h("header", { class: "rsec-head" }, h("span", { class: "rsec-k", text: k }), h("h3", { class: "rsec-title", id: "trh-" + id, text: title }), ledeText ? lede(ledeText) : null),
      ...body);
  }
  const sub = (t, ...body) => { const kids = body.filter(Boolean); return kids.length ? h("div", { class: "rsub" }, h("h4", { class: "rsub-title", text: t }), ...kids) : null; };
  const nonEmpty = a => Array.isArray(a) && a.length ? a.filter(Boolean) : null;

  function timingResearch() {
    if (S.market !== "la") return h("section", { class: "tresearch tresearch-note", "aria-label": "Rent timing research" },
      h("p", { text: "Timing research covers Los Angeles, Long Beach and Orange County." }));
    const T = (MARKETS.la && MARKETS.la.timing) || null;
    if (!T) return h("section", { class: "tresearch tresearch-note", "aria-label": "Rent timing research" }, h("p", { text: "Rent timing research for Los Angeles, Long Beach and Orange County has not been gathered yet." }));
    const sea = T.seasonality || {};
    const hasSea = nonEmpty(sea.months);
    const effects = nonEmpty(T.timing_effects), now = nonEmpty(T.market_now), fc = nonEmpty(T.forecast), hist = nonEmpty(T.history), share = nonEmpty(T.concession_share_history);
    const areas = nonEmpty(T.areas), ups = nonEmpty(T.lease_ups), ops = nonEmpty(T.operators), tactics = nonEmpty(T.tactics), pits = nonEmpty(T.pitfalls), rules = nonEmpty(T.rules), anec = nonEmpty(T.anecdotes);
    const lvlRank = l => (LEVEL[l] || [0])[0];
    const specials = S.buildings.filter(b => ["often", "sometimes"].includes(patternOf(b))).sort((a, b) => (patternOf(a) === "often" ? 0 : 1) - (patternOf(b) === "often" ? 0 : 1) || a.name.localeCompare(b.name));
    const nav = [["when", "When"], ["where", "Where"], ["who", "Who"], ["how", "How"]];
    return h("section", { class: "tresearch", "aria-labelledby": "trTitle" },
      h("header", { class: "tresearch-head" },
        h("p", { class: "eyebrow", text: "Los Angeles · Long Beach · Orange County" }),
        h("h2", { class: "viewhead-title", id: "trTitle", text: "Rent timing and concessions" }),
        h("p", { class: "viewhead-sub", text: "When rents dip, where landlords discount, who sets the price and how to ask." + (T.updated ? ` Research as of ${T.updated}.` : "") }),
        h("nav", { class: "tr-nav", "aria-label": "Research sections" }, ...nav.map(([id, t], i) => h("a", { href: "#tr-" + id, class: "tr-navlink", onclick: e => { e.preventDefault(); const el = document.getElementById("tr-" + id); if (el) el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" }); } },
          h("span", { class: "mono-label", text: ROMAN[i] }), t)))),
      rsec("when", "I", "When", sea.summary || null,
        hasSea ? seasonChart(sea) : h("p", { class: "muted", text: "No month-by-month research found." }),
        sea.best_window || sea.evidence ? h("div", { class: "callpair" },
          sea.best_window ? h("div", { class: "callout good" }, h("p", { class: "mono-label", text: "Best window" }), h("p", { text: sea.best_window })) : null,
          sea.evidence ? h("div", { class: "callout plain" }, h("p", { class: "mono-label", text: "How strong the evidence is" }), h("p", { text: sea.evidence })) : null) : null,
        srcLinks(sea.sources),
        sub("Timing effects", effects && h("div", { class: "rgrid" }, ...effects.map(x => h("article", { class: "rcard" },
          h("header", { class: "rcard-head" }, h("h5", { class: "rcard-title", text: x.title || "—" }), strengthTag(x.strength)),
          x.finding ? h("p", { text: x.finding }) : unk(), srcLinks(x.sources))))),
        sub("The market now", now && h("div", { class: "nowgrid" }, ...now.map(x => h("article", { class: "nowcard" },
          h("p", { class: "mono-label", text: [x.geo, x.as_of ? "as of " + x.as_of : null].filter(Boolean).join(" · ") || "—" }),
          h("p", { class: "nowcard-m", text: x.metric || "—" }),
          h("p", { class: "nowcard-v", text: x.value == null ? "—" : String(x.value) }),
          srcLinks(x.source))))),
        sub("Forecast", fc && h("ul", { class: "rlist" }, ...fc.map(x => h("li", null,
          h("p", { class: "rlist-k mono-label", text: [x.geo, x.as_of ? "as of " + x.as_of : null].filter(Boolean).join(" · ") || "—" }), h("p", { text: x.finding || "—" }), srcLinks(x.source))))),
        sub("History", hist && h("ol", { class: "hist" }, ...hist.map(x => h("li", null,
          h("span", { class: "hist-p", text: x.period || "—" }),
          h("div", null, h("p", { class: "hist-e" }, h("b", { text: x.event || "—" }), x.geo ? h("span", { class: "muted", text: " · " + x.geo }) : null),
            x.effect ? h("p", { class: "hist-x", text: x.effect }) : null, srcLinks(x.sources)))))),
        sub("Share of rentals offering a concession", share && shareCharts(share))),
      rsec("where", "II", "Where", T.area_summary || null,
        areas && h("ol", { class: "areas-rank" }, ...areas.slice().sort((a, b) => lvlRank(b.level) - lvlRank(a.level)).map(x => {
          const a = x.area_id ? S.areaById.get(x.area_id) : null;
          return h("li", { class: "arow" },
            levelPips(x.level),
            h("div", { class: "arow-main" },
              a ? h("button", { type: "button", class: "arow-name linkish", onclick: () => openArea(a), text: x.name || a.name }) : h("p", { class: "arow-name", text: x.name || "—" }),
              h("p", { class: "mono-label", text: [x.region, x.as_of ? "as of " + x.as_of : null].filter(Boolean).join(" · ") })),
            h("dl", { class: "arow-kv" },
              h("dt", { text: "Typical offer" }), h("dd", null, vOr(x.typical_offer)),
              h("dt", { text: "Driver" }), h("dd", null, vOr(x.driver))),
            x.vacancy || x.pipeline || x.evidence || nonEmpty(x.sources) ? h("details", { class: "srcs arow-more" }, h("summary", null, h("span", { text: "Vacancy, pipeline and sources" })),
              h("dl", { class: "pkv" }, h("dt", { text: "Vacancy" }), h("dd", null, vOr(x.vacancy)), h("dt", { text: "Pipeline" }), h("dd", null, vOr(x.pipeline)), h("dt", { text: "Evidence" }), h("dd", null, vOr(x.evidence))),
              srcLinks(x.sources)) : null);
        })),
        sub("New buildings in lease-up", ups && h("div", { class: "rgrid" }, ...ups.map(x => h("article", { class: "rcard" },
          h("header", { class: "rcard-head" }, h("h5", { class: "rcard-title", text: x.name || "—" }), x.units ? h("span", { class: "mono-label", text: x.units + " units" }) : null),
          h("dl", { class: "pkv" },
            h("dt", { text: "Area" }), h("dd", null, vOr([x.area, x.region].filter(Boolean).join(" · ") || null)),
            h("dt", { text: "Opening" }), h("dd", null, vOr(x.opening)),
            h("dt", { text: "Special seen" }), h("dd", null, vOr(x.special_seen)),
            h("dt", { text: "Studio / 1BR rent" }), h("dd", null, vOr(x.studio_1br_rent)),
            h("dt", { text: "Operator" }), h("dd", null, vOr(x.operator))),
          srcLinks(x.sources)))))),
      rsec("who", "III", "Who", "Who sets the price, and how much room a leasing office has.",
        sub("Operators", ops && h("div", { class: "rgrid" }, ...ops.map(x => h("article", { class: "rcard" },
          h("header", { class: "rcard-head" }, h("h5", { class: "rcard-title", text: x.name || "—" }),
            h("span", { class: "tag " + ({ yes: "ok", somewhat: "amber", no: "bad" }[x.negotiable] || ""), text: "Negotiable: " + ({ yes: "yes", somewhat: "somewhat", no: "no" }[x.negotiable] || "—") })),
          h("dl", { class: "pkv" }, h("dt", { text: "Pricing" }), h("dd", null, vOr(x.pricing)), h("dt", { text: "Concessions" }), h("dd", null, vOr(x.concession_style))),
          x.note ? h("p", { class: "rcard-note", text: x.note }) : null, srcLinks(x.sources)))))),
        sub(`Your listings with a specials history (${specials.length})`, specials.length ? h("ul", { class: "spec-list" }, ...specials.map(b => {
          const c = b.concessions || {}, last = (c.seen || []).filter(x => x && x.offer).slice(-1)[0];
          return h("li", null, h("button", { type: "button", class: "spec-btn", "data-listing-link": b.id, onclick: () => openBuilding(b) },
            h("span", { class: "tag " + (patternOf(b) === "often" ? "spec" : ""), text: PATTERN_WORD[patternOf(b)] }),
            h("span", { class: "spec-name", text: b.name }),
            h("span", { class: "spec-sub", text: [areaName(b), last ? "Last seen: " + last.offer : null].filter(Boolean).join(" · ") }),
            h("span", { class: "minilist-arrow", "aria-hidden": "true", text: "→" })));
        })) : h("p", { class: "muted", text: "None of the current listings has a specials history of often or sometimes." }))),
      rsec("how", "IV", "How", "What to ask for, what to watch for, and the California rules that apply.",
        sub("Tactics", tactics && h("div", { class: "rgrid" }, ...tactics.map(x => h("article", { class: "rcard" },
          h("header", { class: "rcard-head" }, h("h5", { class: "rcard-title", text: x.title || "—" }), strengthTag(x.strength)),
          h("dl", { class: "pkv" }, h("dt", { text: "How" }), h("dd", null, vOr(x.how)), h("dt", { text: "Why" }), h("dd", null, vOr(x.why))),
          srcLinks(x.sources))))),
        sub("Pitfalls", pits && h("div", { class: "rgrid" }, ...pits.map(x => h("article", { class: "rcard warn" },
          h("h5", { class: "rcard-title", text: x.title || "—" }), x.detail ? h("p", { text: x.detail }) : unk(), srcLinks(x.sources))))),
        sub("California rules", rules && h("div", { class: "rgrid" }, ...rules.map(x => h("article", { class: "rcard rule" },
          h("h5", { class: "rcard-title", text: x.name || "—" }),
          h("dl", { class: "pkv" }, h("dt", { text: "Applies to" }), h("dd", null, vOr(x.applies)), h("dt", { text: "Effective" }), h("dd", null, vOr(x.effective))),
          x.detail ? h("p", { text: x.detail }) : null, srcLinks(x.sources))))),
        sub("Anecdotes", anec && h("ul", { class: "rlist anec" }, ...anec.map(x => h("li", null, h("span", { class: "strength anec", text: "Anecdotal" }), h("p", { text: x.summary || "—" }), srcLinks(x.source)))))));
  }

  /* ==========================================================================
     Render loop
     ========================================================================== */
  /* Keyed FLIP: First rects → update → Last rects → Invert + Play.
     - Grids (cards, rows, plates) reorder with the CSS `order` property, so a sort
       or filter never re-inserts heavy SVG subtrees; the DOM (reading/tab order)
       is brought in line during idle time, in small chunks.
     - Newly inserted elements that land off screen render lazily
       (content-visibility) and are finished during idle time too, so a capture
       taken at rest is always complete.
     - Only elements on screen (before or after) animate. Leaving elements fade
       out in place as absolutely positioned ghosts. */
  const keyOf = el => el.dataset ? (el.dataset.listing || el.dataset.key || null) : null;
  function unghost(el) {
    el.classList.remove("is-leaving");
    for (const p of ["position", "left", "top", "width", "height", "margin", "pointerEvents", "zIndex"]) el.style[p] = "";
  }
  const idle = window.requestIdleCallback ? (fn, t) => requestIdleCallback(fn, { timeout: t }) : (fn) => setTimeout(() => fn({ timeRemaining: () => 8, didTimeout: true }), 60);
  const cancelIdle = window.cancelIdleCallback || clearTimeout;
  function morph(box, els, o = {}) {
    const animate = !reduceMotion() && !document.hidden;
    const useOrder = o.order !== false;
    const kids = [...box.children].filter(el => keyOf(el) != null);
    const first = new Map();
    if (animate) for (const el of kids) first.set(keyOf(el), { el, r: el.getBoundingClientRect() });
    for (const el of kids) { if (el._flip) { el._flip.cancel(); el._flip = null; } if (el.classList.contains("is-leaving")) unghost(el); }
    const active = document.activeElement, hadFocus = active && active !== document.body && box.contains(active);
    const keep = new Set(els), have = new Set();
    for (const el of kids) { if (!keep.has(el)) el.remove(); else have.add(el); }
    const base = o.after ? 1 : 0;
    if (useOrder) {
      if (o.after) o.after.style.order = "0";
      els.forEach((el, i) => {
        el.style.order = String(i + base);
        if (!have.has(el)) { if (o.lazy !== false) el.classList.add("cv-lazy"); box.append(el); }
      });
    } else {
      let ref = o.after ? o.after.nextSibling : box.firstChild;
      for (const el of els) { if (el !== ref) box.insertBefore(el, ref); else ref = ref.nextSibling; }
    }
    if (hadFocus && active.isConnected && document.activeElement !== active) active.focus({ preventScroll: true });
    if (useOrder) {
      // anything that landed on screen renders now; the rest waits for idle time
      const lazy = els.filter(el => el.classList.contains("cv-lazy"));
      if (lazy.length) { const rs = lazy.map(el => el.getBoundingClientRect()); lazy.forEach((el, i) => { if (onScreen(rs[i], 120)) el.classList.remove("cv-lazy"); }); }
      settleLater(box, els, o.after);
    }
    if (!animate) return;
    const last = els.map(el => el.getBoundingClientRect());
    const boxR = box.getBoundingClientRect();
    let entering = 0;
    const maxEnter = o.maxEnter ?? 10;
    els.forEach((el, i) => {
      const k = keyOf(el), f = first.get(k), l = last[i];
      if (f) {
        first.delete(k);
        if (o.onSettle) o.onSettle(el, onScreen(l));
        const was = onScreen(f.r, 0), is = onScreen(l, 0);
        if (!is) return;                                  // moved off screen: nothing to show
        const dx = f.r.left - l.left, dy = f.r.top - l.top;
        if (Math.abs(dx) < .5 && Math.abs(dy) < .5) return;
        // only glide when the trip is visible end to end; arrivals from far away pop in place
        if (was && Math.abs(dy) < innerHeight * 1.1) { el._flip = anim(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 460, easing: EASE.quint }); return; }
        const d = Math.min(entering++, maxEnter) * 18;
        el._flip = anim(el, [{ opacity: 0, transform: "scale(.965)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: 40 + d, easing: EASE.quint, fill: "backwards" });
      } else if (onScreen(l, 0)) {
        const d = Math.min(entering, maxEnter) * (o.enter === "stagger" ? 28 : 18);
        entering++;
        if (o.enter === "stagger") el._flip = anim(el, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: d, easing: EASE.quint, fill: "backwards" });
        else if (o.enter === "pop") el._flip = anim(el, [{ opacity: 0, transform: "scale(.965)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: 60 + d, easing: EASE.quint, fill: "backwards" });
        if (o.onEnter) o.onEnter(el, d);
      }
    });
    if (o.ghosts === false) return;
    for (const { el, r } of first.values()) {
      if (!onScreen(r)) continue;
      el.classList.add("is-leaving");
      Object.assign(el.style, { position: "absolute", left: (r.left - boxR.left) + "px", top: (r.top - boxR.top) + "px", width: r.width + "px", height: r.height + "px", margin: "0", pointerEvents: "none", zIndex: "0" });
      box.append(el);
      const a = anim(el, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.94)" }], { duration: 220, easing: EASE.in, fill: "forwards" });
      el._flip = a;
      const done = () => { if (el._flip === a) { el._flip = null; el.remove(); unghost(el); if (a) a.cancel(); } };
      if (a) a.onfinish = done; else done();
    }
  }
  /* Idle work after a morph: match DOM order to visual order (for keyboard and
     screen readers), then finish rendering lazily inserted elements. Cheap moves:
     off-screen elements are parked in content-visibility while they move. */
  function settleLater(box, els, head) {
    if (box._idle) cancelIdle(box._idle);
    clearTimeout(box._idleT);
    const queue = els.slice();
    let phase = 0, i = 0, ref = null;
    const step = dl => {
      box._idle = 0;
      if (!box.isConnected) return;
      const budget = () => dl.didTimeout ? i % 12 !== 11 : dl.timeRemaining() > 3;
      if (phase === 0) {                                // park off-screen elements
        const rs = queue.map(el => el.getBoundingClientRect());
        queue.forEach((el, k) => { if (!onScreen(rs[k], 200) && !el.classList.contains("is-leaving")) el.classList.add("cv-lazy"); });
        phase = 1; ref = head ? head.nextSibling : box.firstChild; i = 0;
      }
      if (phase === 1) {                                // DOM order = visual order
        const active = document.activeElement;
        while (i < queue.length && budget()) {
          const el = queue[i++];
          if (el.parentNode !== box) continue;
          while (ref && ref.classList && ref.classList.contains("is-leaving")) ref = ref.nextSibling;
          if (el !== ref) box.insertBefore(el, ref); else ref = ref.nextSibling;
        }
        if (active && box.contains(active) && document.activeElement !== active) active.focus({ preventScroll: true });
        if (i >= queue.length) { phase = 2; i = 0; }
      }
      if (phase === 2) {                                // render what was parked
        while (i < queue.length && budget()) queue[i++].classList.remove("cv-lazy");
        if (i >= queue.length) return;
      }
      box._idle = idle(step, 300);
    };
    // let the motion finish first
    box._idleT = setTimeout(() => { box._idle = idle(step, 300); }, 560);
  }
  const fadeIn = el => el && anim(el, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 280, easing: EASE.quint });

  /* #count: the visible number is a CSS counter that transitions (section 05);
     the real number stays in the text for the live region and for scripts. */
  let countEls = null;
  function renderCount(list) {
    const c = $("count");
    if (!S.loaded) { countEls = null; c.textContent = "Loading…"; return; }
    const meet = list.filter(b => verdict(b) === "all").length;
    if (!countEls) {
      const n = h("b", { class: "count-n" }, h("span", { class: "count-real" }));
      countEls = { n, real: n.firstChild, of: h("span", { class: "count-of" }), q: h("span", { class: "count-q" }), meet: h("span", { class: "count-meet" }) };
      c.replaceChildren(h("span", { class: "count-inner" }, n, countEls.of, countEls.q, countEls.meet));
      n.style.setProperty("--n", reduceMotion() ? list.length : 0);
      void n.offsetWidth;
    }
    countEls.real.textContent = list.length;
    countEls.n.style.setProperty("--n", list.length);
    countEls.of.textContent = S.buildings.length ? ` of ${S.buildings.length} listings` : ` listings in ${marketInfo().name} yet`;
    countEls.q.textContent = S.q ? ` matching “${S.q}”` : "";
    countEls.meet.textContent = S.buildings.length ? ` · ${meet} meet everything` : "";
  }

  /* ==========================================================================
     Render loop
     ========================================================================== */
  let booted = false;
  function renderResults(opts = {}) {
    const list = visible();
    S.rank = new Map(list.map((b, i) => [b.id, i + 1]));
    renderCount(list);
    renderStats(list);
    renderNote(list);
    if (opts.summaryOnly) return;
    const root = $("view");
    const switching = root.dataset.view !== S.view || root.dataset.mkt !== S.market || !!opts.fade;
    if (switching && booted) {
      // keep the toolbar in place: if it is stuck, start the new view at its top
      const main = $("results"), top = main.getBoundingClientRect().top + scrollY - 6;
      if (scrollY > top) scrollTo({ top, behavior: "instant" });
      if (opts.fade) root.replaceChildren();
    }
    root.dataset.view = S.view;
    root.dataset.mkt = S.market;
    const ctx = { switching, initial: !booted };
    if (S.loaded && !S.buildings.length && (S.view === "list" || S.view === "table")) {
      if (switching || !root.querySelector(":scope > .unsurveyed")) root.replaceChildren(marketEmpty("list"));
    } else ({ list: renderList, table: renderTable, map: renderMap, areas: renderAreas, compare: renderCompare, timeline: renderTimeline, add: renderAdd }[S.view] || renderList)(root, list, ctx);
    if (switching && booted) {
      const dx = opts.dir ? opts.dir * 18 : 0;
      if (root._sw) root._sw.cancel();
      root._sw = anim(root, [{ opacity: 0, transform: `translate(${dx}px, ${dx ? 0 : 8}px)` }, { opacity: 1, transform: "none" }], { duration: 300, easing: EASE.quint });
    }
    booted = true;
  }

  /* ==========================================================================
     Drawer (dossier)
     ========================================================================== */
  let drawerState = null;
  function drawer(title, ...content) {
    const root = $("drawerRoot");
    const body = h("div", { class: "drawer-body" }, ...content);
    [...body.children].forEach((el, i) => el.style.setProperty("--i", Math.min(i, 7)));
    if (drawerState) { // already open: swap contents in place, the new dossier slides in from the right
      const old = drawerState.panel.querySelector(".drawer-body"), bar = drawerState.panel.querySelector(".drawer-bar-title");
      old.replaceWith(body);
      bar.textContent = title;
      drawerState.panel.scrollTop = 0;
      if (!reduceMotion()) { body.classList.add("swap"); anim(bar, [{ opacity: 0, transform: "translateX(10px)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: EASE.quint }); }
      growBars(body);
      drawerState.panel.querySelector(".drawer-close").focus({ preventScroll: true });
      return;
    }
    if (!reduceMotion()) body.classList.add("stagger");
    growBars(body);
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
      const done = () => { if (!drawerState) { root.replaceChildren(); root.classList.remove("closing"); } };
      root.classList.add("closing");
      reduceMotion() ? done() : setTimeout(done, 300);
      if (prevFocus && prevFocus.isConnected) prevFocus.focus({ preventScroll: true });
    };
    const onKey = e => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "Tab") {
        const f = [...panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]')].filter(x => x.offsetParent !== null && !(x.tagName !== "SUMMARY" ? x.closest("details:not([open])") : x.parentElement.closest("details:not([open])")) && !x.closest("[inert]"));
        if (!f.length) return;
        if (!panel.contains(document.activeElement)) { e.preventDefault(); f[0].focus(); }
        else if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    closeBtn.addEventListener("click", close);
    scrim.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    root.classList.remove("is-open", "closing");
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
  /* Particulars dossier: every field, value or a dash. "Not confirmed" for yes/no fields research
     could not settle. */
  const feeMoney = n => n % 1 ? "$" + n.toFixed(2) : money(n);
  const PARK_LONG = { garage: "Garage", covered: "Covered", surface: "Surface lot", tandem: "Tandem", street: "Street only" };
  function pval(b, g, k, kind) {
    const v = dget(b, g, k);
    if (kind === "tri") { const t = triOf(v); return h("span", { class: "pv tri " + t }, h("i", { "aria-hidden": "true" }), t === "yes" ? "Yes" : t === "no" ? "No" : "Not confirmed"); }
    if (v == null || v === "" || (Array.isArray(v) && !v.length) || v === "unclear") return h("span", { class: "pv unk", title: "Not found" }, "—", h("span", { class: "sr", text: "not found" }));
    if (k === "required_fees") return h("span", { class: "pv" }, v.map(x => `${x.name.charAt(0).toUpperCase() + x.name.slice(1)}: ${x.amount == null ? "amount not found" : feeMoney(x.amount) + "/mo"}`).join("; "));
    if (k === "type" && g === "parking") return h("span", { class: "pv", text: PARK_LONG[v] || v });
    if (kind === "url") return h("span", { class: "pv" }, linkOut(v));
    if (kind === "tel") return h("span", { class: "pv" }, h("a", { href: "tel:" + String(v).replace(/[^\d+]/g, ""), text: v }));
    if (Array.isArray(v)) return h("span", { class: "pv", text: v.join(", ") });
    if (typeof kind === "function" && typeof v === "number") return h("span", { class: "pv", text: kind(v) });
    return h("span", { class: "pv", text: String(v) });
  }
  function particulars(b) {
    const pct = docPct(b);
    const cards = PARTICULARS.map(([g, title, fields]) => {
      const known = fields.filter(([k]) => isKnown(dget(b, g, k))).length;
      return h("section", { class: "pcard" },
        h("header", { class: "pcard-head" }, h("h4", { text: title }), h("span", { class: "pcard-n", text: `${known} of ${fields.length}` })),
        h("dl", { class: "pkv" }, ...fields.flatMap(([k, label, kind]) => [h("dt", { text: label }), h("dd", null, pval(b, g, k, kind))])));
    });
    const c = costOf(b), loc = D(b).location || {}, w = walkOf(b);
    return section("Particulars",
      h("div", { class: "pmeter" },
        h("div", { class: "pmeter-fig" }, h("b", { class: "serif", text: pct + "%" }), h("span", { class: "fig-k", text: "documented" })),
        h("div", { class: "pmeter-main" },
          h("span", { class: "pmeter-bar", "aria-hidden": "true" }, h("i", { style: { "--w": pct + "%" } })),
          h("p", { class: "hint", text: `Research found ${Math.round(docShare(b) * DOC_TOTAL)} of ${DOC_TOTAL} particulars. A dash means not found; ask the leasing office.` }))),
      h("div", { class: "costbox" },
        h("p", { class: "fig-k", text: "True monthly cost" }),
        h("div", { class: "costbox-sum" },
          h("span", null, h("small", { text: "Rent after specials" }), h("b", { text: money(c.rent) })), h("i", { "aria-hidden": "true", text: "+" }),
          h("span", { class: c.park == null ? "unk" : "" }, h("small", { text: "Parking" }), h("b", { text: c.park == null ? "?" : c.park === 0 ? "$0" : money(c.park) })), h("i", { "aria-hidden": "true", text: "+" }),
          h("span", { class: c.fees == null ? "unk" : "" }, h("small", { text: "Required fees" }), h("b", { text: c.fees == null ? "?" : feeMoney(c.fees) })), h("i", { "aria-hidden": "true", text: "=" }),
          h("span", { class: "total" }, h("small", { text: c.missing.length ? "At least" : "Total" }), h("b", { class: "serif", text: c.total == null ? "—" : money(c.total) }))),
        c.missing.length ? h("p", { class: "hint", text: `Not found: ${c.missing.join(", ")}. The total counts them as $0, so the real cost may be higher.` }) : null),
      h("div", { class: "pgrid" }, ...cards),
      kv([["Freeway distance", b.freeway_band ? b.freeway_band + " (rough estimate)" : "—"],
        ["Walk Score used", w.v == null ? "—" : `${w.v} (${w.src === "area" ? "neighborhood" : "this address"})`],
        ["Internet note", b.internet && b.internet !== "unverified" ? b.internet : null]]),
      D(b).evidence ? h("div", { class: "evidence" }, h("p", { class: "mono-label", text: "Research caveats" }), h("p", { text: D(b).evidence })) : null,
      sources(b.detail_sources, "Particulars sources"));
  }
  /* Specials history from the concessions research. Shown for markets the research covers. */
  function specialsSection(b) {
    const c = b.concessions;
    if (!c) return S.hasConc ? section("Specials history", h("p", { class: "muted", text: "The concessions research did not cover this building. Ask the leasing office what specials it has run." })) : null;
    const p = patternOf(b), seen = (c.seen || []).filter(Boolean);
    const t = v => v ? h("span", { text: v }) : h("span", { class: "pv unk" }, "—", h("span", { class: "sr", text: "not found" }));
    return section("Specials history",
      h("div", { class: "spec-head" },
        h("span", { class: "spec-pattern " + p }, h("span", { class: "fig-k", text: "Runs specials" }), h("b", { class: "serif", text: p === "unknown" ? "Not known" : PATTERN_WORD[p] })),
        c.evidence ? h("p", { class: "spec-ev", text: c.evidence }) : null),
      seen.length ? h("ol", { class: "spec-seen", "aria-label": "Offers seen" }, ...seen.map(x => h("li", null,
        h("span", { class: "spec-when", text: x.when || "Date not found" }), h("span", { class: "spec-offer", text: x.offer || "—" }), srcLinks(x.source)))) : h("p", { class: "muted small", text: "No dated offers found." }),
      h("dl", { class: "pkv" }, h("dt", { text: "At renewal" }), h("dd", null, t(c.renewal_note)), h("dt", { text: "Negotiating" }), h("dd", null, t(c.negotiation_note))),
      srcLinks(c.sources));
  }
  function openBuilding(b) {
    const a = S.areaById.get(b.area_id), v = verdict(b), c = allIn(b), d = savingsOf(b), sc = score(b), rank = S.rank.get(b.id), p = ppsf(b);
    const statusGroup = h("div", { class: "statuses", role: "radiogroup", "aria-label": "Status" }, ...STATUSES.map(st =>
      h("label", { class: "status-opt" },
        h("input", { type: "radio", name: "d-status", value: st.key, checked: (b.my_status || "new") === st.key, disabled: !S.canWrite,
          onchange: e => { b = { ...b, my_status: e.target.value }; saveBuilding(b).then(ok => ok && toast("Saved")); } }),
        h("span", { text: st.name }))));
    const note = h("textarea", { id: "d-note", rows: 4, disabled: !S.canWrite, placeholder: "Tour impressions, questions for the leasing office…" }, b.my_note || "");
    let t; note.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { b = { ...b, my_note: note.value }; saveBuilding(b).then(ok => ok && toast("Note saved")); }, 900); });
    const cmpBtn = h("button", { class: "btn ghost sm", type: "button", disabled: !S.compare.has(b.id) && compareCount() >= 4,
      text: S.compare.has(b.id) ? "Remove from compare" : "Add to compare",
      onclick: e => { S.compare.has(b.id) ? S.compare.delete(b.id) : S.compare.add(b.id); ls.set("compare", [...S.compare]); e.currentTarget.textContent = S.compare.has(b.id) ? "Remove from compare" : "Add to compare"; renderToolbar(); renderResults(); } });
    drawer(rank ? `Specimen No. ${pad2(rank)} of ${S.rank.size}` : "Specimen",
      h("div", { class: "dossier-head" + (v === "all" && ill("seal", "Meets everything") ? " has-seal" : "") },
        h("div", { class: "dossier-kicker" }, regionEmblem(regionOf(b), "sm"), h("span", { text: [a && a.name, a ? regionOf(b) : b.region].filter(Boolean).join(" · ") || "Neighborhood not set" })),
        h("h2", { class: "dossier-name", id: "drawerTitle", text: b.name }),
        b.address ? h("p", { class: "dossier-addr", text: b.address }) : null,
        h("div", { class: "dossier-verdict" },
          h("span", { class: "tag " + (v === "all" ? "ok" : v === "fail" ? "bad" : "amber"), text: verdictLabel(b) }),
          ...flagTags(b, false),
          v === "fail" ? h("span", { class: "muted small", text: failReasons(b).join(" · ") }) : null),
        v === "all" ? seal() : null),
      h("div", { class: "hero-figs five" },
        h("div", { class: "hero-fig" }, h("span", { class: "fig-k", text: "Rent" }), h("b", { class: "serif", text: money(rentOf(b)) }), h("span", { class: "hero-sub", text: b.base_rent && rentOf(b) < b.base_rent ? money(b.base_rent) + " list" : "per month" })),
        (() => { const cc = costOf(b); return h("div", { class: "hero-fig" }, h("span", { class: "fig-k", text: "True monthly" }), h("b", { class: "serif" }, costValue(b)), h("span", { class: "hero-sub", text: cc.missing.length ? costNote(cc) : "rent, parking, fees" })); })(),
        h("div", { class: "hero-fig" }, h("span", { class: "fig-k", text: "Size" }), h("b", { class: "serif", text: b.sqft ? Math.round(b.sqft) : "—" }), h("span", { class: "hero-sub", text: p ? "sq ft · $" + p.toFixed(2) + "/ft²" : "sq ft" })),
        h("div", { class: "hero-fig" }, h("span", { class: "fig-k", text: "Match" }), h("b", { class: "serif" }, fm(sc)), h("span", { class: "hero-sub" }, jar(sc, "xs"), "of 100, vs. all listings")),
        h("div", { class: "hero-fig " + (d == null ? "" : d >= 0 ? "pos" : "neg") }, h("span", { class: "fig-k", text: d == null || d >= 0 ? "Saves vs. Jayne" : "Costs vs. Jayne" }), h("b", { class: "serif", text: d == null ? "—" : money(Math.abs(d)) }), h("span", { class: "hero-sub", text: d == null ? "rent unknown" : `${costOf(b).missing.length ? (d >= 0 ? "at most, " : "at least, ") : ""}a month · ${money(Math.abs(d) * 12)} a year` }))),
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
      particulars(b),
      section("Listing",
        kv([
          ["List rent", b.base_rent ? money(b.base_rent) : null], ["Special", b.special || "None listed"],
          ["Landlord", b.landlord === "private" ? [b.owner_type || "Private owner", b.platform && "on " + b.platform].filter(Boolean).join(", ") : (b.reviews && b.reviews.management_company) || "Management company"],
          ["Rent control", b.rent_control], ["Complex", b.hoa_amenities],
          ["Location", b.location_note], ["Watch out for", b.red_flags], ["Last checked", b.checked_on],
        ]),
        b.notes ? h("p", { class: "research-note", text: b.notes }) : null),
      specialsSection(b),
      reviewSection(b),
      a ? section("Neighborhood",
        areaFacts(a, b),
        h("div", { class: "nb-head" }, h("p", null, h("b", { class: "serif nb-name", text: a.name }), h("span", { class: "muted small", text: " · score " + f1(areaScore(a)) + " / 10" }))),
        factorBars(a, "in-drawer"),
        h("button", { class: "linkbtn", type: "button", text: "Open the full neighborhood report →", onclick: () => openArea(a) })) : null,
      sources(b.sources));
  }
  /* Neighborhood extras. Rent is compared with this market's listings (in this area and overall). */
  function rentCompare(a) {
    const x = extrasOf(a), typ = x.median_1br_rent;
    const here = median(S.buildings.filter(b => b.area_id === a.id).map(rentOf)), all = median(S.buildings.map(rentOf));
    const vs = (m, what) => m == null || typ == null ? null : `${what} ${money(m)}, ${money(Math.abs(typ - m))} ${typ >= m ? "below" : "above"} typical`;
    return [vs(here, "Listings here: median"), vs(all, `All ${marketInfo().name} listings: median`)].filter(Boolean).join(". ") || null;
  }
  function areaFacts(a) {
    const x = extrasOf(a);
    return h("div", { class: "afacts" },
      h("span", null, h("small", { class: "fig-k", text: "Typical 1BR" }), h("b", { text: x.median_1br_rent == null ? "—" : money(x.median_1br_rent) })),
      h("span", null, h("small", { class: "fig-k", text: "Summer high" }), h("b", { text: x.summer_high_f == null ? "—" : Math.round(x.summer_high_f) + "°F" })),
      h("span", null, h("small", { class: "fig-k", text: "Marine layer" }), h("b", { class: "afacts-txt", text: x.marine_layer ? x.marine_layer.split(":")[0] : "—" })));
  }
  const listOrDash = xs => xs && xs.length ? ul(xs) : h("span", { class: "pv unk" }, "—", h("span", { class: "sr", text: "none found" }));
  function areaExtras(a) {
    const x = extrasOf(a);
    const t = v => v == null || v === "" ? h("span", { class: "pv unk" }, "—", h("span", { class: "sr", text: "not found" })) : h("span", { text: v });
    const srcNotes = [["Rent", x.rent_source], ["Summer high", x.summer_source]].filter(([, v]) => v);
    return section("Local conditions",
      h("div", { class: "pkv-wide" },
        h("dl", { class: "pkv" },
          h("dt", { text: "Typical 1BR rent" }), h("dd", null, t(x.median_1br_rent == null ? null : money(x.median_1br_rent) + (x.rent_trend ? " · " + x.rent_trend : ""))),
          h("dt", { text: "vs. these listings" }), h("dd", null, t(rentCompare(a))),
          h("dt", { text: "Summer high" }), h("dd", null, t(x.summer_high_f == null ? null : Math.round(x.summer_high_f) + "°F average August high")),
          h("dt", { text: "Marine layer" }), h("dd", null, t(x.marine_layer)),
          h("dt", { text: "Fire hazard" }), h("dd", null, t(x.fire_hazard)),
          h("dt", { text: "Flood zone" }), h("dd", null, t(x.flood_zone)),
          h("dt", { text: "Airport noise" }), h("dd", null, t(x.airport_noise)),
          h("dt", { text: "Parks" }), h("dd", null, listOrDash(x.parks)),
          h("dt", { text: "Farmers markets" }), h("dd", null, listOrDash(x.farmers_markets)),
          h("dt", { text: "Fiber internet" }), h("dd", null, t(x.fiber)))),
      srcNotes.length ? h("details", { class: "srcs" }, h("summary", null, h("span", { text: `Source notes (${srcNotes.length})` })),
        h("ol", null, ...srcNotes.map(([k, v]) => h("li", null, h("b", { text: k + ": " }), v)))) : null);
  }
  function areaConcessions(a) {
    const c = a.concessions;
    if (!c) return S.market === "la" && MARKETS.la && MARKETS.la.timing ? section("Concessions", h("p", { class: "muted", text: "The rent timing research did not rate this neighborhood." })) : null;
    const t = v => v && v !== "unknown" ? h("span", { text: v }) : h("span", { class: "pv unk" }, "—", h("span", { class: "sr", text: "not found" }));
    return section("Concessions",
      h("div", { class: "aconc-head" }, levelPips(c.level), h("span", { class: "muted small", text: c.as_of ? "As of " + c.as_of : "" })),
      h("dl", { class: "pkv" },
        h("dt", { text: "Typical offer" }), h("dd", null, t(c.typical_offer)),
        h("dt", { text: "Driver" }), h("dd", null, t(c.driver)),
        h("dt", { text: "Vacancy" }), h("dd", null, t(c.vacancy)),
        h("dt", { text: "Pipeline" }), h("dd", null, t(c.pipeline)),
        h("dt", { text: "Evidence" }), h("dd", null, t(c.evidence))),
      srcLinks(c.sources));
  }
  const AREA_ICON = { Freeways: "drive", Traffic: "drive", "Specialty coffee": "coffee", Walkability: "coffee", Quiet: "quiet", Safety: "safety", LAX: "lax", Nightlife: "extras", Gyms: "extras", Errands: "extras", Rail: "drive" };
  function openArea(a) {
    const bs = S.buildings.filter(b => b.area_id === a.id);
    const blocks = [
      [marketInfo().roadsShort, a.freeway, x => ul(x.nearest), "drive"], ["Traffic", a.traffic], ["Specialty coffee", a.coffee, x => ul(x.cafes)],
      ["Walkability", a.walk, x => x.walk_score != null ? h("p", { text: "Walk Score " + x.walk_score }) : null], ["Quiet", a.quiet],
      ["Safety", a.safety, x => h("p", { text: [x.violent_per_1k != null && `Violent ${x.violent_per_1k}/1k`, x.property_per_1k != null && `Property ${x.property_per_1k}/1k`, x.year, x.source].filter(Boolean).join(" · ") })],
      [marketInfo().airport, a.lax, x => h("p", { text: `${x.minutes_offpeak ?? "?"} min off-peak · ${x.minutes_peak ?? "?"} min at peak` }), "lax"],
      ["Nightlife", a.nightlife, x => h("p", { text: [x.nearest_district, x.drive_minutes != null && x.drive_minutes + " min drive"].filter(Boolean).join(" · ") })],
      ["Gyms", a.gyms, x => ul(x.examples)], ["Errands", a.services], ["Rail", a.rail, x => h("p", { text: [x.nearest_station, x.line].filter(Boolean).join(" · ") })],
    ].filter(([, x]) => x);
    const sc = areaScore(a), ex = extrasOf(a);
    drawer("Atlas · " + a.region,
      h("div", { class: "dossier-head area-head" },
        regionEmblem(a.region, "lg"),
        h("div", { class: "dossier-kicker" }, h("span", { text: a.region })),
        h("h2", { class: "dossier-name", id: "drawerTitle", text: a.name })),
      h("div", { class: "hero-figs" },
        h("div", { class: "hero-fig" }, h("span", { class: "fig-k", text: "Score" }), h("b", { class: "serif", text: f1(sc) }), h("span", { class: "hero-sub" }, jar(sc, "xs", 10), "of 10, your weights")),
        h("div", { class: "hero-fig" }, h("span", { class: "fig-k", text: "Listings here" }), h("b", { class: "serif", text: bs.length }), h("span", { class: "hero-sub", text: bs.filter(matches).length + " in view" })),
        h("div", { class: "hero-fig" }, h("span", { class: "fig-k", text: "Typical 1BR" }), h("b", { class: "serif", text: ex.median_1br_rent == null ? "—" : money(ex.median_1br_rent) }), h("span", { class: "hero-sub", text: ex.median_1br_rent == null ? "not found" : "area median rent" })),
        h("div", { class: "hero-fig" + (ex.summer_high_f >= 90 ? " neg" : "") }, h("span", { class: "fig-k", text: "Summer high" }), h("b", { class: "serif", text: ex.summer_high_f == null ? "—" : Math.round(ex.summer_high_f) + "°" }), h("span", { class: "hero-sub", text: ex.summer_high_f == null ? "not found" : "°F, August average" }))),
      a.summary ? h("p", { class: "dossier-summary", text: a.summary }) : null,
      ex.vibe ? h("p", { class: "vibe" }, h("span", { class: "mono-label", text: "Vibe" }), ex.vibe) : null,
      factorBars(a, "in-drawer"),
      a.airports_other ? h("p", { class: "muted small", text: "Other airports: " + a.airports_other }) : null,
      bs.length ? section(`Listings here`,
        h("ul", { class: "minilist" }, ...bs.map(b => h("li", null, h("button", { type: "button", class: "minilist-btn v-" + verdict(b), onclick: () => openBuilding(b) },
          h("span", { class: "minilist-name", text: b.name }), h("span", { class: "minilist-rent", text: money(rentOf(b)) }), h("span", { class: "minilist-arrow", "aria-hidden": "true", text: "→" })))))) : null,
      areaConcessions(a),
      areaExtras(a),
      section("Field notes",
        h("div", { class: "fieldnotes" }, ...blocks.map(([name, x, extra, icoKey]) => h("div", { class: "fieldnote" },
          h("header", { class: "fieldnote-head" }, factorIcon(icoKey || AREA_ICON[name]), h("span", { class: "fieldnote-name", text: name }), h("span", { class: "fieldnote-v" }, x.score != null ? h("span", { class: "meter xs", "aria-hidden": "true" }, h("i", { style: { "--w": x.score * 10 + "%" } })) : null, x.score != null ? x.score + "/10" : "—")),
          extra ? extra(x) : null, x.note ? h("p", { class: "fieldnote-note", text: x.note }) : null)))),
      sources(a.sources));
  }

  /* ==========================================================================
     Data (embedded; personal edits live in this browser)
     ========================================================================== */
  const DATA = JSON.parse(document.getElementById("data").textContent);
  const MARKETS = DATA.markets || { la: { label: "Los Angeles", buildings: DATA.buildings || [], neighborhoods: DATA.neighborhoods || [], geo: DATA.geo } };
  const MARKET_KEYS = Object.keys(MARKET_INFO).filter(k => MARKETS[k]).concat(Object.keys(MARKETS).filter(k => !MARKET_INFO[k]));
  if (!MARKETS[S.market]) S.market = "la";
  function marketData(k) { return MARKETS[k || S.market] || { buildings: [], neighborhoods: [] }; }
  function marketInfo(k) { k = k || S.market; return MARKET_INFO[k] || { name: (MARKETS[k] && MARKETS[k].label) || k, numeral: "", regions: [], roads: "Highways and traffic", roadsShort: "Highways", airport: "Airport" }; }
  let EDITS = {};
  async function saveBuilding(b, isNew) {
    const i = S.buildings.findIndex(x => x.id === b.id);
    if (i >= 0) S.buildings[i] = b; else S.buildings.push(b);
    // EDITS mirrors storage in memory, so Export still works when this browser blocks storage
    EDITS[b.id] = isNew ? b : { ...(EDITS[b.id] || {}), my_status: b.my_status, my_note: b.my_note };
    const ok = ls.set("edits", EDITS);
    if (!ok) toast("This browser isn't saving changes. Use Export notes to keep a copy.");
    renderResults(); renderChips();
    return ok;
  }
  function applyEdits(edits) {
    for (const [id, p] of Object.entries(edits || {})) {
      const i = S.buildings.findIndex(x => x.id === id);
      if (i >= 0) S.buildings[i] = { ...S.buildings[i], ...p };
      else if (p && p.name && (p.market || "la") === S.market) S.buildings.push(p);
    }
  }
  /* Research notes sometimes describe the research tooling rather than the place.
     Reword those caveats for the reader; the facts and the gaps stay the same. */
  const NOTE_FIXES = [
    [/Neighborhood-level per-capita (\d{4}) rates could not be retrieved \(WebFetch was unavailable in this session and search results gave no neighborhood figures\); rates left null rather than invented\./g, "No neighborhood-level per-capita $1 crime rates were found, so none are shown."],
    [/\(Drive times are agent estimates from typical Google-Maps-style patterns; no live routing tool was reachable\.\)/g, "(Drive times are estimates, not live routing.)"],
  ];
  const tidyNote = t => typeof t === "string" ? NOTE_FIXES.reduce((x, [re, to]) => x.replace(re, to), t) : t;
  const tidyArea = a => { const o = { ...a }; for (const [k, v] of Object.entries(o)) if (v && typeof v === "object" && !Array.isArray(v) && typeof v.note === "string") o[k] = { ...v, note: tidyNote(v.note) }; return o; };
  /* The build drops tooling remarks from location notes, which can orphan "expect ~100-200 m error." */
  const tidyLoc = t => { if (typeof t !== "string" || !t) return t; t = t.replace(/^expect (~[\d-]+ m) error\.\s*/, "Map position is estimated (expect $1 error). ").replace(/\s+coordinates estimated from/g, " Coordinates estimated from"); return t.charAt(0).toUpperCase() + t.slice(1); };
  function setData(buildings, areas) {
    areas = areas.map(tidyArea);
    buildings = buildings.map(b => b.location_note ? { ...b, location_note: tidyLoc(b.location_note) } : b);
    S.areas = areas.slice().sort((a, b) => a.name.localeCompare(b.name));
    S.areaById = new Map(S.areas.map(a => [a.id, a]));
    S.buildings = buildings.map(b => ({ ...b })); S.loaded = true;
    S.hasConc = S.buildings.some(b => b.concessions);
  }
  /* Regions present in the market, in the expected order first; labels for roads and airport. */
  function applyMarketMeta() {
    const mi = marketInfo(), present = new Set([...S.areas.map(a => a.region), ...S.buildings.map(b => (S.areaById.get(b.area_id) || {}).region || b.region)].filter(Boolean));
    REGIONS = mi.regions.filter(r => present.has(r)).concat([...present].filter(r => !mi.regions.includes(r)).sort());
    FACTORS.find(f => f.key === "drive").name = mi.roads;
    FACTORS.find(f => f.key === "lax").name = mi.airport;
    document.documentElement.dataset.mkt = S.market;
    $("mastRegions").textContent = (REGIONS.length ? REGIONS : mi.regions).join(" · ");
  }
  function loadMarket() {
    const M = marketData();
    setData(M.buildings || [], M.neighborhoods || []);
    applyEdits(EDITS);
    applyMarketMeta();
  }
  /* Market tabs: three drawer labels. Built once; state moves with aria-pressed. */
  let marketBtns = null;
  function renderMarkets() {
    if (!marketBtns) {
      marketBtns = MARKET_KEYS.map(k => {
        const mi = marketInfo(k), M = marketData(k), nB = (M.buildings || []).length, nA = (M.neighborhoods || []).length;
        return h("button", { type: "button", class: "mkt", "data-market": k, onclick: () => setMarket(k) },
          h("span", { class: "mkt-no", "aria-hidden": "true", text: mi.numeral }),
          h("span", { class: "mkt-name", text: mi.name }),
          h("span", { class: "mkt-sub" }, nB ? plural(nB, "listing") : nA ? "No listings yet" : "Not surveyed yet", nA ? h("span", { class: "mkt-areas", text: " · " + plural(nA, "area") }) : null));
      });
      $("markets").replaceChildren(...marketBtns);
      $("markets").addEventListener("keydown", e => {
        if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
        const i = marketBtns.indexOf(document.activeElement); if (i < 0) return;
        e.preventDefault();
        const j = (i + (e.key === "ArrowRight" ? 1 : -1) + marketBtns.length) % marketBtns.length;
        marketBtns[j].focus(); setMarket(MARKET_KEYS[j]);
      });
    }
    marketBtns.forEach(btn => btn.setAttribute("aria-pressed", btn.dataset.market === S.market ? "true" : "false"));
  }
  function setMarket(k) {
    if (!MARKETS[k] || k === S.market) return;
    S.market = k; ls.set("market", k);
    if (drawerState) drawerState.close();
    ledger && (ledger.topId = undefined);
    loadMarket();
    renderMarkets(); renderFilters(); renderToolbar(); renderResults({ fade: true });
  }
  function exportEdits() {
    const blob = new Blob([JSON.stringify({ app: "apartment-search-2027", exported: new Date().toISOString(), edits: EDITS, compare: [...S.compare], checks: { ...CHECKS } }, null, 1)], { type: "application/json" });
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
        const merged = Object.assign(EDITS, d.edits);
        ls.set("edits", merged);
        loadMarket();
        if (Array.isArray(d.compare)) { S.compare = new Set(d.compare); ls.set("compare", d.compare); }
        if (d.checks && typeof d.checks === "object") { for (const [k, v] of Object.entries(d.checks)) setCheck(k, !!v); if (S.view === "timeline") $("view").replaceChildren(); }
        renderAll(); toast("Notes imported");
      } catch { toast("That file isn't an Apartment Search export."); }
    };
    r.readAsText(file);
  }
  $("exportBtn").addEventListener("click", exportEdits);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", e => { if (e.target.files[0]) importEdits(e.target.files[0]); e.target.value = ""; });

  /* The masthead engraving draws itself once (~1.2s), then stays still.
     Linework is traced with stroke-dashoffset, left-to-right across the plate;
     tints and dot-stipple fade in behind the line. */
  function drawHero(svg) {
    if (!svg || reduceMotion() || typeof svg.animate !== "function") return;
    const els = [...svg.querySelectorAll("path, circle, ellipse, line, polyline")];
    if (!els.length || els.length > 1500) return;
    let minX = Infinity, maxX = -Infinity;
    const items = [];
    for (const el of els) {
      const cs = getComputedStyle(el);
      const stroked = cs.stroke && cs.stroke !== "none";
      let len = 0, box = null;
      try { len = stroked ? el.getTotalLength() : 0; box = el.getBBox(); } catch { continue; }
      const x = box ? box.x + box.width / 2 : 0;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      items.push({ el, len, x, stroked });
    }
    const span = Math.max(1, maxX - minX);
    for (const it of items) {
      const t = (it.x - minX) / span;                 // 0 at left .. 1 at right
      const delay = 40 + t * 380;
      if (it.stroked && it.len > 4) {
        const L = (it.len + 2).toFixed(1);
        it.el.style.strokeDasharray = `${L} ${L}`;
        const a = it.el.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 760, delay, easing: "cubic-bezier(.45,.05,.25,1)", fill: "backwards" });
        a.onfinish = () => { it.el.style.strokeDasharray = ""; };
      } else {
        it.el.animate([{ opacity: 0 }, { opacity: getComputedStyle(it.el).opacity }], { duration: 520, delay: delay + 260, easing: "ease-out", fill: "backwards" });
      }
    }
  }
  function renderArt() {
    const hero = ill("hero");
    if (hero) { $("heroArt").innerHTML = hero; document.body.classList.add("has-hero"); drawHero($("heroArt").querySelector("svg")); }
    const orn = ill("ornament");
    if (orn) $("ornament").innerHTML = orn;
  }
  function boot() {
    renderArt();
    renderDates();
    EDITS = ls.get("edits", {}) || {};
    loadChecks();
    loadMarket();
    renderMarkets();
    S.canWrite = true;
    $("dataDate").textContent = "Data updated " + DATA.updated;
    $("mastDate").textContent = "Updated " + DATA.updated;
    renderAll();
  }
  function renderAll() { renderFilters(); renderToolbar(); renderResults(); }
  boot();
})();
