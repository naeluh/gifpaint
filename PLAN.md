# gifpaint — editing platform plan

Successor to yourimage.io (2014) + gifpaint.in. Browser tool to paint/collage
with images and animated GIFs, then save the result as artwork (PNG, animated
GIF, WebM video).

## Stack

- Vite + vanilla JS (already here). No framework.
- Drop paper.js — own scene model + raw canvas 2D render loop (animated GIF
  strokes need per-frame redraw anyway; paper fights that).
- Deps added: `gifuct-js` (GIF decode), `gifenc` (GIF encode). Video export
  uses native `canvas.captureStream` + `MediaRecorder` (zero deps).

## Core model (src/scene.js)

- `sources`: registry `{id, kind:'img'|'gif', url, thumb}` — library assets.
- `items`: ordered scene list (the "layers"):
  - `{type:'image', srcId, x,y, scale, rotation, opacity}`
  - `{type:'stroke', brush, color, size, srcId?, points:[{x,y,v}], opacity, seed}`
- Render: rAF loop, clear, draw items in order. GIF sources expose
  `frameAt(now)` so every stamp/stroke animates live.
- Undo/redo: snapshot `items` (structuredClone) per committed action, capped
  stack. Covers add/remove/move/paint/clear — the "roll back" ask.
- Autosave scene JSON to localStorage + Save/Load `.json` project files.

## Brushes (src/brushes.js)

1. **image** — stamps current library asset along the path, velocity-sized (the classic).
2. **reveal** — stroke is a mask revealing the asset (yourimage.io effect).
3. **ink** — round line, velocity width.
4. **glow** — neon shadowBlur line.
5. **rainbow** — hue cycles along path.
6. **spray** — seeded particle dots.
7. **eraser** — destination-out.

## Library panel (src/library.js)

- Tabs: **GIFs** (GIPHY trending + search, existing key), **Images**
  (picsum.photos random, CORS-safe), **Uploads** (file/drag-drop → dataURL).
- Click asset = current paint source; "add" stamps it as an image item.

## Editing

- Tools: paint, select/move (drag), stamp.
- Selected item: props bar (scale / rotation / opacity sliders, delete),
  layers panel (right): thumbnails, reorder up/down, delete, click-select.
- Keys: ⌘Z / ⇧⌘Z, Delete, B/V/S tools.

## Export (src/export.js)

- PNG: `canvas.toBlob`.
- Animated GIF: offscreen render N frames (duration input, 15fps, ≤640px) →
  gifenc → download.
- WebM video: MediaRecorder on live canvas (feature-detected).

## Files

`index.html`, `src/style.css`, `src/main.js` (wiring/tools/UI),
`src/scene.js`, `src/brushes.js`, `src/gif.js` (decoder/player),
`src/library.js`, `src/export.js`, `test/scene.test.mjs` (model+undo check).

## Design (Kuzic-borrowed, see ../Kuzic/DESIGN.md)

Graphite floor + warm halo + grain, lifted-glass panels (inset rim + bloom),
one orange ember for anything that acts, whisper focus rings. Plus: library
skeleton cells while GIPHY loads (no spinners), spinning-plus create
affordance on cell hover, warm one-line empty states ("No uploads yet — drop
an image anywhere."), radius ladder 6/16/99, library cells are real buttons
(`aria-pressed`), `prefers-reduced-motion` kills shimmer + plus spin.

## Verify

`node test/scene.test.mjs`, `bun run build`, `bun run dev` manual drive.
