---
name: better-auth
description: "Use this skill whenever working on authentication in this project. Covers Better Auth integration with GitHub/Google OAuth + password credentials, Gravatar avatar resolution, Neon Postgres via Prisma, and session management. Trigger on: login, register, OAuth, SSO, session, JWT, auth route, AuthContext, User model, or any auth-related code change."
---

# Better Auth — OSS Project

## Architecture Overview

```
better-auth (core)
  ├── providers: github (gated), google (gated), email+password
  ├── adapter: prisma (Neon Postgres)
  ├── plugins: emailOTP (activation OTP), twoFactor (login OTP via Resend email / optional Telnyx SMS)
  └── session: cookie-based (httpOnly, sameSite: lax)

User.email  → unique login identifier (citext, case-insensitive)
User.username → user-chosen at sign-up, immutable, public URLs (`additionalFields.username`, validated in `databaseHooks.user.create.before`)
User.handle → ATProto id (auto-generated from email prefix + 4-char hex suffix)
User.did    → AT-URI identity key (auto-generated on create)
avatarUrl   → `resolveAvatarUrl()` server-side; `resolveAvatarDisplayUrl()` client-side — B2 `Asset.publicUrl`, else `/api/assets/{id}/file`, else Gravatar (never stored on User)
hasCustomAvatar → true when `User.avatarAssetId` is set
avatarAssetId → on Better Auth session user (`additionalFields`) for profile-fetch fallback
```

## Principle: Simplicity Over Complexity

