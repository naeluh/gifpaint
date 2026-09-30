import './style.css';
import {
  createScene, addItem, removeItem, moveItem, clearScene, undo, redo,
  beginCommit, commit, makeImageItem, makeStrokeItem, hitTest, handleAt, renderScene,
  serialize, offsetStroke, uid
} from './scene.js';
import { BRUSHES } from './brushes.js';
import { loadGif, loadImage, loadVideo } from './gif.js';
import { createLibrary } from './library.js';
import { exportPNG, exportGIF, exportWebM } from './export.js';
import { createDripSim, DRIP_DEFAULTS, DT, WIDTH_M, TOOLS, landingSpeed, scrapeSweep, sliderToMu, muToSlider } from './drip.js';
import { saveProject, loadSavedProject, clearSaved } from './store.js';
import {
  currentUser, signIn, signUp, signInSocial, signOut, uploadDataSources, saveCloud, loadCloud,
  setVisibility, deleteCloud, listMine, listGallery, shareUrl, projectIdFromUrl
} from './cloud.js';

// ── state ────────────────────────────────────────────────────────────────────
const scene = createScene();
const sources = new Map(); // srcId -> loaded source (adds `url`,`thumb`)
const ui = {
  tool: 'paint',
  brush: 'reveal',
  color: '#ff7a4a',
  size: 28,
  srcId: null,
  selectedId: null,
  drip: { ...DRIP_DEFAULTS } // physics params copied into each new drip stroke
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
const PHYS = new Set(['drip', 'spatter']); // brushes driven by the pour simulator
let dripSim = null; // live pour for the drip stroke in progress (or still draining)
let dripAcc = 0;
let lastNow = 0;
function loop(now) {
  const dt = Math.min((now - lastNow) / 1000 || 0, 0.25); // a backgrounded tab must not replay seconds of physics
  lastNow = now;
  if (dripSim) {
    dripAcc = Math.min(dripAcc + dt, 0.25);
    while (dripAcc >= DT) {
      dripSim.step(DT);
      dripAcc -= DT;
    }
    dripSim.spread(dt); // thin-film creep is slow — once per frame is plenty
  }
  renderScene(scene, ctx, sources, now, W, H, ui.tool === 'select' ? ui.selectedId : null);
  if (dripSim) {
    dripSim.overlay(ctx);
    if (dripSim.idle()) {
      dripSim = null;
      scene.onChange(); // pools settled — autosave the final geometry
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/** Native size (scale 1) unless the source is bigger than the canvas — then fit it. */
const fitScale = (src) => Math.min(1, (W - 32) / src.width, (H - 32) / src.height);

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
    ui.selectedId = addItem(scene, makeImageItem(id, W / 2, H / 2, fitScale(src))).id;
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
  refreshDripPanel();
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
const bgInput = document.getElementById('bg');
bgInput.addEventListener('input', (e) => {
  scene.background = e.target.value; // unprimed cotton duck is #c9b48a
  scheduleAutosave();
});

// ── drip physics panel ───────────────────────────────────────────────────────
const dripPanel = document.getElementById('drip-params');
const dripV = document.getElementById('drip-v');
// slider value ↔ physical param ↔ readout, one row per DRIP_DEFAULTS key
const DRIP_SLIDERS = {
  mu: { el: 'd-mu', read: (v) => sliderToMu(+v), write: muToSlider, fmt: (x) => (x < 1 ? x.toFixed(2) : x < 10 ? x.toFixed(1) : x.toFixed(0)) + ' Pa·s' },
  H: { el: 'd-h', read: (v) => v / 100, write: (x) => Math.round(x * 100), fmt: (x) => Math.round(x * 100) + ' cm' },
  a0: { el: 'd-a', read: (v) => v / 10000, write: (x) => Math.round(x * 10000), fmt: (x) => (x * 1000).toFixed(1) + ' mm' },
  gMul: { el: 'd-g', read: Number, write: (x) => x, fmt: (x) => x.toFixed(1) + '× g' },
  v0: { el: 'd-v0', read: Number, write: (x) => x, fmt: (x) => x.toFixed(2) + ' m/s' },
  theta: { el: 'd-th', read: Number, write: (x) => x, fmt: (x) => x + '°' }
};
const showDripV = () => (dripV.textContent = landingSpeed(ui.drip).toFixed(2) + ' m/s');
const dripSliderSync = []; // push slider ← ui.drip for every row
for (const [key, sl] of Object.entries(DRIP_SLIDERS)) {
  const input = document.getElementById(sl.el);
  const out = input.parentElement.querySelector('output');
  const show = () => {
    input.value = sl.write(ui.drip[key]);
    out.textContent = sl.fmt(ui.drip[key]);
    showDripV();
  };
  input.addEventListener('input', () => {
    ui.drip[key] = sl.read(input.value);
    out.textContent = sl.fmt(ui.drip[key]);
    showDripV();
  });
  dripSliderSync.push(show);
  show();
}
// tool presets: stick / brush / baster / can seed a0, v0, mu (sliders stay adjustable)
const dripTools = document.getElementById('drip-tools');
dripTools.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tool]');
  if (!btn) return;
  const t = TOOLS[btn.dataset.tool];
  ui.drip.tool = btn.dataset.tool;
  Object.assign(ui.drip, { a0: t.a0, v0: t.v0, mu: t.mu });
  dripTools.querySelector('.active')?.classList.remove('active');
  btn.classList.add('active');
  for (const sync of dripSliderSync) sync();
});
function refreshDripPanel() {
  dripPanel.hidden = !(ui.tool === 'paint' && PHYS.has(ui.brush));
  dripTools.hidden = ui.brush !== 'drip'; // spatter always taps a brush; tools are for pouring
}
refreshDripPanel();

/** Topmost other layer's wet pool under a canvas point (for wet-on-wet marbling). */
function paintUnder(px, py, self) {
  for (let i = scene.items.length - 1; i >= 0; i--) {
    const it = scene.items[i];
    if (it === self || !it.ops?.length) continue;
    for (let j = it.ops.length - 1; j >= 0; j--) {
      const op = it.ops[j];
      if (op.t === 'blob' && Math.hypot(px - op.x, py - op.y) <= op.r) return { color: it.color, mu: it.drip?.mu ?? 1.5 };
    }
  }
  return null;
}

// ── painting / selecting ─────────────────────────────────────────────────────
let activeStroke = null;
let drag = null;
let lastPt = null;
let scrapePrev = null; // last pointer position while dragging a scrape tool

const evPos = (e) => {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

canvas.addEventListener('pointerdown', (e) => {
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    /* synthetic events (selftest) have no active pointer */
  }
  const p = evPos(e);
  if (ui.tool === 'paint') {
    const def = BRUSHES.find((b) => b.id === ui.brush);
    if (def.needsSource && !ui.srcId) {
      setStatus(ui.srcLoading ? 'asset still loading…' : 'pick a gif or image from the library first');
      return;
    }
    const isPhys = PHYS.has(ui.brush);
    const isScrape = ui.brush === 'scrape';
    if (isPhys || isScrape) dripSim?.flush(); // finish the previous pour BEFORE the undo snapshot
    beginCommit(scene);
    activeStroke = makeStrokeItem(ui.brush, {
      color: ui.color,
      size: ui.size,
      srcId: def.needsSource || def.canSource ? ui.srcId : null,
      drip: isPhys || isScrape ? ui.drip : undefined
    });
    activeStroke.points.push({ x: p.x, y: p.y, v: 0, t: e.timeStamp });
    scene.items.push(activeStroke);
    if (isPhys) {
      dripSim = createDripSim(activeStroke, W / WIDTH_M, { under: (x, y) => paintUnder(x, y, activeStroke) });
      dripSim.placeHand(p.x, p.y, e.timeStamp);
      dripSim.setPouring(true);
    }
    scrapePrev = p;
  } else if (ui.tool === 'select') {
    const sel = selectedImage();
    if (sel && handleAt(sel, sources.get(sel.srcId), p.x, p.y)) {
      // corner handle → uniform scale drag (aspect locked)
      beginCommit(scene);
      drag = {
        id: sel.id,
        mode: 'scale',
        moved: false,
        startScale: sel.scale,
        startDist: Math.hypot(p.x - sel.x, p.y - sel.y) || 1
      };
      lastPt = p;
      return;
    }
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
    addItem(scene, makeImageItem(ui.srcId, p.x, p.y, fitScale(src)));
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = evPos(e);
  if (activeStroke) {
    if (PHYS.has(activeStroke.brush)) dripSim?.setTarget(p.x, p.y, e.timeStamp);
    else if (activeStroke.brush === 'scrape') {
      scrapeSweep(scene.items, activeStroke, scrapePrev.x, scrapePrev.y, p.x, p.y, ui.size);
      scrapePrev = p;
    }
    const prev = activeStroke.points[activeStroke.points.length - 1];
    const dt = Math.max(e.timeStamp - prev.t, 1);
    const v = Math.min(Math.hypot(p.x - prev.x, p.y - prev.y) / dt, 3);
    if (Math.hypot(p.x - prev.x, p.y - prev.y) > 2)
      activeStroke.points.push({ x: p.x, y: p.y, v, t: e.timeStamp });
  } else if (drag) {
    const it = scene.items.find((i) => i.id === drag.id);
    if (it && drag.mode === 'scale') {
      const k = Math.hypot(p.x - it.x, p.y - it.y) / drag.startDist;
      it.scale = Math.min(8, Math.max(0.05, drag.startScale * k));
      pScale.value = it.scale;
      drag.moved = true;
    } else if (it) {
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
  } else if (ui.tool === 'select') {
    const sel = selectedImage();
    canvas.style.cursor =
      sel && handleAt(sel, sources.get(sel.srcId), p.x, p.y) ? 'nwse-resize' : 'default';
  }
});

/** Selected item when it is an image with a loaded source, else null. */
function selectedImage() {
  const it = scene.items.find((i) => i.id === ui.selectedId);
  return it?.type === 'image' && sources.get(it.srcId) ? it : null;
}

function endPointer(e) {
  if (activeStroke) {
    if (PHYS.has(activeStroke.brush) && dripSim) {
      dripSim.setPouring(false); // thread keeps falling, pools keep creeping
      dripSim.release(e?.timeStamp ?? performance.now()); // flick = throw, tap = dump splash
    }
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
document.getElementById('save-webm').addEventListener('click', () => {
  selectItem(null); // handles/dashes would be recorded off the live canvas
  exportWebM(canvas, +durationEl.value || 2, setStatus);
});

// ── project save/load + autosave ─────────────────────────────────────────────

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
  if (file) {
    await loadProject(JSON.parse(await file.text()));
    setCloud(null); // a file is not the cloud project the URL named
  }
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
  bgInput.value = scene.background;
  scene.past.length = 0;
  scene.future.length = 0;
  selectItem(null);
  scene.onChange();
  setStatus('');
}

let autosaveTimer = null;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  // IndexedDB (localStorage fallback) — never throws, see store.js
  autosaveTimer = setTimeout(() => saveProject(serialize(scene, sources)), 800);
}

// ── cloud: account, cloud save, share links, gallery (src/cloud.js) ───────────
// Interaction grammar from Kuzic + oss-design-prototype: sheets not prompt/confirm,
// copy confirms in place, per-card menus, destructive last, optimistic delete.
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
const accountBtn = $('account');
const authDialog = $('auth-dialog');
const saveDialog = $('save-dialog');
const shareDialog = $('share-dialog');
const confirmDialog = $('confirm-dialog');
const browseDialog = $('browse-dialog');
const accountMenu = $('account-menu');
const cardMenu = $('card-menu');

/** Cloud identity of the open project; id null = only local. */
const cloud = { id: null, isOwner: false, visibility: 'private', title: '' };
/** @type {import('./cloud.js').User | null} */
let user = null;

function setCloud(p) {
  cloud.id = p?.id ?? null;
  cloud.isOwner = !!p?.isOwner;
  cloud.visibility = p?.visibility ?? 'private';
  cloud.title = p?.title ?? '';
  const url = new URL(location.href);
  cloud.id ? url.searchParams.set('p', cloud.id) : url.searchParams.delete('p');
  history.replaceState(null, '', url);
}

function setUser(u) {
  user = u;
  accountBtn.classList.toggle('avatar', !!u);
  accountBtn.textContent = u ? (u.name || u.email).trim().charAt(0).toUpperCase() : 'sign in';
  accountBtn.title = u ? u.email : 'sign in to save and share';
  accountBtn.setAttribute('aria-label', u ? `account, ${u.email}` : 'sign in');
  $('account-email').textContent = u?.email ?? '';
  if (!u) cloud.isOwner = false;
}

// ── sheet chrome: open with focus only on fine pointers, X / backdrop close ──
/**
 * @param {HTMLDialogElement} dialog
 * @param {HTMLElement} [focusEl] focused (and selected) on fine pointers; else the sheet itself
 */
function openSheet(dialog, focusEl) {
  if (!dialog.open) dialog.showModal();
  const target = focusEl && matchMedia('(pointer: fine)').matches ? focusEl : dialog.querySelector('.sheet-inner');
  target.focus();
  if (target === focusEl) focusEl.select?.();
}
for (const dialog of document.querySelectorAll('dialog.sheet')) {
  dialog.querySelector('.sheet-inner').tabIndex = -1;
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-close]')) dialog.close('cancel');
  });
}
/** Resolve with the dialog's returnValue once it closes. @param {HTMLDialogElement} dialog */
const whenClosed = (dialog) =>
  new Promise((resolve) => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));

