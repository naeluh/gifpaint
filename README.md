# gifpaint

Paint and collage with images, animated GIFs and video in the browser, then save the
result as a PNG, an animated GIF or a WebM video. Successor to yourimage.io (2014) and
gifpaint.in. Vite + vanilla JS, canvas 2D, no framework.

## Run

```bash
bun install
bun run dev        # http://localhost:5173
bun run test       # node: scene model, drip physics, autosave store
bun run build      # dist/
```

Dev self-tests: `/?selftest` paints every brush with a live GIF; `/?selftest=drip` drives
drip, throw, tap, spatter, marbling, scrape and handle-resize through the real pointer handlers;
`/?selftest=pollock` lays an Autumn Rhythm-style composition with the simulator. Both set
`document.title` to `SELFTEST-PASS …` or `SELFTEST-FAIL <reason>`.

## Tools

- **paint** (B) — brushes below. **select** (V) — click to select, drag to move, drag a corner
  handle to resize (uniform, 0.05×–8×), sliders for scale / rotate / opacity. **stamp** (S) —
  place the picked asset where you click.
- Library: GIPHY gifs (search), picsum images, uploads (drop images or video anywhere).
  Click a cell to pick it as the paint source; the **+** places it on the canvas.
- Placed media lands at its **native size** (only shrunk to fit the canvas). GIFs decode at
  native size up to 1200px / 40M total frame pixels.
- Undo ⌘Z, redo ⇧⌘Z, Delete removes the selection.

## Brushes

| brush | what it does |
|---|---|
| reveal | ribbon mask that reveals the picked gif/image (the original mechanic) |
| image | stamps the asset along the path, velocity-sized |
| ink / glow / spray | colour strokes; with an asset picked they reveal it through the shape |
| rainbow | hue cycles along the path |
| drip | Pollock pour physics (stick / brush / baster / can) — see below; with an asset picked the pour reveals it (source-in) |
| spatter | tap a loaded brush: a cone of ligament-breakup drops, Weber/Reynolds impact; reveals a picked asset |
| scrape | drag a tool (width = size) through wet paint: pools shrink and streak in their own colour or gif/video, ribbons and dots smear |
| eraser | destination-out |

### Drip brush

A viscous thread leaves a stick you drag, falls, and either coils (hand slower than the
thread), meanders, or lays a straight line (hand faster than the thread's landing speed).
Thin paint or a high stick pinches into drops that splat with Weber/Reynolds-driven
fingers and satellites. Everything that lands keeps spreading as a thin film (lubrication
equation, Huppert gravity-current similarity solutions) until surface tension stops it at
the contact-angle thickness; paint poured onto a wet pool merges into it, and paint poured
onto one spot mounds up and becomes a pool. There is no supply limit.

**Tools** on the pill pick what you pour from — each seeds the sliders and decides what a flick
throws (flow rates are calibrated so lines land at Pollock's 3–7 mm):

| tool | pour | flick (fast release) |
|---|---|---|
| stick | 1 mm thread, 0.25 m/s (0.8 mL/s) | a drop train along the gesture, lobbed |
| brush | thin ligaments that pinch off early (0.5 mL/s) | a fine spatter cloud (hundreds of drops) |
| baster | pressurized jet, 2 m/s (4 mL/s): taut "liquid pen" lines | a flat squirt along the jet |
| can | wide slow pour (45 mL/s): ropes and huge pools | a slosh of a few big drops |

A quick tap with no throw dumps the paint on the stick straight down as a crown splash.
**Wet-on-wet:** a pool landing on another layer's wet pool marbles — Saffman–Taylor fingering,
more and deeper fingers the less viscous the new paint is relative to the old; with assets
picked the fingers cut through to the older layer's gif or video. Thin, wetting paint feathers
its pool rims into the canvas weave; thick enamel keeps clean rims. The second colour input
sets the canvas colour (unprimed cotton duck ≈ `#c9b48a`).

The pill under the canvas exposes the physics:

| slider | param | range | effect |
|---|---|---|---|
| viscosity | μ | 0.03–63 Pa·s (log) | thinned enamel → honey; breakup, coiling, spreading speed |
| height | H | 2–100 cm | fall height → landing speed, drop trains |
| stream | a₀ | 0.8–20 mm | thread radius → flow rate Q = πa₀²v₀ |
| fall speed | g× | 0.1–3× | gravity multiplier — vertical speed of drops and lines |
| pour speed | v₀ | 0.05–4 m/s | speed paint leaves the tool (a baster jets) |
| wetting | θ | 5–90° | contact angle → how far a pool spreads (h_eq = 2·l_c·sin θ/2) |

Pick a gif, image or video in the library and the poured shapes become the mask that
reveals it (`globalCompositeOperation: 'source-in'`, same path as ink/glow/spray); unpick it
to pour colour. "lands at" shows the live landing speed V = √(v₀² + 2gH). A drip stroke is a normal layer:
undo, move, opacity, layers panel, GIF/WebM export and project save all work. Internals:
`.claude/skills/drip-brush/SKILL.md`.

## Export

PNG snapshot; animated GIF (duration input, 15 fps, ≤640px wide); WebM via MediaRecorder.
**save / load** writes and reads a `.json` project file (scene + asset URLs).

## Autosave and state

The scene autosaves 800 ms after every change to **IndexedDB** (`gifpaint` / `kv` /
`project`), falling back to `localStorage` when IndexedDB is unavailable. IndexedDB has no
5 MB cap, so uploaded images and videos (stored as data URLs) survive a reload. An
autosave written by the older localStorage-only build is still read on first load. Nothing
leaves the browser: no server, no account. To move work between machines use **save** /
**load**.

## Deploy

Production deploys from `main` through the Vercel Git integration (project `gifpaint`,
team `zakros`, repo `naeluh/gifpaint`). Merge to `main` and Vercel builds `vite build` →
`dist/`. Branch pushes get preview URLs. `bun run deploy` (`vercel --prod`) is the manual
escape hatch; `.vercelignore` keeps the legacy `gifpaint/` and `yourimage/` trees out of
CLI uploads.
