# Taxonomy CRUD

## Term create order

`resolveTermCohortId` → `canCreateTerm` → resolve slug → `checkJoinedCohortPathConflict` (USER only) → create

## Page taxonomy writes

1. `expandPageTermIdsWithRoots(submittedIds)` — first
2. `isTermAssignableToSite` on **every id in expanded set** — security invariant
3. Persist expanded ids to `PageTaxonomyTerm`

## Assignability

```js
isTermAssignableToSite(term, siteCohortId, memberCohortIds)
// USER site: personal terms OR term.cohortId in memberCohortIds (Set from loadMemberCohortIds)
// COHORT site: cohort terms for site.cohortId only; personal terms rejected
```

Load `memberCohortIds` once per request when syncing page taxonomy on USER sites.

## Site settings

`PATCH /api/sites/[siteId]/taxonomy` — `tagIds` only. Default root is provisioned (`SiteTaxonomyTerm.isDefault`); not editable via API.

## Schemas (`forms.js`)

- `taxonomyTermCreateSchema` — terms/categories
- `tagCreateSchema` — flat tags (`title`, optional `slug`)
- `siteTaxonomyPatchSchema` — `{ tagIds: uuid[] }`
- `pagePublishSchema` — includes `applySiteTags?: boolean`
- `pageTagsPatchSchema` — `{ tagIds: uuid[] }`

## Deprecations

- `PageTermConnection` — legacy; do not wire new UI to `TermConnectionControl`
- `loadPropagatedTermIds` — deprecated; use `loadMemberCohortIds`
- `checkPropagatedCohortPathConflict` — alias for `checkJoinedCohortPathConflict`