/**
 * Promise confirm. Cancel left, commit right; destructive commits are red.
 * @param {{title: string, body?: string, action: string, destructive?: boolean}} opts
 * @returns {Promise<boolean>}
 */
async function confirmSheet({ title, body = '', action, destructive = true }) {
  if (confirmDialog.open) confirmDialog.close('cancel'); // a second ask answers the first "no"
  confirmDialog.returnValue = '';
  $('confirm-title').textContent = title;
  $('confirm-body').textContent = body;
  $('confirm-body').hidden = !body;
  const ok = $('confirm-ok');
  ok.textContent = action;
  ok.classList.toggle('danger', destructive);
  ok.classList.toggle('active', !destructive);
  openSheet(confirmDialog);
  return (await whenClosed(confirmDialog)) === 'ok';
}

/** Name sheet (replaces prompt). @param {string} initial @returns {Promise<string|null>} */
async function askName(initial) {
  saveDialog.returnValue = '';
  const input = $('save-name');
  input.value = initial;
  openSheet(saveDialog, input);
  return (await whenClosed(saveDialog)) === 'ok' ? input.value.trim() || initial : null;
}

// ── account: sign-in sheet + avatar menu ──
const authWaiters = [];
let signingUp = true; // new visitors are the common case (Kuzic: sheet opens on sign-up)
let authContext = '';
function setAuthMode(up) {
  signingUp = up;
  $('auth-name-field').hidden = !up;
  $('auth-title').textContent = authContext || (up ? 'join gifpaint' : 'welcome back');
  $('auth-switch-hint').textContent = up ? 'have an account?' : 'new here?';
  $('auth-mode').textContent = up ? 'sign in' : 'create an account';
  $('auth-password').autocomplete = up ? 'new-password' : 'current-password';
  showAuthError('');
}
function showAuthError(message) {
  const box = $('auth-error');
  box.hidden = !message;
  box.textContent = message;
  box.classList.remove('shake');
  if (message) {
    void box.offsetWidth; // restart the shake for every new error
    box.classList.add('shake');
  }
}
/** Friendlier words for Better Auth's messages. @param {Error} err */
function authMessage(err) {
  const m = err.message ?? '';
  if (/provider not found/i.test(m)) return "that sign-in isn't set up yet. use email for now";
  if (/invalid email or password/i.test(m)) return "email or password doesn't match. try again or create an account";
  if (/already exists/i.test(m)) return 'that email already has an account. sign in instead';
  if (/password (is )?too short/i.test(m)) return 'use at least 8 characters for the password';
  if (/fetch|network|unavailable/i.test(m)) return "couldn't reach the server. check your connection and try again";
  return m || 'something went wrong. try again';
}
/**
 * Signed-in user, opening the sign-in sheet if needed.
 * @param {string} [context] sheet title, e.g. "sign in to save"
 * @returns {Promise<import('./cloud.js').User|null>}
 */
