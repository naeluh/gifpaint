import './style.css';
import {
  createScene, addItem, removeItem, moveItem, clearScene, undo, redo,
  beginCommit, commit, makeImageItem, makeStrokeItem, hitTest, renderScene,
  serialize, offsetStroke, uid
} from './scene.js';
import { BRUSHES } from './brushes.js';
import { loadGif, loadImage, loadVideo } from './gif.js';
import { createLibrary } from './library.js';
import { exportPNG, exportGIF, exportWebM } from './export.js';

// ── state ────────────────────────────────────────────────────────────────────
const scene = createScene();
const sources = new Map(); // srcId -> loaded source (adds `url`,`thumb`)
const ui = {
  tool: 'paint',
  brush: 'reveal',
  color: '#ff7a4a',
  size: 28,
  srcId: null,
  selectedId: null
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const setStatus = (msg) => (statusEl.textContent = msg);

// ── canvas sizing ────────────────────────────────────────────────────────────
let W = 0;
let H = 0;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  W = Math.round(r.width);
  H = Math.round(r.height);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(resize).observe(document.getElementById('stage'));
resize();

// ── render loop ──────────────────────────────────────────────────────────────
function loop(now) {
  renderScene(scene, ctx, sources, now, W, H, ui.tool === 'select' ? ui.selectedId : null);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ── sources ──────────────────────────────────────────────────────────────────
async function ensureSource(entry) {
  // reuse if this url is already loaded
  for (const [id, s] of sources) if (s.url === entry.url) return id;
  setStatus('loading asset…');
  const id = uid();
  try {
    const load = { gif: loadGif, video: loadVideo }[entry.kind] ?? loadImage;
    const src = await load(entry.url);
    src.url = entry.url;
    src.thumb = entry.thumb ?? entry.url;
    sources.set(id, src);
    setStatus('');
    return id;
  } catch (err) {
    setStatus(String(err.message ?? err));
    return null;
  }
}

// ── library ──────────────────────────────────────────────────────────────────
createLibrary({
  setStatus,
  onPick: async (entry) => {
    if (!entry) {
      ui.srcId = null; // unpicked — color brushes go back to plain color
      return;
    }
    // clear stale source while the new one decodes, so a stroke started
    // mid-load can't paint with the previously picked asset
    ui.srcId = null;
    const seq = (ui.pickSeq = (ui.pickSeq ?? 0) + 1);
    ui.srcLoading = true;
    const id = await ensureSource(entry);
    if (seq !== ui.pickSeq) return; // superseded by a newer pick
    ui.srcLoading = false;
    if (id) {
      ui.srcId = id;
      document.getElementById('hint').hidden = true;
    }
  },
  onStamp: async (entry) => {
    const id = await ensureSource(entry);
    if (!id) return;
    const src = sources.get(id);
    const scale = Math.min(1, (W * 0.5) / src.width);
    ui.selectedId = addItem(scene, makeImageItem(id, W / 2, H / 2, scale)).id;
    setTool('select');
  }
});

// ── tools & brushes UI ───────────────────────────────────────────────────────
const toolsEl = document.getElementById('tools');
function setTool(tool) {
  ui.tool = tool;
  toolsEl.querySelector('.active')?.classList.remove('active');
  toolsEl.querySelector(`[data-tool="${tool}"]`)?.classList.add('active');
  canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
  if (tool !== 'select') selectItem(null);
  refreshLayers();
}
toolsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tool]');
  if (btn) setTool(btn.dataset.tool);
});

const brushesEl = document.getElementById('brushes');
for (const b of BRUSHES) {
  const btn = document.createElement('button');
  btn.textContent = b.label;
  btn.dataset.brush = b.id;
  if (b.id === ui.brush) btn.classList.add('active');
  btn.addEventListener('click', () => {
    ui.brush = b.id;
    brushesEl.querySelector('.active')?.classList.remove('active');
    btn.classList.add('active');
    setTool('paint');
  });
  brushesEl.appendChild(btn);
}

document.getElementById('color').addEventListener('input', (e) => (ui.color = e.target.value));
document.getElementById('size').addEventListener('input', (e) => (ui.size = +e.target.value));

// ── painting / selecting ─────────────────────────────────────────────────────
let activeStroke = null;
let drag = null;
let lastPt = null;

