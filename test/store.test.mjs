// run: node test/store.test.mjs — autosave store fallback path (node has no indexedDB)
import assert from 'node:assert/strict';
import { saveProject, loadSavedProject, clearSaved, LEGACY_KEY } from '../src/store.js';

const mem = new Map();
const fakeLocal = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k)
};
Object.defineProperty(globalThis, 'localStorage', { value: fakeLocal, configurable: true });
assert.equal(typeof globalThis.indexedDB, 'undefined', 'test assumes node without indexedDB');

const project = { v: 1, items: [{ id: 'a', type: 'stroke', brush: 'drip', ops: [{ t: 'blob', x: 1, y: 2, r: 3, ph: [0, 0, 0] }] }], sources: [] };
assert.equal(await saveProject(project), 'local', 'falls back to localStorage');
assert.ok(mem.has(LEGACY_KEY), 'written under the legacy key (old autosaves stay readable)');
assert.deepEqual(await loadSavedProject(), project, 'round-trips');

await clearSaved();
assert.equal(await loadSavedProject(), null, 'cleared');

// a legacy autosave written by the old code is still picked up
mem.set(LEGACY_KEY, JSON.stringify({ v: 1, items: [{ id: 'old' }] }));
assert.equal((await loadSavedProject()).items[0].id, 'old', 'legacy localStorage autosave migrates by read');

// storage that throws (quota / private mode) never throws into the caller
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem() { throw new Error('nope'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('nope'); } },
  configurable: true
});
assert.equal(await saveProject(project), null, 'save resolves null instead of throwing');
assert.equal(await loadSavedProject(), null, 'load resolves null instead of throwing');
await assert.doesNotReject(clearSaved());

console.log('store.test: all assertions passed');
