// POST /api/upload {contentType, size} → {putUrl, publicUrl}
// Signed-in users get a 10-minute presigned PUT into the public B2 bucket.
// Content-Type and Content-Length are part of the signature, so B2 refuses a
// body of another type or size.
import { AwsClient } from 'aws4fetch';
import { currentUser } from './_lib/auth.js';
import { q } from './_lib/db.js';
import { fail, guarded, json, readJson } from './_lib/http.js';
import { DAILY_UPLOAD_BYTES, validateUploadRequest } from './_lib/validate.js';

export const runtime = 'nodejs';

const env = process.env;
const b2 = new AwsClient({
  accessKeyId: env.B2_KEY_ID ?? '',
  secretAccessKey: env.B2_APP_KEY ?? '',
  service: 's3',
  region: env.B2_REGION ?? ''
});

export const POST = guarded(async (request) => {
  const user = await currentUser(request);
  if (!user) return fail(401, 'sign in to upload');
  if (!env.B2_KEY_ID || !env.B2_BUCKET || !env.B2_ENDPOINT || !env.B2_PUBLIC_URL) {
    return fail(503, 'uploads are not configured on this deployment');
  }
  const body = await readJson(request, 4096);
  if (body.response) return body.response;
  const v = validateUploadRequest(body.value);
  if (v.error) return fail(400, v.error);
  const { contentType, size, ext } = v.value;

  const [{ used }] = await q(
    `select coalesce(sum(size), 0)::bigint as used from uploads where owner_id = $1 and created_at > now() - interval '1 day'`,
    [user.id]
  );
  if (Number(used) + size > DAILY_UPLOAD_BYTES) return fail(429, "you've hit today's 1 GB upload limit. try again tomorrow");

  const key = `u/${user.id}/${crypto.randomUUID()}.${ext}`;
  const target = new URL(`${env.B2_ENDPOINT.replace(/\/+$/, '')}/${env.B2_BUCKET}/${key}`);
  target.searchParams.set('X-Amz-Expires', '600');
  const signed = await b2.sign(target, {
    method: 'PUT',
    headers: { 'content-type': contentType, 'content-length': String(size) },
    aws: { signQuery: true, allHeaders: true }
  });
  await q('insert into uploads (key, owner_id, size) values ($1, $2, $3)', [key, user.id, size]);
  return json({ putUrl: signed.url, publicUrl: `${env.B2_PUBLIC_URL.replace(/\/+$/, '')}/${key}` });
});
