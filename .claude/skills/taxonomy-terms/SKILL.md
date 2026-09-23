---
name: taxonomy-terms
description: Taxonomy terms (no groups)
---

# Taxonomy terms (no groups)

## Model

- **Terms only** — `TaxonomyTerm.parentTermId` self-relation, max depth 3.
- **Tags** — flat `Tag` model; `/tag/[slug]`; `PageTag` (max 10), `SiteTag` (max 50).
- **Parent terms** — auto-provisioned root term per USER/COHORT site (`parentTerm.js`); `SiteTaxonomyTerm.isDefault`.
- **Slug uniqueness** — root slugs global; child slugs unique per parent (partial indexes).
- **Nested URLs** — `/{username|cohort}/[child]/[grandchild]` via `termPathResolve.js`; `/term/[slug]` redirects when mappable.
- **Page connections** — `PageTermConnection` (D3 relative-path match); cohort archives use `connected=true` rows.

## Key files

| Area | Path |
|------|------|
| Hierarchy | `src/lib/taxonomy/termHierarchy.js` |
| Parent provision | `src/lib/taxonomy/parentTerm.js`, `siteTerms.js` |
| Connections | `src/lib/taxonomy/termConnection.js`, `relativePath.js` |
| Path resolve | `src/lib/taxonomy/termPathResolve.js` |
| Tags | `src/lib/taxonomy/tagLookup.js`, `TagCombobox` |
| ACL | `src/lib/taxonomy/taxonomyAccess.js` (`allowMemberTermCreate`) |
| Lookup | `src/lib/taxonomy/taxonomyLookup.js` |
| Admin tree | `src/components/TaxonomyTermTree/` |
| Public page | `src/components/TermPageView/`, `/term/[slug]` |
| Picker | `src/components/TaxonomyTermPicker/` + `useTermSearch` |
| Permissions | `/{cohortSlug}/permissions`, `/api/cohorts/[id]/permissions/*` |
| Backfill | `scripts/migrateGroupsToTerms.js` |

## API

- `GET /api/taxonomy/terms?assignable=true&siteId=` — root sections with flat descendant terms
- `GET /api/taxonomy/terms?tree=true` — nested tree for admin
- `GET /api/taxonomy/terms?q=&maxDepth=` — combobox search
- `PATCH /api/cohorts/[id]` — `allowMemberTermCreate`
- `GET/PATCH /api/pages/[rkey]/term-connections` — connect/disconnect (D18/D19)
- `GET/PATCH /api/pages/[rkey]/tags` — page tags (max 10)
- `GET/PATCH /api/sites/[siteId]/taxonomy` — site terms + tags
- `GET/POST /api/tags` — tag search/create
- Term blocks: `/api/taxonomy/terms/[id]/blocks` (GET|POST|DELETE clear); `/api/taxonomy/term-blocks/[id]` (PATCH|DELETE); `/api/taxonomy/term-blocks/reorder`

## LEAD page override

- `findManageableProjectBySlugOrRkey` + `canManageCohortPage` in `projectLookup.js`
- LEAD may PATCH page metadata/taxonomy/visibility on cohort-site pages; not DELETE/publish/blocks

## Migration order

0. `bun scripts/validateTermMigrationReadiness.js` — fail fast on duplicates/reserved slugs
1. `bun scripts/dedupeRootTerms.js` — if duplicate user/cohort root terms (e.g. `*-projects` from site migration)
2. Apply `20260625120000_term_tag_taxonomy` migration
3. `bun scripts/backfillParentTerms.js`
4. `bun scripts/seedPageTermConnections.js` — before cohort archive feed deploy (D36)
4. Final migration drops group tables: `20260619120000_taxonomy_drop_groups_step2`
