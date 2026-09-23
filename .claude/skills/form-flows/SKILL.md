---
name: form-flows
description: Page-level form submit lifecycle with createFormFlowMachine + useFormFlow (RHF + Zod). Use when adding or migrating dashboard/auth/settings forms — not editor forms.
---

# Form flows (page-level)

## When to use `useFormFlow`

- **Yes:** auth pages, settings, taxonomy CRUD, site settings, cohort create, page create, page taxonomy config (`PageConfigPanel`), cohort member **add**
- **No:** `EditorShell`, `PageMetaForm`, `PublishPanel`, block config panels (deferred — see `formFlowRegistry.js`)

## Pattern

```js
import { crud } from '@/lib/api/crud.js';

const onSubmit = useCallback(async (data) => {
  const result = await crud('pages', 'create', { body: data });
  router.push(pageEditPath(result.slug ?? result.rkey));
}, [router]);

// Auth pages: keep apiFetch + status branches (403 → verify-email, 2FA)
// Legacy forms not yet migrated may still use apiFetch inline

const { form, onSubmit, handleSubmit, isSubmitting, submitError, reset } = useFormFlow({
  id: 'unique-machine-id',
  schema: someSchema,
  onSubmit,
  defaultValues: { ... },
});
```

- **`<form onSubmit={onSubmit}>`** — auth pages (Enter key)
- **`Button onClick={handleSubmit}`** — pages without a wrapping `<form>`
- **RHF owns validation**; machine owns `idle | submitting | success | error` only
- **No `authFlowMachine`** — 403 → verify-email and 2FA redirects stay as `if` branches inside `onSubmit`
- **`onSubmitRef`** in `useFormFlow` is synced via `useLayoutEffect` so the machine can stay memoized on `[id]` without stale closures

## Optional UUID fields (Zod)

Use shared `optionalUuidSchema` / `optionalNullableUuidSchema` from `src/lib/validation/forms.js` — never default optional UUID fields to `''` in RHF (empty string fails `.uuid()` before preprocess in some paths). Prefer `undefined` or `null`.

Hierarchy metadata (e.g. taxonomy grandparent) should be **derived server-side** from FK fields — do not trust client-sent ancestor IDs.

## Combobox pickers

- **`Combobox`** / **`ComboboxMulti`** primitives (`src/primitives/Combobox`, `ComboboxMulti`) — USWDS-style searchable listbox; pass **`initialOptions`** when the form loads with UUIDs not in the first search page (edit hydration).
- **`TaxonomyTermCombobox`** — parent term on term create; prefetches `?parentTermId=` label via `GET /api/taxonomy/terms/[id]`.
- **`TaxonomyTermPicker`** — page tags via `ComboboxMulti`; edit pages pass `initialTerms` from `GET /api/pages/[rkey]/taxonomy` (`{ termIds, terms }`).

## Mounted reuse (`CohortMemberPanel`)

After add succeeds:

```js
clear();        // useUserSearch
form.reset();   // RHF field
reset();        // machine → idle
```

`success` is **not** `final` so a second SUBMIT works without remounting.

## Registry

`src/lib/forms/formFlowRegistry.js` is **docs only** for fields/schema/crud — imported at runtime only by `formFlowGraph.js` and `crudFromFlow()`.

**Client routes:** `src/lib/api/entityCrudRegistry.js` is the source of truth for `crud()` method/path/metadata. See `.claude/skills/client-crud/SKILL.md`.

## Visualizer

### Dashboard map (CRUD flows, dev only)

In **`bun run dev`**, open **`/dashboard/form-flows`** (authenticated). Production builds return 404 — not linked anywhere in the product UI (same intent as Storybook for forms).

- `page-create`, `cohort-create`, `cohort-member-add`
- `taxonomy-group-create`, `taxonomy-group-edit`, `taxonomy-term-create`, `taxonomy-term-edit`

Graph data lives in `src/lib/forms/formFlowGraph.js` (`SCOPED_FORM_FLOW_IDS`, `buildFormFlowGraph()`). When adding a scoped CRUD flow, update both the registry and `GRAPH_META` transitions.

