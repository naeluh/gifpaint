# Editing-experience substrate (Kuzic UX adoption)

Shared interaction primitives — use these, don't hand-roll per surface.

## Primitives

- **Optimistic mutations:** `useOptimisticAction(baseState)` (`src/lib/hooks/useOptimisticAction.js`) — `run(update, action)` repaints instantly, rollback is automatic on reject, reconcile via `router.refresh()` inside the same transition (never after it — snap-back). For client-held base state, commit it (`setState(next)`) inside `action` on success. Canonical use: `SiteNavigationPanel`.
- **Inline editing:** `useInlineEdit(onCommit)` (`src/lib/hooks/useInlineEdit.js`) — id-keyed, one editor at a time; Enter commits, Esc cancels, blur commits, no-op guard, failed commit keeps editor open. Spread `inputBind` on the `Input`, `buttonBind` on save/cancel buttons (mousedown preventDefault stops blur-commit-before-click). Pure core: `inlineEditCore.js`. Canonical use: `SitePageList` nav label, `TaxonomyTermTree` rename.
- **Promise confirm:** `const confirm = useConfirm()` — `if (!(await confirm({ title, destructive: true }))) return;`. Provider mounted in `DashboardLayout`; Esc/overlay/unmount/double-invoke all resolve `false` (`confirmController.js`). `EntityActionsMenu` built-in confirm stays fine for menu actions; migrate declarative `ConfirmDialog` call sites opportunistically.
- **Success surface:** `emitActionSuccess({ title, message, href, linkLabel })` (`src/lib/hooks/actionSuccessBus.js`) + `ActionSuccessHost` (mounted in `DashboardLayout`). Only for successes with a destination (publish → "View page"). Inline "Saved ✓" (2s) stays for config forms.
- **Form discipline:** `useFormFlow` returns `isDirty`, `canSubmit`, `discard`, `hotkeyProps`. Config forms: Save `disabled={!canSubmit}`, ghost Cancel rendered only while `isDirty && !isSubmitting`, spread `hotkeyProps` on the form wrapper (Cmd/Ctrl+Enter submits). Successful submit auto-rebases the dirty baseline. **Do not dirty-gate auth forms** (autofill may not mark RHF dirty).

## Rules

- New list-row rename/edit → `useInlineEdit`, never per-row `useState` editors.
- New optimistic mutation → `useOptimisticAction`, never bespoke snapshot/rollback.
- Mutations still go through `crud()`; errors inline near the action (no toasts); status branching only via `err instanceof ApiError && err.statusReliable`.
- Manual checklist: `docs/EDITOR_MANUAL_TESTS.md` § "Editing substrate".
