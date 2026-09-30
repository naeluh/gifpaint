# gifpaint

Paint and collage with images, animated GIFs and video in the browser, then save the
result as a PNG, an animated GIF or a WebM video — or sign in, save it to the cloud, share a
link and post it to the gallery. Successor to yourimage.io (2014) and
gifpaint.in. Vite + vanilla JS, canvas 2D, no framework; Vercel functions + Neon Postgres + Better Auth +
Backblaze B2 for the cloud side.

## Run

```bash
bun install
bun run dev        # http://localhost:5173 — canvas only, no cloud API
vercel dev         # canvas + /api (auth, cloud projects, uploads); needs .env.local, see below
bun run test       # node: scene model, drip physics, autosave store, cloud API validators
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
autosave written by the older localStorage-only build is still read on first load. Autosave
and **save** / **load** (`.json` file) never touch the network; only the cloud buttons below do.

## Accounts, cloud save, share links, gallery

- **sign in** — email + password, or Google / GitHub (Better Auth, self-hosted in `api/`;
  sessions are same-origin cookies). The sheet opens on *create an account*; the avatar chip
  (top right) opens a menu with **sign out**. Viewing a shared link or the gallery needs no account.
- **cloud save** — the first save asks for a name in a sheet; later saves update in place.
  Uploaded images/videos are first pushed to the Backblaze B2 bucket through a presigned PUT
  and swapped for their permanent URL, so each upload goes up once. A 320px PNG thumbnail
  goes along (best-effort).
- **share** — saves, makes a private project link-only, and opens the share sheet: *who can
  open it* (only you / anyone with the link / anyone, and it's in the gallery) plus the link
  with **copy link**, which confirms in place for 2 s. Opening someone else's project and
  saving makes your own copy.
- **browse** — *yours* (per-card menu: open, copy link, delete — delete asks first and the
  card leaves at once, coming back if the server refuses) and the public *gallery*.

The cloud UI follows the Kuzic and oss-design-prototype repos: native `<dialog>` sheets with one
chrome (title + close, hairline footer, cancel left of the commit, bottom sheet on phones), no
`prompt`/`confirm`, native `popover` menus, ember only on the commit, red only on destructive
commits, skeletons while loading, one-line empty states with one action, errors that say
"couldn't …" and what to do next. Browse, share, cloud save and the account chip stay pinned at
the right of the top bar; the drawing tools scroll inside their own strip.

Visibility: `private` (owner only; others get 404) · `unlisted` (link) · `public` (link +
gallery). Deleting is a soft delete; the link stops working. Saved projects may only
reference the B2 bucket, GIPHY media and picsum — anything else must be uploaded first.
Uploads: PNG / JPEG / GIF / WebP / WebM / MP4 / MOV, ≤ 100 MB each, 1 GB per user per day.

| route | does |
|---|---|
| `/api/auth/*` | Better Auth (rewritten to `api/auth.js` by `vercel.json`) |
| `GET /api/projects?id=` · `?mine=1` · `?gallery=1&before=` | one project · your list · gallery page (48) |
| `POST /api/projects` · `PUT ?id=` · `DELETE ?id=` | create · update (owner) · soft delete (owner) |
| `POST /api/upload` | `{contentType, size}` → presigned B2 PUT URL + public URL |

Database: Neon Postgres (project `paint`, branch `production`, linked via `.neon`). Schema:
`db/auth.sql` (Better Auth, generated) + `db/schema.sql` (`projects`, `uploads`). Apply with
`neon psql < db/auth.sql && neon psql < db/schema.sql`; regenerate the auth part with
`bunx auth@latest generate --config api/_lib/auth.js --output db/auth.sql` after changing
Better Auth plugins. `neon.ts` is the (empty) Neon config policy — DB only.

### Environment

| var | where | what |
|---|---|---|
| `DATABASE_URL` | prod + preview + `.env.local` | Neon pooled URL (`neon link` / `neon deploy` pull it locally) |
| `BETTER_AUTH_SECRET` | prod + preview + `.env.local` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | prod | `https://gifpaint-zakros.vercel.app` (previews resolve their own host) |
| `GOOGLE_CLIENT_ID` / `_SECRET` | prod (+ local) | optional; callback `https://<host>/api/auth/callback/google` |
| `GITHUB_CLIENT_ID` / `_SECRET` | prod (+ local) | optional; callback `https://<host>/api/auth/callback/github` |
| `B2_KEY_ID` / `B2_APP_KEY` | prod + preview | B2 application key scoped to the bucket |
| `B2_BUCKET` / `B2_REGION` / `B2_ENDPOINT` | prod + preview | e.g. `gifpaint` / `us-west-004` / `https://s3.us-west-004.backblazeb2.com` |
| `B2_PUBLIC_URL` | prod + preview | public file base, e.g. `https://s3.us-west-004.backblazeb2.com/gifpaint` |

`vercel dev` does not read `.env.local` by itself here: run
`set -a; source .env.local; set +a; vercel dev`. Without B2 vars `/api/upload` answers 503 and
projects with uploads can't be cloud-saved (GIPHY/picsum-only projects still can).

The B2 bucket must be **public** with CORS rules (web UI → bucket → CORS → custom):
`s3_get`/`s3_head` from `*` (canvas export and GIF decode read assets cross-origin) and
`s3_put` from the app origins (`https://gifpaint-zakros.vercel.app`, `http://localhost:3000`),
allowed headers `content-type`. OAuth sign-in works only on hosts registered with the
provider (production + localhost); preview URLs use email + password.

## Deploy

Production deploys from `main` through the Vercel Git integration (project `gifpaint`,
team `zakros`, repo `naeluh/gifpaint`). Merge to `main` and Vercel builds `vite build` →
`dist/`. Branch pushes get preview URLs. `bun run deploy` (`vercel --prod`) is the manual
escape hatch; `.vercelignore` keeps the legacy `gifpaint/` and `yourimage/` trees out of
CLI uploads. `vercel deploy` (no `--prod`) makes a preview for checking API changes.
Deployment Protection is on for `*.vercel.app` (anonymous visitors get a 302 to Vercel SSO),
so share links and the gallery are not public until it is relaxed in project settings;
`vercel curl <path> --deployment <url>` probes through it.
