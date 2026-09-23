---
name: taxonomy-push-model
description: Push-model taxonomy — cohort terms propagate to member sites; pages use PageTaxonomyTerm
---

# Taxonomy push model

## Data flow

1. Cohort creates child term → `propagateCohortTermToMemberSites` → `SiteTaxonomyTerm` on each member USER site
2. Member picks term in `TaxonomyTermPicker` → `PageTaxonomyTerm` on publish/config
3. Cohort archive reads `PageTaxonomyTerm` (not `PageTermConnection`)

## Key modules

| Module | Role |
|--------|------|
| `cohortTermPropagation.js` | propagate, unpropagate, `loadPropagatedTermIds`, `getMemberUserSiteIds` |
| `userSite.js` | `findOldestUserSite` (not in propagation module) |
| `termAncestors.js` | `checkPropagatedCohortPathConflict`, BFS ancestor fetch |
| `taxonomyAccess.js` | `isTermAssignableToSite(term, siteCohortId, propagatedTermIds?: Set)` |

## Rules

- `propagatedTermIds` is `Set<string>` end-to-end
- Backfill: `propagateAllCohortTermsToUser(..., { invalidateCache: false })` then one `invalidatePublicContent({})`
- `PageTermConnection` PATCH → 410; product uses push model only
- Tags (flat) ≠ terms (categories): `TagCombobox` + `/api/pages/[rkey]/tags`; terms via `TaxonomyTermPicker`
