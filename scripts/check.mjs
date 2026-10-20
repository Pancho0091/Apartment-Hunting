// Visual + functional check for the built tool.
// Usage: PW=$(npm root -g)/playwright/index.mjs node scripts/check.mjs <out_dir> [--views list,table,map,areas,compare,detail,mobile]
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
if (want("list")) await p.screenshot({ path: `${out}/list.png` });
if (want("list")) await p.screenshot({ path: `${out}/list-full.png`, fullPage: true });
const clickView = async name => { const btn = p.locator(`[data-view="${name}"]`); if (await btn.count()) { await btn.first().click(); await p.waitForTimeout(700); return true; } return false; };
for (const v of ["table", "map", "areas", "compare"]) if (want(v)) { report["view_" + v] = await clickView(v); await p.screenshot({ path: `${out}/${v}.png` }); }
if (want("detail")) {
  await clickView("list");
  const row = p.locator("[data-listing]").first();
  if (await row.count()) { await row.click(); await p.waitForTimeout(700); await p.screenshot({ path: `${out}/detail.png` }); await p.keyboard.press("Escape"); }
  else report.detail = "no [data-listing] element";
}
if (want("search")) { const q = p.locator("#q"); if (await q.count()) { await q.fill("koreatown"); await p.waitForTimeout(400); report.search_koreatown = await p.textContent("#count"); await q.fill(""); } }
if (want("mobile")) {
  const m = await page({ width: 390, height: 844 }, 2);
  report.hscroll_mobile = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await m.screenshot({ path: `${out}/mobile.png` });
  await m.screenshot({ path: `${out}/mobile-full.png`, fullPage: true });
}
report.errors = errs;
console.log(JSON.stringify(report, null, 1));
await b.close();
