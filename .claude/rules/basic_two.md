We use bun not npm

For styling we are only dark mode
dark mode = dark background var(--black-oil-1000) light border 2px solid --white-ghost-100

Do not introduce new style files unless necessary; prefer existing classes and variables.

- In-app pages: `DashboardLayout` + `AppSidebar` from `@/components` (not `app-container`); buttons assume dark tokens on `app-shell dark`
- Content width presets: see [layout-widths.md](layout-widths.md) (`contentWidth`: narrow / medium / full)
- Sidebar drag: set `user-select: none` on body while resizing; snap-to-collapse threshold 160px; persist storage on mouseup only; never inline styles on `hover-slide-menu__btn-label`
- API route catch blocks: use `apiHttpError` from `@/lib/api/apiHttpError` (never raw `err.message` on 500)
- HTML rendered with `dangerouslySetInnerHTML` must pass through `sanitizeHtml` first (`@/lib/media/sanitizeHtml.js` in client/components)
- **Node prod API routes** (Fluid Compute, not Edge): `export const runtime = 'nodejs'`; sanitize persisted HTML via `@/lib/media/sanitizeHtml.server.js` (ESM route bundles have no global `require`)
- **Public/preview pages:** `PublicPageBlocks` uses `page-canvas wysiwyg-surface` + `WYSIWYG-surface.scss` + `useContrastColor` (`--wysiwyg-fg`, `--wysiwyg-link`); never import full `WYSIWYG.scss` on public routes — see `.claude/skills/public-page-render/SKILL.md`
