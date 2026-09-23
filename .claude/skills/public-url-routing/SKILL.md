---
name: public-url-routing
description: Public URL resolution algorithm and pre-flight checklist
---

# Public URL Routing Skill

## Pre-flight

1. `RESERVED_PUBLIC_ROUTE_SEGMENTS` in `routes.js` (includes `taxonomy`; separate from `RESERVED_USER_SEGMENTS`).
2. Route folder: `[root]/[[...path]]` — rename atomically with `package.json` test path.
3. Deploy `/cohorts/new` before enabling `/cohort/:slug` redirects.

## Resolution order (`resolvePublicRoute`)

1. `RESERVED_PUBLIC_ROUTE_SEGMENTS` → notFound
2. **`UrlRedirect` lookup** — exact path → redirect (301)
3. `resolveRootEntity(root)` → user | cohort (if no match, try ROOT site page at `/[urlPath]`)
4. Empty path → home page or hub
5. `path.length >= 2` → `findPublicProjectSitePage` (legacy PROJECT sites during shadow mode)
6. Archived HTML
7. `findPublicSitePage` (USER/COHORT; `publishStatus=PUBLISHED`)
8. Legacy user page fallback
9. notFound

## Taxonomy archives (separate from unified resolver)

- `/project/[slug]` — canonical; `resolveTaxonomyArchive(slug, { role, viewerUserId })`
- `/taxonomy/[slug]` — alias with `<link rel="canonical" href="/project/[slug]">`
- Lookup: **group first**, then term
- CRUD: `/taxonomy/*` only (no static segments under `/taxonomy/`)
- ACL: `canCreateGroup` / `canCreateTerm` / `canReadGroup` in `src/lib/taxonomyAccess.js` — routes must not inline Prisma ACL

## Page editor vs archive

- Editor: `/pages/[slug]/edit` (`pageEditPath`)
- `/project/[slug]/edit` → redirect to editor
- Do not conflate `Project.slug` (page) with `TaxonomyTerm.slug` (archive)

## Draft pages

- `publishStatus=DRAFT` — not publicly routable
- Preview: `/preview/[rkey]` (owner)
- Publish: `POST /api/pages/[rkey]/publish` with `targetSiteId` + `urlPath` (USER site default via `defaultPublishSiteId`; categories via `applyPublishTermDefaults` server-side)

## Test checklist

- Redirect row returns 301 before content resolution
- `/project/[termSlug]` renders term archive; `/pages/[pageSlug]/edit` loads editor
- `uniqueSiteSlug` checks TaxonomyGroup + TaxonomyTerm pools
- Anonymous viewer + COHORT-only taxonomy → 404
