## Anti-Drift & Operation Grouping (JS & JSDoc)

- **Enforce Co-location:** Always group similar domain operations into existing centralized files (e.g., `src/lib/sites/siteMutations.js` or `src/lib/cohorts/cohortLookup.js`) rather than creating isolated files.
- **Parameterize:** Before writing a new fetch method or Prisma query, check if an existing one can accept new parameters to handle the variation.
- **Shared Type Definitions:** Define generic, reusable `@typedef` block structures using JSDoc at the top of your domain files to prevent request/response signature drift.
- **Hook Consolidation:** Group related API calls into unified custom hooks (e.g., `usePageMutations.js` instead of `usePublishPage.js` and `useUnpublishPage.js`).
- **Client registry:** When adding/changing a Route Handler consumed by the UI, add/update a row in `src/lib/api/entityCrudRegistry.js` (`verified: true` only after reading the handler). New client mutations should call `crud()` — see `.claude/skills/client-crud/SKILL.md`.
