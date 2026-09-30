// run: node test/drip.test.mjs — drip physics: ops, params, thin-film spreading
import assert from 'node:assert/strict';
import {
  createDripSim, replayDripOps, landingSpeed, equilibriumThickness, spreadPool, spreadSeg,
  DRIP_DEFAULTS, DT, sliderToMu, muToSlider, TOOLS, makeSwirl, scrapeSweep
} from '../src/drip.js';

const S = 1000; // px per metre
const mk = (over = {}) => ({ color: '#ff7a4a', drip: { ...DRIP_DEFAULTS, ...over }, ops: [] });
function run(sim, seconds, onStep) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    onStep?.(i * DT);
    sim.step(DT);
    sim.spread(DT);
  }
}
const kinds = (item) => item.ops.map((o) => o.t);

// 1. stationary pour → a pool
{
  const item = mk();
  const sim = createDripSim(item, S);
  sim.placeHand(300, 300);
  sim.setPouring(true);
  run(sim, 1);
  assert.ok(item.ops.length > 0, 'ops produced');
  assert.ok(kinds(item).includes('blob'), 'stationary pour pools');
}

// 2. moving hand → line segments
{
  const item = mk();
  const sim = createDripSim(item, S);
  sim.placeHand(200, 300);
  sim.setPouring(true);
  run(sim, 1.5, (t) => sim.setTarget(200 + Math.min(t / 0.4, 1) * 500, 300));
  assert.ok(kinds(item).includes('seg'), 'moving hand lays segments');
}

// 3. fall speed param is live: 3× gravity lands sooner
{
  const firstOpStep = (gMul) => {
    const item = mk({ gMul });
    const sim = createDripSim(item, S);
    sim.placeHand(300, 300);
    sim.setPouring(true);
    for (let i = 0; i < 2000; i++) {
      sim.step(DT);
      if (item.ops.length) return i;
    }
    return Infinity;
  };
  const slow = firstOpStep(1);
  const fast = firstOpStep(3);
  assert.ok(fast < slow, `3× gravity lands sooner (${fast} < ${slow} steps)`);
}

// 4. landing speed formula + pour speed
{
  const V = landingSpeed({ v0: 0.35, H: 0.15, gMul: 1 });
  assert.ok(Math.abs(V - 1.75) < 0.02, `V ≈ 1.75 got ${V}`);
  assert.ok(landingSpeed({ v0: 1.0, H: 0.15, gMul: 1 }) > V, 'higher v0 → higher V');
  assert.ok(Math.abs(sliderToMu(muToSlider(1.5)) - 1.5) < 0.02, 'mu slider round-trips');
  const hEq = equilibriumThickness({ ...DRIP_DEFAULTS, theta: 30 });
  assert.ok(hEq > 0.0007 && hEq < 0.001, `h_eq ≈ 0.85 mm got ${hEq}`);
  assert.ok(equilibriumThickness({ ...DRIP_DEFAULTS, theta: 90 }) > hEq, 'steeper contact angle → thicker puddle');
}

// 5. replay: legacy item is a no-op, fixture of all op types draws
{
  const calls = [];
  const rec = (name) => (...a) => calls.push(name);
  const ctx = {
    globalAlpha: 1,
    beginPath: rec('beginPath'), moveTo: rec('moveTo'), lineTo: rec('lineTo'), stroke: rec('stroke'), fill: rec('fill'),
    arc: rec('arc'), ellipse: rec('ellipse'), quadraticCurveTo: rec('q'), closePath: rec('close'),
    save: rec('save'), restore: rec('restore'), translate: rec('translate'), rotate: rec('rotate')
  };
  assert.doesNotThrow(() => replayDripOps(ctx, { color: '#fff' }), 'no ops = no throw');
  assert.equal(calls.length, 0);
  replayDripOps(ctx, {
    color: '#ff7a4a',
    ops: [
      { t: 'seg', x0: 0, y0: 0, x1: 10, y1: 10, w: 6 },
      { t: 'blob', x: 5, y: 5, r: 8, ph: [0, 1, 2] },
      { t: 'splat', x: 20, y: 20, ang: 0, R: 5, el: 1.2, cx: 0.5, fingers: [[0, 3, 1], [2, 3, 0], [4, 3, 1]], sats: [[9, 0, 0.5]] }
    ]
  });
  assert.ok(calls.filter((c) => c === 'stroke').length >= 2, 'seg body + highlight stroked');
  assert.ok(calls.filter((c) => c === 'fill').length >= 5, 'blob, splat body, fingers, sat, highlights filled');
  assert.equal(ctx.globalAlpha, 1, 'alpha restored');
  // mask mode: black bodies only, no gloss ellipses (it is a source-in stencil)
  calls.length = 0;
  replayDripOps(ctx, { color: '#ff7a4a', ops: [{ t: 'blob', x: 5, y: 5, r: 8, ph: [0, 1, 2] }] }, { mask: true });
  assert.equal(ctx.fillStyle, '#000', 'mask paints opaque black');
  assert.ok(!calls.includes('ellipse'), 'no highlight in mask mode');
}

