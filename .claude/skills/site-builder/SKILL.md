---
name: site-builder
description: Site builder — Site/SitePage models, APIs, dashboard flow, public routing
---

# Site Builder Skill

## Models

- `Site`: slug (global @unique), `assocKind`, `layoutConfig`, `status` (ACTIVE | ARCHIVED | DELETED).
- `SitePage`: `projectId` @unique, `position`, `navLabel`, `isHomePage`.

## USER site auto-provision

- `ensureUserSite()` in `src/lib/userSite.js` — see [user-site-provisioning/SKILL.md](../user-site-provisioning/SKILL.md).
- Stable admin URLs: `/sites/me`, `/sites/me/pages`, `/sites/me/pages/new` → redirect to UUID paths.
- Dashboard **Your site** section uses `GET /api/me/user-site` (serial, before parallel fetches).

## Slug rules

- USER: slug = `auth.username` at provision time; **non-deletable** (archive = disable).
- COHORT site: slug = `cohort.slug` or `uniqueSiteSlug`.
- `uniqueSiteSlug` checks Site + User + Cohort + Taxonomy pools.

## Page creation

- Preferred: `/sites/me/pages/new` (sets `targetSiteId`).
- Loose draft: `/pages/new`.
- `PageCreateForm` → `POST /api/pages` → `pageEditPath(slug)`.
- Publish via `PublishPanel` → `POST /api/pages/[rkey]/publish`.

## APIs

- `GET /api/me/user-site` — ensure USER site + list item.
- `POST /api/cohorts` — cohort + LEAD membership.
- `GET /api/slugs/check?value=&scope=global|user|cohort&parentId=`
- Site CRUD, pages, archive/restore under `/api/sites/*`.

## Dashboard sections (medium width)

1. Your site — `SiteCard` from `/api/me/user-site` (`pagesUrl`, **Manage pages**, **Create first page** when `pageCount === 0`)
2. Cohort sites — filtered from `/api/dashboard/sites`
3. Taxonomy groups — `TaxonomyGroupCard` from `GET /api/taxonomy/groups`; card → `/taxonomy/group/[id]/terms` (**Terms**), **Edit** → group metadata. Create group at `/taxonomy/group/new` (title, description, slug) → terms page. Term create: `/taxonomy/term/new?groupId=`.
4. Draft pages — `PageCard` from `GET /api/pages?draft=true`

Click **Your site** header → `/sites/[id]` overview (page cards, max 6 + link to manage). Full reorder/home/nav at `/sites/[id]/pages` (`SitePageList`). USER provisioning: [user-site-provisioning/SKILL.md](../user-site-provisioning/SKILL.md).

Icons: Lucide via `lucideIconProps()` — see user-site-provisioning skill icon map.

## Hooks (`src/lib/hooks/`)

- `useSiteMutations`, `useSitePages`, `usePageMutations`, `useSlugCheck`

## Public routing

- `/[root]/[[...path]]` only.
- `loadSitePagesOverview` must pass `site` into `serializeSitePage` for `publicUrl`.

## Tests

Register new files in `package.json` `"test"` script.
