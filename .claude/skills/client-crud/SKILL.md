---
name: client-crud
description: Client CRUD — use crud() for registry-covered entity mutations
---

# Client CRUD

Registry: `src/lib/api/entityCrudRegistry.js` (**40** verified ops, 11 entities).

## Use

```js
import { crud, ApiError } from '@/lib/api/crud.js';

await crud('pages', 'update', { params: { rkey }, body });
await crud('terms', 'read', { params: { id: termId } });
```

## Rules

1. **Rethrow `ApiError`** — never `throw new Error(err.message)` for registry ops.
2. Branch on `err.status` only when `err.statusReliable === true`.
3. Add/update registry row (`verified: true`) after reading the Route Handler.
4. `useFormFlow` `onSubmit`: `await crud(...)` — let `ApiError` propagate.
5. Local UI catch: `err instanceof ApiError ? err.message : fallback`.
6. Debounced search hooks: generation counter (no `AbortController` on `crud()`).

## Out of scope (keep apiFetch)

Auth, assets, avatar, permissions, dashboard loaders, slug check, taxonomy groups.

## Block editor

No block write routes. Document save: `pages.update` / `terms.update` with `content`, `contentHtml`, `documentBlockId`, `completeMigration`.

Response types: `src/lib/api/crudTypes.js` (`CrudResultMap`). Extend there when UI reads new response fields.
