// Cloud projects.
//   GET    ?id=<id>                  one project (private ones only for the owner)
//   GET    ?mine=1                   signed-in user's projects (no data)
//   GET    ?gallery=1[&before=<iso>] public projects, newest first, 48 per page
//   POST   {title, data, thumbUrl?, visibility?}   create (signed in)
//   PUT    ?id=<id> {partial of the above}         update (owner)
//   DELETE ?id=<id>                               soft delete (owner)
// Non-owners get 404 for private rows so ids can't be probed.
import { currentUser } from './_lib/auth.js';
import { q } from './_lib/db.js';
import { fail, guarded, json, readJson } from './_lib/http.js';
import { MAX_BODY_BYTES, newId, parseCursor, validateProjectBody } from './_lib/validate.js';

export const runtime = 'nodejs';

const PAGE = 48;
const publicBase = process.env.B2_PUBLIC_URL;

export const GET = guarded(async (request) => {
  const params = new URL(request.url).searchParams;

  if (params.has('gallery')) {
    const before = parseCursor(params.get('before'));
    if (before === undefined) return fail(400, 'before must be a timestamp');
    const rows = await q(
      `select p.id, p.title, p.thumb_url as "thumbUrl", p.created_at as "createdAt", u.name as author
         from projects p join "user" u on u.id = p.owner_id
        where p.deleted_at is null and p.visibility = 'public' and not p.hidden
          and ($1::timestamptz is null or p.created_at < $1)
        order by p.created_at desc limit ${PAGE}`,
      [before]
    );
    return json({ projects: rows, next: rows.length === PAGE ? rows.at(-1).createdAt : null }, 200, {
      'cache-control': 'public, s-maxage=30, stale-while-revalidate=300'
    });
  }

  if (params.has('mine')) {
    const user = await currentUser(request);
    if (!user) return fail(401, 'sign in to see your projects');
    const rows = await q(
      `select id, title, thumb_url as "thumbUrl", visibility, updated_at as "updatedAt"
         from projects where owner_id = $1 and deleted_at is null
        order by updated_at desc limit 200`,
      [user.id]
    );
    return json({ projects: rows });
  }

  const id = params.get('id');
  if (!id) return fail(400, 'pass ?id=, ?mine=1 or ?gallery=1');
  const [row] = await q(
    `select id, owner_id, title, data, thumb_url as "thumbUrl", visibility, updated_at as "updatedAt"
       from projects where id = $1 and deleted_at is null`,
    [id]
  );
  if (!row) return fail(404, 'no project at this link');
  const user = row.visibility === 'private' || request.headers.has('cookie') ? await currentUser(request) : null;
  const isOwner = user?.id === row.owner_id;
  if (row.visibility === 'private' && !isOwner) return fail(404, 'no project at this link');
  const { owner_id: _owner, ...project } = row;
  return json({ ...project, isOwner });
});

export const POST = guarded(async (request) => {
  const user = await currentUser(request);
  if (!user) return fail(401, 'sign in to save to the cloud');
  const body = await readJson(request, MAX_BODY_BYTES);
  if (body.response) return body.response;
  const v = validateProjectBody(body.value, { publicBase });
  if (v.error) return fail(400, v.error);
  const { title = '', data, thumbUrl = null, visibility = 'private' } = v.value;
  const id = newId();
  await q(
    'insert into projects (id, owner_id, title, data, thumb_url, visibility) values ($1, $2, $3, $4, $5, $6)',
    [id, user.id, title, data, thumbUrl, visibility]
  );
  return json({ id, visibility }, 201);
});

export const PUT = guarded(async (request) => {
  const user = await currentUser(request);
  if (!user) return fail(401, 'sign in to save to the cloud');
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return fail(400, 'pass ?id=');
  const body = await readJson(request, MAX_BODY_BYTES);
  if (body.response) return body.response;
  const v = validateProjectBody(body.value, { partial: true, publicBase });
  if (v.error) return fail(400, v.error);
  const cols = { title: 'title', data: 'data', thumbUrl: 'thumb_url', visibility: 'visibility' };
  const keys = Object.keys(v.value);
  const sets = keys.map((k, i) => `${cols[k]} = $${i + 3}`).join(', ');
  const rows = await q(
    `update projects set ${sets}, updated_at = now()
      where id = $1 and owner_id = $2 and deleted_at is null returning id, visibility`,
    [id, user.id, ...keys.map((k) => v.value[k])]
  );
  if (!rows.length) return fail(404, 'no project of yours at this id');
  return json(rows[0]);
});

export const DELETE = guarded(async (request) => {
  const user = await currentUser(request);
  if (!user) return fail(401, 'sign in to delete');
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return fail(400, 'pass ?id=');
  const rows = await q(
    'update projects set deleted_at = now() where id = $1 and owner_id = $2 and deleted_at is null returning id',
    [id, user.id]
  );
  if (!rows.length) return fail(404, 'no project of yours at this id');
  return json({ id, deleted: true });
});
