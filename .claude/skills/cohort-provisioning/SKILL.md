---
name: cohort-provisioning
description: COHORT site auto-provision — ensureCohortSite, cohort create API, member management
---

# Cohort Site Provisioning Skill

## Contracts

### `findCohortSite(cohortId)`

- Read-only. Active COHORT site (`cohortId` + `assocKind: COHORT` + `deletedAt: null`).
- Does **not** create or restore.

### `ensureCohortSite(cohortId, ownerAuth)`

- Idempotent write path. `ownerAuth` is `{ id }` minimum; fetches `username` internally.
- Call **outside** Prisma transactions (P2002 retry).
- Active site → return as-is.
- Soft-deleted COHORT site → restore.
- No site → create with `siteCreateData` including `cohortId`.
- Returns `null` if cohort or owner username missing.

## Create flow

1. User visits `/cohorts/new` (dashboard CTA or sidebar).
2. `POST /api/cohorts` — transaction: `Cohort` + `CohortMember` (LEAD).
3. `ensureCohortSite(cohort.id, auth)` outside transaction.
4. Redirect to `siteDashboardPath(site)` from `siteUrl.js`.

`/sites/new` redirects to `/cohorts/new`. Do **not** ask for raw cohort UUIDs.

## Members

- Manage: `/cohort/[slug]/manage` (`cohortManagePath`).
- `GET/POST /api/cohorts/[id]/members` — list/add (upsert re-join after `leftAt`).
- `DELETE /api/cohorts/[id]/members/[userId]` — soft-leave; blocks last LEAD.
- `GET /api/users/search?q=` — combobox only (`hideFromLookup: false`).
- Member add by exact username ignores `hideFromLookup`.

## Backfill

`bun scripts/backfillCohortSites.js` — orphan cohorts without active COHORT site.

## Access helpers

In `cohortLookup.js` (not a separate file): `canManageCohort`, `canViewCohortMembers`, `listCohortMembers`.
