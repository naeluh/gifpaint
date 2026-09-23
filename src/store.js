// Autosave store: IndexedDB first (no ~5MB cap, so uploaded video/gif dataURLs
// survive a reload), localStorage fallback. Every path swallows to null/no-op —
// autosave must never throw into the UI. The pre-IndexedDB localStorage key is
// still read so an old autosave migrates on first load.
const DB = 'gifpaint';
const STORE = 'kv';
const KEY = 'project';
export const LEGACY_KEY = 'gifpaint.project';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('indexedDB blocked'));
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/**
 * Persist the serialized project.
 * @param {object} data output of `serialize()`
 * @returns {Promise<'idb'|'local'|null>} where it landed (null = nowhere, e.g. quota)
 */
export async function saveProject(data) {
  const json = JSON.stringify(data);
  try {
    const db = await openDb();
    await tx(db, 'readwrite', (s) => s.put(json, KEY));
    db.close();
    return 'idb';
  } catch {
    try {
      localStorage.setItem(LEGACY_KEY, json);
      return 'local';
    } catch {
      return null;
    }
  }
}

/** @returns {Promise<object|null>} last autosaved project, IndexedDB then localStorage */
export async function loadSavedProject() {
  let json = null;
  try {
    const db = await openDb();
    json = await tx(db, 'readonly', (s) => s.get(KEY));
    db.close();
  } catch {
    /* fall through to localStorage */
  }
  if (!json) {
    try {
      json = localStorage.getItem(LEGACY_KEY);
    } catch {
      /* no storage at all */
    }
  }
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Forget the autosave in both stores. */
export async function clearSaved() {
  try {
    const db = await openDb();
    await tx(db, 'readwrite', (s) => s.delete(KEY));
    db.close();
  } catch {
    /* nothing to clear */
  }
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* nothing to clear */
  }
}
