---
name: prisma-database-targets
description: Prisma Database Targets
---

# Prisma Database Targets

Use when configuring, migrating, or debugging Postgres connections for local Docker, Neon, or Prisma Postgres.

## When to use

- Adding or switching database targets
- Writing migration/backup scripts that need `DATABASE_URL`
- Debugging "wrong database" or adapter errors
- Documenting env vars for Vercel or local dev

## Targets

| Target | `DB_TARGET` | Runtime adapter |
|--------|-------------|-----------------|
| Local Docker | `local` | `@prisma/adapter-pg` |
| Neon | `neon` | `@prisma/adapter-neon` |
| Prisma Postgres | `prisma-postgres` | `@prisma/adapter-pg` |
| Legacy unprefixed | `auto` (default) | auto-detect from URL |

## Env vars (never invent URLs)

```bash
# Switch target
DB_TARGET=prisma-postgres

# Prisma Postgres — paste from Console → Connect to your database
PRISMA_POSTGRES_DATABASE_URL=...
PRISMA_POSTGRES_DIRECT_DATABASE_URL=...

# Neon — when using prefixed mode
NEON_DATABASE_URL=...          # -pooler host
NEON_DIRECT_DATABASE_URL=...   # direct host

# Local — optional prefixed overrides
LOCAL_DATABASE_URL=postgres://postgres:postgres@localhost:5432/oss
```

Secrets go in `.env` / `.env.local` only (gitignored).

## Code entry points

- [`lib/databaseEnv.js`](../../lib/databaseEnv.js) — `resolveDatabaseUrls`, `applyDatabaseEnv`, `detectDatabaseProvider`, `redactDatabaseUrl`
- [`lib/prisma.js`](../../lib/prisma.js) — runtime singleton
- [`prisma.config.ts`](../../prisma.config.ts) — CLI datasource URL

Import `prisma` from `lib/prisma.js` in app code. Call `applyDatabaseEnv()` at the start of CLI scripts after `dotenv/config`.

## Migration commands (bun)

```bash
# Respects DB_TARGET from .env
bun run db:migrate
bun run db:migrate:deploy

# Override target for one run
bun run db:migrate -- --env neon
bun run db:migrate -- --env prisma-postgres
```

## Rules

1. Migrations require direct `postgres://` URLs — not `prisma://` Accelerate strings
2. Use `redactDatabaseUrl()` when logging connection info
3. Do not add TypeScript or new dependencies for target switching — extend `lib/databaseEnv.js`
4. Same schema/migrations apply to all targets; no per-target schema forks
5. Run `bun test lib/databaseEnv.test.js` after changing resolver logic

## Prisma Postgres setup checklist

1. Create database in [Prisma Console](https://console.prisma.io)
2. Copy Connect tab URLs into `.env.local` as `PRISMA_POSTGRES_*`
3. Set `DB_TARGET=prisma-postgres`
4. `bun run db:migrate:deploy`
5. `bun run test`
