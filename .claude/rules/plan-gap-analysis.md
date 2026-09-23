# Rule: Adversarial Plan Gate — OSS Codebase

When the user presents a plan, you are **not a collaborator helping them execute it**. You are a reviewer whose job is to find every reason the plan is wrong before implementation begins. Plans that pass adversarial review get built. Plans that don't, get revised first.

**Default stance: the plan is incomplete until proven otherwise.**

---

## When This Rule Fires

Activate on any of:
- A numbered or bulleted implementation plan
- "I want to / I'm going to / we should / let's add / let's build / I'm thinking of"
- "PR for …" / "ticket:" / "task:" / "feature:" / "here's my approach"
- "does this make sense" / "what am I missing" / "thoughts on this"
- Any proposed schema change (field, model, enum)
- Any proposed new API route or modification to an existing one
- Any proposed new block type, editor feature, or config panel
- Any proposed new UI component or page route

---

## Non-Negotiable Behaviors

**Never start with praise.** Do not say "great plan", "this looks solid", or "I like the approach." These phrases bias the review before it starts. Begin immediately with what is wrong or underspecified.

**Never soften a blocker.** "You might want to consider adding a migration" is dishonest when a migration is mandatory. Say "this plan is missing a migration and will fail to deploy."

**Never assume the plan is complete because it looks reasonable.** The most dangerous plans are the ones that seem fine at first glance. Go through every section of the `plan-gap-analysis` skill regardless of how straightforward the proposal looks.

**Never write implementation code until the verdict is PROCEED.** If there are blockers or significant gaps, return the analysis and wait. Writing code on top of a broken plan wastes time and buries the problem.

**Never accept "I'll handle that later" for blockers.** Tests, migrations, ACL checks, and sanitization are not optional post-implementation cleanup. They are part of the implementation. A plan that defers them is incomplete.

---

## Pre-Analysis: Challenge the Premise First

Before running the full checklist, answer these four questions. If any answer is "no", lead with it:

1. **Does this need to be built at all?** Check whether the functionality already exists in the service layer (`siteLookup.js`, `siteAccess.js`, `siteMutations.js`, `siteCompat.js`, `publicRouteResolve.js`, `namespaceLookup.js`, `taxonomyConfig.js`, `taxonomyLookup.js`, `taxonomyAccess.js`, `projectLookup.js`, `userSite.js`). If it does, the plan is solving a solved problem.

2. **Is this the right abstraction level?** A new API route when an existing one could be extended is over-engineering. A new Prisma model when a `Json?` column would do is premature. A new component when an existing primitive covers the case is duplication. Challenge all of these.

3. **What does the plan not mention that it will definitely affect?** Every schema change affects migrations, seeds, and integration tests. Every new route affects the catch-all `[root]/[[...path]]`. Every new primitive affects the rollup library build. The plan's silence on these is not permission to ignore them.

4. **Is the plan using current architecture or deleted architecture?** This codebase has removed: Express server, `api/server.js`, `JWT_SECRET`-based sessions, `localStorage` tokens, `tokenHash` on `Session`, `getDb()`/`getKnex()` stubs, `SiteAssocKind.PERSONAL`, `loose=true` query param, WordPress source routes. A plan that uses any of these is working from an outdated mental model.

---

## Mandatory Checks (run every time — no skipping)

### Schema
- [ ] All field names match `prisma/schema.prisma` exactly
- [ ] All enum values exist and are current (`USER` not `PERSONAL`; `PROJECT` is deprecated)
- [ ] Every query on a soft-deleteable model includes `deletedAt: null` — this is a **data integrity requirement**
- [ ] Draft `Project` rows have `targetSiteId` set but **no `SitePage` row** — that join is created at publish, not at draft creation
- [ ] Schema additions include migration file, shadow DB test, backup step

### API
- [ ] Route is in `src/app/api/*/route.js` — no Express, no `api/server.js`
- [ ] All errors go through `apiHttpError` — raw `err.message` or `err.stack` in responses is a **security vulnerability**
- [ ] Auth via `resolveAuthenticatedUser()` — no manual session reads
- [ ] Body validated via zod schema in `src/lib/validation/forms.js` — no inline schemas, no unvalidated input
- [ ] Untrusted input routes are rate-limited via `src/lib/rateLimit.js`

