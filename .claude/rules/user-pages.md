# User Page Rules

## Data model

- Pages ARE Projects. There is no Page model.
- **Draft vs published:** `publishStatus=DRAFT` has no `SitePage`; `PUBLISHED` requires `SitePage` + `urlPath`.
- **`targetSiteId`** — intended publish site before `SitePage` exists.
- **Sites:** `USER` (was PERSONAL), `COHORT`, `ROOT`. `PROJECT` deprecated → `TaxonomyTerm`.
- **SiteAssocKind in Prisma:** use schema enum values only (`USER`, `COHORT`, `ROOT`, `PROJECT`). Never `{ in: ['USER', 'PERSONAL'] }` or other legacy aliases in queries.
- **API boundary:** Zod may accept `PERSONAL`; normalize via `normalizeSiteAssocKind()` before DB. UI checks: `isUserSiteKind()`.
- **New site kinds:** add to `schema.prisma` + migration first, then client and API.
- **USER site** — auto-provisioned on register/first auth (`ensureUserSite`); one per user; non-deletable. Admin: `/sites/me/pages`. Do not add manual USER site create flow.
- **COHORT site** — auto-provisioned on cohort create (`ensureCohortSite`); `/cohorts/new` only; `/sites/new` redirects. Members: `/cohort/[slug]/manage`. Do not ask for cohort UUID in UI.
- **`Project.urlPath`** — public segment once published. `slug` / `rkey` are internal/editor paths.
- **Taxonomy:** `TaxonomyGroup` + `TaxonomyTerm` + `PageTaxonomyTerm` (separate from `Project.taxonomy` JSON tree).
- Shared slug pool: User, Cohort, Site, TaxonomyGroup, TaxonomyTerm via `uniqueSiteSlug()`.

## Routing

- Public pages: `/[username or cohort]/[urlPath]` — **not** `/user/[username]/[path]`.
- **Site home:** empty path `/{root}/` → `findPublicSiteHomePage` (published + `isHomePage`); else hub feed. Home page also remains at `/{root}/{urlPath}` when `urlPath` is set.
- Unified resolver: `/[root]/[[...path]]` → `resolvePublicRoute()` (UrlRedirect first).
- Taxonomy archives: `/project/[slug]` canonical; `/taxonomy/[slug]` alias.
- Editor: `/pages/[slug]/edit` (`pageEditPath`). `/project/[slug]/edit` redirects.
- Preview: `/preview/[rkey]` (owner-only drafts).

## Page creation

- **Preferred:** `/sites/me/pages/new` (USER site via alias) or `/sites/[siteId]/pages/new`.
- Loose draft: `/pages/new` → `POST /api/pages` (draft default).
- `pageCreateSchema`: title required; **urlPath optional** for drafts.
- `siteId` in POST → sets `targetSiteId` only (no `SitePage` until publish).
- **Taxonomy tags at create:** when urlPath is set, `PageCreateForm` loads `GET /api/taxonomy/terms?grouped=true` (optional `siteId`) and POSTs `termIds` with the page. Uses `PageTaxonomyTerm` — not legacy `Project.taxonomy` JSON. Server rejects `termIds` on draft-only creates (no urlPath). Cohort scope: `effective = term.cohortId ?? group.cohortId`; branch on `site.assocKind`.
- Publish: `POST /api/pages/[rkey]/publish` via **DraftBanner** Dialog + **PublishPanel** (RHF, `pagePublishSchema`, term checkboxes). **Page Meta** panel also exposes site target + Publish when draft. Banner Publish disabled until title, urlPath, and targetSiteId are set (title/urlPath live from Meta form watch). No inline panel expansion.
- List drafts: `GET /api/pages?draft=true` (not `loose=true`).
- **No `useEffect` for taxonomy fetch** — load on `urlPath` input `onChange` via composed RHF `register`; fetch once per empty→non-empty transition (`termGroups.length === 0` guard).

## Preview & share

- Draft: `/preview/{rkey}`. Published: `sitePageUrl(site, project)` or `userPageUrl(username, urlPath)`.
- Taxonomy archive links: `/project/{termOrGroupSlug}`.

## Taxonomy dashboard

- Create group: `/taxonomy/group/new` → redirect to `/taxonomy/group/[id]/terms`.
- Manage terms: `/taxonomy/group/[id]/terms` (add, list, delete); `taxonomyTermNewPath(groupId)` for pre-selected group.
- Edit metadata / delete: `/taxonomy/group/[id]/edit`, `/taxonomy/term/[id]/edit`.
- `TaxonomyGroupCard`: header + **Terms** → terms page; **Edit** → group edit. Do not link card footer to public archive.
- `useSearchParams` on term create requires `<Suspense>` boundary (see dashboard page pattern).
- Group `DELETE` cascades soft-delete to child terms.

## Taxonomy ACL

- Create/read/manage gates live in [`src/lib/taxonomyAccess.js`](src/lib/taxonomyAccess.js); routes must `await canCreateGroup` / `canCreateTerm`.
- Personal group create: any authenticated user. Cohort-scoped: active `CohortMember` with `cohort.deletedAt: null`. Nested (`parentId`): non-admin must `canManageGroup` on parent; cohort + parent gates are sequential AND.
- Term create: group member AND optional `cohortId` membership; admin bypasses via `isAdminRole` early return.
- API session roles are lowercase (`admin` from `roleToApi`); never compare `'ADMIN'`.

## Tests

- Add new test files to `package.json` `"test"` script.
- Site-scoped create → draft → publish → `SitePage` exists.
