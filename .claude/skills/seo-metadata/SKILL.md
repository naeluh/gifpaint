---
name: seo-metadata
description: SEO metadata skill
---

# SEO metadata skill

Public `<head>` for live routes uses `src/lib/seo/` resolvers + Next.js `generateMetadata`.

## Fallback chains

| Surface | Title | Description | OG image |
| --- | --- | --- | --- |
| **Page** | `Project.title` | explicit → block extract → site | `coverAssetId` → first block image → site |
| **Term** | `TaxonomyTerm.title` | explicit → blocks → site | `coverAssetId` → block image → site |
| **Site** | `Site.name` | `Site.description` | `Site.ogImageAssetId` → `Cohort.coverAsset` |

Canonical: `Site.canonicalUrl` else `NEXT_PUBLIC_APP_URL` + public path.

## Robots (`deriveRobots.js`)

- **Project:** `PUBLIC` + `PUBLISHED` + active + `siteLink` + site `ACTIVE` + site `PUBLIC`.
- **Site hub:** site `PUBLIC` + `ACTIVE`.
- **Term:** term `PUBLIC` + `ACTIVE`.
- **Legacy `legacyPage`:** resolver returns no `site` → `noindex` (stricter than rare legacy URL access). Unmigrated drafts usually also lack `siteLink`.

## Basic Auth constraint

When `BASIC_AUTH_*` is set, `proxy.js` gates all public pages and `/api/assets/[id]/file`. Social crawlers get 401 — no User-Agent bypass. Do not enable Basic Auth on sites you want share previews for.

## OG preset

Upload with `?preset=OG` → 1200×630, `fit: 'cover'`, `withoutEnlargement: true` (sub-1200×630 sources crop at native size, no upscale).

## USER site default OG

`ensureUserSite` seeds `ogImageAssetId` / `faviconAssetId` from `avatarAssetId` (AVATAR preset, square). Until the owner uploads via OG preset in SiteForm, crawlers may crop awkwardly.

## Asset library `isPublic` gap (v1)

Fresh upload + `PATCH { isPublic: true }` works for the uploader. Reusing another member's library asset may 403 on PATCH. v1 expects fresh uploads in the same flow.

## Env

- **`NEXT_PUBLIC_APP_URL`** — required in production for absolute canonical/OG URLs.

## Revalidation

Site/page/term meta PATCH handlers call `revalidatePublicPaths()` for the public URL.

## Tests

`bun test src/lib/seo` (also listed in root `package.json` test script).
