// Better Auth, self-hosted on Vercel functions; Neon is only the Postgres.
// Email + password always; Google / GitHub only when their env keys exist, so
// local dev works without OAuth apps.
import { betterAuth } from 'better-auth';
import { pool } from './db.js';

const env = process.env;

/** @type {Record<string, {clientId: string, clientSecret: string}>} */
const socialProviders = {};
if (env.GOOGLE_CLIENT_ID) socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
if (env.GITHUB_CLIENT_ID) socialProviders.github = { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };

export const auth = betterAuth({
  database: pool,
  secret: env.BETTER_AUTH_SECRET,
  // Previews get a new *.vercel.app host per deploy; resolve the base URL from
  // the request host against this allowlist. OAuth callbacks still only work
  // on hosts registered with the provider (prod + localhost).
  baseURL: {
    allowedHosts: ['gifpaint-zakros.vercel.app', 'gifpaint-*-zakros.vercel.app', 'localhost:*'],
    fallback: env.BETTER_AUTH_URL ?? 'https://gifpaint-zakros.vercel.app',
    protocol: env.VERCEL ? 'https' : 'http'
  },
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  socialProviders,
  // Shared across serverless instances (memory store would be per instance).
  rateLimit: { enabled: true, storage: 'database' }
});

/**
 * Signed-in user for a request, or null.
 * @param {Request} request
 * @returns {Promise<{id: string, name: string, email: string} | null>}
 */
export async function currentUser(request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}
