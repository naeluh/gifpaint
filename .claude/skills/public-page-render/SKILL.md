---
name: public-page-render
description: Public and preview page rendering — WYSIWYG surface typography, contrast, homepage cache
---

# Public Page Render

## Components

| Surface | File | SCSS |
|---------|------|------|
| Public + preview body | `PublicPageBlocks.jsx` | `WYSIWYG-surface.scss` |
| Media blocks in HTML | `HtmlBlockRenderer.jsx` | `WYSIWYG-media.scss` |
| Editor canvas (only) | `BlockCanvas.jsx` | full `WYSIWYG.scss` (imports surface) |

## Typography parity

- Wrap content in `className="page-canvas wysiwyg-surface"`.
- Set `--wysiwyg-fg` and `--wysiwyg-link` via `useContrastColor(background)` — mirror `BlockCanvas.jsx`.
- Prefer `pageDesign` CSS vars (`--page-text-color`, `--page-heading-color`) when set; surface SCSS reads them as fallbacks.
- Lexical export uses class-only marks (no inline `color` on paragraphs) — surface SCSS owns text color.

## Do not

- Import `WYSIWYG.scss` on public/preview (editor chrome, draggable handles, toolbar layout).
- Inline styles on `hover-slide-menu__btn-label` (unrelated but same dark-shell rule).

## Homepage

- `/{root}/` empty path → `resolvePublicRoute` → `findPublicSiteHomePage` (published + `isHomePage`).
- Toggle home: `sitePageHome.js` — publish guard, tx flip, `invalidatePublicContent` paths (`siteBasePath` + old/new `urlPath`).
- API: pass `{ site }` to `serializeSitePage` for correct `publicUrl` (home = base path).
- Nav: `loadSiteNavLinks` — home row `href: siteBasePath(site)`, label `navLabel || title`.

## Tests

- `PublicPageBlocks.test.jsx` — surface class + contrast vars
- `siteCompat.test.js` — `serializeSitePage` home `publicUrl`
- `sitePageHome.test.js`, `route.test.js`, `route.post.test.js` — home toggle + invalidation
- `siteNavLinks.test.js`, `publicRouteResolve.test.js`

## Manual check

Side-by-side editor canvas vs `/preview/{rkey}` vs public URL: headings, body text, links (hover), lists, blockquote, code blocks.
