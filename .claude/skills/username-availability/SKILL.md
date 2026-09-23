---
name: username-availability
description: Username validation, availability checks, and registration patterns. Use when editing register flow, check-username API, or User.username migrations.
---

# Username availability

## Rules

- **Immutable** after registration — no update endpoint.
- Format: `USERNAME_REGEX` in `src/lib/username.js` (3–30 chars, lowercase, alphanumeric + hyphen) — **client-safe**; no Prisma.
- DB uniqueness: `checkUsernameAvailability()` in `src/lib/usernameServer.js` (server-only; do not import from client).
- Rate limit: `checkUsernameRateLimit()` in `src/lib/usernameServer.js` (10/min/IP, in-memory).
- Reserved: `RESERVED_USER_SEGMENTS` in `src/lib/routes.js` — use `isReservedUsername()`.
- Store and query with `normalizeUsername()` (lowercase).
- `forms.js` imports only from `username.js`, never `usernameServer.js`.

## API

- `GET /api/auth/check-username?username=` — rate-limited via `usernameServer.js`.
- Sign-up: pass `username` in Better Auth `/api/auth/sign-up/email` body; validated in `databaseHooks.user.create.before` in `src/lib/betterAuth.js` (409 on conflict).

## Client

- Register page: debounce ~400ms before calling check endpoint; block submit unless `available`.
- Reuse `registerFormSchema` from `src/lib/validation/forms.js` — do not duplicate regex.

## Migration

1. Nullable column migration (`20260608000000_add_username_nullable`)
2. `bun run db:backfill-username`
3. Unique + NOT NULL migration (`20260608010000_username_required`)

## URLs

- Public pages: `userPageUrl(username, projectUrl)` → `/{username}/{projectUrl}` (`Project.url` field)
- Profile: `userPath(username)` → `/user/{username}`
- Login: email only — never username credential lookup
