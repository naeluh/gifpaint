---
name: user-site-provisioning
description: USER site auto-provision — ensureUserSite, findUserSite, auth hooks, dashboard provisioning UI
---

# User Site Provisioning Skill

## Contracts

### `findUserSite(userId)`

- Read-only. Returns active USER site or `null`.
- Does **not** create or restore.

### `ensureUserSite(userId)`

- Idempotent write path. Returns site row or `null` (missing user/username).
- Active site → return as-is.
- Soft-deleted USER site → restore (`deletedAt: null`, `status: ACTIVE`).
- No site → create with `slug = username`, `assocKind: USER`.
- `P2002` on create → `findUserSite()` (race with partial unique index).

## Call sites

| Location | When |
|----------|------|
| `betterAuth` `user.create.after` | Registration |
| `resolveAuthenticatedUser` | Every API/RSC auth (once per request) |
| `GET /api/me/user-site` | Dashboard ensure + retry |

Do **not** duplicate ensure logic in UI — call the API.

## Null handling

- API `requireAuth`: 401 if no user.
- RSC `requireSessionUser`: redirect `/login`.
- `/sites/me/*`: redirect `/dashboard?provisioning=1` if ensure fails.
- Dashboard: `useSearchParams()` for `?provisioning=1`; serial fetch `/api/me/user-site` before other lists.

## Do not

- Add manual USER site create UI (`/sites/new` is COHORT-only).
- Use `{ in: ['USER', 'PERSONAL'] }` in Prisma — enum is `USER` only; `PERSONAL` is API alias only.
- Run `GET /api/me/user-site` and `/api/dashboard/sites` in parallel for the USER site card.

## Backfill

```bash
bun scripts/backfillUserSites.js --dry-run
bun scripts/backfillUserSites.js
```

Run before migration `20260614180000_user_site_unique_active` if duplicates exist.

## Icons

Use `lucideIconProps()` from `src/lib/lucideIconProps.js` for dashboard/sidebar touchpoints.