// 6. flush drains everything
{
  const item = mk();
  const sim = createDripSim(item, S);
  sim.placeHand(300, 300);
  sim.setPouring(true);
  run(sim, 0.3);
  assert.equal(sim.idle(), false, 'busy while pouring');
  sim.flush();
  assert.equal(sim.idle(), true, 'idle after flush');
}

// 7. pool spreading exponents (Huppert): const volume 1/8, const flux 1/2
const phys0 = { rho: 1200, g: 9.81, mu: 1.5, hEq: 0 };
const exponent = (feed) => {
  const rec = { V: feed ? 0 : 1e-5, R: 1e-4 };
  const dt = 0.02;
  let R1 = 0;
  for (let t = 0; t < 256; t += dt) {
    if (feed) rec.V += 1e-6 * dt;
    spreadPool(rec, dt, phys0);
    if (!R1 && t >= 1) R1 = rec.R;
  }
  return Math.log(rec.R / R1) / Math.log(256);
};
{
  const e1 = exponent(false);
  assert.ok(Math.abs(e1 - 1 / 8) < 0.125 * 0.15, `const-volume exponent ≈ 1/8 got ${e1.toFixed(4)}`);
  const e2 = exponent(true);
  assert.ok(Math.abs(e2 - 1 / 2) < 0.5 * 0.15, `const-flux exponent ≈ 1/2 got ${e2.toFixed(4)}`);
}

// 8. contact-angle stop: const volume converges at h = hEq
{
  const phys = { ...phys0, hEq: 0.85e-3 };
  const rec = { V: 1e-5, R: 1e-3 };
  let R500 = 0;
  for (let t = 0; t < 1000; t += 0.05) {
    spreadPool(rec, 0.05, phys);
    if (!R500 && t >= 500) R500 = rec.R;
  }
  assert.ok(rec.R - R500 < rec.R * 0.02, `pool practically stops creeping (<2% over 500 s) (${R500} → ${rec.R})`);
  const Rmax = Math.sqrt(rec.V / (Math.PI * phys.hEq));
  assert.ok(rec.R > Rmax * 0.9, `settles near R_max (${rec.R} vs ${Rmax})`);
  const h = rec.V / (Math.PI * rec.R * rec.R);
  assert.ok(h >= phys.hEq * 0.99, `never thinner than h_eq (${h} ≥ ${phys.hEq})`);
}

// 9. no limit while pouring: 20 s pool is > 30% wider than 10 s pool
{
  const radiusAfter = (sec) => {
    const item = mk();
    const sim = createDripSim(item, S);
    sim.placeHand(300, 300);
    sim.setPouring(true);
    run(sim, sec);
    const blob = item.ops.find((o) => o.t === 'blob');
    return blob.r;
  };
  const r10 = radiusAfter(10);
  const r20 = radiusAfter(20);
  assert.ok(r20 > r10 * 1.3, `pool keeps growing (${r10.toFixed(1)} → ${r20.toFixed(1)} px)`);
}

// 10. seg spreading exponent 1/5, and the hEq cap holds
{
  const rec = { A: 2e-6, w: 1e-4 };
  const dt = 0.02;
  let w1 = 0;
  for (let t = 0; t < 256; t += dt) {
    spreadSeg(rec, dt, phys0);
    if (!w1 && t >= 1) w1 = rec.w;
  }
  const e = Math.log(rec.w / w1) / Math.log(256);
  assert.ok(Math.abs(e - 0.2) < 0.2 * 0.15, `planar exponent ≈ 1/5 got ${e.toFixed(4)}`);
  const phys = { ...phys0, hEq: 0.85e-3 };
  const capped = { A: 2e-6, w: 1e-4 };
  for (let t = 0; t < 100; t += 0.05) spreadSeg(capped, 0.05, phys);
  assert.ok(capped.w <= capped.A / phys.hEq + 1e-12, 'ribbon never thinner than h_eq');
}