function requireUser(context = '') {
  if (user) return Promise.resolve(user);
  return new Promise((resolve) => {
    authWaiters.push(resolve);
    authContext = context;
    setAuthMode(signingUp);
    openSheet(authDialog, signingUp ? $('auth-name') : $('auth-email'));
  });
}
authDialog.addEventListener('close', () => {
  for (const resolve of authWaiters.splice(0)) resolve(user);
});
$('auth-mode').addEventListener('click', () => {
  setAuthMode(!signingUp);
  if (matchMedia('(pointer: fine)').matches) (signingUp ? $('auth-name') : $('auth-email')).focus();
});
$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  if (!email || !password) return showAuthError('enter your email and a password');
  if (signingUp && password.length < 8) return showAuthError('use at least 8 characters for the password');
  const btn = $('auth-submit');
  btn.disabled = true;
  btn.textContent = 'one moment…';
  showAuthError('');
  try {
    if (signingUp) await signUp($('auth-name').value.trim() || email.split('@')[0], email, password);
    else await signIn(email, password);
    setUser(await currentUser());
    authDialog.close();
  } catch (err) {
    showAuthError(authMessage(err));
  } finally {
    btn.disabled = false;
    btn.textContent = 'continue';
  }
});
for (const b of authDialog.querySelectorAll('[data-provider]')) {
  // redirects away and back; the 800 ms autosave keeps the canvas
  b.addEventListener('click', () => signInSocial(b.dataset.provider).catch((err) => showAuthError(authMessage(err))));
}

