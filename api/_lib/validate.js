// Pure request validation for the projects / upload routes — no DB, no env,
// so test/api.test.mjs can pin every rule. Each validator returns
// { value } on success or { error } (a user-facing sentence) on failure.

export const MAX_BODY_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5 MB request cap
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const DAILY_UPLOAD_BYTES = 1024 * 1024 * 1024;
export const VISIBILITIES = ['private', 'unlisted', 'public'];
const KINDS = ['img', 'gif', 'video'];

/** Exact upload MIME allowlist → object key extension. No SVG (script-capable). */
export const UPLOAD_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov'
};

/**
 * Asset URLs a shared project may reference: our B2 bucket plus the hosts the
 * library panel pulls from (GIPHY media, picsum). Anything else would let a
 * shared project make every viewer's browser fetch an arbitrary URL.
 * @param {unknown} url
 * @param {string} [publicBase] B2_PUBLIC_URL, e.g. https://f004.backblazeb2.com/file/bucket
 * @returns {boolean}
 */
export function isAllowedAssetUrl(url, publicBase) {
  if (typeof url !== 'string' || url.length > 2048) return false;
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  if (publicBase && url.startsWith(`${publicBase.replace(/\/+$/, '')}/`)) return true;
  return u.hostname === 'picsum.photos' || /^(media\d*|i)\.giphy\.com$/.test(u.hostname);
}

/**
 * Validate a serialize() payload (src/scene.js) bound for the DB.
 * @param {unknown} data
 * @param {string} [publicBase]
 * @returns {{value: object} | {error: string}}
 */
export function validateProjectData(data, publicBase) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'project data must be an object' };
  if (!Array.isArray(data.items)) return { error: 'project items must be a list' };
  if (!Array.isArray(data.sources) || data.sources.length > 500) return { error: 'project sources must be a list of at most 500' };
  if (data.background !== undefined && (typeof data.background !== 'string' || data.background.length > 64)) {
    return { error: 'background must be a colour string' };
  }
  for (const s of data.sources) {
    if (!s || (typeof s.id !== 'string' && typeof s.id !== 'number')) return { error: 'every source needs an id' };
    if (!KINDS.includes(s.kind)) return { error: `unknown source kind ${String(s.kind)}` };
    if (!isAllowedAssetUrl(s.url, publicBase)) {
      return { error: "a file on the canvas comes from a site shared projects can't load. upload it first" };
    }
    if (s.thumb !== undefined && s.thumb !== null && !isAllowedAssetUrl(s.thumb, publicBase)) {
      return { error: "a thumbnail comes from a site shared projects can't load" };
    }
  }
  return { value: data };
}

/**
 * Validate a POST (create) or PUT (partial update) body.
 * @param {unknown} body parsed JSON
 * @param {{partial?: boolean, publicBase?: string}} [opts]
 * @returns {{value: {title?: string, data?: object, thumbUrl?: string|null, visibility?: string}} | {error: string}}
 */
export function validateProjectBody(body, { partial = false, publicBase } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'body must be a JSON object' };
  const value = {};
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.length > 120) return { error: 'title must be at most 120 characters' };
    value.title = body.title.trim();
  }
  if (body.data !== undefined || !partial) {
    const r = validateProjectData(body.data, publicBase);
    if (r.error) return r;
    value.data = r.value;
  }
  if (body.thumbUrl !== undefined && body.thumbUrl !== null) {
    if (!isAllowedAssetUrl(body.thumbUrl, publicBase)) return { error: 'thumbnail must be an uploaded image' };
    value.thumbUrl = body.thumbUrl;
  } else if (body.thumbUrl === null) value.thumbUrl = null;
  if (body.visibility !== undefined) {
    if (!VISIBILITIES.includes(body.visibility)) return { error: 'visibility must be private, unlisted or public' };
    value.visibility = body.visibility;
  }
  if (partial && Object.keys(value).length === 0) return { error: 'nothing to update' };
  return { value };
}

/**
 * Validate an upload request.
 * @param {unknown} body {contentType, size}
 * @returns {{value: {contentType: string, size: number, ext: string}} | {error: string}}
 */
export function validateUploadRequest(body) {
  const contentType = body?.contentType;
  const size = body?.size;
  const ext = UPLOAD_TYPES[contentType];
  if (!ext) return { error: 'only PNG, JPEG, GIF, WebP, WebM, MP4 and MOV files can be uploaded' };
  if (!Number.isInteger(size) || size <= 0) return { error: 'size must be a positive whole number of bytes' };
  if (size > MAX_UPLOAD_BYTES) return { error: 'files over 100 MB cannot be uploaded' };
  return { value: { contentType, size, ext } };
}

/**
 * Parse an ISO timestamp cursor; null when absent, undefined when invalid.
 * @param {string|null} s
 * @returns {Date|null|undefined}
 */
export function parseCursor(s) {
  if (s === null || s === '') return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** 12-char base62 id from crypto randomness (~71 bits). */
export function newId() {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  // ponytail: modulo bias of 256 % 62 is negligible for unguessable-enough ids
  return Array.from(bytes, (b) => alphabet[b % 62]).join('');
}