// 11. feeding: landing inside a pool feeds it; landing far away starts another
{
  const item = mk();
  const sim = createDripSim(item, S);
  sim.placeHand(300, 300);
  sim.setPouring(true);
  run(sim, 1);
  const blobs0 = item.ops.filter((o) => o.t === 'blob');
  assert.equal(blobs0.length, 1, 'one pool under a still hand');
  const r0 = blobs0[0].r;
  run(sim, 1);
  assert.ok(blobs0[0].r > r0, 'landing inside the pool fed it (r grew)');
  assert.equal(item.ops.filter((o) => o.t === 'blob').length, 1, 'still one pool');
  sim.setTarget(900, 300);
  run(sim, 1.5);
  assert.ok(item.ops.filter((o) => o.t === 'blob').length >= 2, 'far landing starts a second pool');
}

// 12. throw: a fast release flings a drop train along the gesture that splats downrange
{
  const item = mk();
  const sim = createDripSim(item, S);
  sim.placeHand(200, 300, 0);
  sim.setPouring(true);
  let t = 0;
  for (let i = 1; i <= 10; i++) {
    t += 10;
    sim.setTarget(200 + 25 * i, 300, t); // 2.5 m/s to the right
    for (let k = 0; k < 2; k++) sim.step(DT);
  }
  sim.setPouring(false);
  assert.equal(sim.release(t), 'throw', 'fast release throws');
  assert.ok(sim.counts().drops >= 10, `drop train (${sim.counts().drops})`);
  run(sim, 1.5);
  const sp = item.ops.filter((o) => o.t === 'splat');
  assert.ok(sp.length >= 10, `splats landed (${sp.length})`);
  const meanX = sp.reduce((a, o) => a + o.x, 0) / sp.length;
  assert.ok(meanX > 450, `splats thrown downrange (mean x ${meanX.toFixed(0)} px)`);
  assert.ok(sp.some((o) => o.el > 1.2), 'oblique impact elongates splats');
}

// 13. tap: a quick press with no throw dumps a splash around the point
{
  const item = mk();
  const sim = createDripSim(item, S);
  sim.placeHand(500, 300, 0);
  sim.setPouring(true);
  run(sim, 0.05);
  sim.setPouring(false);
  assert.equal(sim.release(60), 'dump', 'quick tap dumps');
  run(sim, 1.5);
  const sp = item.ops.filter((o) => o.t === 'splat');
  assert.ok(sp.length >= 5, `dump splats (${sp.length})`);
  assert.ok(sp.every((o) => Math.hypot(o.x - 500, o.y - 300) < 250), 'splash stays around the point');
  // a slow, long press is neither
  const sim2 = createDripSim(mk(), S);
  sim2.placeHand(500, 300, 0);
  sim2.setTarget(505, 300, 400);
  assert.equal(sim2.release(400), null, 'slow long press: no throw, no dump');
}

// 14. tools: brush flick = fine cloud; baster squirt = flat, fast, tight; can = bigger pool
{
  const flick = (tool) => {
    const item = { color: '#000', brush: 'drip', drip: { ...DRIP_DEFAULTS, ...TOOLS[tool], tool }, ops: [] };
    const sim = createDripSim(item, S);
    sim.placeHand(200, 300, 0);
    let t = 0;
    for (let i = 1; i <= 10; i++) {
      t += 10;
      sim.setTarget(200 + 25 * i, 300, t);
      sim.step(DT);
    }
    sim.release(t);
    const c = sim.counts();
    run(sim, 1.5);
    return { drops: c.drops, item };
  };
  const cloud = flick('brush');
  assert.ok(cloud.drops > 100, `brush flick sprays a cloud (${cloud.drops} drops)`);
  const sp = cloud.item.ops.filter((o) => o.t === 'splat');
  assert.ok(sp.length > 100, 'cloud splats land');
  const train = flick('stick');
  assert.ok(train.drops < cloud.drops, 'stick throws fewer, bigger drops');
  const slosh = flick('can');
  assert.ok(slosh.drops <= 20, `can sloshes a few big drops (${slosh.drops})`);
  const squirt = flick('baster');
  const sq = squirt.item.ops.filter((o) => o.t === 'splat');
  const spread = Math.max(...sq.map((o) => o.y)) - Math.min(...sq.map((o) => o.y));
  assert.ok(spread < 120, `baster squirt stays tight (${spread.toFixed(0)} px across)`);
  // can pours far more paint: bigger pool for the same still second
  const still = (tool) => {
    const item = { color: '#000', brush: 'drip', drip: { ...DRIP_DEFAULTS, ...TOOLS[tool], tool }, ops: [] };
    const sim = createDripSim(item, S);
    sim.placeHand(300, 300, 0);
    sim.setPouring(true);
    run(sim, 1);
    return item.ops.find((o) => o.t === 'blob').r;
  };
  assert.ok(still('can') > still('stick') * 1.5, 'can pool outgrows stick pool');
}

