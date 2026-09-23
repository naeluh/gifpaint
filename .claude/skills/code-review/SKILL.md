---
name: code-review
description: Perform thorough, structured code reviews on any language or framework. Use this skill whenever the user asks to "review my code", "check this code", "give feedback on my PR", "look over this function/class/module", "what's wrong with this code", or pastes code and wants critique, improvement suggestions, or a quality assessment. Trigger even for casual asks like "thoughts on this?" when code is present. Covers correctness, security, performance, readability, maintainability, test coverage, and best practices.
---

# Code Review Skill

A structured, opinionated skill for performing high-quality code reviews across any language,
framework, or project size.

---

## Review Philosophy

A great code review is a conversation between equals — not a gotcha hunt. It:
- **Prioritizes ruthlessly**: not every nit is equal to a security flaw
- **Explains the "why"**: don't just say "bad" — say why and what to do instead
- **Acknowledges good work**: callout patterns done well, not just problems
- **Is actionable**: every issue should have a concrete fix or next step

---

## Step 1 — Gather Context

Before reviewing, understand:
- **Language & framework** (infer from code if not stated)
- **Scope**: whole file, function, PR diff, or snippet?
- **Purpose**: what is this code supposed to do?
- **Constraints**: performance-critical? security-sensitive? legacy codebase? beginner?

If the user provides no context, infer from the code and proceed — don't gatekeep with questions.

---

## Step 2 — Categorize Issues by Severity

Use these severity levels consistently:

| Level | Label | Meaning |
|-------|-------|---------|
| 🔴 | **CRITICAL** | Bugs, security vulnerabilities, data loss risk, crashes. Must fix. |
| 🟠 | **MAJOR** | Logic errors, poor error handling, significant performance issues. Should fix. |
| 🟡 | **MINOR** | Code smells, readability issues, missing edge cases. Recommended fix. |
| 🔵 | **NIT** | Style, naming, minor consistency. Fix if convenient. |
| ✅ | **PRAISE** | Genuinely good pattern worth noting — use sparingly, make it count. |

---

## Step 3 — Review Dimensions

Systematically check each dimension (skip irrelevant ones for short snippets):

### 🐛 Correctness
- Does the logic match the stated intent?
- Off-by-one errors, null/undefined handling, edge cases
- Race conditions, mutation of shared state
- Return value consistency

### 🔒 Security
- Input validation and sanitization
- SQL injection, XSS, CSRF, path traversal
- Secrets/credentials hardcoded or logged
- Improper auth checks, privilege escalation
- Dependency vulnerabilities (if visible)

### ⚡ Performance
- Unnecessary re-renders, repeated DB calls, N+1 queries
- Unbounded loops or data structures
- Missing caching opportunities
- Memory leaks (event listeners, timers, large closures)

### 📖 Readability & Maintainability
- Naming: variables, functions, classes — are they self-documenting?
- Function length and single-responsibility
- Magic numbers/strings — should be constants
- Deeply nested conditionals — can they be flattened?
- Dead code, commented-out code
- In JSX-heavy files, avoid over-penalizing visual indentation alone; prioritize nested control flow over markup depth.
- Do not flag `==`/`!=` occurrences found only inside string literals (examples, base64 fixtures, snapshots).

### 🧪 Testing & Observability
- Are tests present? Do they cover happy path + edge cases?
- Are errors logged with enough context to debug?
- Assertions too broad or too brittle?

### 🏗️ Design & Architecture
- Does it follow existing patterns in the codebase?
- Appropriate abstraction level — over-engineered or under-engineered?
- Is it easy to change/extend without breaking things?
- Coupling and cohesion

---

## Step 4 — Output Format

Structure the review clearly. Adapt length to the code size — don't write an essay for 10 lines.

### For small snippets (< ~50 lines):

```
## Code Review

**Summary**: [1-2 sentence overall impression]

**Issues**:
🔴 [Line X] CRITICAL — [description + fix]
🟠 [Line Y] MAJOR — [description + fix]
🟡 [Line Z] MINOR — [description + fix]
✅ [Line W] Nice use of [pattern] — [brief why]

**Suggested Rewrite** (if changes are significant):
[code block]
```

### For larger files/PRs (50+ lines):

```
## Code Review

### Overall Assessment
[2-3 sentences: quality, main concerns, tone]

### 🔴 Critical Issues
[Each issue: location → problem → fix with code example if helpful]

### 🟠 Major Issues
[Same format]

### 🟡 Minor / Nits
[Grouped or listed briefly]

### ✅ What's Working Well
[1-3 genuine callouts]

### Recommended Next Steps
[Prioritized action list]
```

---

## Step 5 — Code Rewrite Guidelines

Offer a rewrite when:
- Critical/major bugs are present
- A cleaner version would teach something valuable
- The user explicitly asks for a rewrite

When rewriting:
- Keep the same intent and interface
- Add a brief comment explaining what changed and why
- Don't gold-plate — fix the problems, don't redesign the world

---

## Language-Specific Reminders

### JavaScript / TypeScript
- `==` vs `===`, `null` vs `undefined`
- `async/await` error handling (unhandled rejections)
- Mutating props/state directly in React
- Type assertions (`as`) masking real type errors

### Python
- Mutable default arguments (`def f(x=[])`)
- Bare `except:` clauses
- `is` vs `==` for value comparison
- Missing `__all__` in library modules

### SQL
- Missing indexes on joined/filtered columns
- `SELECT *` in production queries
- No parameterized queries (injection risk)
- Missing transactions for multi-step writes

### General
- Every TODO/FIXME should have an owner or ticket reference
- Public APIs need docstrings
- Configuration should not live in code

---

## Tone Guidelines

- Be direct but not harsh. "This will cause a crash when X is null" not "This is wrong."
- Use "consider" for nits, "should" for majors, "must" for criticals.
- If the code is genuinely clean, say so briefly and move on — don't pad with fake praise.
- If the code is a disaster, still find one thing done right.

---

## CI integration (static review)

This repo ships a **static** analyzer at [`code-review.js`](../../code-review.js) (no LLM). On pull requests, GitHub Actions:

- Runs `code-review.js --changed --base origin/<base>` (three-dot merge-base diff)
- **Replaces** the prior bot comment on each push (`github-actions[bot]`, marker `<!-- code-review-static -->`)
- Reports CRITICAL and MAJOR only (`--severity major`); **fails** the check only on CRITICAL
- Uploads the full markdown report as a workflow artifact

**Limits:** Fork PRs get no comment (read-only token). Review timeout/crash → failed check, no comment — use workflow logs. `--base` requires `--changed`. Local parity: `git fetch origin main && bun code-review.js --changed --base origin/main --out report.md`.

**OSS static analyzer notes:**

- React JSDoc using `@param props.title` with destructured `({ title })` is valid; the linter normalizes `props.*` to binding names.
- Historical false positive: `path.join(ROOT, 'comment-body.md')` matched `body.` as user input — fixed via word-boundary-aware matching.
- `--strict` re-enables four suppression rules only; JSDoc and path-traversal fixes are permanent.

---
