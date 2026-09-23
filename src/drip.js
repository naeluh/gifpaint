// Drip brush — the physics of a Pollock pour, ported from the Drip Lab
// simulator and parametrized. A viscous thread leaves a moving stick, falls
// ballistically, buckles into rope coils or lays straight (fluid sewing
// machine), pinches into drops (Rayleigh–Plateau) that splat (Weber /
// Reynolds), and everything that lands keeps spreading as a thin film
// (lubrication equation, gravity-current similarity solutions).
//
// DOM-free by design: only `ctx` method calls, so `node test/drip.test.mjs`
// can run it. Physics in metres/seconds; ops are stored in canvas px.

/** @typedef {{mu:number,H:number,a0:number,gMul:number,v0:number,theta:number}} DripParams */

export const DRIP_DEFAULTS = { mu: 1.5, H: 0.15, a0: 0.001, gMul: 1, v0: 0.25, theta: 30, tool: 'stick' };

/**
 * Pollock's pouring tools. Each preset seeds a0 / v0 / mu (still adjustable), sets how
 * readily the thread pinches off (`nef` e-foldings), how much paint rides the tip (`slug`
 * seconds of flow) and what a flick throws (`fling`).
 * @type {Record<string,{label:string,a0:number,v0:number,mu:number,nef:number,slug:number,fling:'train'|'cloud'|'squirt'|'slosh'}>}
 */
// Flow rates are calibrated to the paintings: ribbon width is Q/(U·h), so Pollock's 3–7 mm
// lines at ~1 m/s need Q ≈ 0.5–1.5 mL/s — a 1 mm thread at 0.25 m/s (0.8 mL/s), not a garden hose.
export const TOOLS = {
  stick: { label: 'stick', a0: 0.001, v0: 0.25, mu: 1.5, nef: 7, slug: 0.35, fling: 'train' }, // 0.8 mL/s
  // loaded bristles shed thin ligaments that break early; a flick sprays a fine cloud
  brush: { label: 'brush', a0: 0.0008, v0: 0.25, mu: 0.6, nef: 3, slug: 0.4, fling: 'cloud' }, // 0.5 mL/s
  // basting syringe: pressurized jet, thin controlled "liquid pen" lines, squirts on release
  baster: { label: 'baster', a0: 0.0008, v0: 2.0, mu: 0.4, nef: 7, slug: 0.2, fling: 'squirt' }, // 4 mL/s
  // paint can: wide slow pour, ropes and huge pools; a flick sloshes big drops
  can: { label: 'can', a0: 0.006, v0: 0.4, mu: 1.5, nef: 7, slug: 0.5, fling: 'slosh' } // 45 mL/s
};
export const SPATTER_RATE = 150; // drops per second while a loaded brush is tapped
export const WIDTH_M = 1.2; // physical width of the canvas
export const DT = 1 / 240; // physics substep
export const MAX_OPS = 30000; // ponytail: undo clones every op ×50 deep (~1.5MB/clone at cap); diff history is the upgrade. Pools are never refused

const RHO = 1200; // kg/m³ alkyd enamel
const SIGMA = 0.032; // N/m surface tension
const COILC = 1.5; // prefactor on (νQ/g)^¼ coil radius
const WPOOL = 0.018; // ribbon wider than this (m) starts a puddle
const TILT = 0.45; // oblique projection for drawing height in the overlay
const SPREAD_C = 1.3; // gravity-current prefactor (Huppert: 1.06 flux … 1.58 volume)
const RETIRE_PX_S = 0.02; // spreading slower than this (px/s) is frozen
const THROW_U = 0.8; // m/s pointer speed at release that counts as a throw
const TAP_MS = 160; // press shorter than this with no throw = a straight-down dump
const SLUG_S = 0.35; // seconds of flow riding on the stick tip, thrown as one slug
const MAX_THROW_DROPS = 60; // ponytail: one splat op per drop; enough for a spray, bounded cost

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ── parameter helpers ────────────────────────────────────────────────────────
/** Slider 0–1000 → viscosity Pa·s, log scale 0.03–63 (thinned enamel → honey). */
export const sliderToMu = (v) => 10 ** (-1.5 + (3.3 * v) / 1000);
export const muToSlider = (mu) => Math.round(((Math.log10(mu) + 1.5) / 3.3) * 1000);
/** @param {DripParams} d */
export const gravity = (d) => 9.81 * (d.gMul ?? 1);
/** Speed the thread lands at: V = √(v0² + 2gH). @param {DripParams} d */
export const landingSpeed = (d) => Math.sqrt(d.v0 * d.v0 + 2 * gravity(d) * d.H);
/**
 * Puddle thickness where surface tension stops gravity spreading:
 * h_eq = 2·l_c·sin(θ/2), l_c = √(σ/ρg). @param {DripParams} d
 */
export function equilibriumThickness(d) {
  const lc = Math.sqrt(SIGMA / (RHO * gravity(d)));
  return 2 * lc * Math.sin(((d.theta ?? 30) * Math.PI) / 360);
}

// ── thin-film spreading (D13) ────────────────────────────────────────────────
/**
 * Axisymmetric viscous gravity current. dR/dt = C·(ρg/3μ)·h³/R with h = V/(πR²)
 * integrates exactly (V const within a step) to R⁸ = R₀⁸ + 8·C·(ρg/3μ)·(V/π)³·t,
 * which is Huppert's R ∝ t^{1/8} (const volume) / t^{1/2} (const flux).
 * Spreading gates off as h → hEq and is clamped at h = hEq.
 * @param {{V:number,R:number}} rec pool record (m³, m) — mutated
 * @param {number} dt seconds
 * @param {{rho:number,g:number,mu:number,hEq:number}} phys
 * @returns {number} dR/dt (m/s) over the step
 */