- Do **not** add a plugin if the core API covers it.
- Do **not** create a new model if an existing one fits.
- Do **not** store Gravatar URLs — resolve them on-the-fly from `User.email`.
- The existing `Session` model maps to Better Auth sessions — reuse it.
- `AuthToken` (LOGIN_CODE / MAGIC_LINK) is out of scope.
- OAuth providers are gated on env vars — if `GITHUB_CLIENT_ID` is not set, GitHub SSO is simply not registered.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/betterAuth.js` | Better Auth instance (the only source of truth) |
| `src/lib/otpDelivery.js` | OTP email/SMS delivery (Resend + Telnyx) |
| `src/lib/devOtpBypass.js` | Dev-only OTP bypass (gate, log, Verification lookup) |
| `src/lib/mailtransport.js` | Resend HTTP API wrapper |
| `src/lib/auth.js` | `serializeUser`, role/visibility helpers |
| `src/lib/authSession.js` | `refreshAuthUser` — session + profile fetch for AuthContext |
| `src/lib/assetPublicUrl.js` | `resolveAvatarUrl`, `resolveAvatarDisplayUrl`, `enrichSessionUser`, B2 public URL helpers |
| `src/lib/gravatar.js` | `gravatarUrl(email, size?)` — call at response time only |
| `src/lib/authMiddleware.js` | `requireAuth` / `optionalAuth` for Route Handlers |
| `src/app/api/auth/[...all]/route.js` | Better Auth handler via `toNextJsHandler(auth)` |
| `src/context/AuthContext.jsx` | Frontend session state via `/api/auth/get-session` |

---

## Prisma Models (actual — do NOT invent new model names)

Better Auth uses these exact model names via `prismaAdapter`:

```prisma
model Session {
  id          String   @id @default(uuid()) @db.Uuid
  token       String   @unique          // Better Auth session token
  userId      String   @db.Uuid
  user        User     @relation(...)
  ipAddress   String?
  userAgent   String?
  expiresAt   DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Account {
  id                    String   @id @default(uuid()) @db.Uuid
  userId                String   @db.Uuid
  user                  User     @relation(...)
  providerId            String   // "github" | "google" | "credential"
  accountId             String
  accessToken           String?  @db.Text
  refreshToken          String?  @db.Text
  idToken               String?  @db.Text
  expiresAt             DateTime?
  password              String?  @db.Text
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  @@unique([providerId, accountId])
}

model Verification {
  id         String   @id @default(uuid()) @db.Uuid
  identifier String
  value      String   @db.Text
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Common mistake:** Do NOT use `OAuthAccount` — Better Auth uses `Account`.

---

## Better Auth Instance (`src/lib/betterAuth.js`)

```js
import crypto from 'node:crypto';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError } from 'better-auth/api';
import { prisma } from '../../lib/prisma.js'; // NOT './prisma.js'

const MAX_USERS = 120;

function generateHandle(email) {
  const base = String(email).split('@')[0]
    .replace(/[^a-z0-9]/gi, '-').toLowerCase()
    .replace(/^-+|-+$/g, '').slice(0, 24) || 'user';
  return `${base}-${crypto.randomBytes(2).toString('hex')}`;
}

function generateDid() {
  return `did:plc:${crypto.randomBytes(24).toString('hex')}`;
}

function socialProviders() {
  const providers = {};
  if (process.env.GITHUB_CLIENT_ID) {
    providers.github = {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }
  if (process.env.GOOGLE_CLIENT_ID) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  return providers;
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || process.env.FRONTEND_URL || 'http://localhost:3000',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  // CRITICAL: Prisma schema uses @db.Uuid for all IDs.
  // Better Auth defaults to base62 IDs — must override to UUID format.
  advanced: {
    database: { generateId: 'uuid' },
  },
  emailAndPassword: { enabled: true },
  socialProviders: socialProviders(),
  trustedOrigins: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  session: { cookieCache: { enabled: true, maxAge: 60 * 5 } },
  user: {
    fields: { name: 'displayName' },
    additionalFields: {
      // required: false — fields are auto-generated by databaseHooks before hook.
      // required: true causes MISSING_FIELD 400 before the hook can run.
      did:    { type: 'string', required: false, input: false },
      handle: { type: 'string', required: false, input: false },
      username: { type: 'string', required: false, input: true },
      role:   { type: 'string', required: false, defaultValue: 'PARTICIPANT', input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const count = await prisma.user.count({ where: { deletedAt: null } });
          if (count >= MAX_USERS) {
            throw new APIError('SERVICE_UNAVAILABLE', { message: 'Prototype user limit reached' });
          }
          const email = user.email || '';
          return {
            data: {
              ...user,
              displayName: user.displayName || user.name || email.split('@')[0] || 'User',
              did:    user.did    || generateDid(),
              handle: user.handle || generateHandle(email),
              role:   user.role   || 'PARTICIPANT',
            },
          };
        },
      },
    },
  },
});
```

---

## Express Mount (`api/server.js`) — REMOVED

Auth is now a Next.js Route Handler:

```js
// src/app/api/auth/[...all]/route.js
import { auth } from '@/lib/auth/betterAuth';
import { toNextJsHandler } from 'better-auth/next-js';
export const { GET, POST } = toNextJsHandler(auth);
```

---

## Auth Middleware (`src/lib/authMiddleware.js`)

```js
import { auth } from '@/lib/auth/betterAuth.js';
import { prisma } from '../../lib/prisma.js';
import { roleToApi } from '@/lib/auth/auth.js';

export async function requireAuth(request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user?.id
    ? await prisma.user.findFirst({ where: { id: session.user.id, deletedAt: null } })
    : null;
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return { id: user.id, did: user.did, handle: user.handle, username: user.username, role: roleToApi(user.role) };
}
```

---

## Gravatar (`api/lib/gravatar.js`)

```js
import crypto from 'node:crypto';

export function gravatarUrl(email, size = 80) {
  const hash = crypto.createHash('md5')
    .update(String(email).trim().toLowerCase())
    .digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp`;
}
```

**Never** store this URL in the database. Call `gravatarUrl(user.email)` only in `serializeUser`.

---

## User Serialization (`api/lib/auth.js`)

```js
import { gravatarUrl } from '@/lib/users/gravatar.js';

export function serializeUser(user) {
  return {
    id:          user.id,
    did:         user.did,
    handle:      user.handle,
    email:       user.email,
    displayName: user.displayName,
    role:        roleToApi(user.role),
    avatarUrl:   resolveAvatarUrl(user),
    hasCustomAvatar: hasCustomAvatar(user),
    createdAt:   user.createdAt?.toISOString?.() ?? user.createdAt,
  };
}
```

---

## Frontend AuthContext (`src/context/AuthContext.jsx`)

Session state always uses the enriched profile user from `GET /api/profile` when available. On profile failure, the Better Auth session user is enriched with `enrichSessionUser()` (uses `resolveAvatarDisplayUrl()`).

```jsx
'use client';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiFetch } from '@/lib/api/api';
import { refreshAuthUser } from '@/lib/auth/authSession';

