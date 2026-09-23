---
name: plan-gap-analysis
description: Adversarially stress-test any implementation plan against this codebase. Invoke with phrases like "gap analysis", "review this plan", "what am I missing", "does this hold up", or "challenge my plan".
---

# Skill: Adversarial Plan Gap Analysis

Your job is **not** to help execute the plan. Your job is to find every way the plan is wrong, incomplete, dangerous, or unnecessary before a single line of code is written.

Treat the plan as a suspect. It is probably missing steps, probably conflicts with existing patterns, and probably solves the problem the wrong way. Prove otherwise.

Do not soften findings. Do not say "you might want to consider." Say "this will break" or "this is wrong" when that is true. The developer can decide what to do with that — your job is to surface reality, not manage feelings.

Only move to implementation after the developer has acknowledged the gaps and confirmed how they will be addressed.

---

## Adversarial Mindset: Questions to Ask Before Anything Else

Before running the checklist, challenge the premise of the plan itself:

**Does this need to exist?**
- Does the plan duplicate something already in the codebase? Check `siteLookup.js`, `siteAccess.js`, `siteMutations.js`, `siteCompat.js`, `publicRouteResolve.js`, `namespaceLookup.js`, `taxonomyConfig.js`, `taxonomyLookup.js`, `taxonomyAccess.js`, `projectLookup.js`, `userSite.js`. These service layers exist precisely so routes don't reimplement logic inline. If the plan rewrites any of this, reject it and point to the existing function.

**Does the plan solve the right problem?**
- Is the plan adding a new API route when it could call an existing one?
- Is it adding a new Prisma model when an existing model with a `Json?` field or an enum extension would do?
- Is it adding a new component when an existing primitive in `src/primitives/` already covers the use case?

**What does the plan break that it doesn't mention?**
- Every schema change has migration consequences. Every ACL change has security consequences. Every new route has catch-all collision risk. The plan almost certainly does not mention all of them. Find what it is silent about.

**Who else is affected?**
- Does the change affect P2P replication (`putPage()`, Hypercore workers)?
- Does it affect the Storybook build (`vercel-build` runs Storybook first)?
- Does it affect the rollup library build (`rollup.config.js` — `src/primitives` is published as a package)?
- Does it affect the code-review bot (`lib/codeReviewCore.js`, `lib/codeReviewRules.js`)?

---

## Checklist — Go Through Every Section, Every Time

Do not skip sections because the plan "doesn't seem to touch" them. Justify each skip explicitly if you do skip.

### 1. Schema & Data Model

- Does the plan use exact field names from `prisma/schema.prisma`? Wrong names (`published` instead of `publishStatus`, `kind` instead of `assocKind`, `path` instead of `urlPath`) will produce silent Prisma type errors that only fail at runtime.
- Does the plan use exact enum values? `SiteAssocKind.USER` (not `PERSONAL` — that enum value no longer exists and will throw a Prisma runtime error). `PagePublishStatus.DRAFT` / `PUBLISHED`. `SiteStatus.ACTIVE` / `ARCHIVED` / `DELETED`.
- Does the plan filter soft-deleted records? `User`, `Project`, `Site`, `Asset`, `ChatRoom`, `ChatMessage`, `StreamSession`, `Profile` all have `deletedAt DateTime?`. Any query without `deletedAt: null` will silently return deleted records. Call this out as a **security/data integrity issue**, not a style note.
- Does the plan navigate relations correctly? `Project → SitePage → Site` via `siteLink`. A draft `Project` has `targetSiteId` set but **no `SitePage` row** — that row is created atomically at publish. A plan that creates `SitePage` at draft time breaks the publish flow.
- Does the plan add a new field or model? Then it is missing: (a) a migration SQL file at `prisma/migrations/YYYYMMDD_name/migration.sql`, (b) a `bun db:migrate:shadow` verification, (c) a `bun db:backup` before production deploy. If the plan doesn't mention all three, flag them.
- Does the plan touch `SiteAssocKind.PROJECT`? That value is **deprecated** (shadow mode pending migration cutover). New code must not use it.
- Is the plan adding a `Json?` column where a proper relational model should exist? Push back. `taxonomy Json?` on `Project` already exists as a legacy field — new taxonomy data goes through `TaxonomyGroup → TaxonomyTerm → PageTaxonomyTerm`.

### 2. API Routes