export function spreadPool(rec, dt, phys) {
  if (dt <= 0 || rec.V <= 0) return 0;
  const h0 = rec.V / (Math.PI * rec.R * rec.R);
  const gate = phys.hEq > 0 ? smooth(phys.hEq, 1.5 * phys.hEq, h0) : 1;
  if (gate <= 0) return 0;
  const k = SPREAD_C * ((phys.rho * phys.g) / (3 * phys.mu)) * (rec.V / Math.PI) ** 3;
  let R1 = (rec.R ** 8 + 8 * k * dt * gate) ** (1 / 8);
  if (phys.hEq > 0) R1 = Math.min(R1, Math.sqrt(rec.V / (Math.PI * phys.hEq)));
  const rate = Math.max(0, R1 - rec.R) / dt;
  rec.R = Math.max(rec.R, R1);
  return rate;
}

/**
 * Planar (ribbon) gravity current. A = volume per unit length, h = A/w.
 * dw/dt = C·(ρg/3μ)·A³/w⁴ → w⁵ = w₀⁵ + 5·C·(ρg/3μ)·A³·t  (Huppert: w ∝ t^{1/5}).
 * @param {{A:number,w:number}} rec (m², m) — mutated
 * @returns {number} dw/dt (m/s)
 */
export function spreadSeg(rec, dt, phys) {
  if (dt <= 0 || rec.A <= 0) return 0;
  const h0 = rec.A / rec.w;
  const gate = phys.hEq > 0 ? smooth(phys.hEq, 1.5 * phys.hEq, h0) : 1;
  if (gate <= 0) return 0;
  const k = SPREAD_C * ((phys.rho * phys.g) / (3 * phys.mu)) * rec.A ** 3;
  let w1 = (rec.w ** 5 + 5 * k * dt * gate) ** (1 / 5);
  if (phys.hEq > 0) w1 = Math.min(w1, rec.A / phys.hEq);
  const rate = Math.max(0, w1 - rec.w) / dt;
  rec.w = Math.max(rec.w, w1);
  return rate;
}

// ── colour ───────────────────────────────────────────────────────────────────
/** Mix a #rgb/#rrggbb colour toward white (gloss highlight). Non-hex → translucent white. */
export function mixToWhite(hex, k) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return 'rgba(255,255,255,0.6)';
  let h = m[1];
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const ch = (i) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - k) + 255 * k);
  return `rgb(${ch(0)} ${ch(2)} ${ch(4)})`;
}

// ── replay: item.ops → canvas ────────────────────────────────────────────────
function drawBlob(ctx, op) {
  const fz = op.fz ?? 0; // rim feathering: thin paint wicks into the canvas weave
  const n = fz > 0.05 ? 96 : 32;
  const [p1, p2, p3] = op.ph;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const feather = fz * (0.5 * Math.sin(13 * t + p2 * 3) + 0.3 * Math.sin(29 * t + p1 * 5) + 0.2 * Math.sin(53 * t + p3 * 7));
    const rr = op.r * (1 + 0.05 * Math.sin(3 * t + p1) + 0.035 * Math.sin(5 * t + p2) + 0.02 * Math.sin(7 * t + p3) + feather);
    const px = op.x + rr * Math.cos(t);
    const py = op.y + rr * Math.sin(t);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.fill();
}