/** Pin a popover menu under its trigger, right-aligned. @param {HTMLElement} menu @param {HTMLElement} anchor */
function openMenu(menu, anchor) {
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${r.bottom + 6}px`;
  menu.style.right = `${Math.max(8, innerWidth - r.right)}px`;
  menu.showPopover();
}
accountBtn.addEventListener('click', () => {
  if (!user) return requireUser();
  accountMenu.matches(':popover-open') ? accountMenu.hidePopover() : openMenu(accountMenu, accountBtn);
});
$('account-signout').addEventListener('click', async () => {
  accountMenu.hidePopover();
  await signOut().catch(() => {});
  setUser(null);
  setStatus('signed out');
});

// ── cloud save + share ──
let cloudBusy = false;
/**
 * Save the canvas to the signed-in account: upload data-URL assets to B2,
 * then create (first save, or someone else's project = your copy) or update.
 * @param {'private'|'unlisted'|'public'} [visibility]
 */
async function cloudSave(visibility) {
  if (cloudBusy || !(await requireUser('sign in to save'))) return null;
  const creating = !(cloud.id && cloud.isOwner);
  const title = creating ? await askName(cloud.title || 'untitled') : cloud.title;
  if (title === null) return null;
  cloudBusy = true;
  try {
    selectItem(null); // keep selection chrome out of the thumbnail
    setStatus('uploading…');
    if (await uploadDataSources(sources)) scheduleAutosave(); // autosave now keeps the small urls
    setStatus('saving…');
    const saved = await saveCloud({
      id: creating ? null : cloud.id,
      title,
      data: serialize(scene, sources),
      canvas,
      visibility: visibility ?? (creating ? 'private' : undefined)
    });
    setCloud({ ...saved, title, isOwner: true });
    setStatus('saved to your account');
    return saved;
  } catch (err) {
    if (err.status === 401) setUser(null);
    setStatus(`couldn't save. ${err.message}`);
    return null;
  } finally {
    cloudBusy = false;
  }
}
$('cloud-save').addEventListener('click', () => cloudSave());

