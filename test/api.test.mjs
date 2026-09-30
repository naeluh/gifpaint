// run: node test/api.test.mjs — cloud API validators, auth path restore, client upload swap
import assert from 'node:assert/strict';
import {
  isAllowedAssetUrl,
  validateProjectData,
  validateProjectBody,
  validateUploadRequest,
  parseCursor,
  newId,
  MAX_UPLOAD_BYTES
} from '../api/_lib/validate.js';
import { restorePath, readJson } from '../api/_lib/http.js';
import { uploadDataSources, api, ApiError, projectIdFromUrl } from '../src/cloud.js';

const B2 = 'https://f004.backblazeb2.com/file/gifpaint';

// ── asset URL allowlist ──
assert.ok(isAllowedAssetUrl(`${B2}/u/1/a.png`, B2), 'our bucket');
assert.ok(isAllowedAssetUrl(`${B2}/u/1/a.png`, `${B2}/`), 'trailing slash on base tolerated');
assert.ok(isAllowedAssetUrl('https://media2.giphy.com/media/x/200.gif'), 'giphy media host');
assert.ok(isAllowedAssetUrl('https://i.giphy.com/x.gif'), 'giphy i host');
assert.ok(isAllowedAssetUrl('https://picsum.photos/seed/ab/600/450'), 'picsum');
assert.ok(!isAllowedAssetUrl('data:image/png;base64,AAAA', B2), 'data: refused — upload first');
assert.ok(!isAllowedAssetUrl('javascript:alert(1)', B2), 'javascript: refused');
assert.ok(!isAllowedAssetUrl('http://picsum.photos/x', B2), 'plain http refused');
assert.ok(!isAllowedAssetUrl('https://evil.example/track.gif', B2), 'unknown host refused');
assert.ok(!isAllowedAssetUrl(`${B2}evil/x.png`, B2), 'bucket prefix must end at a path boundary');
assert.ok(!isAllowedAssetUrl('https://giphy.com.evil.example/x.gif', B2), 'lookalike host refused');
assert.ok(!isAllowedAssetUrl('https://user:pw@picsum.photos/x', B2), 'credentials in URL refused');
assert.ok(!isAllowedAssetUrl(`https://picsum.photos/${'a'.repeat(2100)}`, B2), 'overlong URL refused');

// ── project data ──
const good = {
  v: 1,
  background: '#111213',
  items: [{ id: 'a', type: 'image', srcId: 's1' }],
  sources: [{ id: 's1', kind: 'gif', url: 'https://media.giphy.com/m/1.gif', thumb: 'https://media.giphy.com/m/1s.gif' }]
};
assert.deepEqual(validateProjectData(good, B2).value, good, 'valid project passes unchanged');
assert.match(validateProjectData(null).error, /object/);
assert.match(validateProjectData({ sources: [] }).error, /items/);
assert.match(validateProjectData({ items: [], sources: [{ id: 1, kind: 'img', url: 'data:x' }] }, B2).error, /upload it first/);
assert.match(validateProjectData({ items: [], sources: [{ id: 1, kind: 'svg', url: `${B2}/a` }] }, B2).error, /kind/);
assert.match(validateProjectData({ items: [], sources: [{ kind: 'img', url: `${B2}/a` }] }, B2).error, /id/);
assert.match(
  validateProjectData({ items: [], sources: [{ id: 1, kind: 'img', url: `${B2}/a`, thumb: 'data:x' }] }, B2).error,
  /thumbnail/
);
assert.match(validateProjectData({ items: [], sources: [], background: 'x'.repeat(65) }).error, /colour/);
assert.match(validateProjectData({ items: [], sources: Array(501).fill({}) }).error, /500/);

// ── create / update bodies ──
assert.deepEqual(validateProjectBody({ title: ' hi ', data: good }, { publicBase: B2 }).value, { title: 'hi', data: good });
assert.match(validateProjectBody({ title: 'x' }).error, /object/, 'create requires data');
assert.deepEqual(validateProjectBody({ visibility: 'public' }, { partial: true }).value, { visibility: 'public' });
assert.match(validateProjectBody({ visibility: 'everyone' }, { partial: true }).error, /visibility/);
assert.match(validateProjectBody({}, { partial: true }).error, /nothing/);
assert.match(validateProjectBody({ title: 'x'.repeat(121) }, { partial: true }).error, /120/);
assert.match(validateProjectBody({ thumbUrl: 'https://evil.example/a.png' }, { partial: true, publicBase: B2 }).error, /thumbnail/);
assert.deepEqual(validateProjectBody({ thumbUrl: null }, { partial: true }).value, { thumbUrl: null }, 'thumb can be cleared');
assert.deepEqual(
  Object.keys(validateProjectBody({ title: 'a', owner_id: 'x', id: 'y' }, { partial: true }).value),
  ['title'],
  'unknown keys never reach the UPDATE column list'
);
assert.match(validateProjectBody([], { partial: true }).error, /object/);

