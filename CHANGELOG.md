# Changelog

## [Unreleased]

### Added
- **Accounts** — Better Auth (email + password, Google, GitHub) self-hosted in Vercel functions
  (`api/auth.js`, rewritten from `/api/auth/*` by `vercel.json`); DB-backed rate limiting.
- **Cloud save / share links / gallery** — Neon Postgres `projects` table with `private` /
  `unlisted` / `public` visibility; `/?p=<id>` opens a shared project (before the local
  autosave); **browse** sheet lists your projects and the public gallery. `api/projects.js`.
- **Uploads to Backblaze B2** — uploaded images/videos are pushed through presigned PUTs
  (`api/upload.js`, type + size signed, exact MIME allowlist, 100 MB each, 1 GB/user/day) and
  swapped for permanent public URLs before a cloud save; PNG thumbnails likewise.
- Neon project link (`.neon`, `neon.ts`), schema in `db/auth.sql` + `db/schema.sql`.
- Tests: `test/api.test.mjs` (asset-URL allowlist, body/upload validation, auth path restore,
  client upload swap), wired into `bun run test`.
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
- **Cloud UI redone after Kuzic + oss-design-prototype** — no native `prompt`/`confirm`: name,
  share, delete-confirm and sign-in are native `<dialog>` sheets with one chrome (bottom sheet on
  phones, reduced-motion honoured); share sheet with *who can open it* replaces the gallery
  checkbox; copy confirms on the button (clipboard, then an in-modal textarea fallback); avatar
  chip + popover menu for sign out; per-card popover menus with optimistic delete + rollback;
  lock marker on private cards; skeleton grid; cloud cluster pinned right of the top bar.
  Server/client error copy rewritten ("couldn't …", no em dashes).
- Global `[hidden] { display: none !important }` — author `display` rules were beating it.
- Autosave is still local-only, but the README no longer claims nothing leaves the browser: the
  cloud buttons do.
- GIF decode cap: fixed 480px → native up to 1200px within a 40M-pixel budget.
- WebM export deselects first so selection chrome is not recorded.