function drawSplat(ctx, op) {
  const { R, el, cx } = op;
  const N = op.fingers.length;
  ctx.save();
  ctx.translate(op.x, op.y);
  ctx.rotate(op.ang);
  ctx.beginPath();
  ctx.ellipse(cx, 0, R * el, R, 0, 0, Math.PI * 2);
  ctx.fill();
  const bw = N ? Math.min(R * 0.4, ((Math.PI * 2 * R) / N) * 0.42) : 0;
  for (const [th, len, tip] of op.fingers) {
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    const rx = cx + R * el * cs * 0.9;
    const ry = R * sn * 0.9;
    let nx = cs / el;
    let ny = sn;
    const nn = Math.hypot(nx, ny) || 1;
    nx /= nn;
    ny /= nn;
    const tx = rx + nx * len;
    const ty = ry + ny * len;
    ctx.beginPath();
    ctx.moveTo(rx - ny * bw * 0.5, ry + nx * bw * 0.5);
    ctx.quadraticCurveTo(rx + nx * len * 0.5 - ny * bw * 0.15, ry + ny * len * 0.5 + nx * bw * 0.15, tx, ty);
    ctx.quadraticCurveTo(rx + nx * len * 0.5 + ny * bw * 0.15, ry + ny * len * 0.5 - nx * bw * 0.15, rx + ny * bw * 0.5, ry - nx * bw * 0.5);
    ctx.closePath();
    ctx.fill();
    if (tip) {
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(0.4, bw * 0.28), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const [sx, sy, sr] of op.sats) {
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Wet-on-wet marbling lobes: the older paint's colour fingering into a pool that landed on it
 * (Saffman–Taylor: a less viscous fluid displacing a more viscous one fingers; the reverse
 * displaces smoothly). `swirl = {c, n, k, ph}` — colour, finger count, amplitude (fraction of r), phase.
 */
function drawSwirl(ctx, op) {
  const { c, n, k, ph } = op.swirl;
  ctx.fillStyle = c;
  for (let i = 0; i < n; i++) {
    const th = ph + (i / n) * Math.PI * 2;
    const wob = 1 + 0.35 * Math.sin(3.7 * th + ph);
    const rx = op.r * k * wob;
    const ry = op.r * k * 0.55;
    const cx = op.x + Math.cos(th) * (op.r - rx * 0.9);
    const cy = op.y + Math.sin(th) * (op.r - rx * 0.9);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, th, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Saffman–Taylor fingering pattern for new paint (muNew) landing on wet paint (muOld).
 * Mobility ratio M = muOld/muNew > 1 is unstable → more, deeper fingers.
 * @returns {{c:string,n:number,k:number,ph:number}}
 */
export function makeSwirl(oldColor, muOld, muNew) {
  const M = muOld / Math.max(muNew, 1e-6);
  const u = smooth(0.3, 3, M);
  return { c: oldColor, n: 2 + Math.round(5 * u), k: 0.08 + 0.3 * u, ph: Math.random() * 6.28 };
}

// ── scraping: a tool dragged through wet paint ───────────────────────────────
/**
 * Drag a tool of width w (px) from (ax,ay) to (bx,by) through every other physics item's
 * paint. Pools lose the scooped fraction of their volume (volume-conserving radius shrink),
 * get pushed aside by the bow wave, and the scooped paint is laid as a streak in the pool's
 * own colour on `into.ops`; ribbons and dots inside the swath are smeared along the drag.
 * Pure: mutates only ops. Returns the number of ops touched.
 * @param {Array<object>} items scene items (drip/spatter/scrape items with `ops`)
 * @param {object} into the scrape stroke item receiving streak ops
 */
export function scrapeSweep(items, into, ax, ay, bx, by, w) {
  const dx = bx - ax;
  const dy = by - ay;
  const L = Math.hypot(dx, dy);
  if (L < 0.5) return 0;
  const ux = dx / L;
  const uy = dy / L;
  const half = w / 2;
  // distance from a point to the swept segment, plus the along-track parameter
  const near = (px, py) => {
    const t = Math.max(0, Math.min(1, ((px - ax) * ux + (py - ay) * uy) / L));
    const qx = ax + ux * L * t;
    const qy = ay + uy * L * t;
    return { dist: Math.hypot(px - qx, py - qy), qx, qy, side: Math.sign((px - qx) * -uy + (py - qy) * ux) || 1 };
  };
  let touched = 0;
  for (const it of items) {
    if (it === into || !it.ops?.length) continue;
    for (const op of it.ops) {
      if (op.t === 'blob') {
        const { dist, qx, qy, side } = near(op.x, op.y);
        if (dist > op.r + half) continue;
        const f = Math.min(1, half / Math.max(op.r, 1)) * 0.5; // scooped fraction per pass
        const r0 = op.r;
        op.r = Math.max(0.5, r0 * Math.sqrt(1 - f));
        const push = Math.min(half, r0 * 0.25);
        op.x += -uy * side * push; // bow wave shoves the pool aside
        op.y += ux * side * push;
        // the scooped paint streaks out along the drag, tapering
        const sx = qx;
        const sy = qy;
        const len = L + w * 1.5;
        const tag = it.srcId ? { c: it.color, src: it.srcId } : { c: it.color }; // streak keeps its paint's colour / gif / video
        into.ops.push({ t: 'seg', x0: sx, y0: sy, x1: sx + ux * len * 0.6, y1: sy + uy * len * 0.6, w: w * 0.6, ...tag });
        into.ops.push({ t: 'seg', x0: sx + ux * len * 0.6, y0: sy + uy * len * 0.6, x1: sx + ux * len, y1: sy + uy * len, w: w * 0.28, ...tag });
        touched++;
      } else if (op.t === 'seg') {
        const { dist } = near((op.x0 + op.x1) / 2, (op.y0 + op.y1) / 2);
        if (dist > half) continue;
        const k = Math.min(L, half) * (1 - dist / half); // smear along the drag
        op.x0 += ux * k; op.y0 += uy * k; op.x1 += ux * k; op.y1 += uy * k;
        op.w *= 1.1;
        touched++;
      } else if (op.t === 'splat') {
        const { dist } = near(op.x, op.y);
        if (dist > half) continue;
        const k = Math.min(L, half) * (1 - dist / half);
        op.x += ux * k;
        op.y += uy * k;
        op.el = Math.min(3.2, op.el * 1.15);
        touched++;
      }
    }
  }
  return touched;
}

/**
 * Draw a drip stroke from its recorded ops. Two passes: bodies in deposit order,
 * then gloss highlights so a later segment's round cap never cuts a highlight.
 * Legacy items without `ops` draw nothing.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ops?:Array<object>, color:string}} item
 * @param {{mask?:boolean, filter?:(op:object)=>boolean}} [opts] mask = opaque black bodies only
 *   (a source-in stencil), no gloss; filter = draw a subset of the ops
 */
export function replayDripOps(ctx, item, { mask = false, filter = null } = {}) {
  const ops = filter ? item.ops?.filter(filter) : item.ops;
  if (!ops?.length) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // ops may carry their own colour (`c`): scraped paint keeps the colour it came from
  const colorOf = (op) => (mask ? '#000' : (op.c ?? item.color));
  for (const op of ops) {
    ctx.fillStyle = ctx.strokeStyle = colorOf(op);
    if (op.t === 'seg') {
      ctx.lineWidth = op.w;
      ctx.beginPath();
      ctx.moveTo(op.x0, op.y0);
      ctx.lineTo(op.x1, op.y1);
      ctx.stroke();
    } else if (op.t === 'blob') {
      drawBlob(ctx, op);
      if (op.swirl) {
        // colour: the older paint's colour fingers in. Stencil: cut the fingers out of the
        // mask so whatever is under (the older pool's colour, gif or video) shows through.
        if (mask) ctx.globalCompositeOperation = 'destination-out';
        drawSwirl(ctx, op);
        if (mask) ctx.globalCompositeOperation = 'source-over';
      }
    } else if (op.t === 'splat') drawSplat(ctx, op);
  }
  if (mask) return; // stencil: alpha is all that matters
  // highlights
  const hiCache = new Map();
  const hiOf = (op) => {
    const c = op.c ?? item.color;
    if (!hiCache.has(c)) hiCache.set(c, mixToWhite(c, 0.45));
    return hiCache.get(c);
  };
  const base = ctx.globalAlpha;
  for (const op of ops) {
    ctx.fillStyle = ctx.strokeStyle = hiOf(op);
    if (op.t === 'seg') {
      if (op.w <= 2.2) continue;
      const o = -op.w * 0.16;
      ctx.lineWidth = op.w * 0.24;
      ctx.beginPath();
      ctx.moveTo(op.x0 + o, op.y0 + o);
      ctx.lineTo(op.x1 + o, op.y1 + o);
      ctx.stroke();
    } else if (op.t === 'blob' && op.r > 2) {
      ctx.globalAlpha = base * 0.55;
      ctx.beginPath();
      ctx.ellipse(op.x - op.r * 0.32, op.y - op.r * 0.36, op.r * 0.28, op.r * 0.13, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = base;
    } else if (op.t === 'splat' && op.R > 2.2) {
      ctx.globalAlpha = base * 0.5;
      ctx.beginPath();
      ctx.ellipse(op.x - op.R * 0.3, op.y - op.R * 0.3, op.R * 0.3, op.R * 0.15, -0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = base;
    }
  }
}

// ── the simulator ────────────────────────────────────────────────────────────
/**
 * Live pour simulation for one drip stroke item. Appends ops to `item.ops`.
 * @param {{drip:DripParams, ops:Array<object>, color:string}} item
 * @param {number} S canvas px per metre (W / WIDTH_M)
 */
export function createDripSim(item, S, { under = null } = {}) {
  const d = { ...DRIP_DEFAULTS, ...item.drip };
  const tool = TOOLS[d.tool] ?? TOOLS.stick;
  const spatter = item.brush === 'spatter'; // tapping a loaded brush: drops, no thread
  const G = gravity(d);
  const V0 = d.v0;
  const Q = Math.PI * d.a0 * d.a0 * V0; // constant flow — the stick never runs dry
  const NEF = tool.nef; // e-foldings of capillary growth before pinch-off
  const phys = { rho: RHO, g: G, mu: d.mu, hEq: equilibriumThickness(d) };
  const nu = d.mu / RHO;
  const ops = item.ops;

  const hand = { x: 0, y: 0, vx: 0, vy: 0, k: 90 };
  const target = { x: 0, y: 0 };
  const samples = []; // recent pointer samples {t ms, x, y} for release velocity
  let pressT = null;
  let pouring = false;
  let gap = true;
  let pid = 0;
  let simT = 0;
  let parcels = [];
  let drops = [];
  let lastLand = null;
  let Uema = 0;
  let mdx = 1;
  let mdy = 0;
  let coilW = 0;
  const coil = { phi: 0, dir: 1, jit: 0 };
  /** @type {Array<{V:number,R:number,x:number,y:number,op:object,active:boolean}>} */
  const pools = [];
  /** @type {Array<{A:number,w:number,op:object}>} */
  const segs = []; // still spreading
  /** @type {{x:number,y:number,V:number,r:number}|null} paint mounding on one spot (coils stacking) */
  let site = null;

  // a landed thread only partly flattens: runny paint spreads thin, viscous stays round
  const filmH = (a) => Math.max(1e-4, a * (0.3 + 0.55 * smooth(-1, 1, Math.log10(d.mu))));
  const aLoc = (p) => Math.sqrt(p.vol / (Math.PI * Math.max(p.ds, 1e-6)));
  // fastest Rayleigh–Plateau mode growth rate, viscous + inertial capillary times
  const growth = (a) => 1 / ((6 * d.mu * a) / SIGMA + 2.9 * Math.sqrt((RHO * a * a * a) / SIGMA));
  const roomForOps = () => ops.length < MAX_OPS;
  // seconds for a puddle of volume V to spread out to radius R (R⁸ = 8·C·(ρg/3μ)·(V/π)³·t)
  const spreadTime = (V, R) => R ** 8 / (8 * SPREAD_C * ((RHO * G) / (3 * d.mu)) * (V / Math.PI) ** 3);

  // ── deposition ──
  function poolAt(x, y) {
    for (const pl of pools) if (Math.hypot(x - pl.x, y - pl.y) <= pl.R) return pl;
    return null;
  }
  function syncPool(pl) {
    pl.op.x = pl.x * S;
    pl.op.y = pl.y * S;
    pl.op.r = pl.R * S;
  }
  function feed(pl, x, y, vol) {
    pl.V += vol;
    const f = vol / pl.V; // mass-weighted centroid drift
    pl.x += (x - pl.x) * f;
    pl.y += (y - pl.y) * f;
    pl.active = true;
    syncPool(pl);
  }
  function newPool(x, y, vol, R) {
    const op = { t: 'blob', x: 0, y: 0, r: 0, ph: [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28] };
    // thin, wetting paint feathers into the weave (Washburn wicking); thick enamel keeps a clean rim
    const fz = 0.12 * (1 - smooth(-0.5, 1, Math.log10(d.mu))) * (1 - smooth(20, 70, d.theta));
    if (fz > 0.01) op.fz = +fz.toFixed(3);
    // wet-on-wet: landing on another layer's pool of a different colour marbles
    const u = under?.(x * S, y * S);
    if (u && u.color !== item.color) op.swirl = makeSwirl(u.color, u.mu ?? 1.5, d.mu);
    const pl = { V: vol, R, x, y, op, active: true };
    syncPool(pl);
    ops.push(op);
    pools.push(pl);
  }
  function mergePools() {
    for (let i = 0; i < pools.length; i++) {
      for (let j = pools.length - 1; j > i; j--) {
        const a = pools[i];
        const b = pools[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) >= Math.max(a.R, b.R)) continue;
        const V = a.V + b.V;
        a.x = (a.x * a.V + b.x * b.V) / V;
        a.y = (a.y * a.V + b.y * b.V) / V;
        a.V = V;
        a.R = Math.sqrt(a.R * a.R + b.R * b.R);
        a.active = true;
        syncPool(a);
        const k = ops.indexOf(b.op);
        if (k >= 0) ops.splice(k, 1);
        pools.splice(j, 1);
      }
    }
  }
  function addSeg(x0, y0, x1, y1, w, A) {
    if (!roomForOps()) return;
    const op = { t: 'seg', x0: x0 * S, y0: y0 * S, x1: x1 * S, y1: y1 * S, w: Math.max(0.55, w * S) };
    ops.push(op);
    segs.push({ A, w, op });
  }
  // lay a volume of paint along a short path: ribbon width from volume / (length × film thickness)
  function deposit(x0, y0, x1, y1, vol, a) {
    const pl = poolAt(x1, y1);
    if (pl) {
      feed(pl, x1, y1, vol); // paint on wet paint pools, even on a fast pass
      return;
    }
    const L = Math.max(Math.hypot(x1 - x0, y1 - y0), 1e-7);
    const h = filmH(a);
    const w = Math.max(2.2 * a, vol / (L * h));
    if (w > WPOOL) {
      newPool(x1, y1, vol, Math.sqrt(vol / (Math.PI * h)));
      return;
    }
    addSeg(x0, y0, x1, y1, w, vol / L);
  }

  // ── a continuous thread touches down: sewing-machine coiling ──
  function land(p, lx, ly) {
    const a = aLoc(p);
    const Vt = Math.max(0.05, Math.abs(p.vz));
    const cont = lastLand && lastLand.id === p.id - 1;
    const dtL = cont ? Math.max(simT - lastLand.t, DT * 0.5) : DT;
    if (cont) {
      const dx = lx - lastLand.bx;
      const dy = ly - lastLand.by;
      const dist = Math.hypot(dx, dy);
      Uema += (dist / dtL - Uema) * 0.25;
      if (dist > 1e-7) {
        mdx += (dx / dist - mdx) * 0.25;
        mdy += (dy / dist - mdy) * 0.25;
        const m = Math.hypot(mdx, mdy) || 1;
        mdx /= m;
        mdy /= m;
      }
    } else {
      Uema = Math.hypot(p.vx, p.vy) / 0.85;
      coilW = 0;
    }
    const Qn = p.vol / DT;
    const R = COILC * Math.pow((nu * Qn) / G, 0.25); // coil radius (νQ/g)^¼
    // thread landing on a wet pool merges into it — coils sink in, a fast pass feeds it
    const onPool = poolAt(lx, ly);
    if (onPool) {
      feed(onPool, lx, ly, p.vol);
      site = null;
      lastLand = { id: p.id, t: simT, bx: lx, by: ly, fx: lx, fy: ly };
      return;
    }
    // paint laid on the same spot mounds up: once the mound would puddle past the coil
    // footprint (h_eq) and flow there within a second (μ), it IS a pool — coils merge
    const siteR = 1.5 * R + 4 * a;
    if (site && Math.hypot(lx - site.x, ly - site.y) <= site.r) {
      site.V += p.vol;
      site.x += ((lx - site.x) * p.vol) / site.V;
      site.y += ((ly - site.y) * p.vol) / site.V;
    } else site = { x: lx, y: ly, V: p.vol, r: siteR };
    if (Math.sqrt(site.V / (Math.PI * phys.hEq)) >= R && spreadTime(site.V, R) <= 1) {
      newPool(site.x, site.y, site.V, R);
      site = null;
      lastLand = { id: p.id, t: simT, bx: lx, by: ly, fx: lx, fy: ly };
      return;
    }
    const Re = (Vt * a) / nu;
    const wt = cont ? (1 - smooth(6, 25, Re)) * smooth(2 * R, 5 * R, d.H) : 0;
    coilW += (wt - coilW) * 0.08;
    const u = Uema / Vt;
    const rot = 1 - smooth(0.45, 0.75, u);
    const mea = smooth(0.45, 0.75, u) * (1 - smooth(0.85, 1.05, u));
    const phi0 = coil.phi;
    // rope laid down at its own speed V; arm tremor + thread waviness jitter the rate and radius
    coil.phi += coil.dir * (Vt / R) * dtL * (1 + 0.3 * (Math.random() - 0.5));
    coil.jit += (0.35 * (Math.random() - 0.5) - coil.jit) * 0.1;
    if (rot > 0.5 && Math.random() < dtL * 0.3) coil.dir *= -1; // coils occasionally reverse
    const Rj = R * (1 + coil.jit);
    const off = (bx, by, ph) => [
      bx + coilW * (rot * Rj * Math.cos(ph) + mea * 1.2 * Rj * Math.sin(ph) * -mdy),
      by + coilW * (rot * Rj * Math.sin(ph) + mea * 1.2 * Rj * Math.sin(ph) * mdx)
    ];
    let fx;
    let fy;
    if (cont) {
      const n = Math.max(1, Math.min(24, Math.ceil((Math.abs(coil.phi - phi0) * coilW) / 0.3)));
      let px = lastLand.fx;
      let py = lastLand.fy;
      for (let j = 1; j <= n; j++) {
        const t = j / n;
        const f = off(lastLand.bx + (lx - lastLand.bx) * t, lastLand.by + (ly - lastLand.by) * t, phi0 + (coil.phi - phi0) * t);
        deposit(px, py, f[0], f[1], p.vol / n, a);
        px = f[0];
        py = f[1];
      }
      fx = px;
      fy = py;
    } else {
      [fx, fy] = off(lx, ly, coil.phi);
      const pl = poolAt(fx, fy);
      if (pl) feed(pl, fx, fy, p.vol);
      else newPool(fx, fy, p.vol, Math.sqrt(p.vol / (Math.PI * filmH(a))));
    }
    lastLand = { id: p.id, t: simT, bx: lx, by: ly, fx, fy };
  }

  // ── a drop hits: Weber / Reynolds driven splat ──
  function splat(x, y, dr) {
    if (!roomForOps()) return;
    const D = dr.D;
    const vn = Math.max(0.05, Math.abs(dr.vz));
    const vh = Math.hypot(dr.vx, dr.vy);
    const We = (RHO * vn * vn * D) / SIGMA;
    const Re = Math.max(0.01, (RHO * vn * D) / d.mu);
    const sp = Math.sqrt(We * Math.pow(Re, -0.4));
    const beta = Math.max(1, (Math.pow(Re, 0.2) * sp) / (1.24 + sp)); // Laan et al. 2014 spreading
    const K = Math.sqrt(We) * Math.pow(Re, 0.25); // Mundo splash parameter
    const N = Math.min(40, Math.round(K / (4 * Math.sqrt(3)))); // Aziz & Chandra finger count
    const fing = smooth(35, 95, K);
    const el = Math.min(3.2, 1 + (0.75 * vh) / (vn + 0.3));
    const ang = Math.atan2(dr.vy, dr.vx);
    const R = Math.max(0.5, beta * D * 0.5 * S);
    const cx = R * (el - 1) * 0.55;
    const fingers = [];
    const sats = [];
    if (fing > 0.02 && N >= 3) {
      for (let i = 0; i < N; i++) {
        const th = ((i + (Math.random() - 0.5) * 0.6) / N) * Math.PI * 2;
        const fwd = 1 + Math.max(0, Math.cos(th)) * (el - 1) * 1.2;
        fingers.push([th, R * fing * (0.25 + Math.random() * 0.85) * fwd, Math.random() < 0.6 ? 1 : 0]);
      }
      if (K > 57) {
        const M = Math.round(N * (0.15 + Math.random() * 0.45));
        for (let i = 0; i < M; i++) {
          const th = Math.random() * Math.PI * 2;
          const cs = Math.cos(th);
          const sn = Math.sin(th);
          const dist = R * (1.4 + Math.random() * 1.8) * (1 + Math.max(0, cs) * (el - 1) * 1.5);
          sats.push([cx + cs * dist, sn * dist, Math.max(0.4, R * (0.04 + Math.random() * 0.1))]);
        }
      }
    }
    ops.push({ t: 'splat', x: x * S, y: y * S, ang, R, el, cx, fingers, sats });
  }

  // ── throwing: the slug on the stick leaves with the hand and breaks into a drop train ──
  function releaseVelocity(t) {
    const last = samples[samples.length - 1];
    if (!last) return { U: 0, ux: 1, uy: 0 };
    let ref = samples[0];
    for (let i = samples.length - 1; i >= 0; i--) {
      if (last.t - samples[i].t >= 40) {
        ref = samples[i];
        break;
      }
    }
    const dt = (last.t - ref.t) / 1000;
    if (dt <= 0) return { U: 0, ux: 1, uy: 0 };
    const dx = last.x - ref.x;
    const dy = last.y - ref.y;
    const dist = Math.hypot(dx, dy);
    return dist > 0 ? { U: dist / dt, ux: dx / dist, uy: dy / dist } : { U: 0, ux: 1, uy: 0 };
  }
  /**
   * A stretched ligament of paint leaves the stick: drops of varied size (ligament breakup),
   * the front of the train faster, ±10° lateral scatter, lobbed for a flick (arc) or jabbed
   * straight down for a dump. Each drop then flies ballistically and splats obliquely.
   */
  function throwSlug(U, ux, uy, mode) {
    const fling = mode === 'throw' ? tool.fling : 'dump';
    let left = Q * tool.slug;
    // cloud: hundreds of fine drops off the bristles; slosh: a few big ones off the can lip
    const cap = fling === 'cloud' ? 300 : fling === 'slosh' ? 20 : MAX_THROW_DROPS;
    const dScale = fling === 'cloud' ? 0.45 : fling === 'slosh' ? 2.2 : 1;
    let n = 0;
    while (left > 0 && n < cap) {
      const D = dScale * d.a0 * (1.2 + Math.random() * 2.4) * Math.exp((Math.random() - 0.5) * 0.6);
      const vol = Math.min(left, (Math.PI / 6) * D ** 3);
      left -= vol;
      n++;
      let vx;
      let vy;
      let vz;
      if (fling !== 'dump') {
        const k = 0.55 + Math.random() * 0.65; // train: front drops faster
        const cone = fling === 'cloud' ? 1.1 : fling === 'squirt' ? 0.12 : fling === 'slosh' ? 0.6 : 0.35;
        const ang = (Math.random() - 0.5) * cone;
        const c = Math.cos(ang);
        const sn = Math.sin(ang);
        const speed = fling === 'squirt' ? Math.max(U, V0) * 1.2 : U;
        vx = speed * k * (ux * c - uy * sn);
        vy = speed * k * (ux * sn + uy * c);
        // over-arching lob for a flick; a squirt leaves flat; a slosh barely lifts
        vz = fling === 'squirt' ? -V0 * 0.3 : fling === 'slosh' ? U * 0.1 : U * (0.2 + Math.random() * 0.3);
      } else {
        const ang = Math.random() * Math.PI * 2; // dump: radial crown
        const sp = 0.05 + Math.random() * 0.4;
        vx = Math.cos(ang) * sp;
        vy = Math.sin(ang) * sp;
        vz = -V0 - Math.random() * 0.6; // jabbed down
      }
      drops.push({ x: hand.x, y: hand.y, z: d.H, vx, vy, vz, vol, D: Math.cbrt((6 * vol) / Math.PI) });
    }
  }

  // ── Rayleigh–Plateau: broken runs of thread become drops ──
  function makeDrop(run) {
    let vol = 0, x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0;
    for (const p of run) {
      const v = p.vol;
      vol += v; x += p.x * v; y += p.y * v; z += p.z * v; vx += p.vx * v; vy += p.vy * v; vz += p.vz * v;
    }
    drops.push({ x: x / vol, y: y / vol, z: z / vol, vx: vx / vol, vy: vy / vol, vz: vz / vol, vol, D: Math.cbrt((6 * vol) / Math.PI) });
  }
  function breakup() {
    if (!parcels.length) return;
    const out = [];
    let run = [];
    let runLen = 0;
    const flush = () => {
      if (run.length) {
        makeDrop(run);
        run = [];
        runLen = 0;
      }
    };
    for (const p of parcels) {
      const last = run.length ? run[run.length - 1] : null;
      if (last && p.id !== last.id + 1) flush(); // end of the thread: whatever broke becomes a drop
      if (p.prog >= 1) {
        run.push(p);
        runLen += p.ds;
        if (runLen >= 9.02 * aLoc(p)) flush(); // fastest-growing wavelength ≈ 9 radii
      } else {
        if (run.length) {
          for (const q of run) out.push(q);
          run = [];
          runLen = 0;
        }
        out.push(p);
      }
    }
    flush();
    parcels = out;
  }

  // ── physics step (call at DT) ──
  function step(dt) {
    simT += dt;
    const c = 2 * 0.62 * Math.sqrt(hand.k); // slightly underdamped arm
    hand.vx += (hand.k * (target.x - hand.x) - c * hand.vx) * dt;
    hand.vy += (hand.k * (target.y - hand.y) - c * hand.vy) * dt;
    hand.x += hand.vx * dt;
    hand.y += hand.vy * dt;

    if (pouring && spatter) {
      // tap a loaded brush against the hand: a cone of ligament-breakup drops, biased the way the hand moves
      const n = Math.floor(SPATTER_RATE * dt + Math.random());
      const hv = Math.hypot(hand.vx, hand.vy);
      const bias = hv > 0.05 ? Math.atan2(hand.vy, hand.vx) : null;
      for (let i = 0; i < n; i++) {
        const D = d.a0 * 0.5 * Math.exp((Math.random() - 0.5) * 1.2);
        const vol = (Math.PI / 6) * D ** 3;
        const el = Math.random() * 0.9; // elevation off vertical (0 = straight down, ~50° max)
        const az = bias === null ? Math.random() * Math.PI * 2 : bias + (Math.random() - 0.5) * 1.6;
        const sp = V0 * Math.exp((Math.random() - 0.5) * 0.8);
        drops.push({
          x: hand.x, y: hand.y, z: d.H,
          vx: hand.vx * 0.5 + Math.cos(az) * sp * Math.sin(el),
          vy: hand.vy * 0.5 + Math.sin(az) * sp * Math.sin(el),
          vz: -sp * Math.cos(el), vol, D
        });
      }
    } else if (pouring) {
      if (gap) {
        pid += 3;
        gap = false;
      }
      parcels.push({
        id: ++pid, x: hand.x, y: hand.y, z: d.H,
        vx: hand.vx * 0.85, vy: hand.vy * 0.85, vz: -V0,
        vol: Q * dt, ds: V0 * dt, prog: -Math.random() * 0.15
      });
    } else gap = true;

    let any = false;
    for (let k = 0; k < parcels.length; k++) {
      const p = parcels[k];
      const ox = p.x, oy = p.y, oz = p.z;
      p.vz -= G * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const q = k > 0 ? parcels[k - 1] : null;
      p.ds = q && q.id === p.id - 1 ? Math.max(1e-6, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)) : Math.abs(p.vz) * dt;
      p.prog += (growth(aLoc(p)) * dt) / NEF;
      if (p.z <= 0) {
        const f = oz / (oz - p.z);
        land(p, ox + (p.x - ox) * f, oy + (p.y - oy) * f);
        p.dead = true;
        any = true;
      }
    }
    if (any) parcels = parcels.filter((p) => !p.dead);
    breakup();
    if (parcels.length > 5000) parcels.splice(0, parcels.length - 5000);

    any = false;
    for (const dr of drops) {
      const ox = dr.x, oy = dr.y, oz = dr.z;
      dr.vz -= G * dt;
      dr.x += dr.vx * dt;
      dr.y += dr.vy * dt;
      dr.z += dr.vz * dt;
      if (dr.z <= 0) {
        const f = oz / (oz - dr.z);
        splat(ox + (dr.x - ox) * f, oy + (dr.y - oy) * f, dr);
        dr.dead = true;
        any = true;
      }
    }
    if (any) drops = drops.filter((dr) => !dr.dead);
  }

  // ── thin-film spreading (call once per frame with the frame dt) ──
  function spread(dt) {
    let grew = false;
    for (const pl of pools) {
      if (!pl.active) continue;
      const rate = spreadPool(pl, dt, phys);
      syncPool(pl);
      if (rate * S < RETIRE_PX_S) pl.active = false;
      else grew = true;
    }
    if (grew) mergePools();
    for (let i = segs.length - 1; i >= 0; i--) {
      const sg = segs[i];
      const rate = spreadSeg(sg, dt, phys);
      sg.op.w = Math.max(0.55, sg.w * S);
      if (rate * S < RETIRE_PX_S) segs.splice(i, 1);
    }
  }

  const idle = () => !pouring && !parcels.length && !drops.length && !segs.length && !pools.some((p) => p.active);

  /** Fast-forward until nothing is in flight or spreading (≤ 60 s sim time). */
  function flush() {
    pouring = false;
    let t = 0;
    while ((parcels.length || drops.length) && t < 5) {
      step(DT);
      t += DT;
    }
    parcels = [];
    drops = [];
    for (let i = 0; i < 240 && !idle(); i++) spread(0.25);
    segs.length = 0;
    for (const pl of pools) pl.active = false;
  }

  // ── overlay: stick, falling thread, drops in flight (px) ──
  function overlay(ctx) {
    const hx = hand.x * S;
    const hy = hand.y * S;
    const top = (hand.y - d.H * TILT) * S;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // shadows on the canvas plane
    if (pouring || parcels.length) {
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath();
      ctx.ellipse(hx, hy, 8, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,.18)';
    ctx.lineWidth = 1.2;
    let prev = null;
    for (const p of parcels) {
      const X = p.x * S;
      const Y = p.y * S;
      if (prev && prev.id === p.id - 1) {
        ctx.beginPath();
        ctx.moveTo(prev.X, prev.Y);
        ctx.lineTo(X, Y);
        ctx.stroke();
      }
      prev = { id: p.id, X, Y };
    }
    // thread
    prev = null;
    const first = parcels[0];
    if (first && lastLand && first.id === lastLand.id + 1) prev = { id: lastLand.id, X: lastLand.fx * S, Y: lastLand.fy * S };
    ctx.strokeStyle = item.color;
    for (const p of parcels) {
      const X = p.x * S;
      const Y = (p.y - p.z * TILT) * S;
      if (prev && prev.id === p.id - 1) {
        ctx.lineWidth = Math.max(1, 2 * aLoc(p) * S);
        ctx.beginPath();
        ctx.moveTo(prev.X, prev.Y);
        ctx.lineTo(X, Y);
        ctx.stroke();
      }
      prev = { id: p.id, X, Y };
    }
    const lastP = parcels[parcels.length - 1];
    if (pouring && lastP && lastP.id === pid) {
      ctx.lineWidth = Math.max(1, 2 * d.a0 * S);
      ctx.beginPath();
      ctx.moveTo(hx, top);
      ctx.lineTo(lastP.x * S, (lastP.y - lastP.z * TILT) * S);
      ctx.stroke();
    }
    // drops
    for (const dr of drops) {
      const r = Math.max(0.9, dr.D * 0.5 * S);
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.beginPath();
      ctx.arc(dr.x * S, dr.y * S, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(dr.x * S, (dr.y - dr.z * TILT) * S, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!pouring && !parcels.length) {
      ctx.restore();
      return; // pools may creep for a while — no stick hovering over a finished pour
    }
    // the stick
    ctx.strokeStyle = '#7b5a36';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hx, top);
    ctx.lineTo(hx + 16, top - 42);
    ctx.stroke();
    ctx.strokeStyle = '#a88559';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hx + 1, top - 3);
    ctx.lineTo(hx + 16, top - 42);
    ctx.stroke();
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(hx, top, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return {
    /**
     * Pointer position in canvas px; the arm spring chases it and stiffens with pointer
     * speed so a flick actually moves the hand (Drip Lab: k 90 slow … 700 flick).
     * @param {number} [t] event timeStamp (ms) — needed for throws
     */
    setTarget(px, py, t) {
      target.x = px / S;
      target.y = py / S;
      if (t === undefined) return;
      const last = samples[samples.length - 1];
      samples.push({ t, x: target.x, y: target.y });
      if (samples.length > 8) samples.shift();
      if (last && t > last.t) {
        const Uptr = Math.hypot(target.x - last.x, target.y - last.y) / ((t - last.t) / 1000);
        hand.k = 90 + 610 * smooth(0.3, 1.5, Uptr);
      }
    },
    /** Teleport the hand (pointerdown) so paint never trails from the last stroke. */
    placeHand(px, py, t) {
      hand.x = target.x = px / S;
      hand.y = target.y = py / S;
      hand.vx = hand.vy = 0;
      hand.k = 90;
      pressT = t ?? null;
      samples.length = 0;
      if (t !== undefined) samples.push({ t, x: hand.x, y: hand.y });
    },
    /**
     * Pointer released at time t (ms): a fast release throws the paint on the stick as a
     * drop train along the gesture; a quick tap dumps it straight down as a splash.
     * @returns {'throw'|'dump'|null} what happened
     */
    release(t) {
      if (pressT === null || t === undefined || spatter) return null;
      const { U, ux, uy } = releaseVelocity(t);
      const held = t - pressT;
      pressT = null;
      samples.length = 0;
      if (U >= THROW_U) {
        throwSlug(U, ux, uy, 'throw');
        return 'throw';
      }
      if (held <= TAP_MS) {
        throwSlug(0, 1, 0, 'dump');
        return 'dump';
      }
      return null;
    },
    setPouring(on) {
      pouring = !!on;
    },
    step,
    spread,
    idle,
    flush,
    overlay,
    /** @returns {{parcels:number,drops:number,pools:number}} debug counts */
    counts: () => ({ parcels: parcels.length, drops: drops.length, pools: pools.length })
  };
}