- Is the route in `src/app/api/*/route.js`? If the plan mentions Express, a custom server, or `api/server.js`, it is using the deleted architecture. Reject it.
- Does every response error go through `apiHttpError` from `src/lib/apiHttpError.js`? A raw `res.status(500).json({ error: err.message })` or `res.status(500).json({ error: err.stack })` is a **security vulnerability** (stack traces in production). Mark it as a blocker, not a suggestion.
- Does the plan authenticate via `resolveAuthenticatedUser()`? Any bespoke session read, cookie parse, or token decode is wrong and should be replaced.
- Does the plan validate request bodies? If not, ask: what happens if the body is `{}`, `null`, or a 10MB string? Shared `zod` schemas live in `src/lib/validation/forms.js`. Inline schemas in route files are wrong.
- Does the plan add a public-facing route? Then it needs: `publicRouteResolve.js` registration and/or `namespaceLookup.js` — and it needs to survive a collision with `[root]/[[...path]]`. Test the ordering explicitly.
- Does the plan add a route that accepts untrusted input without calling `rateLimit` from `src/lib/rateLimit.js`? Flag as a **denial-of-service risk**.
- Does the plan add redirects or rewrites? They go in `next.config.js`. Middleware is the wrong place. Check for collisions with the existing redirect table before adding new ones.

### 3. Block / Editor System

- Does the plan add a block type without registering it in `src/lib/blocks/registry.js`? The block will not render. The plan is incomplete.
- Does the plan bypass the XState machine (`src/lib/editor/editorMachine.js`) to update editor state directly from a component? This will cause render loops and broken undo history. Reject it.
- Does the plan hard-code editor chrome colors instead of using `useEditorChrome`? It will fail dark mode and custom page background colors.
- Does the plan touch grid cells without using `nestBlocks` / `gridCells.js` (`cellKey`, `groupGridInnerBlocks`, `childCellKey`)? Manual cell wiring will desync on rerender. Reject it.
- Does the plan add autosave for a new field without following the debounce + conflict-check pattern in `metadataAutosave.js`? It will cause race conditions on slow connections.
- Does the plan render HTML from user content without calling `sanitizeHtml`? This is an **XSS vulnerability**. Block the plan until it adds sanitization.

### 4. Auth & Identity

- Does the plan introduce any non-Better-Auth auth path? JWT, `localStorage` tokens, manual cookie parsing, `tokenHash` reads — all of these are from the deleted architecture. Reject them.
- Does the plan conflate `did`, `handle`, and `username`? They are three distinct fields on `User` with different semantics. A plan that says "use the user ID" without specifying which one is underspecified. Force a decision.
- Does the plan provision a per-user resource without following the `ensureUserSite()` pattern (idempotent, error-isolated, called on registration + first auth)? It will fail for existing users who don't trigger the new provision path.
- Does the plan add email or SMS delivery outside `otpDelivery.js`? Reject it. All OTP/2FA delivery goes through that module.

### 5. Site Architecture

- Does the plan manually create a USER site? USER sites are auto-provisioned by `ensureUserSite()`. A plan that creates one manually will either conflict with the existing row (unique constraint on `ownerId + USER + ACTIVE`) or create a duplicate.
- Does the plan query sites without using the service layer (`siteLookup.js`, `siteAccess.js`, `siteMutations.js`, `siteCompat.js`)? Inline Prisma queries that duplicate this logic will diverge from the canonical ACL rules. Reject and redirect to the existing functions.
- Does the plan check cohort permissions by `CohortRole`? The ACL was changed: any active cohort member can CRUD cohort site pages (not LEAD-only). A plan that gatekeeps on `role: LEAD` is implementing the wrong rule.
- Does the plan assume `/sites/me/*` is a real route that persists? It is an alias that redirects to the authenticated user's USER site UUID path. Don't store or link to it.

### 6. Assets

- Does the plan store a raw URL on `Project` or any other model? All media goes through `Asset` rows + B2. Raw URLs in the DB are wrong and cannot be managed (resize, delete, CDN swap).
- Does the plan handle only the `READY` state for assets? The full lifecycle is `PENDING → UPLOADING → READY / FAILED`. A plan that assumes assets are immediately available after `POST /api/assets` will break for large files and slow connections.
- Does the plan process images server-side without using `sharp` via `src/utils/imageOptimizer.js`? That utility exists specifically to standardize resizing. Don't add a second image processing path.
- Does the plan call `dangerouslySetInnerHTML` on asset-derived HTML without `sanitizeHtml`? **XSS vulnerability.** Block it.

### 7. P2P / Hypercore

- Does the plan import `hypercore`, `hyperbee`, or `hyperswarm` inside a Next.js route handler or page? This will crash the build or the edge runtime. P2P code belongs exclusively in `worker/p2p.js`.
- Does the plan add a new Node-only package without checking whether it needs to be in `serverExternalPackages` in `next.config.js`? Reference: `isomorphic-dompurify` and `jsdom` are already there because they caused production 500s when loaded at module import time. Test any new heavy dependency for the same failure mode.
- Does the plan add a publish side-effect that blocks the HTTP response? `putPage()` is best-effort and non-blocking. New publish side-effects must follow the same pattern.

### 8. UI Components

