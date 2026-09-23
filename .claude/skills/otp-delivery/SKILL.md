---
name: otp-delivery
description: "Use when editing OTP email/SMS delivery in this project. Covers Resend HTTP API for email and Telnyx Messages API for SMS. Trigger on: mailtransport, otpDelivery, RESEND_KEY, TELNYX_KEY, OTP email, password reset email, SMS 2FA, 10DLC."
---

# OTP Delivery — Resend + Telnyx

## File split

| File | Responsibility |
|------|----------------|
| `src/lib/mailtransport.js` | Resend HTTP API — `sendEmail()`, `getFromAddress()` |
| `src/lib/otpDelivery.js` | OTP/password-reset templates; Telnyx SMS; `sendOtpByPreference()` |
| `src/lib/devOtpBypass.js` | Dev-only OTP bypass gate, logging, Verification lookup, `parseOtpFromValue()` |
| `src/lib/betterAuth.js` | Wires `sendOtpByPreference` + `sendPasswordResetEmail` into Better Auth |

Do not add nodemailer or Twilio. Use native `fetch` only.

## Environment variables

```env
# Email (required for OTP + password reset)
RESEND_KEY=
MAIL_FROM=Your App <noreply@yourdomain.com>   # Verified domain in Resend dashboard

# SMS (optional — user enables preferOtpSms in settings)
TELNYX_KEY=
TELNYX_FROM=+15551234567                       # E.164; assigned to 10DLC campaign
TELNYX_MESSAGING_PROFILE_ID=                   # From Telnyx portal after 10DLC setup

# Dev OTP bypass (local only — never production/preview)
DEV_OTP_BYPASS=1
DEV_OTP_BYPASS_CODE=000000
NEXT_PUBLIC_DEV_OTP_BYPASS=1
NEXT_PUBLIC_DEV_OTP_BYPASS_CODE=000000
```

When `DEV_OTP_BYPASS=1` and `NODE_ENV=development`, `otpDelivery.js` skips external sends and logs `[otp:dev]` to the terminal. Verify endpoints accept the bypass code; [`src/app/api/auth/[...all]/route.js`](src/app/api/auth/[...all]/route.js) substitutes the real OTP from `Verification` before Better Auth validates. `RESEND_KEY` / `TELNYX_*` are optional in that mode.

## API details

**Resend** — `POST https://api.resend.com/emails`
- Auth: `Authorization: Bearer ${RESEND_KEY}`
- Returns **201** on success (not 200)
- Error body: `{ name, message, statusCode }` — parse JSON in error handler
- Optional `Idempotency-Key` header supported in `sendEmail({ idempotencyKey })` but not yet wired through Better Auth OTP resend callbacks

**Telnyx** — `POST https://api.telnyx.com/v2/messages`
- Auth: `Authorization: Bearer ${TELNYX_KEY}`
- Body must include `messaging_profile_id` for US A2P/10DLC compliance
- All three Telnyx env vars are required when sending SMS (strict throw)

## 10DLC pre-flight (US SMS)

Before first US SMS send:

1. Register Brand + Campaign in Telnyx Mission Control (use case: 2FA/OTP)
2. Assign `TELNYX_FROM` number to the campaign
3. Copy `messaging_profile_id` to `TELNYX_MESSAGING_PROFILE_ID`

SMS OTP will be **silently blocked** for US numbers until 10DLC is approved (1–3 business days).

Guide: https://support.telnyx.com/en/articles/6325731-register-for-10dlc-messaging

## Testing

- Unit tests: `src/lib/mailtransport.test.js`, `src/lib/otpDelivery.test.js`, `src/lib/devOtpBypass.test.js`
- Mock `globalThis.fetch` — never hit live Resend/Telnyx APIs in unit tests
- Resend happy path: mock `{ status: 201, ok: true }`
- Telnyx happy path: assert `messaging_profile_id` in POST body

```bash
bun test src/lib/mailtransport.test.js src/lib/otpDelivery.test.js
```

## What NOT to Do

- ❌ Do not reintroduce Mailchimp SMTP, Mandrill, or Twilio
- ❌ Do not add `nodemailer` — use Resend HTTP API via `mailtransport.js`
- ❌ Do not skip 10DLC brand/campaign registration — US messages will be blocked
- ❌ Do not send SMS without `TELNYX_MESSAGING_PROFILE_ID`
- ❌ Do not hardcode sender addresses — use `MAIL_FROM` and `TELNYX_FROM` env vars
- ❌ Do not assert Resend success as HTTP 200 — it returns 201
- ❌ Do not set `DEV_OTP_BYPASS=1` on Vercel preview or production — gated by `NODE_ENV` and `VERCEL_ENV` in `devOtpBypass.js`

## Known limitation

Rapid OTP resends may deliver duplicate emails because `Idempotency-Key` is not yet passed from Better Auth `sendOTP` callbacks. Document here if adding threading later.
