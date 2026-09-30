// Cloud side of gifpaint: Better Auth session, projects API, B2 uploads.
// Everything here talks to same-origin /api/* (Vercel functions; `vercel dev`
// locally). Local autosave (store.js) and .json save/load never depend on it.
import { createAuthClient } from 'better-auth/client';

/** @type {ReturnType<typeof createAuthClient> | undefined} */
let client;
/** Lazy so importing this module (tests, no window) never builds a client. */
export const authClient = () => (client ??= createAuthClient());

/** @typedef {{id: string, name: string, email: string}} User */
/** @typedef {'private'|'unlisted'|'public'} Visibility */
/** @typedef {{id: string, title: string, thumbUrl: string|null, visibility?: Visibility, author?: string, createdAt?: string, updatedAt?: string}} ProjectSummary */

/** Error carrying the HTTP status so callers can branch (401 → sign in). */
export class ApiError extends Error {
  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Better Auth client calls resolve `{ data, error }`; turn `error` into a throw.
 * @template T
 * @param {Promise<{data: T, error: {message?: string, status?: number} | null}>} p
 * @returns {Promise<T>}
 */
async function unwrap(p) {
  const { data, error } = await p;
  if (error) throw new ApiError(error.message || 'sign-in failed', error.status ?? 400);
  return data;
}

/** @returns {Promise<User|null>} */
export async function currentUser() {
  try {
    const data = await unwrap(authClient().getSession());
    return data?.user ?? null;
  } catch {
    return null; // no API (plain `vite` dev) = signed out
  }
}

/** @param {string} email @param {string} password */
export const signIn = (email, password) => unwrap(authClient().signIn.email({ email, password }));

/** @param {string} name @param {string} email @param {string} password */
export const signUp = (name, email, password) => unwrap(authClient().signUp.email({ name, email, password }));

/** Redirects to the provider and back to this page. @param {'google'|'github'} provider */
export const signInSocial = (provider) =>
  unwrap(authClient().signIn.social({ provider, callbackURL: location.href }));

export const signOut = () => unwrap(authClient().signOut());

/**
 * fetch + JSON with `{error}` bodies turned into ApiError.
 * @param {string} path
 * @param {RequestInit} [init]
 * @param {typeof fetch} [fetchImpl]
 */
export async function api(path, init = {}, fetchImpl = fetch) {
  const res = await fetchImpl(path, {
    ...init,
    headers: init.body ? { 'content-type': 'application/json', ...init.headers } : init.headers
  });
  // a non-JSON 200 is plain `vite` serving index.html: no API behind it
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new ApiError(body?.error || `cloud unavailable (${res.status})`, res.status);
  return body;
}

/**
 * Upload one blob to B2 through a presigned PUT.
 * @param {Blob} blob
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<string>} permanent public URL
 */
export async function uploadBlob(blob, fetchImpl = fetch) {
  const { putUrl, publicUrl } = await api(
    '/api/upload',
    { method: 'POST', body: JSON.stringify({ contentType: blob.type, size: blob.size }) },
    fetchImpl
  );
  const res = await fetchImpl(putUrl, { method: 'PUT', body: blob, headers: { 'content-type': blob.type } });
  if (!res.ok) throw new ApiError(`upload failed (${res.status})`, res.status);
  return publicUrl;
}

/**
 * Replace every `data:` source URL with an uploaded B2 URL, in place on the
 * live source entries, so a later save never uploads the same asset again.
 * @param {Map<string, {url: string, thumb?: string}>} sources
 * @param {(blob: Blob) => Promise<string>} [upload]
 * @param {typeof fetch} [fetchImpl] used to turn the data URL into a Blob
 * @returns {Promise<number>} how many were uploaded
 */
export async function uploadDataSources(sources, upload = uploadBlob, fetchImpl = fetch) {
  let n = 0;
  for (const s of sources.values()) {
    if (!s.url?.startsWith('data:')) continue;
    const blob = await (await fetchImpl(s.url)).blob();
    const url = await upload(blob);
    if (s.thumb === s.url || s.thumb?.startsWith('data:')) s.thumb = url;
    s.url = url;
    n++;
  }
  return n;
}

/**
 * 320px-wide PNG of the canvas, or null when the canvas is tainted by a
 * cross-origin asset without CORS (the save still goes through).
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob|null>}
 */
export function thumbnail(canvas) {
  const w = 320;
  const h = Math.round((canvas.height / canvas.width) * w) || 240;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(canvas, 0, 0, w, h);
  return new Promise((resolve) => {
    try {
      c.toBlob((b) => resolve(b), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/**
 * Create (no id) or update (id) a cloud project. Uploads first.
 * @param {{id?: string|null, title: string, data: object, canvas: HTMLCanvasElement, visibility?: Visibility}} p
 * @returns {Promise<{id: string, visibility: Visibility}>}
 */
export async function saveCloud({ id, title, data, canvas, visibility }) {
  const thumb = await thumbnail(canvas);
  // thumbnail is best-effort; the project's own assets are not
  const thumbUrl = thumb ? await uploadBlob(thumb).catch(() => null) : null;
  const body = JSON.stringify({ title, data, thumbUrl, ...(visibility ? { visibility } : {}) });
  return id
    ? api(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'PUT', body })
    : api('/api/projects', { method: 'POST', body });
}

/** @param {string} id @returns {Promise<{id: string, title: string, data: object, visibility: Visibility, isOwner: boolean}>} */
export const loadCloud = (id) => api(`/api/projects?id=${encodeURIComponent(id)}`);

/** @param {string} id @param {Visibility} visibility */
export const setVisibility = (id, visibility) =>
  api(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ visibility }) });

/** @param {string} id */
export const deleteCloud = (id) => api(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' });

/** @returns {Promise<{projects: ProjectSummary[]}>} */
export const listMine = () => api('/api/projects?mine=1');

/** @param {string|null} [before] cursor from the previous page's `next` @returns {Promise<{projects: ProjectSummary[], next: string|null}>} */
export const listGallery = (before) =>
  api(`/api/projects?gallery=1${before ? `&before=${encodeURIComponent(before)}` : ''}`);

/** Share URL for a project id on this origin. @param {string} id */
export const shareUrl = (id) => `${location.origin}/?p=${encodeURIComponent(id)}`;

/** Project id from a URL's `?p=`, or null. @param {string} href */
export function projectIdFromUrl(href) {
  const id = new URL(href).searchParams.get('p');
  return id && /^[0-9A-Za-z]{1,32}$/.test(id) ? id : null;
}
