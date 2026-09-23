# Site navigation tree

## Two trees — never conflate

- **URL tree** (`SitePage.parentId` + `pathSegment` + `position`): owns `Project.urlPath`. Edited on the **Pages** tab (`SitePagesManager` → `SitePageList` DnD). Depth cap **5** (`MAX_SITE_PAGE_TREE_DEPTH`), `validateTreeMove` / `planFlatTreeMove` in `sitePageTree.js`.
- **Visitor nav tree** (`Site.layoutConfig.navTree`): JSON of `{ id, pageId? | url?, label?, children[] }`, recursive zod (`navTreeNodeSchema` in `forms.js`), **unlimited depth**. Edited on the **Navigation** tab. Placing/nesting nav items NEVER touches `SitePage.parentId` or URLs.
- Pages are **hidden from nav until placed** in `navTree`. Fallback: site without `navTree` renders nav from the page tree + legacy `navLinks` (`loadSiteNavTree` branches).

## Nav tree editing (client)

- Pure helpers in `src/lib/sites/siteNavTreeEdit.js`: `flattenNavTreeWithDepth`, `collectNavPageIds`, `navAddPageItem`, `navAddLinkItem`, `navRemoveItem` (children promote), `navRelabelItem`, `navMoveItemToParent` (subtree intact, cycle-safe), `planNavTreeMove` (flat index + target depth, no cap).
- `SiteNavTreeEditor` — flat depth-first DnD (drag right = nest, `navDepthFromDragOffset` clamps to max existing depth + 1). `SiteNavigationPanel` holds optimistic state: setState → `patchSite({ layoutConfig: { ...existing, navTree } })` → rollback + inline error on failure.
- Pool of unplaced pages: `collectNavPageIds` filter + search + `useChunkedList` (IntersectionObserver, 50/chunk). "Seed from page hierarchy" = `seedNavTreeFromPages`.
- Page-level controls: `PageNavSection` in `PageConfigPanel` (show-in-nav, label, parent Select excluding own subtree) — optimistic `crud('sites','update')`.
- `layoutConfig` PATCH replaces wholesale — **always spread existing layoutConfig** when saving any one key.

## Public render (WAI-ARIA contract)

- Server: `loadSiteNavTree` → `buildNavTreeFromConfig(navTree, publishedRows, site)` (unresolved pageIds dropped w/ children promoted; external items `{ external: true }`); legacy `buildSiteNavTreeFromRows` when no navTree.
- Client: `SitePublicNav` (`variant: 'sidebar' | 'top-mega' | 'top-flat'`) — the only public nav component:
  - Expanders are real `<button aria-expanded aria-controls>`; sidebar toggle is a **sibling** of the link (link navigates, button expands).
  - **No hover-open menus.** Click/Enter/Space only; Esc closes and refocuses the toggle; outside click closes mega panels (`useOutsideDismiss` hook).
  - `aria-current="page"` on active link; active trail auto-expanded; `:focus-visible` outline ships in nav-scoped CSS (public routes have no dashboard SCSS).
  - Mega panel: own page as first "Overview" link, level-2 headers, level-3+ indented sublists — no flyout chains.
- Manual a11y checklist: `docs/EDITOR_MANUAL_TESTS.md`.

## Design cascade (site → page → nav)

- `layoutConfig.siteDesign` (zod `siteDesignSchema`) = site defaults; `pageDesign` overrides; nav overrides inside `.site-nav`. Implementation is CSS-var layering only: `resolveDesignLayers({ siteDesign, pageDesign })` in `pageStyles.js` — no merge logic.
- Background image: `{ assetId } | { url https }`; server resolves assets via `resolveDesignForRender` (`designAssets.js`, server-only) before passing to `PublicPageBlocks`; render via `buildBackgroundImageStyle` (https or root-relative only).
- Google Fonts: `googleFontFamilies` (name regex `[A-Za-z0-9 ]+`) + `googleFontLinkHref`; `<link>` tags emitted by `PublicPageBlocks`.
- Shared UI: `DesignFieldsSection` (RHF, `prefix` + `fields` props, `cleanDesignValues` before submit) in SiteForm / PageMetaForm; `DesignVarReference` table (from `DESIGN_VAR_DEFS` / `NAV_CSS_VAR_DEFS`) must sit next to every custom-vars/CSS textarea.
- Nav basic style controls write `navCssVars` via `parseCssVarsString` / `serializeCssVars` (`navStyles.js`).

## URL-tree API (unchanged)

- `POST /api/sites/[siteId]/pages/reorder` — `{ moves }`; `PATCH .../pages/[pageId]` — `parentId`, `pathSegment`, `navLabel`, `isHomePage`; `DELETE` promotes children. `recomputeSitePageUrlPaths` + cache invalidation after tree changes. Prisma tree routes: `export const runtime = 'nodejs'`.

## Tests

- `siteNavTreeEdit.test.js`, `navTreeSchema.test.js`, `siteNavTree.test.js` (buildNavTreeFromConfig), `SitePublicNav.test.jsx`, `SiteNavigationPanel.test.jsx`, `SiteNavTreeEditor.test.jsx`, `PublicPageBlocks.test.jsx` (cascade + nav), `pageStyles.test.js` / `navStyles.test.js` (design layers, fonts, bg image, var defs).
- Component tests are SSR string assertions (`renderToStaticMarkup`) — no RTL in repo. `useRouter` needs `mock.module('next/navigation', …)`.