const evPos = (e) => {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = evPos(e);
  if (ui.tool === 'paint') {
    const def = BRUSHES.find((b) => b.id === ui.brush);
    if (def.needsSource && !ui.srcId) {
      setStatus(ui.srcLoading ? 'asset still loading…' : 'pick a gif or image from the library first');
      return;
    }
    beginCommit(scene);
    activeStroke = makeStrokeItem(ui.brush, {
      color: ui.color,
      size: ui.size,
      srcId: def.needsSource || def.canSource ? ui.srcId : null
    });
    activeStroke.points.push({ x: p.x, y: p.y, v: 0, t: e.timeStamp });
    scene.items.push(activeStroke);
  } else if (ui.tool === 'select') {
    const hit = hitTest(scene, sources, p.x, p.y);
    selectItem(hit?.id ?? null);
    if (hit) {
      beginCommit(scene);
      drag = { id: hit.id, moved: false };
      lastPt = p;
    }
  } else if (ui.tool === 'stamp') {
    if (!ui.srcId) {
      setStatus(ui.srcLoading ? 'asset still loading…' : 'pick an asset first');
      return;
    }
    const src = sources.get(ui.srcId);
    const scale = Math.min(1, (W * 0.4) / src.width);
    addItem(scene, makeImageItem(ui.srcId, p.x, p.y, scale));
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = evPos(e);
  if (activeStroke) {
    const prev = activeStroke.points[activeStroke.points.length - 1];
    const dt = Math.max(e.timeStamp - prev.t, 1);
    const v = Math.min(Math.hypot(p.x - prev.x, p.y - prev.y) / dt, 3);
    if (Math.hypot(p.x - prev.x, p.y - prev.y) > 2)
      activeStroke.points.push({ x: p.x, y: p.y, v, t: e.timeStamp });
  } else if (drag) {
    const it = scene.items.find((i) => i.id === drag.id);
    if (it) {
      const dx = p.x - lastPt.x;
      const dy = p.y - lastPt.y;
      if (it.type === 'image') {
        it.x += dx;
        it.y += dy;
      } else {
        offsetStroke(it, dx, dy);
      }
      drag.moved = true;
    }
    lastPt = p;
  }
});

function endPointer() {
  if (activeStroke) {
    for (const pt of activeStroke.points) delete pt.t;
    commit(scene);
    activeStroke = null;
  } else if (drag) {
    if (drag.moved) commit(scene);
    else scene._pending = null;
    drag = null;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

// ── selection props ──────────────────────────────────────────────────────────
const props = document.getElementById('props');
const pScale = document.getElementById('p-scale');
const pRot = document.getElementById('p-rot');
const pOp = document.getElementById('p-op');

function selectItem(id) {
  ui.selectedId = id;
  const it = scene.items.find((i) => i.id === id);
  props.hidden = !it;
  if (it) {
    pScale.value = it.scale ?? 1;
    pScale.parentElement.style.display = it.type === 'image' ? '' : 'none';
    pRot.value = ((it.rotation ?? 0) * 180) / Math.PI;
    pRot.parentElement.style.display = it.type === 'image' ? '' : 'none';
    pOp.value = it.opacity;
  }
  refreshLayers();
}

let propsPending = false;
function propEdit(fn) {
  const it = scene.items.find((i) => i.id === ui.selectedId);
  if (!it) return;
  if (!propsPending) {
    beginCommit(scene);
    propsPending = true;
  }
  fn(it);
}
const propCommit = () => {
  if (propsPending) {
    commit(scene);
    propsPending = false;
  }
};
pScale.addEventListener('input', () => propEdit((it) => (it.scale = +pScale.value)));
pRot.addEventListener('input', () => propEdit((it) => (it.rotation = (+pRot.value * Math.PI) / 180)));
pOp.addEventListener('input', () => propEdit((it) => (it.opacity = +pOp.value)));
for (const el of [pScale, pRot, pOp]) el.addEventListener('change', propCommit);
document.getElementById('p-delete').addEventListener('click', () => {
  if (ui.selectedId) {
    removeItem(scene, ui.selectedId);
    selectItem(null);
  }
});

// ── layers panel ─────────────────────────────────────────────────────────────
const layerList = document.getElementById('layer-list');
function refreshLayers() {
  layerList.innerHTML = '';
  for (const it of scene.items) {
    const row = document.createElement('div');
    row.className = 'layer' + (it.id === ui.selectedId ? ' selected' : '');
    if (it.srcId && sources.get(it.srcId)) {
      const img = document.createElement('img');
      img.src = sources.get(it.srcId).thumb;
      row.appendChild(img);
    } else {
      const sw = document.createElement('div');
      sw.className = 'swatch';
      sw.style.background = it.color ?? '#000';
      row.appendChild(sw);
    }
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = it.type === 'image' ? 'image' : it.brush;
    row.appendChild(name);
    for (const [txt, fn] of [
      ['▲', () => moveItem(scene, it.id, +1)],
      ['▼', () => moveItem(scene, it.id, -1)],
      ['✕', () => { removeItem(scene, it.id); if (ui.selectedId === it.id) selectItem(null); }]
    ]) {
      const b = document.createElement('button');
      b.textContent = txt;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        fn();
      });
      row.appendChild(b);
    }
    row.addEventListener('click', () => {
      setTool('select');
      selectItem(it.id);
    });
    layerList.appendChild(row);
  }
}
scene.onChange = () => {
  if (scene.items.length) document.getElementById('hint').hidden = true;
  refreshLayers();
  scheduleAutosave();
};

