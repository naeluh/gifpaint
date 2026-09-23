---
name: code-drift-check
description: Check whether functionality already exists in the codebase before writing new code, and detect "code drift" — duplicate, near-duplicate, or diverging implementations of the same logic (e.g. three slightly different date-formatting helpers, two auth-check functions that used to be identical but have drifted apart). Use this skill BEFORE implementing any new function, utility, component, hook, API client, validator, or similar reusable logic — search first, then decide whether to reuse, extend, or consolidate rather than writing a fresh copy. Also use when the user asks things like "are we already doing this somewhere?", "is there duplicate code for X?", "why do we have two versions of Y?", "audit for duplicate logic", or "check for code drift". Trigger proactively any time a new piece of non-trivial logic is about to be written, even if the user didn't explicitly ask for a duplication check.
---

# Code Drift Check

Prevents two related problems:

1. **Reinventing the wheel** — writing new code that duplicates existing functionality.
2. **Code drift** — multiple implementations of "the same" logic that were once aligned but have quietly diverged, creating inconsistent behavior and bugs.

## When to run this

- Before writing any new function/component/hook/util/validator/API wrapper that does something generic-sounding (formatting, validation, parsing, auth checks, API calls, retries, error handling, etc.)
- When the user explicitly asks to check for duplication or drift
- When you notice a naming pattern that suggests prior copies (`formatDateV2`, `utils_old`, `helpers2`, `NewValidator`)
- Periodically as a hygiene pass on request ("audit the codebase for duplicate logic")

Skip it for one-off script tasks, throwaway prototypes, or when the user explicitly says not to bother.

## Workflow

### 1. Understand what the new code needs to do

Before searching, articulate in one sentence what the logic's _purpose_ is (not just its literal name) — e.g. "normalize a phone number to E.164" not "phoneUtil". Drift-check by purpose, not by exact function name, since duplicates are rarely named identically.

### 2. Search broadly, not just by exact name

Use several searches, not one:

- Exact/likely function name (`grep -ri "formatPhone"`)
- Synonyms and near-synonyms (`format`, `normalize`, `parse`, `sanitize`, `validate` + the domain noun)
- The domain noun alone across the codebase (`phone`, `date`, `auth`, `retry`)
- Directory conventions — check `utils/`, `helpers/`, `lib/`, `shared/`, `common/` first, since duplicates cluster there
- Import graphs — check what similar existing files already import, since a helper often already exists one level up

```bash
grep -rniE "(format|normalize|parse|sanitize).*phone" --include="*.{js,ts,jsx,tsx,py}" .
grep -rli "phone" --include="*.{js,ts,py}" . | xargs -I{} grep -l "function\|def " {}
```

### 3. If something similar exists, diff it against intent

For each candidate found:

- Read the implementation, not just the signature
- Check callers — is it used in 1 place or 10? Widely-used code is riskier to fork
- Compare behavior against what the new code needs: same edge cases? same error handling? same assumptions (locale, timezone, nullability)?
- Check git history/blame if available — was this ever a shared function that got copy-pasted and diverged?

```bash
git log --follow -p -- path/to/candidate.js | head -100
git log --all --oneline -- '**/format*phone*'
```

### 4. Decide: reuse, extend, or knowingly duplicate

In order of preference:

1. **Reuse as-is** — import/call the existing implementation.
2. **Extend it** — add a parameter or branch to cover the new case, if the change is backward-compatible and doesn't bloat the function's responsibility.
3. **Refactor into a shared version** — if 2+ near-duplicates already exist and are drifting, this is the moment to consolidate them into one canonical implementation and update all call sites.
4. **Duplicate deliberately** — only when reuse would create an inappropriate coupling (e.g. two services that must be independently deployable, or genuinely different domains that coincidentally look similar). If choosing this, say so explicitly and note why, so it's a decision and not an accident.

Never silently write a parallel implementation without checking — that's exactly how drift starts.

### 5. If auditing existing code for drift (not writing new code)

- Cluster candidate files/functions by purpose using the searches above
- For each cluster of 2+, diff them directly:

```bash
diff path/to/implA.js path/to/implB.js
```

- Flag clusters where behavior has diverged in ways that look unintentional (one handles null, the other throws; one is missing a validation the other has)
- Report findings as: `[cluster name] — N implementations found: [files]. Divergences: [list]. Recommendation: [consolidate to X / keep separate because Y].`
- Don't auto-fix without confirming — consolidating call sites can be a large, risky change. Propose the plan first.

## Output format when reporting findings

Keep it concrete and actionable:

```
Found existing implementation: `src/utils/formatPhone.js` (used in 6 places)
- Handles: US numbers, international with +, strips formatting
- Missing: extension numbers (ext. 1234) — which the new feature needs

Recommendation: extend formatPhone.js to accept an `allowExtension` option
rather than writing a new formatPhoneWithExt() function.
```

If nothing similar exists, say so briefly and proceed with the new implementation — don't manufacture a finding.
