# CRUD tab navigation (config pages only)

## Scope

Use `CrudTabNav` and wrappers (`SiteTabNav`, `CohortTabNav`, `TaxonomyGroupTabNav`) on **config** surfaces:

- Site settings / pages / navigation / taxonomy (`/sites/[id]/edit`, `/sites/[id]/navigation`, `/sites/[id]/pages`, `/sites/[id]/taxonomy`)
- Cohort manage / pages / taxonomy (`/{slug}/manage`, `/{slug}/pages`, `/{slug}/taxonomy`)
- Taxonomy group terms / edit (`/taxonomy/group/[id]/…`)
- Taxonomy term new / edit (`/taxonomy/term/…`) — `TaxonomyTermTabNav` (Terms | New term or Settings)

**Excluded:** Lexical editor (`EditorShell`, `/pages/[slug]/edit`), `PageMetaForm`, `DraftBanner`, `PublishPanel`.

## Pattern

- Route-based `Link` + `usePathname()` — **not** the `Tabs` primitive.
- Tab nav **always renders**; put loading/error in the content area only (no layout shift).
- Site hub: `siteDashboardPath(site)` → `/sites/[id]/pages` (not bare `/sites/[id]`).
- Page taxonomy config: `PageConfigPanel` on `/sites/[siteId]/pages/[pageId]`; self-fetches `GET /api/pages/[rkey]/taxonomy`.

## Save feedback

Config forms use inline **Saved ✓** for 2s (`var(--color-success, #4ade80)`), not toasts.

**One Save per config page.** A config page (site, page, nav, taxonomy) has exactly one submit button that saves every section — sections contribute fields to the parent RHF form (see `PageNavSection`: presentational, fields via `form` prop, tree built on submit with `buildNextNavTree`). No per-section "Save X" buttons. Instant-apply interactions (DnD reorder, optimistic toggles) are exempt — they save on gesture, not via button.

## Data loading

Page bodies: `useResourceLoad(fetcher, deps)` — not raw `useEffect` fetch in `page.jsx`.
Form reset when async data arrives: `useEffect` + `reset()` inside the form component is OK.

## TaxonomyTermPicker

- `lucideIconProps('sm')` only (no `'xs'`).
- Term edit `Link` is a **sibling** of `Checkbox`, not inside the label.
- **USER sites:** all depth-0 roots are checkboxes; personal root is default-selected; one root set active at a time (mutual exclusion via `togglePageTermSelection` in `taxonomyScope.js`); inactive sets get `disabledIds`.
- **COHORT sites:** depth-0 cohort root is a header (no checkbox); only children are checkboxes; filter to site cohort terms only.
- `showTaxonomy` / `urlPath` gate lives in the **caller** (`PageCreateForm`), not inside the picker.
- Manage actions use **`EntityActionsMenu`** when a row/section has **2+** operations (`Add child`, `Settings`, etc.); single actions (term **Edit** checkbox row) stay as one ghost button. Destructive ops always go through **`ConfirmDialog`** (built into the menu or standalone). Only when `section.canManage`.

## TaxonomyGroupList

- Row layout matches `SitePageList` (bordered cards, ghost Terms + Settings).
- Settings link only when `canManage`; use `TaxonomyGroupListHeader` + section lists on cohort sites.
