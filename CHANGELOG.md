# Changelog

## [Unreleased]

### Added
- **Drip brush** — Pollock pour physics (falling thread, sewing-machine coiling, Rayleigh–Plateau
  breakup, Weber/Reynolds splats) recorded as replayable draw ops on a normal stroke item, so undo,
  move, layers, opacity, export and project save all work. Six live sliders: viscosity, stick height,
  stream radius, **fall speed** (gravity ×), **pour speed** (v₀), wetting (contact angle). Live
  landing-speed readout. With a library asset picked the poured shapes are a source-in mask that
  reveals the gif / image / video (`canSource`, same as ink/glow/spray); unpicked = colour.
- **Throwing** — a fast release flings the paint on the tool as a drop train along the gesture
  (lobbed, oblique splats with forward fingers); a quick tap dumps it straight down as a crown
  splash. The arm spring stiffens with pointer speed so flicks actually move the hand.
- **Tools** — stick / brush / baster / can presets on the drip pill (flow rate, pinch-off, slug,
  flick mode: train / cloud / squirt / slosh), calibrated to Pollock's line widths.
- **Spatter brush** — tapped loaded brush: cone of ligament-breakup drops, Weber/Reynolds impact.
- **Scrape brush** — tool dragged through wet paint: volume-conserving bite out of pools, streaks in
  the pool's colour (or its gif/video), smeared ribbons and dots. Undo covers the other layers.
- **Wet-on-wet marbling** — Saffman–Taylor fingering when a pool lands on another layer's wet pool;
  in mask mode the fingers cut through to the older layer's asset.
- **Feathered rims** on thin, wetting paint; **canvas colour** input (unprimed duck `#c9b48a`).
- **Thin-film pooling** — landed paint spreads by the lubrication equation (Huppert gravity-current
  similarity solutions: R ∝ t^1/8 / t^1/2, ribbon w ∝ t^1/5), stops at the contact-angle
  equilibrium thickness, merges when a thread lands on a wet pool, and mounds into a pool when
  coiled onto one spot. No paint-supply limit.
- **Resize handles** — drag a corner of a selected image to scale it (uniform, 0.05–8×), undoable.
  Scale slider max raised 4 → 8.
- **Native-size placement** — stamped / added media lands at scale 1, shrunk only to fit the canvas.
- **IndexedDB autosave** with localStorage fallback (`src/store.js`); legacy localStorage autosave
  still read. Uploaded video/gif data URLs now survive reload.
- Tests: `test/drip.test.mjs`, `test/store.test.mjs`; `bun run test` script. Dev self-test
  `/?selftest=drip`.
- Vercel: project `gifpaint` linked to `naeluh/gifpaint`; production deploys from `main`.
  `.vercelignore`, `bun run deploy`.

### Changed
- GIF decode cap: fixed 480px → native up to 1200px within a 40M-pixel budget.
- WebM export deselects first so selection chrome is not recorded.