/**
 * Copy text; clipboard API first, hidden-textarea fallback (Kuzic copyTextRobust).
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = Object.assign(el('textarea'), { value: text, readOnly: true });
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    // inside the open modal: everything outside a modal <dialog> is inert and can't be selected
    (document.querySelector('dialog[open]') ?? document.body).append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
let copyTimer = null;
/** Swap a copy button to "link copied" for 2 s; on failure select the link. */
async function copyLink(button, url, field) {
  if (await copyText(url)) {
    clearTimeout(copyTimer);
    button.classList.add('copied');
    button.textContent = 'link copied';
    copyTimer = setTimeout(() => {
      button.classList.remove('copied');
      button.textContent = 'copy link';
    }, 2000);
  } else {
    field?.select();
    setStatus("couldn't copy the link. it's selected, copy it from there");
  }
}

const VISIBILITY_WORDS = {
  private: 'only you can open it now',
  unlisted: 'anyone with the link can open it',
  public: "it's in the gallery"
};
function syncShareSheet() {
  for (const r of shareDialog.querySelectorAll('input[name=visibility]')) r.checked = r.value === cloud.visibility;
  $('share-link').value = shareUrl(cloud.id);
}
$('cloud-share').addEventListener('click', async () => {
  // sharing means "someone else can open it": a private project becomes link-only
  const saved = await cloudSave(cloud.visibility === 'private' || !cloud.isOwner ? 'unlisted' : undefined);
  if (!saved) return;
  syncShareSheet();
  openSheet(shareDialog, $('share-copy'));
});
$('share-access').addEventListener('change', async (e) => {
  const want = e.target.value;
  const before = cloud.visibility;
  try {
    cloud.visibility = (await setVisibility(cloud.id, want)).visibility;
    setStatus(VISIBILITY_WORDS[cloud.visibility]);
  } catch (err) {
    cloud.visibility = before;
    syncShareSheet();
    setStatus(`couldn't change who can open it. ${err.message}`);
  }
});
$('share-copy').addEventListener('click', (e) => copyLink(e.currentTarget, $('share-link').value, $('share-link')));

// ── browse sheet: your projects / public gallery ──
const browse = { tab: 'mine', next: null, items: new Map() };
const LOCK_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const KEBAB_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.3" fill="currentColor"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="12.5" cy="8" r="1.3" fill="currentColor"/></svg>';
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
/** "3 days ago" style date. @param {string} iso */
function ago(iso) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, secs] of [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]) {
    if (Math.abs(s) >= secs) return rtf.format(Math.round(s / secs), unit);
  }
  return 'just now';
}
/** One-line empty state + at most one action. */
function emptyState(text, actionLabel, onAction) {
  const box = el('div', 'browse-empty', text);
  if (actionLabel) {
    const b = el('button', 'sheet-btn', actionLabel);
    b.type = 'button';
    b.addEventListener('click', onAction);
    box.append(b);
  }
  return box;
}
function browseItem(p, tab) {
  const wrap = el('div', 'browse-item');
  wrap.dataset.id = p.id;
  const cell = el('button', 'lib-cell');
  cell.type = 'button';
  cell.setAttribute('aria-label', `open ${p.title || 'untitled'}`);
  if (p.thumbUrl) cell.append(Object.assign(el('img'), { src: p.thumbUrl, alt: '', loading: 'lazy' }));
  cell.addEventListener('click', () => openCloud(p.id));
  const cap = el('div', 'browse-caption');
  const text = el('div', 'browse-text');
  text.append(el('span', 'browse-title', p.title || 'untitled'));
  const meta = el('span', 'browse-meta', tab === 'mine' ? ago(p.updatedAt) : (p.author ?? ''));
  if (tab === 'mine' && p.visibility === 'private') meta.insertAdjacentHTML('afterbegin', LOCK_SVG); // lock-only marker
  text.append(meta);
  cap.append(text);
  if (tab === 'mine') {
    const more = el('button', 'icon-btn');
    more.type = 'button';
    more.innerHTML = KEBAB_SVG;
    more.setAttribute('aria-label', `more actions for ${p.title || 'untitled'}`);
    more.setAttribute('aria-haspopup', 'menu');
    more.addEventListener('click', () => {
      cardMenu.dataset.id = p.id;
      cardMenu.querySelector('[data-act=copy]').hidden = p.visibility === 'private';
      openMenu(cardMenu, more);
    });
    cap.append(more);
  }
  wrap.append(cell, cap);
  browse.items.set(p.id, p);
  return wrap;
}
const mineEmpty = () =>
  emptyState('No projects yet.', 'cloud save', () => {
    browseDialog.close();
    cloudSave();
  });
