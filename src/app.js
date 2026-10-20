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
  const VERDICTS = { all: "Meets everything", check: "Needs checks", fail: "Fails a requirement" };
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
  function jar(s, cls) {
    const v = s == null ? 0 : Math.max(0, Math.min(1, s / 10)), q = Math.round(v * 20) / 20;
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
  /* Shown place name; never guesses a region the listing does not have (regionOf defaults for filtering only). */
  const whereText = b => areaName(b) || b.region || "Neighborhood not set";
  const isNew = b => b.batch === "new-oct15" || b.batch === "private-oct15";
  const statusName = k => (STATUSES.find(s => s.key === (k || "new")) || STATUSES[0]).name;
  const savingsOf = b => { const c = allIn(b); return c == null ? null : JAYNE.allIn - c; };

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
        h("span", { class: "measure", "aria-hidden": "true", style: { "--p": (span * 100).toFixed(1) + "%", "--k": span.toFixed(3), "--i": i } }));
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
    const topId = top ? top.id + "|" + f1(score(top)) : "";
    if (ledger.topId !== topId) {
      const first = ledger.topId == null;
      ledger.topId = topId;
      const node = top ? h("button", { class: "toppick", type: "button", onclick: () => openBuilding(top) }, h("b", { text: top.name }), h("span", { class: "arrow", "aria-hidden": "true", text: "→" })) : h("b", { text: "—" });
      const hadFocus = ledger.topSlot.contains(document.activeElement);
      ledger.topSlot.replaceChildren(node);
      if (hadFocus && node.focus) node.focus({ preventScroll: true });
      ledger.topSub.textContent = top ? [areaName(top), money(rentOf(top)), "match " + f1(score(top))].filter(Boolean).join(" · ") : "";
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
    if (f.maxRent !== d.maxRent) n++; if (f.minSqft !== d.minSqft) n++; if (f.minRep !== d.minRep) n++;
    for (const k of ["regions", "verdicts", "landlords", "statuses"]) if (!sameSet(f[k], d[k])) n++;
    n += f.mustHave.length; if (f.hideScam !== d.hideScam) n++; if (f.newOnly) n++;
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
  function range(id, label, min, max, step, value, fmt, onInput, ends, field) {
    const out = h("output", { for: id, text: fmt(value) });
    const pct = v => ((v - min) / (max - min) * 100).toFixed(2) + "%";
    const input = h("input", { type: "range", class: "range", id, min, max, step, value, "data-num": field, style: { "--p": pct(value) },
      oninput: e => { const v = +e.target.value; e.target.style.setProperty("--p", pct(v)); out.textContent = fmt(v); onInput(v); },
      onchange: () => settleRange() });
    input._sync = v => { input.value = v; input.style.setProperty("--p", pct(v)); out.textContent = fmt(v); };
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
    $("filters").replaceChildren(
      h("div", { class: "filters-head" },
        h("p", { class: "mono-label" }, "Refine", h("span", { class: "filters-active", id: "filtersActive", text: nActive ? ` · ${nActive} active` : "" })),
        h("button", { class: "linkbtn", id: "clearAll", type: "button", disabled: !nActive && !S.q, text: "Clear all", onclick: clearAll })),
      h("div", { class: "fgroup fgroup-flat" },
        range("f-rent", "Max rent", 1500, 2600, 25, f.maxRent, money, v => { f.maxRent = v; refreshFromRange(); }, ["$1,500", "$2,600"], "maxRent"),
        range("f-sqft", "Min size", 600, 1000, 10, f.minSqft, v => v + " sq ft", v => { f.minSqft = v; refreshFromRange(); }, ["600", "1,000 sq ft"], "minSqft"),
        range("f-rep", "Min review score", 0, 9, 1, f.minRep, v => v ? v + "+ / 10" : "Any", v => { f.minRep = v; refreshFromRange(); }, ["Any", "9 / 10"], "minRep")),
      g("must", "Must be confirmed", true,
        tagList("mh", REQS.map(r => [r.key, r.name]), f.mustHave, (k, on) => { toggleIn(f.mustHave, k, on); rerender(); },
          Object.fromEntries(REQS.map(r => [r.key, S.buildings.filter(b => reqVal(b, r.key) === "yes").length])), k => reqIcon(k) || h("span", { class: "ico-fallback", "aria-hidden": "true" }), "mustHave")),
      g("region", "Region", true,
        tagList("rg", REGIONS.map(r => [r, r]), f.regions, (k, on) => { toggleIn(f.regions, k, on); rerender(); }, counts(regionOf), null, "regions")),
      g("verdict", "Requirements", true,
        tagList("vd", Object.entries(VERDICTS), f.verdicts, (k, on) => { toggleIn(f.verdicts, k, on); rerender(); }, counts(verdict), k => h("span", { class: "vdot " + k, "aria-hidden": "true" }), "verdicts")),
      g("landlord", "Landlord", true,
        tagList("ll", Object.entries(LANDLORDS), f.landlords, (k, on) => { toggleIn(f.landlords, k, on); rerender(); }, counts(b => b.landlord || "company"), null, "landlords"),
        h("div", { class: "switches" },
          toggleRow("f-scam", "Hide likely scams", f.hideScam, S.buildings.filter(b => b.scam_flags).length, on => { f.hideScam = on; rerender(); }, "hideScam"),
          toggleRow("f-new", "Only recent finds", f.newOnly, S.buildings.filter(isNew).length, on => { f.newOnly = on; rerender(); }, "newOnly"))),
      g("status", "My status", false,
        tagList("st", STATUSES.map(s => [s.key, s.name]), f.statuses, (k, on) => { toggleIn(f.statuses, k, on); rerender(); }, counts(b => b.my_status || "new"), null, "statuses")),
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
                cancelAnimationFrame(lightRefresh); lightRefresh = requestAnimationFrame(() => renderResults({ summaryOnly: true }));
                clearTimeout(restTimer); restTimer = setTimeout(() => renderResults(), 160);
              }, onchange: () => settleRange() }));
        })),
        h("button", { class: "linkbtn", type: "button", text: "Reset weights", onclick: () => { S.weights = Object.assign({}, defaultWeights); ls.set("weights", S.weights); renderFilters(); renderResults(); } })),
    );
    renderChips();
    updateBadge();
  }
  /* Bring the existing filter controls in line with S.f (after chips or Clear all). */
  function syncFilters() {
    const root = $("filters"), f = S.f;
    root.querySelectorAll("input[data-arr]").forEach(i => { i.checked = f[i.dataset.arr].includes(i.dataset.key); });
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
    tb.viewBtns.forEach((btn, i) => {
      const k = VIEWS[i][0], on = S.view === k;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (k === "compare") {
        let n = btn.querySelector(".seg-n");
        if (S.compare.size) {
          if (!n) { n = h("span", { class: "seg-n" }); btn.append(n); anim(n, [{ transform: "scale(.3)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 320, easing: EASE.spring }); }
          else if (n.textContent !== String(S.compare.size)) anim(n, [{ transform: "scale(1.35)" }, { transform: "none" }], { duration: 320, easing: EASE.spring });
          n.textContent = S.compare.size;
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
    const cache = listCache[mode], sc = score(b), scK = f1(sc);
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
        fails.length ? h("p", { class: "specimen-fails", text: fails.join(" · ") }) : null,
        h("footer", { class: "specimen-foot" },
          h("div", { class: "match", title: "Best-match score out of 10, using your ranking weights" }, jar(sc), h("span", { class: "match-k", text: "Match" }), h("b", { class: "match-v", text: f1(sc) })),
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
      h("span", { class: "rowitem-match" }, jar(sc, "xs"), h("b", { text: f1(sc) })),
      savingsEl(b, "rowitem-save") || h("span", { class: "rowitem-num", text: "—" }));
  }

  /* ==========================================================================
     Views: table
     ========================================================================== */
  const TCOLS = [
    { k: "name", t: "Building", v: b => b.name.toLowerCase(), cell: b => h("td", { class: "t-name" }, h("span", { class: "t-title" }, openBtn(b.name)), h("span", { class: "t-sub", text: whereText(b) })) },
    { k: "rent", t: "Rent", num: true, v: rentOf, cell: b => h("td", { class: "num strong", text: money(rentOf(b)) }) },
    { k: "sqft", t: "Sq ft", num: true, v: b => b.sqft, cell: b => h("td", { class: "num", text: b.sqft != null ? Math.round(b.sqft) : "—" }) },
    { k: "ppsf", t: "$/sq ft", num: true, v: ppsf, cell: b => h("td", { class: "num", text: ppsf(b) ? ppsf(b).toFixed(2) : "—" }) },
    { k: "save", t: "vs. Jayne", num: true, v: savingsOf, cell: b => { const d = savingsOf(b); return h("td", { class: "num " + (d == null ? "" : d >= 0 ? "pos" : "neg"), text: d == null ? "—" : (d >= 0 ? "+" : "−") + money(Math.abs(d)) }); } },
    { k: "score", t: "Match", num: true, v: score, cell: b => h("td", { class: "num" }, h("span", { class: "t-match" }, score(b) == null ? null : h("span", { class: "meter xs", "aria-hidden": "true" }, h("i", { style: { "--w": score(b) * 10 + "%" } })), f1(score(b)))) },
    { k: "rep", t: "Reviews", num: true, v: repScore, cell: b => h("td", { class: "num", text: repScore(b) ?? "—" }) },
    { k: "req", t: "Requirements", v: b => REQS.filter(r => reqVal(b, r.key) === "yes").length, cell: b => h("td", null, h("span", { class: "dots" }, ...REQS.map(r => h("i", { class: reqVal(b, r.key), title: r.name + ": " + REQ_WORD[reqVal(b, r.key)].toLowerCase() })))) },
    { k: "landlord", t: "Landlord", v: b => b.landlord || "company", cell: b => h("td", { class: "t-text", text: b.landlord === "private" ? "Private" : "Company" }) },
    { k: "status", t: "Status", v: b => b.my_status || "new", cell: b => h("td", { class: "t-text", text: statusName(b.my_status) }) },
  ];
  function renderTable(root, list, ctx) {
    if (!list.length) {
      if (!root.querySelector(":scope > .empty")) { root.replaceChildren(emptyState()); if (!ctx.switching) fadeIn(root.firstChild); }
      return;
    }
    const col = TCOLS.find(c => c.k === S.tsort.key) || TCOLS.find(c => c.k === "score");
    const rows = list.slice().sort((a, b) => { const x = col.v(a), y = col.v(b); if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * S.tsort.dir; });
    const head = h("thead", null, h("tr", null, h("th", { class: "num t-no", scope: "col", text: "No." }), ...TCOLS.map(c => h("th", { class: c.num ? "num" : null, scope: "col", "aria-sort": S.tsort.key === c.k ? (S.tsort.dir > 0 ? "ascending" : "descending") : null },
      h("button", { type: "button", class: "th-btn" + (S.tsort.key === c.k ? " on" : ""), "data-col": c.k, onclick: () => {
          S.tsort = { key: c.k, dir: S.tsort.key === c.k ? -S.tsort.dir : (c.num && !["rent", "ppsf"].includes(c.k) ? -1 : 1) }; ls.set("tsort", S.tsort); renderResults();
          const again = document.querySelector(`.th-btn[data-col="${c.k}"]`); if (again) again.focus({ preventScroll: true });
        } },
        c.t, h("span", { class: "th-arrow", "aria-hidden": "true", text: S.tsort.key === c.k ? (S.tsort.dir > 0 ? "↑" : "↓") : "↕" }))))));
    const trs = rows.map((b, i) => h("tr", { class: "v-" + verdict(b), "data-listing": b.id, onclick: () => openBuilding(b) },
      h("td", { class: "num t-no", text: pad2(i + 1) }), ...TCOLS.map(c => c.cell(b))));
    const cap = h("caption", { class: "sr", text: `${rows.length} listings. Select a column heading to sort.` });
    const table = root.querySelector(":scope > .tablewrap > table");
    if (!table) {
      root.replaceChildren(h("div", { class: "tablewrap" }, h("table", { class: "ledger-table" }, cap, head, h("tbody", null, ...trs))));
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
        return window.MapView.render(root, list, { geo: DATA.geo, areas: S.areas, verdict, rentOf, money, score, areaScore, openBuilding, openArea });
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
    const list = S.areas.filter(a => S.f.regions.includes(a.region)).map(a => ({ a, sc: areaScore(a) })).sort((x, y) => (y.sc ?? -1) - (x.sc ?? -1));
    if (!list.length) { root.replaceChildren(emptyState(S.loaded ? "No neighborhoods in the selected regions." : "Loading…")); return; }
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
    const picks = S.buildings.filter(b => S.compare.has(b.id));
    if (!picks.length) return root.append(emptyState("Open any listing and choose Compare to line up to four side by side.", "Nothing on the bench yet", true));
    const rows = [
      ["Neighborhood", b => areaName(b) || "—"],
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
            h("span", { class: "mono-label", text: whereText(b) }),
            h("button", { class: "compare-name", type: "button", text: b.name, onclick: () => openBuilding(b) }),
            verdict(b) === "all" ? h("span", { class: "tag ok", text: "Meets everything" }) : null,
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
          return h("tr", null, h("th", { scope: "row", class: "compare-k" }, reqKey ? reqIcon(reqKey) : null, label), ...picks.map((b, i) => {
            const t = String(fmt(b));
            if (reqKey) return h("td", null, h("span", { class: "reqword " + t }, h("i", { "aria-hidden": "true" }), REQ_WORD[t]));
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
    countEls.of.textContent = ` of ${S.buildings.length} listings`;
    countEls.q.textContent = S.q ? ` matching “${S.q}”` : "";
    countEls.meet.textContent = ` · ${meet} meet everything`;
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
    if (opts.summaryOnly) return;
    const root = $("view");
    const switching = root.dataset.view !== S.view || !!opts.fade;
    if (switching && booted) {
      // keep the toolbar in place: if it is stuck, start the new view at its top
      const main = $("results"), top = main.getBoundingClientRect().top + scrollY - 6;
      if (scrollY > top) scrollTo({ top, behavior: "instant" });
      if (opts.fade) root.replaceChildren();
    }
    root.dataset.view = S.view;
    const ctx = { switching, initial: !booted };
    ({ list: renderList, table: renderTable, map: renderMap, areas: renderAreas, compare: renderCompare, add: renderAdd }[S.view] || renderList)(root, list, ctx);
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
      h("div", { class: "dossier-head" + (v === "all" && ill("seal", "Meets everything") ? " has-seal" : "") },
        h("div", { class: "dossier-kicker" }, regionEmblem(regionOf(b), "sm"), h("span", { text: [a && a.name, a ? regionOf(b) : b.region].filter(Boolean).join(" · ") || "Neighborhood not set" })),
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
      h("div", { class: "dossier-head area-head" },
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
      else if (p && p.name) S.buildings.push(p);
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
  }
  function exportEdits() {
    const blob = new Blob([JSON.stringify({ app: "apartment-search-2027", exported: new Date().toISOString(), edits: EDITS, compare: [...S.compare] }, null, 1)], { type: "application/json" });
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
        setData(DATA.buildings, DATA.neighborhoods); applyEdits(merged);
        if (Array.isArray(d.compare)) { S.compare = new Set(d.compare); ls.set("compare", d.compare); }
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
    setData(DATA.buildings, DATA.neighborhoods);
    EDITS = ls.get("edits", {}) || {};
    applyEdits(EDITS);
    S.canWrite = true;
    $("dataDate").textContent = "Data updated " + DATA.updated;
    $("mastDate").textContent = "Updated " + DATA.updated;
    renderAll();
  }
  function renderAll() { renderFilters(); renderToolbar(); renderResults(); }
  boot();
})();
