// run: node test/scene.test.mjs — scene model + undo/redo + hit test
import assert from 'node:assert/strict';
import {
  createScene, addItem, removeItem, moveItem, clearScene, undo, redo,
  makeImageItem, makeStrokeItem, hitTest, serialize, beginCommit, commit
} from '../src/scene.js';

const scene = createScene();
const sources = new Map([['s1', { width: 100, height: 80 }]]);

// add / undo / redo
const img = addItem(scene, makeImageItem('s1', 50, 50, 1));
assert.equal(scene.items.length, 1);
undo(scene);
assert.equal(scene.items.length, 0, 'undo removes add');
redo(scene);
assert.equal(scene.items.length, 1, 'redo restores add');

// stroke + hit test
const stroke = makeStrokeItem('ink', { color: '#fff', size: 10 });
stroke.points.push({ x: 200, y: 200, v: 0 });
addItem(scene, stroke);
assert.equal(hitTest(scene, sources, 202, 202)?.id, stroke.id, 'hit stroke');
assert.equal(hitTest(scene, sources, 50, 50)?.id, img.id, 'hit image');
assert.equal(hitTest(scene, sources, 500, 500), null, 'miss');

// image hit respects rotation: corner point inside AABB but outside rotated rect
const liveImg = scene.items.find((i) => i.id === img.id);
liveImg.rotation = Math.PI / 4;
assert.equal(hitTest(scene, sources, 99, 11), null, 'rotated corner miss');
liveImg.rotation = 0;

// reorder
moveItem(scene, img.id, +1);
assert.equal(scene.items[1].id, img.id, 'moved up');
undo(scene);
assert.equal(scene.items[0].id, img.id, 'undo reorder');

// remove + undo
removeItem(scene, stroke.id);
assert.equal(scene.items.length, 1);
undo(scene);
assert.equal(scene.items.length, 2, 'undo remove');

// begin/commit pairing (drag pattern)
beginCommit(scene);
scene.items[0].x = 999;
commit(scene);
undo(scene);
assert.equal(scene.items[0].x, 50, 'undo drag restores position');

// clear + serialize
clearScene(scene);
assert.equal(scene.items.length, 0);
undo(scene);
assert.ok(scene.items.length > 0, 'undo clear');
const data = serialize(scene, new Map([['s1', { kind: 'img', url: 'u', thumb: 't' }]]));
assert.equal(data.sources[0].url, 'u');
assert.ok(Array.isArray(data.items));

// history cap
for (let i = 0; i < 60; i++) addItem(scene, makeImageItem('s1', i, i));
assert.ok(scene.past.length <= 50, 'history capped');

console.log('scene.test: all assertions passed');
