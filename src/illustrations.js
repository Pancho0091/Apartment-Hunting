/* Illustrations. Owner: illustration pass.
   window.Illus — hand-drawn (procedural) SVG line engravings in a 19th-century botanical /
   apothecary manner. Every function returns an SVG markup STRING and never throws.

   API (all `opts` are optional; a string is shorthand for { label }):
     hero(opts)            wide header engraving, viewBox 1200x220, width 100%.
                           Left ~40% is kept calm for the page title.
     region(name, opts)    emblem, viewBox 64x64, default 64px. "Los Angeles" fan palm,
                           "Long Beach" scallop + waves, "Orange County" orange branch;
                           anything else -> botanical sprig. Legible at 32px.
     req(key, opts)        24x24 icon, default 20px: wd, ac, dw, parking, packages.
     factor(key, opts)     24x24 icon, default 20px: drive, coffee, quiet, safety, lax, extras, rep.
     seal(text, opts)      circular stamp, viewBox 100x100, default 96px. opts.sub = lower arc text.
     ornament(opts)        divider flourish, viewBox 320x20, default 320px wide.
     empty(opts)           empty specimen jar vignette, viewBox 160x150, default 160px.
     compass(opts)         compass rose, viewBox 120x120, default 120px.
     jar(fill, opts)       score jar, viewBox 36x48, default 30px wide; fill 0..1 (null = empty).
   opts: { label, size, class, tint }   size = rendered width in px (height follows aspect).
   Decorative by default (aria-hidden="true"); pass a label to get role="img" + aria-label.
   Colors: stroke = currentColor. Tints read CSS vars --sage, --amber, --green, --vermilion.
   Occluding fills (petals, jar label, trunks) use --illus-bg (falls back to --paper, #f3efe6):
   set --illus-bg on the container if the illustration sits on a different surface.
   All strokes are non-scaling (1 unit = 1 screen px) via an injected <style id="illus-css">.
*/
(function () {
  "use strict";
  var I = (window.Illus = window.Illus || {});

  /* ---------- tiny SVG toolkit ---------- */
  var T = {
    sage: "var(--sage, #8a9a7b)",
    amber: "var(--amber, #a8641f)",
    green: "var(--green, #2f4b3c)",
    verm: "var(--vermilion, #b8432f)",
    bg: "var(--illus-bg, var(--paper, #f3efe6))"
  };
  var PI = Math.PI;
  var uidN = 0;
  function uid(p) { return "il" + p + (++uidN).toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function pt(p, y) { return y === undefined ? r1(p[0]) + " " + r1(p[1]) : r1(p) + " " + r1(y); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function P(d, a) { return '<path d="' + d + '"' + (a ? " " + a : "") + "/>"; }
  function C(cx, cy, r, a) { return '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="' + r1(r) + '"' + (a ? " " + a : "") + "/>"; }
  function E(cx, cy, rx, ry, a) { return '<ellipse cx="' + r1(cx) + '" cy="' + r1(cy) + '" rx="' + r1(rx) + '" ry="' + r1(ry) + '"' + (a ? " " + a : "") + "/>"; }
  function G(body, a) { return "<g" + (a ? " " + a : "") + ">" + body + "</g>"; }
  function tint(c, o) { return 'fill="' + c + '" fill-opacity="' + o + '" stroke="none"'; }
  var FINE = 'stroke-width=".55" opacity=".8"';
  var HAIR = 'stroke-width=".75"';
  var DOT = 'stroke-width="1.1"';

  // Catmull-Rom spline as cubic segments (no leading M).
  function curveC(ps) {
    var d = "";
    for (var i = 0; i < ps.length - 1; i++) {
      var p0 = ps[i - 1] || ps[i], p1 = ps[i], p2 = ps[i + 1], p3 = ps[i + 2] || p2;
      d += "C" + pt(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6) + " " +
        pt(p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6) + " " + pt(p2);
    }
    return d;
  }
  function curve(ps, closed) { return "M" + pt(ps[0]) + curveC(ps) + (closed ? "Z" : ""); }
  function at(ps, s) {
    s = Math.max(0, Math.min(1, s)) * (ps.length - 1);
    var i = Math.min(ps.length - 2, Math.floor(s)), f = s - i;
    return [ps[i][0] + (ps[i + 1][0] - ps[i][0]) * f, ps[i][1] + (ps[i + 1][1] - ps[i][1]) * f];
  }
  function polar(cx, cy, r, a) { return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }
  function deg(d) { return d * PI / 180; }
  function clip(shape, body) {
    var id = uid("c");
    return '<clipPath id="' + id + '">' + shape + "</clipPath>" + G(body, 'clip-path="url(#' + id + ')"');
  }
  // dots (round-capped zero-length segments) scattered in an ellipse, denser toward dir
  function stipple(cx, cy, rx, ry, count, seed, dir, a) {
    var R = rng(seed), d = "", k = 0, guard = 0;
    while (k < count && guard++ < count * 8) {
      var t = R() * 2 * PI, u = Math.sqrt(R());
      var w = dir ? 0.5 + 0.5 * u * (Math.cos(t) * dir[0] + Math.sin(t) * dir[1]) : 1;
      if (R() > w * w) continue;
      d += "M" + pt(cx + Math.cos(t) * u * rx, cy + Math.sin(t) * u * ry) + "h0";
      k++;
    }
    return d ? P(d, a || DOT) : "";
  }

  /* ---------- botanical primitives ---------- */
  // Leaf outline from base (x,y) along angle ang. o: bend, k (width position), p (fullness),
  // shade (+1 right / -1 left side hatched), veins, fill, fo (fill opacity), stip (stipple count), rib
  function leafGeom(x, y, ang, L, W, o) {
    var bend = o.bend || 0, k = o.k || 0.75, ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
    var N = o.N || 10, S = [], Lp = [], Rp = [], Wd = [];
    for (var i = 0; i <= N; i++) {
      var s = i / N, b = bend * L * s * s;
      var cx = x + ca * L * s + nx * b, cy = y + sa * L * s + ny * b;
      var tx = ca + nx * 2 * bend * s, ty = sa + ny * 2 * bend * s, tl = Math.hypot(tx, ty);
      tx /= tl; ty /= tl;
      var w = (W / 2) * Math.pow(Math.sin(PI * Math.pow(s, k)), o.p || 0.8);
      if (o.blunt && s < 0.15) w = Math.max(w, W * 0.22 * (s / 0.15));
      S.push([cx, cy]); Lp.push([cx - ty * w, cy + tx * w]); Rp.push([cx + ty * w, cy - tx * w]); Wd.push(w);
    }
    return { S: S, L: Lp, R: Rp };
  }
  function leaf(x, y, ang, L, W, o) {
    o = o || {};
    var g = leafGeom(x, y, ang, L, W, o);
    var d = "M" + pt(g.L[0]) + curveC(g.L) + curveC(g.R.slice().reverse()) + "Z";
    var out = "";
    if (o.bg !== false) out += P(d, 'fill="' + T.bg + '" stroke="none"');
    if (o.fill) out += P(d, tint(o.fill, o.fo || 0.22));
    if (o.stip) {
      var R = rng(o.seed || 7), sd = "";
      for (var q = 0; q < o.stip; q++) {
        var s = 0.08 + R() * 0.84, a = at(g.L, s), b = at(g.R, s), u = Math.pow(R(), 0.55);
        if ((o.shade || 1) < 0) u = 1 - u;
        u = 0.1 + u * 0.8;
        sd += "M" + pt(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u) + "h0";
      }
      out += P(sd, 'stroke-width=".9" opacity=".7"');
    }
    out += P(d, o.a || "");
    if (o.rib !== false) out += P("M" + pt(g.S[0]) + curveC(g.S.slice(0, -1)), 'stroke-width=".6"');
    if (o.shade) {
      var Es = o.shade > 0 ? g.R : g.L, h = "", M = o.hn || Math.max(5, Math.round(L / 3.4));
      for (var j = 1; j < M; j++) {
        var s2 = j / M, A = at(g.S, s2 * 0.96), B = at(Es, Math.min(1, s2 + 0.07));
        h += "M" + pt(A) + "L" + pt(A[0] + (B[0] - A[0]) * 0.86, A[1] + (B[1] - A[1]) * 0.86);
      }
      out += P(h, FINE);
    }
    if (o.veins) {
      var Vs = (o.shade || 1) > 0 ? g.L : g.R, v = "", nv = o.veins;
      for (var m = 1; m <= nv; m++) {
        var s3 = m / (nv + 1) * 0.9, A2 = at(g.S, s3), B2 = at(Vs, s3 + 0.12);
        v += "M" + pt(A2) + "Q" + pt(A2[0] + (B2[0] - A2[0]) * 0.5, A2[1] + (B2[1] - A2[1]) * 0.35) + " " + pt(A2[0] + (B2[0] - A2[0]) * 0.8, A2[1] + (B2[1] - A2[1]) * 0.8);
      }
      out += P(v, 'stroke-width=".5" opacity=".7"');
    }
    return out;
  }
  // Tapered limb along spine points (trunk, stem). o.shade: hatch the right side.
  function limb(ps, w0, w1, o) {
    o = o || {};
    var Lp = [], Rp = [], n = ps.length;
    for (var i = 0; i < n; i++) {
      var a = ps[Math.max(0, i - 1)], b = ps[Math.min(n - 1, i + 1)];
      var tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      var w = (w0 + (w1 - w0) * i / (n - 1)) / 2;
      Lp.push([ps[i][0] - ty * w, ps[i][1] + tx * w]); Rp.push([ps[i][0] + ty * w, ps[i][1] - tx * w]);
    }
    var d = "M" + pt(Lp[0]) + curveC(Lp) + "L" + pt(Rp[n - 1]) + curveC(Rp.slice().reverse()) + "Z";
    var out = P(d, 'fill="' + T.bg + '"' + (o.a ? " " + o.a : ""));
    if (o.shade) {
      var h = "", M = o.hn || 14;
      for (var j = 0; j <= M; j++) {
        var s = j / M, A = at(ps, s), B = at(Lp, s); // Lp is the right-hand side when drawn upward
        h += "M" + pt(B) + "L" + pt(A[0] + (B[0] - A[0]) * 0.35, A[1] + (B[1] - A[1]) * 0.35);
      }
      out += P(h, FINE);
    }
    return out;
  }
  function star(cx, cy, r, a) {
    var d = "";
    for (var i = 0; i < 10; i++) {
      var p = polar(cx, cy, i % 2 ? r * 0.42 : r, -PI / 2 + i * PI / 5);
      d += (i ? "L" : "M") + pt(p);
    }
    return P(d + "Z", a || "");
  }

  // Valencia orange: tinted body, contour hatching on the shadow side, oil-gland pores, calyx.
  function orange(cx, cy, r, seed, o) {
    o = o || {};
    var out = C(cx, cy, r, 'fill="' + T.bg + '" stroke="none"') + C(cx, cy, r, tint(T.amber, o.fo || 0.3));
    var hx = cx - r * 0.38, hy = cy - r * 0.42, rings = "";
    var nR = o.rings || 6;
    for (var k = 0; k < nR; k++) rings += C(hx, hy, r * (0.98 + k * 0.1));
    out += clip(C(cx, cy, r), G(rings, FINE));
    if (o.pores !== false) out += stipple(cx, cy, r * 0.92, r * 0.92, Math.round(r * (o.pd || 2.2)), seed, [0.6, 0.7], 'stroke-width=".9" opacity=".65"');
    out += C(cx, cy, r);
    // calyx where the stalk meets the fruit
    var ax = cx + r * 0.12, ay = cy - r * 0.96, cal = "";
    for (var i = 0; i < 5; i++) {
      var p = polar(ax, ay, r * 0.2, -PI / 2 + i * 2 * PI / 5 + 0.3);
      cal += "M" + pt(ax, ay) + "Q" + pt((ax + p[0]) / 2 + 0.3, (ay + p[1]) / 2 - 0.4) + " " + pt(p);
    }
    out += P(cal, HAIR) + C(ax, ay, Math.max(0.8, r * 0.07), 'fill="currentColor"');
    return out;
  }
  // Orange blossom, face on: five thick recurved petals, a crown of stamens.
  function blossom(cx, cy, r, rot, o) {
    o = o || {};
    var out = "";
    for (var i = 0; i < 5; i++) {
      var a = rot + i * 2 * PI / 5;
      out += leaf(cx, cy, a, r, r * 0.62, { k: 0.9, p: 0.6, rib: false, shade: i % 2 ? 1 : 0, hn: 5, bend: 0.06 });
    }
    var st = "";
    for (var j = 0; j < 9; j++) {
      var p = polar(cx, cy, r * 0.36, j * 2 * PI / 9 + rot);
      st += "M" + pt(cx, cy) + "L" + pt(p) + "M" + pt(p) + "h0";
    }
    out += C(cx, cy, r * 0.2, 'fill="' + T.bg + '"') + P(st, 'stroke-width=".6"');
    out += C(cx, cy, r * 0.11, tint(T.sage, 0.8));
    return out;
  }
  function bud(x, y, ang, L) {
    var g = leaf(x, y, ang, L, L * 0.55, { k: 1.1, p: 0.6, rib: false });
    return g + P("M" + pt(x, y) + "l" + pt(Math.cos(ang) * L * 0.25, Math.sin(ang) * L * 0.25), HAIR);
  }

  // Washingtonia fan-palm frond: petiole from crown to hastula, then a costapalmate fan of
  // stiff segments whose free tips droop, with hanging filaments.
  function frond(cx, cy, ang, R, o) {
    o = o || {};
    var p = R * (o.pet || 0.4), ca = Math.cos(ang), sa = Math.sin(ang);
    var ctl = [cx + ca * p * 0.6, cy + sa * p * 0.6];
    var H = [cx + ca * p, cy + sa * p + p * 0.3 * ca * ca];
    var bang = Math.atan2(H[1] - ctl[1], H[0] - ctl[0]);
    var out = P("M" + pt(cx, cy) + "Q" + pt(ctl) + " " + pt(H), o.pa || 'stroke-width=".9"');
    var Rf = R - p, segs = o.segs || 11, spread = o.spread || deg(104), pleat = "", free = "", arc = [], fil = "";
    for (var i = 0; i < segs; i++) {
      var f = i / (segs - 1), t = bang - spread / 2 + spread * f;
      var len = Rf * (0.8 + 0.2 * Math.sin(PI * f));
      var droop = len * (0.06 + 0.5 * (1 + Math.sin(t)) / 2);
      var m = [H[0] + Math.cos(t) * len * 0.5, H[1] + Math.sin(t) * len * 0.5];
      var c1 = [H[0] + Math.cos(t) * len * 0.8, H[1] + Math.sin(t) * len * 0.8];
      var e = [H[0] + Math.cos(t) * len * 0.98, H[1] + Math.sin(t) * len * 0.98 + droop];
      pleat += "M" + pt(H) + "L" + pt(m);
      free += "M" + pt(m) + "Q" + pt(c1) + " " + pt(e);
      arc.push(m);
      if (o.fil !== false && i % 3 === 1) fil += "M" + pt(e) + "q" + pt(0.3, 1.4) + " " + pt(-0.2, Rf * 0.12);
    }
    var fan = "M" + pt(H) + "L" + pt(arc[0]) + curveC(arc) + "Z";
    out += P(fan, 'fill="' + T.bg + '" stroke="none"') + P(fan, tint(T.sage, o.fo != null ? o.fo : 0.14));
    out += P(pleat, 'stroke-width=".45" opacity=".8"') + P(curveC(arc).length ? "M" + pt(arc[0]) + curveC(arc) : "", 'stroke-width=".7"');
    out += P(free, o.sa || 'stroke-width=".6"');
    if (fil) out += P(fil, 'stroke-width=".4" opacity=".6"');
    return out;
  }
  // Whole palm. base (bx,by), crown (tx,ty). o: R (crown radius), w0,w1 trunk widths, n fronds, lean.
  function palm(bx, by, tx, ty, o) {
    o = o || {};
    var R = o.R || 40, rand = rng(o.seed || 3), out = "";
    var mx = (bx + tx) / 2 + (o.lean || 0), my = (by + ty) / 2, spine = [];
    for (var i = 0; i <= 12; i++) {
      var s = i / 12, u = 1 - s;
      spine.push([u * u * bx + 2 * u * s * mx + s * s * tx, u * u * by + 2 * u * s * my + s * s * ty]);
    }
    var w0 = o.w0 || R * 0.18, w1 = o.w1 || R * 0.11;
    out += limb(spine, w0, w1, { shade: true, hn: Math.round((by - ty) / 5) });
    // leaf-scar rings
    var rings = "", h = by - ty, step = o.ringStep || 3.4;
    for (var y = step; y < h * 0.86; y += step + rand() * 1.2) {
      var s2 = y / h, c = at(spine, s2), w = (w0 + (w1 - w0) * s2) / 2;
      rings += "M" + pt(c[0] - w, c[1]) + "q" + pt(w, 1.1) + " " + pt(w * 2, -0.2);
    }
    out += P(rings, 'stroke-width=".5" opacity=".75"');
    // the dead-frond "petticoat"
    var sk = o.skirt || h * 0.2, sw = R * 0.36, bw = w1 * 1.3, K = Math.round(sw / (o.skDen || 1.5)), sd = "";
    var skL = [], skR = [];
    for (var j = 0; j <= K; j++) {
      var f = j / K, xt = tx - sw / 2 + sw * f, yb = ty + sk * (0.78 + 0.22 * rand());
      var xb = tx + (f - 0.5) * bw * 1.6 + (rand() - 0.5) * 1.2;
      sd += "M" + pt(xt, ty + 1) + "Q" + pt(xt + (f - 0.5) * sw * 0.5, ty + sk * 0.5) + " " + pt(xb, yb);
    }
    var skin = "M" + pt(tx - sw / 2, ty + 1) + "Q" + pt(tx - sw * 0.75, ty + sk * 0.5) + " " + pt(tx - bw * 0.8, ty + sk) +
      "L" + pt(tx + bw * 0.8, ty + sk) + "Q" + pt(tx + sw * 0.75, ty + sk * 0.5) + " " + pt(tx + sw / 2, ty + 1) + "Z";
    out += P(skin, 'fill="' + T.bg + '" stroke="none"') + P(sd, 'stroke-width=".5"');
    // crown
    var angs = o.angs || [-90, -62, -118, -36, -144, -12, -168, 18, 162];
    var fr = "";
    for (var k = 0; k < angs.length; k++) {
      var a = deg(angs[k] + (rand() - 0.5) * 8);
      fr += frond(tx, ty, a, R * (0.8 + rand() * 0.26), { segs: o.segs, fil: o.fil, pet: o.pet, spread: deg(70 + rand() * 55) });
    }
    out += fr + C(tx, ty, Math.max(1, R * 0.04), 'fill="currentColor"');
    return out;
  }

  // Salvia apiana: rosette of pale stippled leaves, arching wands of whorled flowers.
  function sage(x, y, s, seed) {
    var R = rng(seed || 11), out = "", stalks = "", whorls = "";
    var specs = [[-0.32, 118], [0.05, 132], [0.38, 100]];
    for (var i = 0; i < specs.length; i++) {
      var lean = specs[i][0], hgt = specs[i][1] * s, base = [x + (i - 1) * 3 * s, y - 6 * s];
      var top = [base[0] + lean * hgt * 0.55, base[1] - hgt], mid = [base[0] + lean * hgt * 0.12, base[1] - hgt * 0.55];
      var pts = [base, mid, top];
      stalks += P("M" + pt(base) + "Q" + pt(mid) + " " + pt(top), 'stroke-width=".9"');
      for (var t = 0.42; t < 1.0; t += 0.09 + R() * 0.02) {
        var u = 1 - t, c = [u * u * base[0] + 2 * u * t * mid[0] + t * t * top[0], u * u * base[1] + 2 * u * t * mid[1] + t * t * top[1]];
        var size = (6 - t * 3.4) * s, wd = "", dirc = -PI / 2 + lean * 0.5;
        whorls += leaf(c[0], c[1], dirc - 1.05 - R() * 0.2, size, size * 0.5, { rib: false, fill: T.sage, fo: 0.5, k: 0.7 });
        whorls += leaf(c[0], c[1], dirc + 1.05 + R() * 0.2, size, size * 0.5, { rib: false, fill: T.sage, fo: 0.5, k: 0.7 });
        for (var f = 0; f < 4; f++) {
          var e = polar(c[0], c[1], size * (0.55 + R() * 0.25), dirc + (f - 1.5) * 0.9 + PI * (f % 2 ? 0 : 0));
          wd += "M" + pt(e) + "h0";
        }
        whorls += P(wd, 'stroke-width="1.3" opacity=".8"');
      }
      void pts;
    }
    out += stalks + whorls;
    var la = [-164, -148, -130, -114, -100, -86, -70, -54, -36, -18];
    for (var j = 0; j < la.length; j++) {
      var L = (34 + R() * 14) * s * (j === 0 || j === la.length - 1 ? 0.8 : 1);
      var A = deg(la[j] + (R() - 0.5) * 6);
      out += leaf(x + Math.cos(A) * 2, y, A, L, 8.5 * s, { k: 0.85, bend: (A < -PI / 2 ? -0.1 : 0.1), fill: T.sage, fo: 0.32, stip: Math.round(L * 0.9), seed: j + 3, shade: A < -PI / 2 ? -1 : 1, hn: 0 });
    }
    return out;
  }

  // Strelitzia reginae: paddle leaves on long petioles; crane-head flower.
  function strelitzia(x, y, s) {
    var out = "";
    var leaves = [[-118, 70, 46, 15], [-72, 82, 50, 16], [-98, 92, 44, 14], [-50, 52, 40, 13]];
    for (var i = 0; i < leaves.length; i++) {
      var a = deg(leaves[i][0]), pl = leaves[i][1] * s, bl = leaves[i][2] * s, bw = leaves[i][3] * s;
      var bx = x + Math.cos(a) * pl * 0.7, by = y + Math.sin(a) * pl;
      out += P("M" + pt(x + (i - 1.5) * 2 * s, y) + "Q" + pt(x + Math.cos(a) * pl * 0.2, y - pl * 0.6) + " " + pt(bx, by), 'stroke-width=".9"');
      out += leaf(bx, by, a + (a < -PI / 2 ? -0.12 : 0.12), bl, bw, { k: 0.95, p: 0.55, bend: a < -PI / 2 ? 0.08 : -0.08, shade: a < -PI / 2 ? -1 : 1, veins: 6, blunt: true });
    }
    // flower stalk and spathe
    var sx = x + 6 * s, sy = y - 98 * s;
    out += P("M" + pt(x + 2 * s, y) + "Q" + pt(x + 6 * s, y - 60 * s) + " " + pt(sx, sy), 'stroke-width="1"');
    var sepal = [-118, -100, -82], so = [sx + 13 * s, sy - 3 * s];
    for (var j = 0; j < sepal.length; j++) out += leaf(so[0], so[1], deg(sepal[j]), (27 - j * 2.5) * s, 5.8 * s, { k: 0.45, p: 0.9, bend: -0.14, fill: T.amber, fo: 0.5, shade: 1, hn: 6 });
    out += leaf(so[0] + 3 * s, so[1] + 0.5 * s, deg(-24), 22 * s, 4.2 * s, { k: 0.4, bend: -0.12, fill: T.green, fo: 0.4 });
    out += leaf(sx - 4 * s, sy + 1.5 * s, deg(-7), 44 * s, 8.5 * s, { k: 0.38, p: 1.1, bend: 0.05, fill: T.green, fo: 0.16, shade: 1, hn: 11 });
    return out;
  }

  // Scallop shell (Pecten), hinge at bottom (hx,hy), fan radius R.
  function scallop(hx, hy, R, o) {
    o = o || {};
    var n = o.ribs || 15, a0 = deg(-160), a1 = deg(-20), edge = [], ribs = "", sh = "";
    var tips = [];
    for (var i = 0; i <= n * 2; i++) {
      var f = i / (n * 2), a = a0 + (a1 - a0) * f, rr = R * (i % 2 ? 0.93 : 1.0) * (0.9 + 0.1 * Math.sin(PI * f));
      var p = polar(hx, hy, rr, a);
      edge.push(p);
      if (i % 2 === 1) tips.push([a, rr]);
    }
    var ear = R * 0.36;
    var outline = "M" + pt(hx, hy) + "L" + pt(hx - ear, hy - R * 0.05) + "L" + pt(hx - ear * 0.95, hy - R * 0.2) + "L" + pt(edge[0]) + curveC(edge) +
      "L" + pt(hx + ear * 0.95, hy - R * 0.2) + "L" + pt(hx + ear, hy - R * 0.05) + "Z";
    for (var j = 0; j <= n; j++) {
      var p2 = edge[j * 2];
      ribs += "M" + pt(hx, hy - R * 0.04) + "L" + pt(p2);
      if (j < n && j % 1 === 0) {
        // shading on the right flank of each rib
        var a2 = a0 + (a1 - a0) * (j * 2 + 1) / (n * 2), q = polar(hx, hy, R * 0.9, a2 - 0.03), q0 = polar(hx, hy, R * 0.3, a2 - 0.01);
        sh += "M" + pt(q0) + "L" + pt(q);
      }
    }
    var growth = "";
    var gr = o.growth || [0.34, 0.55, 0.74];
    for (var g = 0; g < gr.length; g++) {
      var gp = [];
      for (var k = 0; k <= 12; k++) gp.push(polar(hx, hy, R * gr[g] * (1 + 0.012 * (k % 2)), a0 + (a1 - a0) * k / 12));
      growth += curve(gp);
    }
    var out = P(outline, 'fill="' + T.bg + '"') + P(outline, tint(T.amber, o.fo || 0.14));
    out += clip(P(outline), P(ribs, 'stroke-width=".6"') + P(sh, FINE) + P(growth, 'stroke-width=".5" opacity=".7"'));
    out += P(outline, o.a || "");
    // ear ridges
    out += P("M" + pt(hx - ear * 0.6, hy - R * 0.03) + "l" + pt(-0.6, -R * 0.14) + "M" + pt(hx + ear * 0.6, hy - R * 0.03) + "l" + pt(0.6, -R * 0.14), FINE);
    return out;
  }
  function waves(x0, x1, y, amp, len, a) {
    var d = "M" + pt(x0, y);
    for (var x = x0; x < x1 - 0.1; x += len) {
      var e = Math.min(len, x1 - x);
      d += "q" + pt(e / 4, -amp) + " " + pt(e / 2, 0) + "t" + pt(e / 2, 0);
    }
    return P(d, a || "");
  }
  function sprig(x, y, L, ang, s, seed) {
    var R = rng(seed || 5), ca = Math.cos(ang), sa = Math.sin(ang), out = "";
    var spine = [];
    for (var i = 0; i <= 6; i++) { var f = i / 6; spine.push([x + ca * L * f + Math.sin(f * 3) * 1.5 * s, y + sa * L * f]); }
    out += P(curve(spine), 'stroke-width="1"');
    for (var j = 1; j <= 4; j++) {
      var f2 = j / 5.2, b = at(spine, f2), side = j % 2 ? 1 : -1;
      out += leaf(b[0], b[1], ang + side * 0.8, (13 - j * 1.6) * s, 5.5 * s, { k: 0.8, shade: side, hn: 5, bend: -side * 0.08 });
    }
    out += leaf(spine[6][0], spine[6][1], ang, 9 * s, 4.5 * s, { k: 0.8, hn: 4, shade: 1 });
    void R;
    return out;
  }

  /* ---------- root wrapper ---------- */
  function opt(o) { return typeof o === "string" ? { label: o } : (o && typeof o === "object" ? o : {}); }
  function svg(vw, vh, defW, body, o, cls, extra) {
    o = opt(o);
    var w = o.size != null ? o.size : defW, h;
    if (typeof w === "number") h = r1(w * vh / vw);
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vw + " " + vh + '"' +
      (w != null ? ' width="' + w + '"' : "") + (h != null ? ' height="' + h + '"' : "") +
      ' class="illus ' + cls + (o.class ? " " + esc(o.class) : "") + '" fill="none" stroke="currentColor" stroke-width="' + (o.stroke || 1) +
      '" stroke-linecap="round" stroke-linejoin="round"' + (extra || "") +
      (o.label ? ' role="img" aria-label="' + esc(o.label) + '"' : ' aria-hidden="true" focusable="false"') + ">";
    return s + body + "</svg>";
  }
  function safe(fn, fallback) {
    return function () {
      try { return fn.apply(null, arguments); } catch (e) { try { return fallback ? fallback() : ""; } catch (e2) { return ""; } }
    };
  }
  if (typeof document !== "undefined" && document.head && !document.getElementById("illus-css")) {
    var st = document.createElement("style");
    st.id = "illus-css";
    st.textContent = "svg.illus{display:inline-block;vertical-align:middle;flex:none}svg.illus *{vector-effect:non-scaling-stroke}svg.illus text{vector-effect:none}svg.illus-hero{display:block;height:auto}";
    document.head.appendChild(st);
  }

  /* ---------- hero ---------- */
  var heroCache = null;
  function heroBody() {
    if (heroCache) return heroCache;
    var out = "", R = rng(2027);
    // the sea: horizon, Catalina on the horizon, engraved swell lines thinning toward the title side
    var hz = 168, sea = "";
    out += P("M470 " + hz + "H1200", 'stroke-width=".6" opacity=".55"');
    for (var x = 300; x < 470; x += 9) sea += "M" + x + " " + hz + "h" + r1(2 + (x - 300) / 30);
    out += P(sea, 'stroke-width=".6" opacity=".4"');
    var cat = "M500 " + hz + "C512 164 520 163.5 528 160.5S544 159 552 162S566 160 578 164S592 167 600 " + hz;
    out += P(cat, 'fill="' + T.bg + '" stroke-width=".6" opacity=".7"');
    var catH = "";
    for (var cx = 530; cx < 596; cx += 3) catH += "M" + cx + " " + (hz - 0.4) + "l" + r1(-1.3) + " " + r1(-(cx < 560 ? 4 : 3) * (0.6 + 0.4 * Math.sin((cx - 530) / 9))) ;
    out += P(catH, 'stroke-width=".45" opacity=".5"');
    // Palos Verdes headland, right, behind the plants
    var pv = "M1040 " + hz + "C1060 158 1080 150 1102 147C1126 144 1150 148 1170 152C1185 155 1194 158 1200 159";
    out += P(pv + "V" + hz + "Z", 'fill="' + T.bg + '" stroke="none"') + P(pv, 'stroke-width=".7" opacity=".7"');
    var pvh = "";
    for (var hx = 1050; hx < 1200; hx += 3.2) {
      var top = hx < 1102 ? hz - (hx - 1040) * 0.4 + 2 : 149 + (hx - 1102) * 0.11;
      var len = (hz - top) * (0.3 + 0.35 * R());
      pvh += "M" + r1(hx) + " " + r1(top + 1.5) + "l" + r1(len * 0.5) + " " + r1(len);
    }
    out += P(pvh, 'stroke-width=".45" opacity=".5"');
    var sw = "";
    for (var row = 0; row < 11; row++) {
      var y = hz + 3 + row * (2.1 + row * 0.35), xs = 470 - row * 6 + R() * 20;
      var xEnd = 1200;
      for (var x2 = xs; x2 < xEnd;) {
        var L = 8 + R() * (30 + row * 6), gap = 3 + R() * (10 + row);
        var fade = Math.min(1, (x2 - 300) / 360);
        if (R() < fade) sw += "M" + r1(x2) + " " + r1(y + (R() - 0.5) * 0.6) + "h" + r1(Math.min(L, xEnd - x2));
        x2 += L + gap;
      }
    }
    out += P(sw, 'stroke-width=".5" opacity=".55"');
    // shoreline with foam scallops
    var shore = "M470 220C520 213 600 206 700 204S820 202 900 205S1060 210 1200 206";
    out += P(shore + "V220Z", 'fill="' + T.bg + '" stroke="none"') + P(shore, 'stroke-width=".8"');
    var foam = "";
    for (var fx = 600; fx < 1190; fx += 14 + R() * 10) {
      var fy = fx < 700 ? 214 - (fx - 600) * 0.1 : fx < 900 ? 203.2 + Math.sin(fx / 40) * 0.6 : 205 + (fx - 900) * 0.02;
      foam += "M" + r1(fx) + " " + r1(fy - 2.2) + "q4 -2.2 8 0";
    }
    out += P(foam, 'stroke-width=".5" opacity=".6"');
    out += stipple(900, 214, 300, 6, 160, 9, [0, 1], 'stroke-width=".9" opacity=".45"');

    // white sage, far left of the planting
    out += G(sage(646, 212, 1.12, 21));
    // tall Washingtonia robusta and its shorter companion
    out += palm(818, 226, 836, 58, { R: 46, w0: 8.5, w1: 5.2, lean: 6, seed: 4, skirt: 30 });
    out += palm(892, 226, 914, 96, { R: 36, w0: 7, w1: 4.4, lean: -4, seed: 9, skirt: 20, angs: [-84, -50, -116, -20, -150, 14, 168] });
    // bird-of-paradise
    out += strelitzia(990, 224, 1.08);
    // orange branch entering from the upper right corner
    var ob = "";
    var br = [[1206, 4], [1176, 16], [1148, 32], [1118, 44], [1090, 50], [1066, 52]];
    ob += limb(br, 4.2, 1.6, { shade: true, hn: 18 });
    var twig = [[1150, 31], [1158, 46], [1160, 58]];
    ob += P(curve(twig), 'stroke-width=".9"');
    var lv = [
      [1180, 14, -150, 34, 13, 1], [1166, 22, -80, 30, 12, -1], [1140, 36, 160, 32, 12, -1],
      [1128, 40, -112, 28, 11, 1], [1104, 47, 130, 30, 11, 1], [1096, 49, -150, 26, 10, -1],
      [1072, 51, -170, 22, 9, 1], [1192, 9, 110, 30, 12, 1]
    ];
    for (var i = 0; i < lv.length; i++) {
      var q = lv[i];
      ob += leaf(q[0], q[1], deg(q[2]), q[3], q[4], { k: 0.8, p: 0.75, bend: q[5] * 0.08, shade: q[5], veins: 5, fill: T.green, fo: 0.08 });
    }
    ob += orange(1161, 74, 17, 31, {});
    ob += P("M1118 44Q1121 52 1121 55", 'stroke-width=".9"');
    ob += orange(1121, 68, 13.5, 32, { rings: 5 });
    ob += blossom(1064, 60, 13, 0.4);
    ob += bud(1090, 50, deg(70), 9) + bud(1086, 50, deg(115), 7);
    out += G(ob, 'transform="translate(0 13)"');
    heroCache = out;
    return out;
  }
  I.hero = safe(function (o) {
    o = opt(o);
    var par = o.fit === "slice" ? "xMaxYMax slice" : "xMaxYMax meet";
    return svg(1200, 220, o.size != null ? o.size : "100%", heroBody(), Object.assign({}, o, { size: o.size != null ? o.size : "100%" }), "illus-hero", ' preserveAspectRatio="' + par + '"');
  });

  /* ---------- regions ---------- */
  var REGIONS = {
    la: function () {
      return P("M12 59.5H52", HAIR) + stipple(32, 60.5, 18, 1.4, 18, 4, null, 'stroke-width=".9" opacity=".5"') +
        palm(30, 60, 33, 21, { R: 22, w0: 5, w1: 3.2, lean: 2.5, seed: 6, skirt: 8, segs: 8, fil: false, ringStep: 3, skDen: 1.6, angs: [-88, -50, -128, -16, -164, 14, 166] });
    },
    lb: function () {
      return scallop(32, 46, 27, { ribs: 11, growth: [0.4, 0.68] }) +
        waves(10, 54, 52.5, 1.8, 8, 'stroke-width=".9"') + waves(14, 50, 56.5, 1.4, 8, HAIR) + waves(20, 44, 60, 1, 8, FINE);
    },
    oc: function () {
      var out = P("M5 12Q20 16 30 24T47 39", 'stroke-width="1.4"');
      out += P("M30 24Q31 28 29.5 30.5", HAIR);
      out += leaf(17, 15, deg(-60), 14, 7.5, { shade: 1, k: 0.8, hn: 6, veins: 3, fill: T.green, fo: 0.08 });
      out += leaf(40, 32, deg(-40), 18, 8.5, { shade: -1, k: 0.8, hn: 6, veins: 3, bend: 0.1, fill: T.green, fo: 0.08 });
      out += leaf(24, 20, deg(-118), 15, 7, { shade: -1, k: 0.8, hn: 5, veins: 3, bend: -0.1, fill: T.green, fo: 0.08 });
      out += orange(28, 43, 12.5, 17, { rings: 5, pd: 1.6 });
      out += blossom(49, 46, 7.5, 0.5);
      return out;
    },
    other: function () { return sprig(29, 60, 40, deg(-84), 1.3, 3); }
  };
  function regionKey(name) {
    var n = String(name == null ? "" : name).toLowerCase();
    if (/long\s*beach|^lb$|belmont|naples|signal hill|bixby/.test(n)) return "lb";
    if (/orange|^oc$|irvine|anaheim|santa ana|costa mesa|huntington|newport|fullerton|tustin|garden grove|laguna/.test(n)) return "oc";
    if (/los\s*angeles|^la$|l\.a\.|hollywood|koreatown|pasadena|glendale|burbank|santa monica|culver|downtown|silver lake|echo park|mid.?city|westwood|valley/.test(n)) return "la";
    return "other";
  }
  var regionCache = {};
  I.region = safe(function (name, o) {
    var k = regionKey(name);
    if (!regionCache[k]) regionCache[k] = REGIONS[k]();
    return svg(64, 64, 64, regionCache[k], o, "illus-region illus-region-" + k);
  });

  /* ---------- small icons (24 grid) ---------- */
  var REQ = {
    wd: P("M4 2.5h16a1.5 1.5 0 0 1 1.5 1.5v16.5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V4A1.5 1.5 0 0 1 4 2.5zM2.5 7h19") +
      C(5.5, 4.8, 0.55, 'fill="currentColor" stroke="none"') + C(7.6, 4.8, 0.55, 'fill="currentColor" stroke="none"') + P("M14 4.8h4.5") +
      C(12, 14.2, 5.4) + C(12, 14.2, 3.6, 'stroke-width=".8"') + P("M8.6 15c1.1-.9 2.3-.9 3.4 0s2.3.9 3.4 0V17a3.6 3.6 0 0 1-6.8 0z", tint(T.sage, 0.7)) + P("M8.6 15c1.1-.9 2.3-.9 3.4 0s2.3.9 3.4 0", 'stroke-width=".8"'),
    ac: (function () {
      var d = "";
      for (var i = 0; i < 6; i++) {
        var a = -PI / 2 + i * PI / 3, e = polar(12, 12, 9.5, a), m = polar(12, 12, 6, a);
        d += "M" + pt(polar(12, 12, 2.4, a)) + "L" + pt(e) + "M" + pt(m) + "L" + pt(polar(m[0], m[1], 2.6, a - 0.75)) + "M" + pt(m) + "L" + pt(polar(m[0], m[1], 2.6, a + 0.75));
      }
      var hx = "";
      for (var j = 0; j < 6; j++) hx += (j ? "L" : "M") + pt(polar(12, 12, 2.4, -PI / 2 + j * PI / 3));
      return P(d) + P(hx + "Z", tint(T.sage, 0.6)) + P(hx + "Z", 'stroke-width=".8"');
    })(),
    dw: C(8.6, 10.6, 6, 'fill="' + T.bg + '"') + C(8.6, 10.6, 4, 'stroke-width=".7"') + C(15.2, 11.4, 5.6, 'fill="' + T.bg + '"') + C(15.2, 11.4, 3.7, 'stroke-width=".7"') +
      P("M13.2 9.6a2.3 2.3 0 0 1 2-1.3", 'stroke-width=".7"') + P("M2.5 18.5h19M4.5 18.5V21M19.5 18.5V21M6 18.5v-2M11 18.5v-2M18 18.5v-2", 'stroke-width="1.1"') + P("M20.6 2.4v2.6M19.3 3.7h2.6", 'stroke-width=".8"'),
    parking: P("M5.5 2.5h13a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3v-13a3 3 0 0 1 3-3z") + P("M4.5 4.5h15v15h-15z", 'stroke-width=".5" opacity=".6"') +
      P("M9.5 17V7h3.4a3 3 0 0 1 0 6H9.5", 'stroke-width="1.6"'),
    packages: P("M12 2.8l8.5 4.3v9.8L12 21.2l-8.5-4.3V7.1z") + P("M3.5 7.1L12 11.4l8.5-4.3M12 11.4v9.8") + P("M7.7 4.9l8.6 4.4v3.8", 'stroke-width="1.2"') +
      P("M12 11.4l8.5-4.3v9.8L12 21.2z", tint(T.amber, 0.22)) + P("M14.2 15.6l3.6-1.8M14.2 17.4l2.4-1.2", 'stroke-width=".7"')
  };
  var FACT = {
    drive: P("M3.5 21.5L10.4 5M20.5 21.5L13.6 5M7 5h10") + P("M12 20.5v-3M12 14.5v-2.2M12 10v-1.5M12 7.2v-.8", 'stroke-width="1.3"') ,
    coffee: P("M5 9.5h11.5v4.5a5.5 5.5 0 0 1-5.5 5.5h-.5A5.5 5.5 0 0 1 5 14z") + P("M5 12h11.5v2a5.5 5.5 0 0 1-5.5 5.5h-.5A5.5 5.5 0 0 1 5 14z", tint(T.amber, 0.3)) +
      P("M16.5 11h1.2a2.3 2.3 0 0 1 0 4.6h-1.5M3 21.3h15.5") + P("M9 7.5c-1-1.2 1-2 0-3.2s1-2 0-3M12.5 7.5c-1-1.2 1-2 0-3.2s1-2 0-3", 'stroke-width=".8"'),
    quiet: P("M15.8 3.4A8.8 8.8 0 1 0 20.6 17a7.2 7.2 0 0 1-4.8-13.6z") + P("M15.8 3.4A8.8 8.8 0 0 0 9 8a8 8 0 0 1 7.6-4.3z", tint(T.sage, 0.5)) +
      star(19, 7.2, 2.2, 'stroke-width=".8"') + P("M21.5 12.2h0M17 2.5h0", 'stroke-width="1.4"'),
    safety: P("M12 2.6l7.8 2.9v6.2c0 4.7-3.3 8.1-7.8 9.7-4.5-1.6-7.8-5-7.8-9.7V5.5z") + P("M12 4.6l6 2.2v4.9c0 3.6-2.5 6.3-6 7.6", 'stroke-width=".6" opacity=".7"') +
      C(12, 10.6, 1.8) + P("M11.2 12.2l-.7 3.6h3l-.7-3.6", tint(T.green, 0.6)) + P("M11.2 12.2l-.7 3.6h3l-.7-3.6"),
    lax: P("M12 2.3c1 0 1.5 1.1 1.5 2.5v4.6l7.7 4.5v2l-7.7-2.5v4.4l2.3 1.8v1.6L12 20.2l-3.8 1V19.6l2.3-1.8v-4.4l-7.7 2.5v-2l7.7-4.5V4.8c0-1.4.5-2.5 1.5-2.5z") +
      P("M12 4.5v12", 'stroke-width=".6" opacity=".7"'),
    extras: C(12, 2.6, 1.1) + P("M8 7.2h8L14.4 4.3H9.6z") + P("M8.6 7.2h6.8v10H8.6z") + P("M10.6 7.2v10M13.4 7.2v10", 'stroke-width=".6" opacity=".7"') +
      P("M12 15.5c-1.6-1-1.3-3.1 0-4.8 1.3 1.7 1.6 3.8 0 4.8z", tint(T.amber, 0.75)) + P("M12 15.5c-1.6-1-1.3-3.1 0-4.8 1.3 1.7 1.6 3.8 0 4.8z", 'stroke-width=".8"') + P("M7.4 17.2h9.2l-1.1 3.5H8.5z"),
    rep: P("M20.6 2.8C13.5 3.6 8.8 8.6 7.3 16.3l2.2-.3c5.2-2 9.2-6.7 11.1-13.2z") + P("M3.6 21l9.7-11.2", 'stroke-width="1.1"') +
      P("M10.2 12.5l-1.7.1M12.5 9.8l-1.4-.4M14.9 7.3l-1.1-.6M17.2 5.1l-.9-.7M11 13.8l1.6.5M13.4 11.5l1.6.2M15.8 8.9l1.5-.1", 'stroke-width=".6"') +
      star(18, 17.6, 3.4, tint(T.amber, 0.55)) + star(18, 17.6, 3.4, 'stroke-width=".9"')
  };
  var GENERIC = (function () {
    return P("M12 21.5V10") + leaf(12, 16, deg(-140), 7.5, 3.6, { hn: 0, rib: true, bg: false }) + leaf(12, 13, deg(-40), 7.5, 3.6, { hn: 0, bg: false }) +
      leaf(12, 10, deg(-90), 8, 4, { bg: false, shade: 1, hn: 4 });
  })();
  var REQ_ALIAS = { washer: "wd", laundry: "wd", "w/d": "wd", "washer/dryer": "wd", dryer: "wd", air: "ac", aircon: "ac", "a/c": "ac", cooling: "ac",
    dishwasher: "dw", dishes: "dw", park: "parking", garage: "parking", car: "parking", package: "packages", parcel: "packages", parcels: "packages", lockers: "packages" };
  var FACT_ALIAS = { commute: "drive", road: "drive", cafe: "coffee", cafes: "coffee", noise: "quiet", calm: "quiet", crime: "safety", safe: "safety",
    airport: "lax", plane: "lax", flight: "lax", amenities: "extras", amenity: "extras", gym: "extras", reputation: "rep", reviews: "rep", review: "rep" };
  function icon(set, alias, key, o, cls) {
    var k = String(key == null ? "" : key).toLowerCase().trim();
    k = set[k] ? k : alias[k] || "";
    var body = set[k] || GENERIC;
    o = opt(o);
    return svg(24, 24, 20, body, Object.assign({ stroke: 1.25 }, o), cls + " illus-" + (k || "generic"));
  }
  I.req = safe(function (key, o) { return icon(REQ, REQ_ALIAS, key, o, "illus-icon illus-req"); });
  I.factor = safe(function (key, o) { return icon(FACT, FACT_ALIAS, key, o, "illus-icon illus-factor"); });

  /* ---------- seal ---------- */
  var MONO = "var(--mono, 'Geist Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace)";
  I.seal = safe(function (text, o) {
    o = opt(o);
    var t = String(text == null || text === "" ? "Meets everything" : text).toUpperCase();
    var id = uid("s"), id2 = uid("s"), r = 37.2, out = "";
    out += C(50, 50, 48.2, 'stroke-width="1.2"') + C(50, 50, 46.2, 'stroke-width=".6"');
    var beads = "";
    for (var i = 0; i < 72; i++) beads += "M" + pt(polar(50, 50, 44.6, i * PI / 36)) + "h0";
    out += P(beads, 'stroke-width="1" opacity=".75"');
    out += C(50, 50, 30.4, 'stroke-width=".6"') + C(50, 50, 28.6, 'stroke-width="1.1"');
    var a0 = deg(200), a1 = deg(-20);
    var s = polar(50, 50, r, -a0 + 2 * PI), e = polar(50, 50, r, -a1);
    // top arc: left -> over the top -> right
    s = [50 + r * Math.cos(a0), 50 - r * Math.sin(a0)];
    e = [50 + r * Math.cos(a1), 50 - r * Math.sin(a1)];
    var arcLen = r * (a0 - a1), fs = Math.min(8.4, arcLen / (t.length * 0.78));
    out += '<path id="' + id + '" d="M' + pt(s) + "A" + r + " " + r + " 0 1 1 " + pt(e) + '" stroke="none"/>';
    out += '<text fill="currentColor" stroke="none" font-family="' + MONO + '" font-size="' + r1(fs) + '" letter-spacing="' + r1(fs * 0.16) + '" font-weight="500">' +
      '<textPath href="#' + id + '" startOffset="50%" text-anchor="middle" dominant-baseline="central">' + esc(t) + "</textPath></text>";
    // lower arc: optional sub text, else three stars
    if (o.sub) {
      var rb = r, sb = [50 - rb * 0.94, 50 + rb * 0.34], eb = [50 + rb * 0.94, 50 + rb * 0.34];
      out += '<path id="' + id2 + '" d="M' + pt(sb) + "A" + rb + " " + rb + " 0 0 0 " + pt(eb) + '" stroke="none"/>';
      out += '<text fill="currentColor" stroke="none" font-family="' + MONO + '" font-size="6.4" letter-spacing="1.2">' +
        '<textPath href="#' + id2 + '" startOffset="50%" text-anchor="middle" dominant-baseline="central">' + esc(String(o.sub).toUpperCase()) + "</textPath></text>";
    } else {
      for (var k = -1; k <= 1; k++) {
        var p = polar(50, 50, r, PI / 2 + k * 0.42);
        out += star(p[0], p[1], k ? 2.6 : 3.4, 'fill="currentColor" stroke="none"');
      }
    }
    // centre: a check mark in a laurel
    var laurel = "";
    for (var side = -1; side <= 1; side += 2) {
      var stem = [];
      for (var j = 0; j <= 6; j++) { var aa = PI / 2 + side * (0.35 + j * 0.33); stem.push(polar(50, 51, 21, aa)); }
      laurel += P(curve(stem), HAIR);
      for (var m = 1; m <= 5; m++) {
        var b = at(stem, m / 6.2), ang = Math.atan2(b[1] - 51, b[0] - 50);
        laurel += leaf(b[0], b[1], ang + side * 1.25 - (side > 0 ? 0 : 0), 6.2, 2.7, { rib: false, bg: false, fill: T.sage, fo: 0.45, k: 0.8 });
        laurel += leaf(b[0], b[1], ang + PI - side * 0.35, 5.2, 2.3, { rib: false, bg: false, fill: T.sage, fo: 0.45, k: 0.8 });
      }
    }
    out += laurel;
    out += P("M39.5 50.5l7 7.2 14.5-16", 'stroke="' + (o.tint ? T[o.tint] || o.tint : T.green) + '" stroke-width="2.6"');
    return svg(100, 100, 96, G(out, o.rotate ? 'transform="rotate(' + (+o.rotate || 0) + ' 50 50)"' : ""), o, "illus-seal");
  });

  /* ---------- ornament ---------- */
  var ornCache = null;
  I.ornament = safe(function (o) {
    if (!ornCache) {
      var out = "", cx = 160, cy = 10;
      out += P("M" + (cx - 7) + " " + cy + "L" + cx + " " + (cy - 5) + "L" + (cx + 7) + " " + cy + "L" + cx + " " + (cy + 5) + "Z", 'fill="' + T.bg + '"');
      out += P("M" + (cx - 3.4) + " " + cy + "L" + cx + " " + (cy - 2.4) + "L" + (cx + 3.4) + " " + cy + "L" + cx + " " + (cy + 2.4) + "Z", tint(T.amber, 0.7));
      for (var s = -1; s <= 1; s += 2) {
        var x0 = cx + s * 8;
        out += P("M" + x0 + " " + cy + "C" + (x0 + s * 14) + " " + (cy - 7) + " " + (x0 + s * 26) + " " + (cy + 6) + " " + (x0 + s * 40) + " " + cy +
          "S" + (x0 + s * 70) + " " + (cy - 1) + " " + (x0 + s * 140) + " " + cy, 'stroke-width=".9"');
        out += P("M" + (x0 + s * 40) + " " + cy + "c" + s * 4 + " -3 " + s * 9 + " -3 " + s * 10 + " 0s" + (-s * 3) + " 3 " + (-s * 5) + " 0", 'stroke-width=".7"');
        out += leaf(x0 + s * 7, cy - 1.2, s > 0 ? deg(-35) : deg(-145), 11, 4.4, { rib: true, shade: s, hn: 4, bg: false, fill: T.sage, fo: 0.4 });
        out += leaf(x0 + s * 20, cy + 2, s > 0 ? deg(25) : deg(155), 10, 4, { rib: true, shade: -s, hn: 3, bg: false, fill: T.sage, fo: 0.4 });
        out += leaf(x0 + s * 31, cy - 1.2, s > 0 ? deg(-30) : deg(-150), 8, 3.2, { rib: false, bg: false, fill: T.sage, fo: 0.4 });
        out += P("M" + (x0 + s * 146) + " " + cy + "h0", 'stroke-width="2.2"');
      }
      ornCache = out;
    }
    return svg(320, 20, 320, ornCache, o, "illus-ornament");
  });

  /* ---------- jars ---------- */
  // Jar geometry on a 36x48 grid: knob, lid, neck with label collar, shouldered body.
  var JAR_BODY = "M11 14.5C6.5 15.5 4.5 18.5 4.5 23V40.5C4.5 43 6 44.5 8.5 44.5H27.5C30 44.5 31.5 43 31.5 40.5V23C31.5 18.5 29.5 15.5 25 14.5Z";
  var JAR_IN = "M11.6 16C8 17 6.2 19.4 6.2 23.2V40.2C6.2 41.9 7.2 42.9 8.9 42.9H27.1C28.8 42.9 29.8 41.9 29.8 40.2V23.2C29.8 19.4 28 17 24.4 16Z";
  I.jar = safe(function (fill, o) {
    o = opt(o);
    var v = fill == null || fill === "" || isNaN(+fill) ? null : Math.max(0, Math.min(1, +fill));
    var out = "", top = 18.5, bot = 42.9;
    out += P(JAR_BODY, 'fill="' + T.bg + '"');
    if (v != null && v > 0) {
      var y = bot - (bot - top) * v, col = o.tint ? (T[o.tint] || o.tint) : T.amber;
      var liquid = "M2 " + r1(y) + "q4.5 -1 9 0t9 0 9 0 9 0V48H2Z";
      out += clip(P(JAR_IN), P(liquid, 'fill="' + col + '" fill-opacity=".5" stroke="none"') +
        P("M2 " + r1(y) + "q4.5 -1 9 0t9 0 9 0 9 0", 'stroke="' + col + '" stroke-width="1.1"') +
        stipple(18, (y + bot) / 2, 11, (bot - y) / 2, Math.round(v * 9), 4, null, 'stroke="' + col + '" stroke-width=".8" opacity=".6"'));
    } else if (v === 0) {
      out += P("M6.8 " + bot + "H29.2", 'stroke-width=".9" opacity=".6"');
    }
    // graduation marks on the right flank (25 / 50 / 75 %)
    var marks = "";
    for (var i = 1; i <= 3; i++) {
      var my = bot - (bot - top) * i / 4;
      marks += "M" + (i === 2 ? 26.4 : 27.6) + " " + r1(my) + "H29.6";
    }
    out += P(marks, 'stroke-width=".7" opacity=".85"');
    // glass highlight
    out += P("M8.6 23.5V36", 'stroke-width=".8" opacity=".55"') + P("M10.4 21.5v3", 'stroke-width=".6" opacity=".45"');
    out += P(JAR_BODY, 'stroke-width="1.15"');
    // neck, collar label band, lid, knob
    out += P("M11.5 9.5V14.5M24.5 9.5V14.5", 'stroke-width="1"');
    out += P("M10.5 10H25.5V14H10.5Z", 'fill="' + T.bg + '" stroke-width=".8"') + P("M10.5 11.2H25.5M10.5 12.8H25.5", 'stroke-width=".45"');
    out += P("M8.5 9.5H27.5L26.5 6.5H9.5Z", 'fill="' + T.bg + '" stroke-width="1.1"');
    out += C(18, 4, 2, 'fill="' + T.bg + '" stroke-width="1"');
    var label = o.label;
    if (label === true && v != null) label = Math.round(v * 100) + "% match";
    return svg(36, 48, o.size != null ? o.size : 30, out, Object.assign({}, o, { label: label }), "illus-jar");
  });

  var emptyCache = null;
  I.empty = safe(function (o) {
    if (!emptyCache) {
      var out = "";
      // cast shadow
      out += stipple(86, 136, 50, 4.5, 120, 77, [0.8, 0.2], 'stroke-width="1" opacity=".55"');
      out += P("M28 136.5H148", 'stroke-width=".6" opacity=".5"');
      var body = "M58 46C40 50 34 60 34 74V124C34 131 38 135 45 135H111C118 135 122 131 122 124V74C122 60 116 50 98 46Z";
      out += P(body, 'fill="' + T.bg + '"');
      // shading on the right flank of the glass: contour hatching
      var hs = "";
      for (var k = 0; k < 16; k++) {
        var x = 104 + k * 1.15;
        hs += "M" + r1(x) + " " + r1(58 + k * 0.6) + "V" + r1(130 - k * 0.2);
      }
      out += clip(P(body), P(hs, 'stroke-width=".5" opacity=".7"'));
      // highlights
      out += P("M44 76V118M48.5 70V80", 'stroke-width=".9" opacity=".55"');
      // blank specimen label
      out += P("M50 84H106V112H50Z", 'fill="' + T.bg + '" stroke-width="1"') + P("M53 87H103V109H53Z", 'stroke-width=".5"');
      out += P("M62 94H94", 'stroke-width=".6" stroke-dasharray="1.6 2.4"') + P("M66 102H90", 'stroke-width=".5" opacity=".6" stroke-dasharray="1.2 2.6"');
      out += P(body, 'stroke-width="1.3"');
      // bottom thickness
      out += P("M38 128C40 131 43 132 47 132H109C113 132 116 131 118 128", 'stroke-width=".6" opacity=".7"');
      // neck, lip, stopper
      out += P("M60 46V36M96 46V36", 'stroke-width="1.1"') + P("M56 36H100V30H56Z", 'fill="' + T.bg + '" stroke-width="1.1"');
      out += P("M62 30C62 22 70 18 78 18S94 22 94 30", 'fill="' + T.bg + '" stroke-width="1.1"');
      out += C(78, 12, 5.5, 'fill="' + T.bg + '" stroke-width="1.1"') + P("M75 9.5a3.5 3.5 0 0 1 2-1.6", 'stroke-width=".7"');
      var sh = "";
      for (var j = 0; j < 7; j++) sh += "M" + r1(84 + j * 1.6) + " " + r1(21 + j * 0.5) + "V30";
      out += P(sh, FINE);
      // a fallen sage leaf beside the jar
      out += leaf(126, 134, deg(-12), 22, 7, { k: 0.8, fill: T.sage, fo: 0.35, stip: 16, shade: 1, hn: 7, bend: 0.12 });
      out += P("M126 134q-3 1-5 .4", HAIR);
      emptyCache = out;
    }
    return svg(160, 150, 160, emptyCache, o, "illus-empty");
  });

  /* ---------- compass rose ---------- */
  var compassCache = null;
  I.compass = safe(function (o) {
    if (!compassCache) {
      var cx = 60, cy = 62, out = "";
      out += C(cx, cy, 48, 'fill="' + T.bg + '" fill-opacity=".85" stroke-width="1.1"') + C(cx, cy, 45, 'stroke-width=".55"');
      var ticks = "";
      for (var i = 0; i < 72; i++) {
        var a = i * PI / 36, l = i % 9 === 0 ? 4.5 : i % 2 === 0 ? 2.6 : 1.4;
        ticks += "M" + pt(polar(cx, cy, 45, a)) + "L" + pt(polar(cx, cy, 45 - l, a));
      }
      out += P(ticks, 'stroke-width=".55"');
      out += C(cx, cy, 30, 'stroke-width=".5" stroke-dasharray="1 2"');
      function point(a, len, w, col) {
        var tip = polar(cx, cy, len, a), l = polar(cx, cy, w, a - PI / 2), r = polar(cx, cy, w, a + PI / 2);
        return P("M" + pt(tip) + "L" + pt(l) + "L" + pt(cx, cy) + "Z", 'fill="' + T.bg + '" stroke-width=".8"') +
          P("M" + pt(tip) + "L" + pt(r) + "L" + pt(cx, cy) + "Z", 'fill="' + col + '" stroke-width=".8"');
      }
      for (var k = 0; k < 4; k++) out += point(-PI / 4 + k * PI / 2, 27, 4.4, T.sage);
      for (var j = 0; j < 4; j++) out += point(-PI / 2 + j * PI / 2, j === 0 ? 43 : 40, 6.2, j === 0 ? T.amber : "currentColor");
      out += C(cx, cy, 3, 'fill="' + T.bg + '" stroke-width=".9"') + C(cx, cy, 1, 'fill="currentColor" stroke="none"');
      out += '<text x="' + cx + '" y="9.6" text-anchor="middle" fill="currentColor" stroke="none" font-family="var(--serif, \'Instrument Serif\', Georgia, serif)" font-size="12">N</text>';
      compassCache = out;
    }
    return svg(120, 120, 120, compassCache, o, "illus-compass");
  });

  I.version = "1.0";
  I.keys = { region: ["Los Angeles", "Long Beach", "Orange County"], req: Object.keys(REQ), factor: Object.keys(FACT) };
})();
