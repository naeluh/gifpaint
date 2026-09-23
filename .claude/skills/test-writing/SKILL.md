---
name: test-writing
description: Writing tests for this project — unit, integration, and React component tests
---

# Test Writing Skill

## Stack

- **Runner**: Bun's built-in test runner (`bun test`)
- **React**: component tests use `.test.jsx`; DOM via jsdom
- **Database**: Postgres (Docker) — integration tests require a live DB
- **Test agent**: `src/tests/testAgent.js` — cookie-aware supertest-style agent for API route tests

---

## File naming and placement

| What you're testing | File name | Location |
|---|---|---|
| Utility / lib module | `<name>.test.js` | Same directory as the source file |
| React component | `<Name>.test.jsx` | Same directory as the component |
| API route handler | `route.test.js` | Same directory as `route.js` |
| Context / hook | `<Name>.test.js` | Same directory as the context file |
| Script / CLI util | `<script>.test.js` | Same directory as the script |
| Cross-cutting integration | `integration.test.js` | `src/tests/` |

**Never** put tests in a separate top-level `__tests__/` folder. Keep them co-located.

---

## Imports

```js
import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
```

React component tests additionally need:
```js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
```

---

## Unit tests — lib modules

```js
// src/lib/routes.test.js pattern
import { describe, test, expect } from 'bun:test';
import { userPageUrl, cohortPath, previewPath } from '@/lib/sites/routes.js';

describe('userPageUrl', () => {
  test('builds /{username}/{urlPath}', () => {
    expect(userPageUrl('alice', 'about')).toBe('/alice/about');
  });

  test('handles missing urlPath', () => {
    expect(userPageUrl('alice', '')).toBe('/alice');
  });
});
```

**Rules:**
- One `describe` per exported function/class.
- Name tests as behaviour statements: `'returns null when input is empty'`.
- Test both the happy path and at least one error/edge path.
- Do not `import` from barrel `index.js` files in tests — import from the specific file.

---

## Zod schema tests

```js
// src/lib/validation/forms.test.js pattern
import { describe, test, expect } from 'bun:test';
import { pageCreateSchema } from './forms.js';

describe('pageCreateSchema', () => {
  test('accepts valid input', () => {
    const result = pageCreateSchema.safeParse({ title: 'My Page', urlPath: 'my-page' });
    expect(result.success).toBe(true);
  });

  test('rejects missing title', () => {
    const result = pageCreateSchema.safeParse({ urlPath: 'my-page' });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toContain('title');
  });

  test('trims and lowercases urlPath', () => {
    const result = pageCreateSchema.safeParse({ title: 'T', urlPath: '  My-Page  ' });
    expect(result.data.urlPath).toBe('my-page');
  });
});
```

---

## Prisma / database tests

Always mock `lib/prisma.js` — never hit a real DB in unit tests:

```js
import { mock } from 'bun:test';

// At the top of the test file, before importing the module under test:
mock.module('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve({ id: 'uuid-1', email: 'test@example.com' })),
    },
    $transaction: mock((fns) => Promise.all(fns.map(f => f()))),
  },
}));
```

For integration tests that need real Prisma, use `src/tests/testAgent.js` and the Docker DB (see Integration Tests below).

---

## API route tests

Route handlers are Next.js App Router `route.js` files. Test them via `testAgent`:

```js
// src/app/api/pages/route.test.js pattern
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestAgent } from '@/tests/testAgent.js';

let agent;

beforeAll(async () => {
  agent = await createTestAgent();
  await agent.register({ email: 'test@example.com', password: 'Password1!' });
  await agent.login({ email: 'test@example.com', password: 'Password1!' });
});

afterAll(() => agent?.cleanup?.());

describe('GET /api/pages', () => {
  test('returns 401 without session', async () => {
    const res = await fetch('http://localhost:3000/api/pages');
    expect(res.status).toBe(401);
  });

  test('returns page list for authenticated user', async () => {
    const res = await agent.get('/api/pages');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('POST /api/pages', () => {
  test('creates a draft page', async () => {
    const res = await agent.post('/api/pages', { title: 'Test Page' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.publishStatus).toBe('DRAFT');
  });

  test('returns 422 when title is missing', async () => {
    const res = await agent.post('/api/pages', {});
    expect(res.status).toBe(422);
  });
});
```

**Rules:**
- Always test the unauthenticated path (expect 401 or 403).
- Test the validated-input-missing path (expect 400 or 422).
- Test the happy path.
- Never hardcode UUIDs — read them from the response of a preceding creation call.

---

## React component tests

```jsx
// src/primitives/Button/Button.test.jsx pattern
import { describe, test, expect, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button.js';

describe('Button', () => {
  test('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeDefined();
  });

  test('calls onClick when clicked', () => {
    const onClick = mock(() => {});
    render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('is disabled when disabled prop is set', () => {
    render(<Button disabled>Go</Button>);
    expect(screen.getByRole('button').disabled).toBe(true);
  });
});
```

**Rules:**
- Query by role first (`getByRole`), then by label/text, never by class or test-id.
- Mock side effects (API calls, router push) at the module level with `mock.module`.
- Wrap async state updates in `waitFor`.

---

## Context tests

```js
// src/context/AuthContext.test.js pattern
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { render, screen, waitFor } from '@testing-library/react';

mock.module('@/lib/api/api', () => ({
  apiFetch: mock(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ user: null }) })),
}));

import { AuthProvider, useAuth } from './AuthContext.jsx';

function TestConsumer() {
  const { user } = useAuth();
  return <div>{user ? user.email : 'logged out'}</div>;
}

describe('AuthContext', () => {
  test('renders logged-out state when no session', async () => {
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => screen.getByText('logged out'));
  });
});
```

