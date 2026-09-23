# Client CRUD

- **New registry-covered mutations:** use `crud()` from `@/lib/api/crud.js`, not inline `apiFetch` + `res.json()` boilerplate.
- **New API route:** add a verified row to `entityCrudRegistry.js` (`verified: true`, `routeFile`, `successShape`, `errorStatusReliable`) after reading the route handler.
- **Zod:** stays in `src/lib/validation/forms.js`; `crud()` does not validate bodies.
- **Server routes:** keep `apiHttpError` in route handlers — client helper does not fix bare-500 catches.
- **Auth / blocks / assets / permissions:** stay on `apiFetch`; `crudFromFlow` blocklists auth flow ids.
- **Status branching:** only when `err instanceof ApiError && err.statusReliable`.
- **Migrate existing call sites:** file-read the target first; confirm return-value consumers before swapping deletes that change shape.

Skill: `.claude/skills/client-crud/SKILL.md`
