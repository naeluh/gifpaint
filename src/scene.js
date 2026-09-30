// Scene model: sources registry + ordered items + undo/redo. DOM-free so it
// can be tested in node. Rendering receives a ctx + source lookup.
import { renderStroke, drawSourceCentered } from './brushes.js';

let nextId = 1;
export const uid = () => `i${nextId++}_${Date.now().toString(36)}`;

export function createScene() {
  const scene = {
    items: [], // bottom -> top draw order
    background: '#111213',
    past: [],
    future: [],
    dirty: true,
    onChange: null // set by UI, called after any committed mutation
  };
  return scene;
}

const snap = (scene) => structuredClone(scene.items);
// ponytail: full-array snapshots, capped at 50 — diff-based ops if scenes get huge

export function commit(scene) {
  scene.past.push(scene._pending ?? snap(scene));
  scene._pending = null;
  if (scene.past.length > 50) scene.past.shift();
  scene.future.length = 0;
  changed(scene);
}

// call BEFORE mutating, so commit() stores the pre-mutation state
export function beginCommit(scene) {
  scene._pending = snap(scene);
}

export function undo(scene) {
  if (!scene.past.length) return;
  scene.future.push(snap(scene));
  scene.items = scene.past.pop();
  changed(scene);
}

export function redo(scene) {
  if (!scene.future.length) return;
  scene.past.push(snap(scene));
  scene.items = scene.future.pop();
  changed(scene);
}

function changed(scene) {
  scene.dirty = true;
  scene.onChange?.();
}

export function addItem(scene, item) {
  beginCommit(scene);
  scene.items.push(item);
  commit(scene);
  return item;
}

export function removeItem(scene, id) {
  const i = scene.items.findIndex((it) => it.id === id);
  if (i === -1) return;
  beginCommit(scene);
  scene.items.splice(i, 1);
  commit(scene);
}

export function moveItem(scene, id, dir) {
  const i = scene.items.findIndex((it) => it.id === id);
  const j = i + dir;
  if (i === -1 || j < 0 || j >= scene.items.length) return;
  beginCommit(scene);
  const [it] = scene.items.splice(i, 1);
  scene.items.splice(j, 0, it);
  commit(scene);
}

export function clearScene(scene) {
  if (!scene.items.length) return;
  beginCommit(scene);
  scene.items = [];
  commit(scene);
}

export function makeImageItem(srcId, x, y, scale = 1) {
  return { id: uid(), type: 'image', srcId, x, y, scale, rotation: 0, opacity: 1 };
}

/**
 * @param {string} brush brush id
 * @param {{color:string,size:number,srcId?:string|null,drip?:object}} opts
 *   `drip` = physics params → the item also carries `ops` (recorded deposits, see drip.js)
 */
export function makeStrokeItem(brush, opts) {
  return {
    id: uid(),
    type: 'stroke',
    brush,
    color: opts.color,
    size: opts.size,
    srcId: opts.srcId ?? null,
    opacity: 1,
    seed: Math.floor(Math.random() * 1e9),
    points: [],
    ...(opts.drip ? { drip: { ...opts.drip }, ops: [] } : {})
  };
}

/** Canvas point → image item's local (unrotated, unscaled) coords. */
function toLocal(it, x, y) {
  const cos = Math.cos(-it.rotation);
  const sin = Math.sin(-it.rotation);
  const dx = x - it.x;
  const dy = y - it.y;
  return { lx: (dx * cos - dy * sin) / it.scale, ly: (dx * sin + dy * cos) / it.scale };
}

export const HANDLE_PX = 8; // resize handle square, CSS px (unscaled)

/**
 * True when (x,y) is on one of the 4 corner resize handles of an image item.
 * @param {object} it image item
 * @param {{width:number,height:number}} src loaded source
 * @param {number} x canvas px
 * @param {number} y canvas px
 */
export function handleAt(it, src, x, y) {
  const { lx, ly } = toLocal(it, x, y);
  const tol = HANDLE_PX / it.scale;
  return Math.abs(Math.abs(lx) - src.width / 2) <= tol && Math.abs(Math.abs(ly) - src.height / 2) <= tol;
}

// hit test: topmost item under point. Strokes tested by distance to points.
export function hitTest(scene, sources, x, y) {
  for (let i = scene.items.length - 1; i >= 0; i--) {
    const it = scene.items[i];
    if (it.type === 'image') {
      const src = sources.get(it.srcId);
      if (!src) continue;
      const { lx, ly } = toLocal(it, x, y);
      if (Math.abs(lx) <= src.width / 2 && Math.abs(ly) <= src.height / 2) return it;
    } else {
      const r = Math.max(it.size, 12);
      if (it.points.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 <= r * r)) return it;
    }
  }
  return null;
}

export function renderScene(scene, ctx, sources, now, w, h, selectedId = null) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = scene.background;
  ctx.fillRect(0, 0, w, h);
  for (const it of scene.items) {
    ctx.save();
    ctx.globalAlpha = it.opacity;
    if (it.type === 'image') {
      const src = sources.get(it.srcId);
      if (src) {
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rotation);
        ctx.scale(it.scale, it.scale);
        drawSourceCentered(ctx, src, now);
      }
    } else {
      renderStroke(ctx, it, now, sources, w, h);
    }
    ctx.restore();
  }
  if (selectedId) drawSelection(scene, ctx, sources, selectedId);
}

function drawSelection(scene, ctx, sources, id) {
  const it = scene.items.find((i) => i.id === id);
  if (!it) return;
  ctx.save();
  ctx.strokeStyle = '#ff7a4a'; /* selection acts — ember */
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  if (it.type === 'image') {
    const src = sources.get(it.srcId);
    if (src) {
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rotation);
      const w = src.width * it.scale;
      const h = src.height * it.scale;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      // corner resize handles (fillRect — no dash inheritance)
      ctx.fillStyle = '#ff7a4a';
      const hp = HANDLE_PX;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
        ctx.fillRect((sx * w) / 2 - hp / 2, (sy * h) / 2 - hp / 2, hp, hp);
    }
  } else if (it.points.length) {
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const p of it.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = it.size;
    ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
  }
  ctx.restore();
}

// ── project (de)serialization ────────────────────────────────────────────────
export function serialize(scene, sources) {
  return {
    v: 1,
    background: scene.background,
    items: scene.items,
    sources: [...sources.entries()].map(([id, s]) => ({
      id,
      kind: s.kind,
      url: s.url,
      thumb: s.thumb
    }))
  };
}

export function offsetStroke(item, dx, dy) {
  for (const p of item.points) {
    p.x += dx;
    p.y += dy;
  }
  for (const op of item.ops ?? []) {
    if (op.t === 'seg') {
      op.x0 += dx; op.y0 += dy; op.x1 += dx; op.y1 += dy;
    } else {
      op.x += dx; op.y += dy; // blob / splat: children are relative to (x,y)
    }
  }
}