---

## Integration tests

Located in `src/tests/integration.test.js`. Require a running Postgres:

```bash
docker compose up -d database
bun run db:migrate:deploy
bun test src/tests/integration.test.js
```

Use `createTestAgent()` from `src/tests/testAgent.js` — it auto-stubs Resend so Better Auth background email tasks never hit the real API.

For sign-up flows, prefer `registerVerifiedTestUser()` from `src/tests/authTestHelpers.js` instead of duplicating OTP/session logic:

```js
import { registerVerifiedTestUser } from '@/tests/authTestHelpers.js';

const { agent, userId, email, username } = await registerVerifiedTestUser({
  prisma,
  createTestAgent,
  prefix: 'test-blocks-',
  suffix: 'list',
});
```

Run the curated suite with `bun run test` (sets `NODE_ENV=test`, silences Prisma error logs for expected constraint checks). Do not use bare `bun test` at repo root — it picks up archived `backup/` tests.

Integration tests follow the full user journey:

```js
// src/tests/integration.test.js pattern
import { describe, test, expect, beforeAll } from 'bun:test';
import { createTestAgent } from './testAgent.js';

describe('auth flow', () => {
  let agent;

  beforeAll(async () => {
    agent = await createTestAgent();
  });

  test('register → verify → login → access dashboard', async () => {
    const email = `test-${Date.now()}@example.com`;

    // Register
    const reg = await agent.post('/api/auth/sign-up/email', {
      email,
      password: 'Password1!',
      name: 'Test User',
      username: `user${Date.now()}`,
    });
    expect(reg.status).toBe(200);

    // Activate (dev: bypass OTP or seed verified=true)
    // ...

    // Login
    const login = await agent.post('/api/auth/sign-in/email', { email, password: 'Password1!' });
    expect(login.status).toBe(200);

    // Authenticated route
    const profile = await agent.get('/api/profile');
    expect(profile.status).toBe(200);
  });
});
```

**Always** use a unique email per test run (suffix with `Date.now()`) to avoid collisions against a shared DB.

---

## XState machine tests

```js
// src/lib/editor/editorMachine.test.js pattern
import { describe, test, expect } from 'bun:test';
import { createActor } from 'xstate';
import { editorMachine } from './editorMachine.js';

describe('editorMachine', () => {
  test('starts with no block selected', () => {
    const actor = createActor(editorMachine).start();
    expect(actor.getSnapshot().context.selectedBlockId).toBeNull();
  });

  test('SELECT_BLOCK sets selectedBlockId', () => {
    const actor = createActor(editorMachine).start();
    actor.send({ type: 'SELECT_BLOCK', id: 'block-1' });
    expect(actor.getSnapshot().context.selectedBlockId).toBe('block-1');
  });

  test('DESELECT clears selectedBlockId', () => {
    const actor = createActor(editorMachine).start();
    actor.send({ type: 'SELECT_BLOCK', id: 'block-1' });
    actor.send({ type: 'DESELECT' });
    expect(actor.getSnapshot().context.selectedBlockId).toBeNull();
  });
});
```

---

## `apiHttpError` — what NOT to test through

API routes use `apiHttpError(err, { fallback, logLabel })` to map errors. In route tests, verify the **status code and safe message**, not the raw `err.message` or stack:

```js
test('returns 500 with generic message on DB error', async () => {
  // arrange: make prisma throw
  const res = await agent.post('/api/pages', { title: 'x' });
  expect(res.status).toBe(500);
  const body = await res.json();
  expect(body.error).not.toContain('PrismaClientKnownRequestError'); // no internals leaked
});
```

---

## Things to always cover

For every module or route, write at least:

1. **Happy path** — valid input, correct output/status.
2. **Auth guard** — unauthenticated request gets 401/403.
3. **Validation** — invalid/missing input gets 400/422, not 500.
4. **Error path** — DB/external-service failure returns safe error (no stack leak).

For React components additionally:

5. **Render** — component mounts without throwing.
6. **Interaction** — key user actions trigger the right callbacks.
7. **Accessibility** — interactive elements are reachable by role/label.

---

## Common mistakes to avoid

- **Don't import from `@/components` or `@/primitives` barrel** in unit tests — import directly from the file.
- **Don't `await` Prisma calls in test assertions that use mocks** — mock returns are synchronous by default unless you wrap them in `Promise.resolve`.
- **Don't use `mock.module` after the import it replaces** — call `mock.module(...)` before the `import` of the module under test, or use a dynamic `import()` after mocking.
- **Don't share state between tests** — use `beforeEach` to reset mocks: `mockFn.mockReset()`.
- **Don't test implementation details** — test behaviour (what the output is), not which internal function was called.
- **Don't use `console.log` in tests** — use `expect` assertions; CI treats unexpected output as noise.
- **Don't skip the unauthenticated case** — every route that requires a session must have a 401 test.

---

## Running tests

```bash
# Full curated suite (recommended — sets NODE_ENV=test, explicit file list)
bun run test

# Single file
bun test src/lib/routes.test.js

# Watch mode
bun test --watch src/lib/
```

The full test command is defined in `package.json` and lists every test file explicitly — add new test files to that list.

**Do not** rely on bare `bun test` at the repo root; `bunfig.toml` limits discovery to `src/` and `backup/` fixtures may still fail. Always use `bun run test`.