// 15. spatter brush: tapping emits a cone of drops that splat around the point
{
  const item = { color: '#000', brush: 'spatter', drip: { ...DRIP_DEFAULTS }, ops: [] };
  const sim = createDripSim(item, S);
  sim.placeHand(500, 300, 0);
  sim.setPouring(true);
  run(sim, 0.5);
  sim.setPouring(false);
  assert.equal(sim.release(500), null, 'spatter has nothing to throw');
  run(sim, 1.5);
  const sp = item.ops.filter((o) => o.t === 'splat');
  assert.ok(sp.length >= 40, `spatter cloud (${sp.length})`);
  assert.ok(sp.every((o) => Math.hypot(o.x - 500, o.y - 300) < 400), 'cloud stays around the tap');
  assert.ok(sim.idle(), 'spatter sim idles once the drops land');
}

// 16. marbling: Saffman–Taylor — less viscous over more viscous fingers more
{
  const unstable = makeSwirl('#000', 5, 0.5);
  const stable = makeSwirl('#000', 0.5, 5);
  assert.ok(unstable.n > stable.n && unstable.k > stable.k, 'mobility ratio drives fingering');
  assert.equal(unstable.c, '#000', 'lobes carry the older colour');
  const item = { color: '#fff', brush: 'drip', drip: { ...DRIP_DEFAULTS }, ops: [] };
  const sim = createDripSim(item, S, { under: () => ({ color: '#000', mu: 5 }) });
  sim.placeHand(300, 300, 0);
  sim.setPouring(true);
  run(sim, 0.5);
  assert.ok(item.ops.find((o) => o.t === 'blob')?.swirl, 'pool landing on wet paint marbles');
  const same = { color: '#000', brush: 'drip', drip: { ...DRIP_DEFAULTS }, ops: [] };
  const sim2 = createDripSim(same, S, { under: () => ({ color: '#000', mu: 5 }) });
  sim2.placeHand(300, 300, 0);
  sim2.setPouring(true);
  run(sim2, 0.5);
  assert.ok(!same.ops.find((o) => o.t === 'blob')?.swirl, 'same colour on same colour: no marbling');
  // mask replay: swirl cuts holes (destination-out) then restores
  const seen = [];
  const ctx = new Proxy({ globalAlpha: 1 }, { get: (t, k) => (k in t ? t[k] : (...a) => { if (k === 'ellipse') seen.push(t.globalCompositeOperation); }), set: (t, k, v) => ((t[k] = v), true) });
  replayDripOps(ctx, { color: '#fff', ops: [{ t: 'blob', x: 5, y: 5, r: 8, ph: [0, 1, 2], swirl: unstable }] }, { mask: true });
  assert.ok(seen.includes('destination-out'), 'mask mode cuts the fingers out of the stencil');
  assert.equal(ctx.globalCompositeOperation, 'source-over', 'composite op restored');
}

// 17. scrape: pools shrink and streak in their own colour / source; ribbons smear; undo-safe (pure ops)
{
  const pool = { color: '#ff0000', srcId: 'gif1', ops: [{ t: 'blob', x: 300, y: 300, r: 40, ph: [0, 0, 0] }] };
  const line = { color: '#00ff00', ops: [{ t: 'seg', x0: 290, y0: 305, x1: 310, y1: 305, w: 4 }, { t: 'seg', x0: 600, y0: 600, x1: 620, y1: 600, w: 4 }] };
  const into = { color: '#000', ops: [] };
  const n = scrapeSweep([pool, line, into], into, 200, 300, 400, 300, 30);
  assert.ok(n >= 2, `touched ${n} ops`);
  assert.ok(pool.ops[0].r < 40, 'pool lost volume');
  assert.ok(into.ops.length >= 2 && into.ops.every((o) => o.c === '#ff0000' && o.src === 'gif1'), 'streak keeps the pool colour + source');
  assert.ok(into.ops.some((o) => o.x1 > 400), 'streak runs out along the drag');
  assert.equal(line.ops[1].x0, 600, 'ribbon outside the swath untouched');
  assert.equal(scrapeSweep([pool], into, 0, 0, 0.1, 0, 30), 0, 'no-op for a zero-length drag');
}

console.log('drip.test: all assertions passed');