- Does the plan add a reusable UI component to `src/components/` instead of `src/primitives/`? If it could be used in more than one place, it belongs in primitives with a `.stories.js` file. The rollup build publishes `src/primitives` as a package — components there must not have app-specific imports.
- Does the plan add a Storybook story for every new primitive? The rule is enforced: every new page needs a `Pages/` story in `src/stories/`, every new primitive needs a `.stories.js`. If the plan doesn't mention stories, it is incomplete.
- Does the plan import Lucide icons directly (`import { X } from 'lucide-react'`)? Use `lucideIconProps()` from `src/lib/lucideIconProps.js`. Direct imports bypass the size and prop normalization applied by the helper.
- Does the plan use inline styles? Reject. Styling goes in per-component `.scss` files using tokens from `src/styles/_variables.scss`.
- Does the plan use a `<form>` element? Reject. Forms use `react-hook-form` with `handleSubmit` wired to a button's `onClick`. This is a documented codebase rule, not a preference.

### 9. Testing

This is the section most plans skip entirely. Do not let that pass.

- Does the plan include a co-located unit test for every new module (`.test.js` / `.test.jsx`)? If not, the plan is incomplete. Period.
- Does the plan include a route handler integration test using `src/tests/testAgent.js`? If not, the API surface is untested.
- Does the plan add the new test files to the explicit file list in `package.json#scripts.test`? Files not in that list will not run in CI. This is not optional — the runner does not auto-discover.
- Does the plan test the **negative paths**? Auth failure, malformed body, soft-deleted record lookup, rate limit hit, missing env var. A test suite that only tests the happy path is not a test suite.
- If the plan adds a code-review rule, does it add a fixture in `fixtures/code-review/`? Check both the safe and unsafe variants.

### 10. Migration Workflow

If schema changes are involved, the plan must include every step. Missing any one of them is a gap:

1. Edit `prisma/schema.prisma`
2. `bun db:migrate` (creates and names the migration file)
3. `bun db:migrate:shadow` (verifies migration against shadow DB)
4. `bun db:migrate:dry` before any destructive operation
5. `bun db:backup` before production deploy
6. `bun db:migrate:deploy` for production
7. `bun db:generate` if the Prisma client shape changed (usually automatic via `postinstall`, but verify)

### 11. Routing Conflicts

Every new route must be checked against:

- The existing redirect table in `next.config.js`. Adding a route that matches a redirect source will silently lose requests.
- The `[root]/[[...path]]` catch-all. Anything not claimed by a more-specific page falls into it. Test the ordering.
- Known permanent redirects (`/cohort/:slug → /:slug`). Do not add new routes under `/cohort/`.

| Redirected from | Redirected to |
|---|---|
| `/feed` | `/all` |
| `/page/:slug` | `/project/:slug` |
| `/project/new` | `/pages/new` |
| `/editor/new` | `/pages/new` |
| `/editor/:id` | `/project/:id/edit` |
| `/:handle/settings` | `/user/:handle/settings` |
| `/cohort/:slug` | `/:slug` (permanent) |
| `/cohort/:slug/:path*` | `/:slug/:path*` (permanent) |

### 12. Taxonomy

- Does the plan store new taxonomy data in the `taxonomy Json?` column on `Project`? That is a legacy field. New taxonomy data goes through `TaxonomyGroup → TaxonomyTerm → PageTaxonomyTerm → Project`.
- Does the plan add taxonomy UI outside `/taxonomy/*`? Reject and redirect to the existing CRUD routes.
- Does the plan call Prisma directly for taxonomy queries instead of using `taxonomyConfig.js`, `taxonomyLookup.js`, `taxonomyAccess.js`? Reject. Those service modules exist to centralise access control and query patterns.

---

## Output Format — No Participation Trophies

Do not list things under "✅ Covered" just to soften the report. Only mark something covered if the plan **explicitly and correctly** addresses it — not if it's probably fine or seems like it would work.

```
## Adversarial Gap Analysis

### 🚫 Blockers — plan cannot proceed without resolving these
[Each item: what is wrong, what breaks, exact fix with file path / function / SQL]

### ⚠️ Gaps — missing pieces that will cause bugs or regressions
[Each item: what is missing, what the consequence is, exact fix]

### ❓ Underspecified — decisions the plan defers that must be made now
[Each item: what is ambiguous, why it matters, what the options are]

### ✅ Covered — explicitly and correctly handled
[Only list things the plan gets right. Leave this section empty if nothing qualifies.]

### Verdict
[One of: REJECT (blockers present — do not implement), REVISE (gaps/ambiguity — plan needs updates before implementation), PROCEED WITH CAUTION (minor issues — implement with listed constraints)]
```

End with a **Verdict**. Do not leave the developer guessing whether they can proceed.

If the verdict is REJECT or REVISE, do not write implementation code. Wait for the developer to address the findings and resubmit the plan.
