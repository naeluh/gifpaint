---
name: site-navigation
description: Decoupled navTree (unlimited nesting, hidden-until-placed), accessible public nav, design cascade, URL page tree, reorder API
---

# Site navigation

## Two trees

- **URL tree**: `SitePage.parentId` + `pathSegment` + sibling `position` → derived `Project.urlPath` (recomputed in API transactions — never PATCH `urlPath` directly). Max depth **5**; validate with `validateTreeMove` / `validateMoveBatch` (`sitePageTree.js`). Edited on **Pages** tab via `SitePagesManager` → `SitePageList` DnD (`planFlatTreeMove`, `targetIndexForFlatDrop`, `depthFromDragOffset`).
- **Visitor nav tree**: `Site.layoutConfig.navTree` — `{ id, pageId?|url?, label?, children[] }`, recursive zod `navTreeNodeSchema`, **unlimited depth**, pages hidden from nav until placed. Edited on **Navigation** tab; never touches URLs. No `navTree` → legacy page-tree nav fallback.
- Home page: `isHomePage: true`, `parentId: null`, `pathSegment: null` (URL tree only).

## Nav editing

- Pure helpers: `src/lib/sites/siteNavTreeEdit.js` (`flattenNavTreeWithDepth`, `collectNavPageIds`, `navAddPageItem` / `navAddLinkItem`, `navRemoveItem`, `navRelabelItem`, `navMoveItemToParent`, `planNavTreeMove` — no depth cap).
- `SiteNavigationPanel`: optimistic navTree state + `patchSite` (**always spread existing `layoutConfig`** — PATCH replaces wholesale), rollback on error; pool of unplaced pages (search + `useChunkedList` chunked scroll); `seedNavTreeFromPages`; basic style controls writing `navCssVars` (`parseCssVarsString` / `serializeCssVars`).
- Page config: `PageNavSection` (`PageConfigPanel.jsx`) — show-in-nav, label, parent Select (own subtree excluded); `crud('sites','update')`.
- `SiteTabNav`: Settings | Navigation | Pages | Taxonomy.

## API (URL tree)

- `POST /api/sites/[siteId]/pages/reorder` — body `{ moves: [{ id, parentId, position }] }` only; partial sibling groups OK. `applySitePageTreeMoves` then `recomputeSitePageUrlPaths`.
- `PATCH /api/sites/[siteId]/pages/[pageId]` — `parentId`, `pathSegment`, `navLabel`, `isHomePage`; on `parentId` change server assigns `position = max(siblings)+1`.
- `DELETE` — `promoteChildrenOnDelete` then recompute, one transaction.

## Public render

- `loadSiteNavTree`: navTree present → `buildNavTreeFromConfig(navTree, publishedRows, site)` (unknown pageIds dropped, children promoted; external items `{ external: true }`); else `buildSiteNavTreeFromRows` (published pages only).
- `SitePublicNav` (client; variants `sidebar` / `top-mega` / `top-flat`) — WAI-ARIA contract: real `<button aria-expanded aria-controls>` toggles (sidebar toggle is a sibling of the link), **no hover-open menus**, Esc closes + refocuses toggle, outside click closes mega (`useOutsideDismiss`), `aria-current="page"`, active trail auto-expanded, `:focus-visible` outline in nav-scoped CSS. Mega panel: "Overview" self-link first, level-2 headers, level-3+ indented sublists (no flyouts).
- Mobile drawer below `SITE_NAV_DRAWER_BREAKPOINT_PX` (768). Nav custom CSS: `sanitizeNavCustomCss` / `buildNavStyleTag`.
- Defaults: `layoutConfig.navLayout: 'left'`, `navStyle: 'sidebar'`.

## Design cascade

- `layoutConfig.siteDesign` (site defaults) → `pageDesign` (page override) → `--site-nav-*` (nav scope). CSS-var layering via `resolveDesignLayers` (`pageStyles.js`); background image `{ assetId }|{ url }` resolved server-side by `resolveDesignForRender` (`designAssets.js`) then `buildBackgroundImageStyle`; Google Fonts via `googleFontFamilies` + `googleFontLinkHref` `<link>` tags.
- Shared form: `DesignFieldsSection` (+ `cleanDesignValues` before submit); `DesignVarReference` table (`DESIGN_VAR_DEFS`, `NAV_CSS_VAR_DEFS`) beside every custom-vars/CSS textarea.

## Tests & deploy

- Unit: `sitePageTree.test.js`, `siteNavTreeEdit.test.js`, `navTreeSchema.test.js`, `siteNavTree.test.js`, `navStyles.test.js`, `pageStyles.test.js`.
- Components (SSR markup asserts — no RTL in repo): `SitePublicNav.test.jsx`, `SiteNavigationPanel.test.jsx` (needs `mock.module('next/navigation')` for `useRouter`), `SiteNavTreeEditor.test.jsx`, `PublicPageBlocks.test.jsx`.
- Manual a11y checklist: `docs/EDITOR_MANUAL_TESTS.md`.
- CI Postgres: `route.delete.integration.test.js` (runs when `CI=true` + `DATABASE_URL`). Post-deploy canary: `bun run db:count-nav-layouts`.
