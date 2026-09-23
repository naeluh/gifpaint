---
name: drip-brush
description: Drip (Pollock pour) brush internals — src/drip.js physics sim, recorded-ops model, params, pooling rules, tests. Use when touching the drip brush, its sliders, pooling/spreading behaviour, or adding a physics-driven brush.
---

# Drip brush

## Model
- A drip stroke is a normal stroke item + `drip` (params) + `ops` (recorded deposits, **px**).
  `renderStroke` → `replayDripOps(ctx, item)` every frame. Undo/move/layers/export need no
  special casing; `offsetStroke` shifts ops (`seg` endpoints, `blob`/`splat` centres — children
  are centre-relative).
- Ops: `seg {x0,y0,x1,y1,w}`, `blob {x,y,r,ph[3]}` (mutated in place as the pool grows),
  `splat {x,y,ang,R,el,cx,fingers[[th,len,tip]],sats[[x,y,r]]}` (random choices frozen at impact).
  Highlights are derived at replay (second pass), never stored. `MAX_OPS = 30000` gates segs and
  splats only — pools are never refused.
- `canSource`: with `item.srcId` set, `renderStroke` wraps the replay in `maskSource(...)` and
  calls `replayDripOps(c, item, { mask: true })` (opaque black bodies, no gloss) — the pour is a
  source-in stencil over the cover-fit frame, exactly like ink/glow/spray. No srcId = colour.
- `src/drip.js` is **DOM-free at module level** (scene.test imports it via brushes.js).

## Sim lifecycle (main.js)
pointerdown: `dripSim?.flush()` → `beginCommit` → item → `createDripSim(item, W / WIDTH_M)` →
`placeHand` → `setPouring(true)`. pointermove: `setTarget`. pointerup: `setPouring(false)` +
`commit`. Loop: `acc = min(acc+dt, .25)`, `step(DT)` at 240 Hz, `spread(dt)` once per frame,
`overlay(ctx)` after `renderScene`; `idle()` (nothing in flight, nothing spreading) → sim = null +
`scene.onChange()`.

## Physics (metres, seconds; `S` px/m)
- Thread parcels inherit hand velocity, fall under `g = 9.81·gMul`, radius from mass
  conservation; Rayleigh–Plateau growth → drops after `NEF=7` e-foldings; sewing-machine foot
  displacement keyed on `U/V`; splats from We/Re (Laan spread, Mundo K, Aziz–Chandra fingers).
- **Pooling (D13):** `spreadPool` integrates `dR/dt = C(ρg/3μ)h³/R` in closed form
  (`R⁸ = R₀⁸ + 8k·dt`), clamped at `h_eq = 2·l_c·sin(θ/2)`; `spreadSeg` likewise (`w⁵`).
  Landing rules in `land()`: thread base inside a pool → `feed` (centroid mass-weighted);
  else paint mounding on one `site` becomes a pool once `√(V/πh_eq) ≥ coilR` **and** it would
  spread there within 1 s (μ-dependent) — coils stay visible for viscous paint, merge for runny.
  Pools whose centre falls inside another merge. Ribbons wider than `WPOOL` start a pool.
- Supply is unlimited (`Q = π a₀² v₀` constant); the Drip Lab stick `load` was deliberately dropped.

## Techniques (all in drip.js)
- `TOOLS` presets: a0/v0/mu + `nef` (pinch-off e-foldings) + `slug` (s of flow on the tip) +
  `fling` (`train|cloud|squirt|slosh`) — `release(t)` picks throw vs `dump` (tap ≤ 160 ms) from
  the pointer-sample release velocity (`THROW_U = 0.8 m/s`). **Calibrate Q first**: ribbon width is
  Q/(U·h); Q = πa₀²v₀ must land in mL/s (stick 0.8) or every line is a rope.
- `item.brush === 'spatter'` → `step()` emits `SPATTER_RATE` drops/s in a cone instead of parcels.
- Marbling: `createDripSim(item, S, { under })` — `under(px,py)` returns the topmost other layer's
  pool `{color, mu}`; `newPool` stores `op.swirl = makeSwirl(...)`. Colour replay paints lobes in
  the old colour; mask replay cuts them out (`destination-out`) so the older layer's asset shows.
- `scrapeSweep(items, into, ax, ay, bx, by, w)`: pure, mutates other items' ops; streak ops carry
  `c` (colour) and `src` (the pool's srcId) — `brushes.js` replays `src` ops through `maskSource`
  per source. Main calls it per pointermove; `dripSim?.flush()` first so no live pool fights it.
- `op.fz` = rim feathering (thin + wetting paint), `op.c` = per-op colour, `op.src` = per-op asset.

## Gotchas
- Test the thread **base** point for pool membership, not the coil-displaced foot — a still
  hand coils on a 7 mm circle and never touches a 2 mm pool otherwise (the "pool never grows" bug).
- Retire criteria are px/s (`RETIRE_PX_S`); `idle()` waits for spreading, so the overlay hides
  the stick once nothing is in flight.
- Headless proof: `--virtual-time-budget` freezes rAF → the sim never steps. Use a real-time CDP
  probe (Node 24 `WebSocket` + `--remote-debugging-port`) and read `document.title`.

## Tests
`node test/drip.test.mjs` — ops per regime, gMul/v0 live, Huppert exponents (1/8, 1/2, 1/5),
contact-angle stop, unbounded pool while pouring, feeding vs new pool, replay on legacy items,
flush. Browser: `/?selftest=drip`.

## Upgrade path
Heightfield (GPU lubrication solver) for true coalescence of partially overlapping pools,
wet-on-wet marbling, wicking, drying skin. Per-item bitmap cache if replay cost shows.
