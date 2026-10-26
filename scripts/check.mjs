// Visual + functional check for the built tool.
// Usage: PW=$(npm root -g)/playwright/index.mjs node scripts/check.mjs <out_dir> [--views=list,table,map,areas,compare,detail,area,filters,markets,perf,search,mobile]
// Prints JSON (counts, horizontal-scroll flags, per-market counts, filter timing, console errors) and writes screenshots.
const { chromium } = await import(process.env.PW || "playwright");
const out = process.argv[2] || "shots";
const only = (process.argv.find(a => a.startsWith("--views=")) || "").slice(8).split(",").filter(Boolean);
const want = v => !only.length || only.includes(v);
const file = "file://" + new URL("../Apartment-Search-2027.html", import.meta.url).pathname;
const fs = await import("node:fs"); fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const errs = [];
const page = async (vp, scale = 1) => {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: scale, reducedMotion: "no-preference" });
  const p = await ctx.newPage();
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  await p.goto(file); await p.waitForTimeout(1200);
  return p;
};
const p = await page({ width: 1440, height: 900 });
const report = {};
report.count = await p.textContent("#count").catch(() => "(no #count)");
report.hscroll_desktop = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const toResults = async () => { await p.evaluate(() => { const r = document.getElementById("results"); scrollTo({ top: r.getBoundingClientRect().top + scrollY - 8, behavior: "instant" }); }); await p.waitForTimeout(300); };
if (want("list")) await p.screenshot({ path: `${out}/list.png` });
if (want("list")) await p.screenshot({ path: `${out}/list-full.png`, fullPage: true });
const clickView = async name => { const btn = p.locator(`[data-view="${name}"]`); if (await btn.count()) { await btn.first().click(); await p.waitForTimeout(700); return true; } return false; };
for (const v of ["table", "map", "areas", "compare"]) if (want(v)) {
  report["view_" + v] = await clickView(v);
  if (v === "table") { await toResults(); report.table_cols = await p.locator(".ledger-table thead th").count(); }
  await p.screenshot({ path: `${out}/${v}.png` });
  await p.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
}
if (want("table")) { // column picker opens and lists options
  await clickView("table"); await toResults();
  const pick = p.locator(".colpick > summary");
  if (await pick.count()) { await pick.click(); await p.waitForTimeout(300); report.colpick_options = await p.locator(".colpick-opt").count(); await p.screenshot({ path: `${out}/table-columns.png` }); await p.keyboard.press("Escape"); }
}
if (want("detail")) {
  await clickView("list");
  const row = p.locator("[data-listing]").first();
  if (await row.count()) {
    await row.click(); await p.waitForTimeout(900); await p.screenshot({ path: `${out}/detail.png` });
    const sec = p.locator(".drawer .pgrid");
    if (await sec.count()) { await p.evaluate(() => { const d = document.querySelector(".drawer"), s = document.querySelector(".drawer .pmeter"); d.scrollTop = s.offsetTop - 60; }); await p.waitForTimeout(300); await p.screenshot({ path: `${out}/detail-particulars.png` }); report.particulars_cards = await p.locator(".drawer .pcard").count(); }
    await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  } else report.detail = "no [data-listing] element";
}
if (want("area")) {
  await clickView("areas");
  const plate = p.locator(".plate").first();
  if (await plate.count()) {
    await plate.click(); await p.waitForTimeout(900); await p.screenshot({ path: `${out}/area.png` });
    await p.evaluate(() => { const d = document.querySelector(".drawer"), s = [...document.querySelectorAll(".drawer .dsec")].find(x => /Local conditions/i.test(x.textContent)); if (s) d.scrollTop = s.offsetTop - 60; });
    await p.waitForTimeout(300); await p.screenshot({ path: `${out}/area-extras.png` });
    await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  }
}
if (want("filters")) {
  await clickView("list");
  await p.evaluate(() => document.querySelectorAll("#filters details.fgroup").forEach(d => { if (/Pets|Parking|Building|Location/.test(d.textContent.slice(0, 40))) d.open = true; }));
  await toResults(); await p.waitForTimeout(400);
  await p.evaluate(() => { document.getElementById("sidebar").scrollTop = document.querySelector('#filters [data-g="pets"]').offsetTop - 10; });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/filters.png` });
  // a three-state filter and a range filter actually filter
  const before = await p.textContent("#count .count-real");
  await p.locator('input[data-tri="cats"][value="yes"]').check({ force: true }); await p.waitForTimeout(500);
  report.filter_cats_yes = [before, await p.textContent("#count .count-real")];
  await p.locator('input[data-tri="cats"][value="maybe"]').check({ force: true }); await p.waitForTimeout(500);
  report.filter_cats_maybe = await p.textContent("#count .count-real");
  await p.locator('input[data-tri="cats"][value="any"]').check({ force: true }); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelectorAll("#filters details.fgroup").forEach(d => { d.open = false; }));
}
if (want("perf")) { // long tasks during filter changes (target < 100 ms)
  await clickView("list");
  await p.evaluate(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ type: "longtask", buffered: false }); });
  for (const sel of ['input[data-tri="gym"][value="yes"]', 'input[data-tri="gym"][value="any"]', 'input[data-tri="pool"][value="maybe"]', 'input[data-tri="pool"][value="any"]']) {
    await p.locator(sel).check({ force: true }); await p.waitForTimeout(450);
  }
  const chip = p.locator(".chip").first(); await chip.click(); await p.waitForTimeout(450); await chip.click(); await p.waitForTimeout(900);
  report.filter_long_tasks_ms = await p.evaluate(() => window.__lt);
}
if (want("search")) { const q = p.locator("#q"); if (await q.count()) { await q.fill("koreatown"); await p.waitForTimeout(400); report.search_koreatown = await p.textContent("#count"); await q.fill(""); await p.waitForTimeout(300); } }
if (want("markets")) { // each market tab: list + map
  report.markets = {};
  const keys = await p.locator("[data-market]").evaluateAll(els => els.map(e => e.dataset.market));
  for (const k of keys) {
    await p.locator(`[data-market="${k}"]`).click(); await p.waitForTimeout(800);
    await clickView("list"); await p.evaluate(() => scrollTo({ top: 0, behavior: "instant" })); await p.waitForTimeout(300);
    const m = { count: await p.textContent("#count"), pressed: await p.getAttribute(`[data-market="${k}"]`, "aria-pressed"), empty_state: await p.locator(".unsurveyed").count() > 0 };
    await p.screenshot({ path: `${out}/market-${k}-top.png` });
    await toResults(); await p.screenshot({ path: `${out}/market-${k}-list.png` });
    await clickView("map"); await toResults(); await p.waitForTimeout(500);
    m.map_title = await p.locator(".mv-cart h3").first().textContent().catch(() => null);
    m.legend_excluded = await p.locator(".mv-legend").first().textContent().then(t => /ruled out/i.test(t)).catch(() => null);
    await p.screenshot({ path: `${out}/market-${k}-map.png` });
    m.hscroll = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    report.markets[k] = m;
  }
  await p.locator('[data-market="la"]').click(); await p.waitForTimeout(600); await clickView("list");
}
if (want("mobile")) {
  const m = await page({ width: 390, height: 844 }, 2);
  report.hscroll_mobile = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await m.screenshot({ path: `${out}/mobile.png` });
  await m.screenshot({ path: `${out}/mobile-full.png`, fullPage: true });
  const mk = {};
  for (const k of ["seattle", "nyc", "la"]) {
    const t = m.locator(`[data-market="${k}"]`); if (!(await t.count())) continue;
    await t.click(); await m.waitForTimeout(700);
    mk[k] = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (k !== "la") await m.screenshot({ path: `${out}/mobile-${k}.png` });
  }
  report.hscroll_mobile_markets = mk;
  const row = m.locator("[data-listing]").first();
  if (await row.count()) { await row.click(); await m.waitForTimeout(900); await m.screenshot({ path: `${out}/mobile-detail.png` });
    await m.evaluate(() => { const d = document.querySelector(".drawer"), s = document.querySelector(".drawer .pmeter"); if (s) d.scrollTop = s.offsetTop - 60; }); await m.waitForTimeout(300);
    await m.screenshot({ path: `${out}/mobile-particulars.png` });
    report.hscroll_mobile_drawer = await m.evaluate(() => { const d = document.querySelector(".drawer"); return d ? d.scrollWidth > d.clientWidth : null; });
    await m.keyboard.press("Escape"); await m.waitForTimeout(400); }
  await m.locator("#toggleFilters").click(); await m.waitForTimeout(700);
  await m.screenshot({ path: `${out}/mobile-filters.png` });
}
report.errors = errs;
console.log(JSON.stringify(report, null, 1));
await b.close();