async function showBrowse(tab, append = false) {
  browse.tab = tab;
  for (const b of $('browse-tabs').children) {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  }
  const grid = $('browse-grid');
  $('browse-foot').hidden = true;
  if (tab === 'mine' && !user) {
    return grid.replaceChildren(
      emptyState('Sign in to see the projects you saved.', 'sign in', async () => (await requireUser()) && showBrowse('mine'))
    );
  }
  if (!append) {
    // skeleton mirrors the grid: thumb + two caption lines, varied widths
    grid.replaceChildren(
      ...Array.from({ length: 8 }, (_, i) => {
        const s = el('div', 'browse-item browse-skel');
        s.append(el('div', 'lib-skel'), Object.assign(el('div', 'lib-skel skel-line'), { style: `width:${[70, 55, 80, 60][i % 4]}%` }));
        return s;
      })
    );
  }
  grid.setAttribute('aria-busy', 'true');
  try {
    const res = tab === 'mine' ? await listMine() : await listGallery(append ? browse.next : null);
    if (browse.tab !== tab) return; // switched tabs mid-load
    browse.next = res.next ?? null;
    if (!append) grid.replaceChildren();
    for (const p of res.projects) grid.append(browseItem(p, tab));
    if (!grid.children.length) grid.append(tab === 'mine' ? mineEmpty() : emptyState('Nothing in the gallery yet.'));
    $('browse-foot').hidden = !browse.next;
  } catch (err) {
    grid.replaceChildren(emptyState(`Couldn't load projects. ${err.message}`, 'try again', () => showBrowse(tab)));
  } finally {
    grid.removeAttribute('aria-busy');
  }
}
async function openCloud(id) {
  if (
    scene.items.length &&
    id !== cloud.id &&
    !(await confirmSheet({
      title: 'replace the canvas?',
      body: "anything you haven't saved goes away.",
      action: 'open project',
      destructive: false
    }))
  ) {
    return;
  }
  browseDialog.close();
  setStatus('loading project…');
  try {
    const p = await loadCloud(id);
    await loadProject(p.data);
    setCloud(p);
  } catch (err) {
    setStatus(`couldn't open it. ${err.message}`);
  }
}
/** Optimistic delete: the card leaves now and comes back if the server says no. */
async function deleteProject(id) {
  const p = browse.items.get(id);
  const name = p?.title || 'untitled';
  const ok = await confirmSheet({
    title: `delete “${name}”?`,
    body: 'its share link stops working. this cannot be undone.',
    action: 'delete project'
  });
  if (!ok) return;
  const card = $('browse-grid').querySelector(`[data-id="${CSS.escape(id)}"]`);
  const next = card?.nextSibling ?? null;
  card?.remove();
  try {
    await deleteCloud(id);
    if (cloud.id === id) setCloud(null);
    setStatus(`deleted ${name}`);
    if (!$('browse-grid').querySelector('.browse-item')) $('browse-grid').replaceChildren(mineEmpty());
  } catch (err) {
    if (card) $('browse-grid').insertBefore(card, next);
    setStatus(`couldn't delete ${name}. ${err.message}`);
  }
}
cardMenu.addEventListener('click', async (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  const id = cardMenu.dataset.id;
  cardMenu.hidePopover();
  if (act === 'open') openCloud(id);
  else if (act === 'delete') deleteProject(id);
  else if (act === 'copy') {
    if (await copyText(shareUrl(id))) setStatus('link copied');
    else setStatus("couldn't copy the link");
  }
});
$('cloud-browse').addEventListener('click', () => {
  openSheet(browseDialog);
  showBrowse(browse.tab);
});
$('browse-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]')?.dataset.tab;
  if (tab) showBrowse(tab);
});
$('browse-more').addEventListener('click', () => showBrowse('gallery', true));

currentUser().then(setUser); // label only; never blocks the canvas

