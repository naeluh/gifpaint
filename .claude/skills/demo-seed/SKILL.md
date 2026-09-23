---
name: demo-seed
description: Local demo seed script — artists, cohorts, terms, tags, wipe
---

# Demo seed (local only)

## Commands

```bash
bun run db:seed-demo                    # defaults: 4 artists, 1 cohort, 12 tags
bun run db:seed-demo -- --artists=6 --cohorts=2 --tags=15 --pages=3
bun run db:seed-demo -- --no-b2         # skip Backblaze (no credentials)
bun run db:wipe-demo                    # remove manifest + @demo.oss.local users
```

## Demo markers

- Users: `*@demo.oss.local`, usernames `demo-*`, DIDs `did:plc:demo*`
- Slugs: `demo-*` prefix on cohorts, tags, pages
- Manifest: `.cache/demo-seed-manifest.json` (`isDemo: true`) — required for clean wipe

## CLI scripts must not import `server-only` modules

Self-contained like `propagateCohortTerms.js`; B2 via `scripts/lib/demoSeedAssets.js` + sharp placeholders.