// ── top bar actions ──────────────────────────────────────────────────────────
document.getElementById('undo').addEventListener('click', () => undo(scene));
document.getElementById('redo').addEventListener('click', () => redo(scene));
document.getElementById('clear').addEventListener('click', () => {
  clearScene(scene);
  selectItem(null);
});

const durationEl = document.getElementById('duration');
document.getElementById('save-png').addEventListener('click', () => exportPNG(canvas));
document.getElementById('save-gif').addEventListener('click', () =>
  exportGIF(scene, sources, W, H, +durationEl.value || 2, setStatus)
);
document.getElementById('save-webm').addEventListener('click', () =>
  exportWebM(canvas, +durationEl.value || 2, setStatus)
);

// ── project save/load + autosave ─────────────────────────────────────────────
const AUTOSAVE_KEY = 'gifpaint.project';

document.getElementById('save-project').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(serialize(scene, sources))], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gifpaint-project.json';
  a.click();
});

const projectFile = document.getElementById('project-file');
document.getElementById('load-project').addEventListener('click', () => projectFile.click());
projectFile.addEventListener('change', async () => {
  const file = projectFile.files[0];
  if (file) loadProject(JSON.parse(await file.text()));
  projectFile.value = '';
});

async function loadProject(data) {
  setStatus('loading project…');
  sources.clear();
  for (const s of data.sources ?? []) {
    try {
      const load = { gif: loadGif, video: loadVideo }[s.kind] ?? loadImage;
      const src = await load(s.url);
      src.url = s.url;
      src.thumb = s.thumb ?? s.url;
      sources.set(s.id, src);
    } catch {
      /* dead url — its items just won't draw */
    }
  }
  scene.items = data.items ?? [];
  scene.background = data.background ?? scene.background;
  scene.past.length = 0;
  scene.future.length = 0;
  selectItem(null);
  scene.onChange();
  setStatus('');
}

let autosaveTimer = null;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serialize(scene, sources)));
    } catch {
      /* quota (big uploads) — file save still works */
    }
  }, 800);
}

const saved = localStorage.getItem(AUTOSAVE_KEY);
if (saved) {
  try {
    const data = JSON.parse(saved);
    if (data.items?.length) loadProject(data);
  } catch { /* ignore corrupt autosave */ }
}

// ── keyboard ─────────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? redo(scene) : undo(scene);
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selectedId) {
    removeItem(scene, ui.selectedId);
    selectItem(null);
  } else if (e.key === 'b') setTool('paint');
  else if (e.key === 'v') setTool('select');
  else if (e.key === 's') setTool('stamp');
});

// ── dev self-test: /?selftest paints every brush with a live gif ─────────────
if (import.meta.env.DEV && location.search.includes('selftest')) {
  (async () => {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
      scene.items = [];
      const api = await fetch(
        'https://api.giphy.com/v1/gifs/trending?api_key=pCjkqdZQCp6TVtFBI1hJia1LyQWy1LlE&limit=1'
      ).then((r) => r.json());
      const gifUrl = api.data[0].images.fixed_height.url;
      const srcId = await ensureSource({ kind: 'gif', url: gifUrl });
      if (!srcId) throw new Error('source load failed');
      const wave = (x) => 120 + Math.sin(x / 40) * 60;
      let y = 0;
      for (const b of BRUSHES) {
        if (b.id === 'eraser') continue;
        y += 90;
        const st = makeStrokeItem(b.id, {
          color: `hsl(${y} 90% 60%)`,
          size: 24,
          srcId: b.needsSource || b.canSource ? srcId : null
        });
        for (let x = 40; x < W - 40; x += 8)
          st.points.push({ x, y: y + wave(x) - 120, v: 0.15 + Math.abs(Math.sin(x / 90)) * 1.6 });
        scene.items.push(st);
      }
      scene.items.push(makeImageItem(srcId, W - 140, 100, 0.6));
      scene.onChange();
      // confirm pixels actually landed
      setTimeout(() => {
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let lit = 0;
        for (let i = 0; i < d.length; i += 400) if (d[i] > 40 || d[i + 1] > 40) lit++;
        document.title = lit > 50 ? 'SELFTEST-PASS' : 'SELFTEST-FAIL';
      }, 1500);
    } catch (err) {
      document.title = 'SELFTEST-FAIL ' + err.message;
    }
  })();
}
