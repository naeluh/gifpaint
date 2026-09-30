// All Better Auth routes. Vercel functions outside Next match one path segment,
// so vercel.json rewrites /api/auth/* here and passes the tail as ?__ba=.
import { auth } from './_lib/auth.js';
import { restorePath } from './_lib/http.js';

export const runtime = 'nodejs';

export async function GET(request) {
  return auth.handler(await restorePath(request));
}

export async function POST(request) {
  return auth.handler(await restorePath(request));
}