// restore BEFORE anything below can touch scene.items (the selftest clears them).
// A share link (?p=) wins over the local autosave; if it can't load, fall back.
const sharedId = projectIdFromUrl(location.href);
let sharedError = null;
const shared = sharedId ? await loadCloud(sharedId).catch((err) => ((sharedError = err.message), null)) : null;
if (shared?.data) {
  await loadProject(shared.data);
  setCloud(shared);
} else {
  if (sharedId) setCloud(null);
  const restored = await loadSavedProject();
  if (restored?.items?.length) await loadProject(restored);
  if (sharedError) setStatus(sharedError); // loadProject clears the status
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

// ── dev self-tests: /?selftest paints every brush with a live gif;
//    /?selftest=drip drives the drip brush + handle resize through real pointer handlers ──
const selftest = new URLSearchParams(location.search).get('selftest');
if (import.meta.env.DEV && selftest === 'drip') {
  (async () => {
    try {
      await clearSaved();
      scene.items = [];
      const r = canvas.getBoundingClientRect();
      const fire = (type, fx, fy) =>
        canvas.dispatchEvent(new PointerEvent(type, { clientX: r.left + fx, clientY: r.top + fy, pointerId: 1, bubbles: true }));
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      // drip: a fast sweep (segments), then hold still (pool), release, let it drain
      ui.brush = 'drip';
      setTool('paint');
      fire('pointerdown', W * 0.2, H * 0.5);
      for (let i = 1; i <= 30; i++) {
        fire('pointermove', W * (0.2 + (0.4 * i) / 30), H * 0.5);
        await wait(16);
      }
      await wait(2500);
      fire('pointerup', W * 0.6, H * 0.5);
      await wait(1500);
      const drip = scene.items.find((i) => i.brush === 'drip');
      const kinds = new Set((drip?.ops ?? []).map((o) => o.t));
      if (!kinds.has('seg') || !kinds.has('blob')) throw new Error('drip ops: ' + [...kinds].join(',') || 'none');
      // flick across → thrown drop train; tap → dump splash
      fire('pointerdown', W * 0.15, H * 0.25);
      for (let i = 1; i <= 6; i++) {
        fire('pointermove', W * (0.15 + 0.05 * i), H * 0.25);
        await wait(8);
      }
      fire('pointerup', W * 0.45, H * 0.25);
      fire('pointerdown', W * 0.8, H * 0.25);
      await wait(30);
      fire('pointerup', W * 0.8, H * 0.25);
      await wait(1500);
      const [flick, tap] = scene.items.filter((i) => i.brush === 'drip').slice(1);
      const splats = (it) => (it?.ops ?? []).filter((o) => o.t === 'splat').length;
      if (splats(flick) < 5) throw new Error('flick splats ' + splats(flick));
      if (splats(tap) < 3) throw new Error('tap splats ' + splats(tap));
      // spatter: tap a loaded brush → cloud of dots
      ui.brush = 'spatter';
      fire('pointerdown', W * 0.8, H * 0.6);
      await wait(400);
      fire('pointerup', W * 0.8, H * 0.6);
      await wait(1200);
      if (splats(scene.items.at(-1)) < 20) throw new Error('spatter splats ' + splats(scene.items.at(-1)));
      // wet-on-wet: a second colour poured onto the first pool marbles
      ui.brush = 'drip';
      ui.color = '#3399ff';
      const firstPool = drip.ops.find((o) => o.t === 'blob');
      fire('pointerdown', firstPool.x, firstPool.y);
      await wait(900);
      fire('pointerup', firstPool.x, firstPool.y);
      await wait(1500);
      const marbled = scene.items.at(-1).ops.find((o) => o.t === 'blob');
      if (!marbled?.swirl) throw new Error('no marbling on wet-on-wet pool');
      ui.color = '#ff7a4a';
      // scrape: drag a tool through the first pool → it shrinks, streak in its colour
      ui.brush = 'scrape';
      const r0 = firstPool.r;
      fire('pointerdown', firstPool.x - r0 - 20, firstPool.y);
      fire('pointermove', firstPool.x + r0 + 40, firstPool.y + 4);
      fire('pointerup', firstPool.x + r0 + 40, firstPool.y + 4);
      const scrape = scene.items.at(-1);
      if (!(firstPool.r < r0) || !scrape.ops.some((o) => o.c === drip.color)) throw new Error('scrape: r ' + r0 + '→' + firstPool.r + ' ops ' + scrape.ops.length);
      undo(scene);
      if (scene.items.at(-1).brush === 'scrape') throw new Error('undo scrape');
      ui.brush = 'drip';
      if (!dripPanel.hidden === false) throw new Error('drip panel hidden while drip brush active');
      // native-size placement + corner-handle resize + undo
      const png = document.createElement('canvas');
      png.width = 120;
      png.height = 80;
      png.getContext('2d').fillStyle = '#4af';
      png.getContext('2d').fillRect(0, 0, 120, 80);
      const srcId = await ensureSource({ kind: 'img', url: png.toDataURL() });
      // drip with an asset picked = reveal mask
      ui.srcId = srcId;
      setTool('paint');
      fire('pointerdown', W * 0.3, H * 0.75);
      fire('pointermove', W * 0.5, H * 0.75);
      await wait(1200);
      fire('pointerup', W * 0.5, H * 0.75);
      await wait(800);
      const masked = scene.items.at(-1);
      if (masked?.srcId !== srcId || !masked.ops.length) throw new Error('masked drip: srcId ' + masked?.srcId);
      ui.srcId = null;
      const img = addItem(scene, makeImageItem(srcId, W / 2, H / 2, fitScale(sources.get(srcId))));
      if (img.scale !== 1) throw new Error('native size: scale ' + img.scale);
      setTool('select');
      selectItem(img.id);
      fire('pointerdown', W / 2 + 60, H / 2 + 40); // bottom-right handle
      fire('pointermove', W / 2 + 120, H / 2 + 80); // twice as far from the centre
      fire('pointerup', W / 2 + 120, H / 2 + 80);
      if (Math.abs(img.scale - 2) > 0.05) throw new Error('handle resize: scale ' + img.scale);
      undo(scene);
      if (scene.items.find((i) => i.id === img.id).scale !== 1) throw new Error('undo did not restore scale');
      await wait(300);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let lit = 0;
      for (let i = 0; i < d.length; i += 400) if (d[i] > 40 || d[i + 1] > 40) lit++;
      document.title = lit > 50 ? `SELFTEST-PASS drip ops=${drip.ops.length}` : 'SELFTEST-FAIL pixels';
    } catch (err) {
      document.title = 'SELFTEST-FAIL ' + err.message;
    }
  })();
} else if (import.meta.env.DEV && selftest === 'pollock') {
  // /?selftest=pollock — an Autumn Rhythm-style composition laid down by the simulator itself
  (async () => {
    await clearSaved();
    scene.items = [];
    scene.background = '#c9b48a';
    bgInput.value = scene.background;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const S = W / WIDTH_M;
    const pour = (color, tool, over, path, secs, flick) => {
      const drip = { ...DRIP_DEFAULTS, ...TOOLS[tool], tool, ...over };
      const it = makeStrokeItem('drip', { color, size: 28, drip });
      scene.items.push(it);
      const sim = createDripSim(it, S, { under: (x, y) => paintUnder(x, y, it) });
      const [x0, y0] = path(0);
      sim.placeHand(x0, y0, 0);
      sim.setPouring(true);
      const n = Math.round(secs / DT);
      for (let i = 1; i <= n; i++) {
        const [x, y] = path(i / n);
        sim.setTarget(x, y, (i * DT) * 1000);
        sim.step(DT);
        sim.spread(DT);
      }
      sim.setPouring(false);
      if (flick) sim.release(secs * 1000);
      sim.flush();
    };
    const arc = (x0, y0, x1, y1, bend) => (t) => {
      const mx = (x0 + x1) / 2 + (y0 - y1) * bend;
      const my = (y0 + y1) / 2 + (x1 - x0) * bend;
      const u = 1 - t;
      return [u * u * x0 + 2 * u * t * mx + t * t * x1, u * u * y0 + 2 * u * t * my + t * t * y1];
    };
    const BLACK = '#151311', WHITE = '#efeadf', TAN = '#a08a5e', BLUE = '#4c6970';
    // 1 tan and white thin pours first, then black skeins, then white and blue on top
    const sweep = (bend) => arc(rnd(0, W), rnd(0, H), rnd(0, W), rnd(0, H), rnd(-bend, bend));
    for (let i = 0; i < 6; i++) pour(i % 2 ? TAN : WHITE, 'can', { a0: 0.003, mu: 0.6, theta: 12 }, sweep(0.5), rnd(0.6, 1.2));
    for (let i = 0; i < 18; i++) pour(BLACK, 'baster', { H: 0.35, mu: 0.3 }, sweep(0.8), rnd(0.18, 0.45), i % 3 === 0); // fast: U > V, taut lines
    for (let i = 0; i < 8; i++) pour(BLACK, 'stick', { mu: 2.5 }, sweep(0.3), rnd(0.8, 2));
    for (let i = 0; i < 6; i++) pour(WHITE, 'brush', {}, sweep(0.6), rnd(0.3, 0.6), true);
    for (let i = 0; i < 4; i++) pour(BLUE, 'baster', { H: 0.5, mu: 0.2 }, sweep(0.8), rnd(0.25, 0.5), true);
    scene.past.length = 0;
    scene.onChange();
    document.title = `POLLOCK items=${scene.items.length}`;
  })();
} else if (import.meta.env.DEV && selftest !== null) {
  (async () => {
    try {
      await clearSaved();
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
        if (b.id === 'eraser' || PHYS.has(b.id) || b.id === 'scrape') continue; // physics brushes need their sim
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