// ── upload requests ──
assert.deepEqual(validateUploadRequest({ contentType: 'image/png', size: 10 }).value, { contentType: 'image/png', size: 10, ext: 'png' });
assert.equal(validateUploadRequest({ contentType: 'video/quicktime', size: 1 }).value.ext, 'mov');
assert.match(validateUploadRequest({ contentType: 'image/svg+xml', size: 10 }).error, /PNG/, 'SVG refused');
assert.match(validateUploadRequest({ contentType: 'image/png', size: 0 }).error, /positive/);
assert.match(validateUploadRequest({ contentType: 'image/png', size: 1.5 }).error, /whole/);
assert.ok(validateUploadRequest({ contentType: 'image/png', size: MAX_UPLOAD_BYTES }).value, 'exactly the cap is fine');
assert.match(validateUploadRequest({ contentType: 'image/png', size: MAX_UPLOAD_BYTES + 1 }).error, /100 MB/);
assert.match(validateUploadRequest(null).error, /PNG/);

// ── cursor + ids ──
assert.equal(parseCursor(null), null);
assert.equal(parseCursor(''), null);
assert.equal(parseCursor('nope'), undefined);
assert.equal(parseCursor('2026-09-29T00:00:00Z').toISOString(), '2026-09-29T00:00:00.000Z');
const ids = new Set(Array.from({ length: 2000 }, newId));
assert.equal(ids.size, 2000, 'ids do not collide');
for (const id of ids) assert.match(id, /^[0-9A-Za-z]{12}$/);

// ── auth rewrite path restore ──
{
  const r = await restorePath(new Request('https://x.test/api/auth?__ba=sign-in/email', { method: 'POST', body: '{"a":1}' }));
  assert.equal(new URL(r.url).pathname, '/api/auth/sign-in/email', 'tail restored');
  assert.equal(new URL(r.url).searchParams.has('__ba'), false, 'marker removed');
  assert.equal(await r.text(), '{"a":1}', 'body kept');
  const kept = await restorePath(new Request('https://x.test/api/auth/get-session?__ba=get-session'));
  assert.equal(new URL(kept.url).pathname, '/api/auth/get-session', 'original path wins when Vercel kept it');
  const plain = new Request('https://x.test/api/auth/ok');
  assert.equal(await restorePath(plain), plain, 'no marker = untouched');
  const q = await restorePath(new Request('https://x.test/api/auth?__ba=callback/github&code=abc'));
  assert.equal(new URL(q.url).search, '?code=abc', 'OAuth query survives');
}

// ── body cap ──
{
  const big = await readJson(new Request('https://x.test', { method: 'POST', body: 'x'.repeat(11) }), 10);
  assert.equal(big.response.status, 413);
  const bad = await readJson(new Request('https://x.test', { method: 'POST', body: '{' }), 10);
  assert.equal(bad.response.status, 400);
  assert.deepEqual((await readJson(new Request('https://x.test', { method: 'POST', body: '{"a":1}' }), 10)).value, { a: 1 });
}

// ── client: data-URL sources upload once, in place ──
{
  const fakeFetch = async (url) => ({ blob: async () => new Blob(['x'], { type: url.slice(5, url.indexOf(';')) }) });
  const uploaded = [];
  const upload = async (blob) => {
    uploaded.push(blob.type);
    return `${B2}/u/1/${uploaded.length}`;
  };
  const dataUrl = 'data:image/png;base64,AAAA';
  const sources = new Map([
    ['a', { url: dataUrl, thumb: dataUrl }],
    ['b', { url: 'https://media.giphy.com/1.gif', thumb: 'https://media.giphy.com/1s.gif' }],
    ['c', { url: 'data:video/webm;base64,AAAA' }]
  ]);
  assert.equal(await uploadDataSources(sources, upload, fakeFetch), 2);
  assert.deepEqual(uploaded, ['image/png', 'video/webm']);
  assert.deepEqual(sources.get('a'), { url: `${B2}/u/1/1`, thumb: `${B2}/u/1/1` }, 'url + thumb swapped');
  assert.equal(sources.get('b').url, 'https://media.giphy.com/1.gif', 'remote urls untouched');
  assert.equal(sources.get('c').thumb, undefined, 'absent thumb stays absent');
  assert.equal(await uploadDataSources(sources, upload, fakeFetch), 0, 'second save uploads nothing');
}

// ── client: api() error shape ──
{
  const res = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });
  await assert.rejects(api('/x', {}, res(401, { error: 'sign in to save' })), (e) => e instanceof ApiError && e.status === 401 && e.message === 'sign in to save');
  await assert.rejects(api('/x', {}, async () => ({ ok: false, status: 502, json: async () => { throw new Error('html'); } })), /502/);
  assert.deepEqual(await api('/x', {}, res(200, { id: 'a' })), { id: 'a' });
  await assert.rejects(api('/x', {}, async () => ({ ok: true, status: 200, json: async () => { throw new Error('html'); } })), /unavailable/, 'index.html fallback is not success');
}

// ── share link parsing ──
assert.equal(projectIdFromUrl('https://g.test/?p=Ab3'), 'Ab3');
assert.equal(projectIdFromUrl('https://g.test/'), null);
assert.equal(projectIdFromUrl('https://g.test/?p=../x'), null, 'junk id ignored');

console.log('api.test ok');