Auth, `profile-settings`, `site-settings`, and editor flows are **not** on the map.

### Stately (machine topology)

The Stately viz cannot run `fromPromise` in the browser sandbox. Paste definitions use `RESOLVE`/`REJECT` manual events instead of `invoke` — state topology is identical to production.

Open https://stately.ai/viz and paste one of:

**Base machine (shared by every form):**

```js
const { createMachine, assign } = XState;

const formFlowMachine = createMachine({
  id: 'formFlow',
  initial: 'idle',
  context: { error: null },
  states: {
    idle: {
      on: {
        SUBMIT: { target: 'submitting', actions: assign({ error: null }) },
      },
    },
    submitting: {
      // In production: fromPromise(() => onSubmitRef.current(input))
      // For viz: manual events simulate resolve/reject
      on: {
        RESOLVE: { target: 'success' },
        REJECT: {
          target: 'error',
          actions: assign({ error: () => 'Something went wrong' }),
        },
      },
    },
    success: {
      on: { RESET: { target: 'idle', actions: assign({ error: null }) } },
    },
    error: {
      on: {
        SUBMIT: { target: 'submitting', actions: assign({ error: null }) },
        RETRY:  { target: 'idle',       actions: assign({ error: null }) },
      },
    },
  },
});
```

Click **SUBMIT** → **RESOLVE** (happy path) or **REJECT** (error path). From `error`, click **SUBMIT** again to test resubmit without RETRY. From `success`, click **RESET** to return to `idle` (simulates `CohortMemberPanel` reuse).

**Login machine** (same states — auth branches are callback-only, not in XState):

```js
const { createMachine, assign } = XState;

// Auth routing (403 → /verify-email, 2FA → /verify-otp) happens inside the
// onSubmit callback, not here. Machine only sees: returned → RESOLVE, threw → REJECT.
const loginMachine = createMachine({
  id: 'login',
  initial: 'idle',
  context: { error: null },
  states: {
    idle: {
      on: {
        SUBMIT: { target: 'submitting', actions: assign({ error: null }) },
      },
    },
    submitting: {
      on: {
        RESOLVE: { target: 'success' },
        REJECT: {
          target: 'error',
          actions: assign({ error: () => 'Invalid credentials' }),
        },
      },
    },
    success: {
      on: { RESET: { target: 'idle', actions: assign({ error: null }) } },
    },
    error: {
      on: {
        SUBMIT: { target: 'submitting', actions: assign({ error: null }) },
        RETRY:  { target: 'idle',       actions: assign({ error: null }) },
      },
    },
  },
});
```

**CohortMemberPanel — add flow only** (remove = direct DELETE; `useUserSearch` not modeled):

```js
const { createMachine, assign } = XState;

const cohortAddMemberMachine = createMachine({
  id: 'cohort-add-member',
  initial: 'idle',
  context: { error: null },
  states: {
    idle: {
      on: {
        SUBMIT: { target: 'submitting', actions: assign({ error: null }) },
      },
    },
    submitting: {
      on: {
        RESOLVE: { target: 'success' },
        REJECT: {
          target: 'error',
          actions: assign({ error: () => 'Could not add member' }),
        },
      },
    },
    success: {
      on: { RESET: { target: 'idle', actions: assign({ error: null }) } },
    },
    error: {
      on: {
        SUBMIT: { target: 'submitting', actions: assign({ error: null }) },
        RETRY:  { target: 'idle',       actions: assign({ error: null }) },
      },
    },
  },
});
```

All three machines are topologically identical — intentional. Paste any one to confirm transitions before implementing.

**CohortMemberPanel post-success cleanup** (not in viz — callback-only):

```js
clear();        // useUserSearch
form.reset();   // RHF username field — reset() alone leaves field populated
reset();        // machine → idle
```

**Production vs viz:**

| | Production (`createFormFlowMachine`) | Viz paste |
|---|---|---|
| Async | `fromPromise(({ input }) => onSubmitRef.current(input))` | `on: { RESOLVE, REJECT }` |
| Error source | `event.error?.message` | hardcoded string |
| Input | `input: ({ event }) => event.data` | not needed |
| States | identical | identical |