const AuthContext = createContext(null);
let pendingRefresh = null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refreshSession = useCallback(async () => {
    if (pendingRefresh) return pendingRefresh;
    pendingRefresh = refreshAuthUser(apiFetch)
      .then((result) => { setUser(result.user); return result; })
      .finally(() => { pendingRefresh = null; });
    return pendingRefresh;
  }, []);

  useEffect(() => { refreshSession().finally(() => setReady(true)); }, [refreshSession]);

  // Async — no arguments. Never pass Better Auth data.user.
  const login = useCallback(async () => refreshSession(), [refreshSession]);

  const logout = useCallback(async () => {
    try { await apiFetch('/api/auth/sign-out', { method: 'POST', body: JSON.stringify({}) }); } catch {}
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshSession, ready, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**Rules:**

- Never `setUser(betterAuthUser)` after sign-in — raw session user lacks `avatarUrl`.
- After sign-in / OTP verify: `await login()` (or `await refreshSession()`) **before** `router.replace`.
- Display avatars with `resolveAvatarDisplayUrl(user)` from `src/lib/assetPublicUrl.js`.
- Session includes `avatarAssetId` (`additionalFields`) for proxy URL fallback when profile is unavailable.

---

## Frontend Auth Pages

Both pages use **only** `Button`, `FormGroup`, `Input`, `Label` from `@/primitives`. OAuth buttons use `Button variant='ghost'`. No custom button elements.

```jsx
// Password sign-in
const res = await apiFetch('/api/auth/sign-in/email', {
  method: 'POST',
  body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
});

// Password sign-up — optional phone; manual OTP send after success
const res = await apiFetch('/api/auth/sign-up/email', {
  method: 'POST',
  body: JSON.stringify({
    email: normalizedEmail,
    password,
    name,
    ...(phone ? { phone, preferOtpSms: true } : { preferOtpSms: false }),
  }),
});
if (res.ok) {
  await apiFetch('/api/auth/email-otp/send-verification-otp', {
    method: 'POST',
    body: JSON.stringify({
      email: normalizedEmail,
      type: 'email-verification',
      ...(phone ? { phone, preferOtpSms: true } : {}),
    }),
  }).catch(() => {});
  router.push(`/verify-email?email=${encodeURIComponent(normalizedEmail)}&via=${phone ? 'phone' : 'email'}`);
}
// Do NOT call refreshSession() after sign-up

// OAuth redirect
function oauthUrl(provider) {
  const base = getApiUrl().replace(/\/$/, '');
  const callback = encodeURIComponent(`${window.location.origin}/dashboard`);
  return `${base}/api/auth/sign-in/${provider}?callbackURL=${callback}`;
}
window.location.href = oauthUrl('github'); // or 'google'
```

---

---

## Email verification (account activation)

Separate from login 2FA OTP. Uses **6-digit code** via the `emailOTP` plugin, not a magic link.

| Page | Purpose |
|------|---------|
| `/verify-email` | After register — enter 6-digit activation OTP; resend with neutral copy |
| `/verify-otp` | After login — 6-digit second factor only |

Config in `src/lib/betterAuth.js`:

```js
emailAndPassword: {
  enabled: true,
  autoSignIn: false,
  requireEmailVerification: true,
  customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
    ...coreFields,
    twoFactorEnabled: false,
    phone: null,
    phoneVerified: false,
    preferOtpSms: false,
    ...additionalFields,
    id,
  }),
  onExistingUserSignUp: async ({ user }) => { /* notify existing user */ },
},
plugins: [
  emailOTP({
    sendVerificationOnSignUp: false,
    disableSignUp: true,
    expiresIn: 300,
    async sendVerificationOTP({ email, otp, type }) {
      // Prisma lookup with retry — BA body schema strips phone/preferOtpSms
    },
  }),
  twoFactor({ /* login OTP */ }),
],
```

**Constraints (read before changing auth):**

1. `phone` + `preferOtpSms` as `additionalFields` with `input: true` at sign-up
2. `verifyEmailOTP` requires user to exist — sign-up first
3. No auto-sign-in after verify — redirect to `/login?verified=true`
4. Manual OTP send after sign-up (`sendVerificationOnSignUp: false`)
5. Login 403 = unverified — link to `/verify-email`
6. Endpoint: `POST /api/auth/email-otp/verify-email`
7. Do not pass query params in BA `callbackURL`
8. BA `send-verification-otp` body schema only accepts `email` + `type` — extra fields like `phone` are stripped. Use Prisma lookup with short retry in `sendVerificationOTP` to route SMS (handles post-sign-up race).
9. `disableSignUp: true` causes `USER_NOT_FOUND` for unregistered emails on resend (BA #5017) — always neutral resend copy
10. `customSyntheticUser` required when `twoFactor` + `additionalFields` registered with `requireEmailVerification: true`
11. Client may pass `phone` in OTP send body for documentation intent — BA strips it; delivery uses DB lookup
12. Transform empty phone `''` → `undefined` before sign-up body — preserves `@unique` on `phone`
13. Wrap `sessionStorage` in try/catch; provide `EmailInputFallback` on `/verify-email`

**Client flow:**

```js
// Sign-up — phone omitted when empty (not '')
const res = await apiFetch('/api/auth/sign-up/email', {
  method: 'POST',
  body: JSON.stringify({
    email, password, name,
    ...(phone ? { phone, preferOtpSms: true } : { preferOtpSms: false }),
  }),
});

// Manual OTP send — pass phone in body for SMS routing
await apiFetch('/api/auth/email-otp/send-verification-otp', {
  method: 'POST',
  body: JSON.stringify({
    email, type: 'email-verification',
    ...(phone ? { phone, preferOtpSms: true } : {}),
  }),
});

// Verify — no session created
await apiFetch('/api/auth/email-otp/verify-email', {
  method: 'POST',
  body: JSON.stringify({ email, otp: code }),
});
// → router.push('/login?verified=true')
```

Resend endpoints: activation `POST /api/auth/email-otp/send-verification-otp`; login `POST /api/auth/two-factor/send-otp`.

---

## Two-Factor OTP (Resend + Telnyx)

Credential login uses the `twoFactor` plugin. OTP delivery is delegated to `src/lib/otpDelivery.js`:

- **Email (default):** Resend via `sendOtpEmail()` / `sendPasswordResetEmail()`
- **SMS (optional):** Telnyx when user sets `phone` + `preferOtpSms` at registration or in settings

```env
RESEND_KEY=
MAIL_FROM=Your App <noreply@yourdomain.com>
TELNYX_KEY=                          # optional
TELNYX_FROM=+15551234567             # optional, E.164
TELNYX_MESSAGING_PROFILE_ID=         # required for US SMS (10DLC)
```

See [otp-delivery/SKILL.md](../otp-delivery/SKILL.md) for API details, 10DLC setup, and testing.

Auth pages: `/verify-email`, `/verify-otp`, `/forgot-password`, `/reset-password`. Login OTP resend: `/api/auth/two-factor/send-otp`. Activation OTP resend: `/api/auth/email-otp/send-verification-otp` (always show neutral success copy).

---

## Environment Variables

```env
# Better Auth
BETTER_AUTH_SECRET=at-least-32-chars-random-string
BETTER_AUTH_URL=http://localhost:3000       # App base URL (same as Next.js)

# Email OTP + password reset (Resend)
RESEND_KEY=
MAIL_FROM=Your App <noreply@yourdomain.com>

# Optional SMS OTP (Telnyx — requires 10DLC for US)
TELNYX_KEY=
TELNYX_FROM=+15551234567
TELNYX_MESSAGING_PROFILE_ID=

# OAuth — omit to disable that provider
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Frontend origin (added to trustedOrigins)
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000

# Dev OTP bypass (local only — never production/preview)
# DEV_OTP_BYPASS=1
# DEV_OTP_BYPASS_CODE=000000
# NEXT_PUBLIC_DEV_OTP_BYPASS=1
```

When `DEV_OTP_BYPASS=1`, verify pages accept the bypass code; the auth route substitutes the real OTP from `Verification`. See `devOtpBypass.js` and the `otp-delivery` skill.

---

## OAuth App Callback URLs

**GitHub** (https://github.com/settings/developers):
- Authorization callback URL: `{BETTER_AUTH_URL}/api/auth/callback/github`

**Google** (https://console.cloud.google.com/apis/credentials):
- Authorized redirect URI: `{BETTER_AUTH_URL}/api/auth/callback/google`

---

## What NOT to Do

- ❌ Do not use `OAuthAccount` model — Better Auth uses `Account`.
- ❌ Do not import prisma from `./prisma.js` in `src/lib/betterAuth.js` — use `../../lib/prisma.js`.
- ❌ Do not use Express `toNodeHandler` — use `toNextJsHandler` in Next.js Route Handlers.
- ❌ Do not use `required: true` on `additionalFields` like `did`/`handle` — Better Auth validates BEFORE the `databaseHooks.user.create.before` hook runs, causing MISSING_FIELD 400.
- ❌ Do not omit `advanced.database.generateId: 'uuid'` — Better Auth defaults to base62 IDs which are incompatible with Postgres `@db.Uuid` columns, causing silent 422 failures.
- ❌ Do not store JWTs in localStorage — Better Auth uses httpOnly cookies only.
- ❌ Do not store Gravatar URLs in the DB — compute at response time.
- ❌ Do not add `better-auth/client` to the API — it is a browser-only package.
- ❌ Do not hardcode social provider config — gate on env vars so missing keys disable the provider.
- ❌ Do not change `User.email` to a non-citext column — case-insensitive uniqueness is required.
- ❌ Do not replicate sessions to Hyperbee — sessions are API-only.
- ❌ Do not reintroduce Mailchimp SMTP, Mandrill, Twilio, or `nodemailer` — use Resend + Telnyx via `otpDelivery.js`.
- ❌ Do not skip Telnyx 10DLC registration for US SMS — messages will be blocked.
- ❌ Do not call `refreshSession()` immediately after sign-up when `autoSignIn: false`.
- ❌ Do not pass empty string `''` for `phone` in sign-up body — omit the field so DB stores `null` (preserves `@unique`).
- ❌ Do not show error-specific copy on OTP resend — use neutral *"If your account exists, a new code has been sent."*
- ❌ Do not omit `customSyntheticUser` when `twoFactor` + custom `additionalFields` are registered.
- ❌ Do not set `DEV_OTP_BYPASS=1` on Vercel preview or production deployments.

---

## Testing

Integration tests use `request.agent(app)` to carry cookies across requests:

```js
import request from 'supertest';
import { app } from '../server.js';

const agent = request.agent(app);
// sign-up sets the session cookie on the agent
await agent.post('/api/auth/sign-up/email').send({ email, password, name });
// subsequent requests automatically include the cookie
const profile = await agent.get('/api/profile');
expect(profile.status).toBe(200);
```

Never extract a token from the response body — Better Auth returns no body token.
Session state lives in the httpOnly `better-auth.session` cookie.

---

## Migration Checklist

1. Schema: `Account`, `Session` (with `token` column), `Verification` models present.
2. Run `bun run db:migrate:deploy` (or `bun run db:migrate` for dev).
3. Set `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FRONTEND_URL` in `.env`.
4. Optionally set `GITHUB_*` and/or `GOOGLE_*` for SSO.
5. Set `RESEND_KEY` and `MAIL_FROM` for OTP/password-reset email.
6. Optionally set `TELNYX_*` for SMS OTP (requires 10DLC for US numbers).
7. Run `bun run test` from repo root.