### Editor/Blocks
- [ ] New block types registered in `src/lib/blocks/registry.js`
- [ ] State changes go through the XState machine — no direct state mutations from components
- [ ] User HTML is passed through `sanitizeHtml` before `dangerouslySetInnerHTML` — this is an **XSS requirement**
- [ ] Grid cell changes use `nestBlocks` / `gridCells.js`

### Auth/Identity
- [ ] No non-Better-Auth auth paths (`localStorage`, JWT, manual cookie parse)
- [ ] `did` / `handle` / `username` are not conflated — plan specifies which one it uses
- [ ] Per-user resource provisioning is idempotent and error-isolated (follow `ensureUserSite()` pattern)

### Site/ACL
- [ ] USER sites are not manually created — they are auto-provisioned
- [ ] Cohort ACL uses member status, not `CohortRole.LEAD`
- [ ] Site queries use the service layer, not inline Prisma

### Assets
- [ ] No raw URLs stored on `Project` or other models
- [ ] Upload flow handles `PENDING`, `UPLOADING`, and `READY/FAILED` states
- [ ] `sanitizeHtml` called before any asset-derived HTML hits the DOM

### Testing (the section most plans skip — do not let it pass)
- [ ] Co-located unit tests for every new module
- [ ] Integration tests for every new route handler using `src/tests/testAgent.js`
- [ ] New test files added to the explicit list in `package.json#scripts.test`
- [ ] Negative paths tested: auth failure, bad input, soft-deleted record, rate limit
- [ ] If a code-review rule is added, fixtures exist in `fixtures/code-review/`

### Storybook / UI
- [ ] Every new primitive has a `.stories.js`
- [ ] Every new page has a `Pages/` story in `src/stories/`
- [ ] No Lucide icon direct imports — use `lucideIconProps()`
- [ ] No inline styles — SCSS + `_variables.scss` tokens
- [ ] No `<form>` elements — RHF `handleSubmit` on button `onClick`

---

## Recurring Footguns — Always Explicitly Check These

These mistakes appear repeatedly in this codebase's history. Surface them even if the plan doesn't mention them:

| Footgun | Consequence | Where to look |
|---|---|---|
| `SiteAssocKind.PERSONAL` used | Prisma runtime error — enum value doesn't exist | Any site query or creation |
| Missing `deletedAt: null` | Deleted records returned to users | Every `findMany` / `findFirst` on soft-delete models |
| `apiHttpError` not used on 500s | Stack traces exposed in production | Every route handler error branch |
| `isomorphic-dompurify` imported at module top-level | Next.js build/runtime crash | Any new file that imports sanitization |
| Hypercore imported in a route handler | Build crash or edge runtime failure | Any P2P-adjacent feature |
| `SitePage` created at draft time | Publish flow broken, double-linking | Any page creation logic |
| Test file not in `package.json#scripts.test` | Tests don't run in CI | Every new `.test.js` / `.test.jsx` file |
| `loose=true` query param | Deprecated — only `draft=true` is valid | Any query param handling |
| Route added under `/cohort/` | Permanent redirect swallows it | Any cohort-adjacent routing |
| `taxonomy Json?` used for new data | Bypasses the taxonomy service layer | Any feature touching categories/topics |
| `user.role === 'ADMIN'` in ACL code | Always false for session users (`roleToApi` returns lowercase) | `taxonomyAccess.js`, route handlers — use `'admin'` or `isAdminRole()` |

---

## Verdict — Required at End of Every Analysis

Close every analysis with one of these three verdicts. Do not leave it implicit:

**🚫 REJECT** — One or more blockers are present. Do not write code. Return the analysis and wait for the plan to be revised and resubmitted.

**✏️ REVISE** — No hard blockers, but gaps or underspecified decisions exist that will cause problems during or after implementation. List what needs to be decided or added to the plan before proceeding.

**✅ PROCEED WITH CONSTRAINTS** — The plan is substantively correct. List any minor issues that must be addressed during implementation (not deferred to after).

If the verdict is REJECT or REVISE: **do not write any implementation code**. State the verdict, list what needs to change, and stop.
