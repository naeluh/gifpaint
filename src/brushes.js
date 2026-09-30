// Brush set. Each stroke item is re-rendered every frame from its points, so
// GIF-based brushes animate live. All draw funcs are pure-ish (seeded RNG).
import { replayDripOps } from './drip.js';

export const BRUSHES = [
  { id: 'reveal', label: 'reveal', needsSource: true }, // the original — default
  { id: 'image', label: 'image', needsSource: true },
  // canSource: shape reveals the picked source when one is active, else color
  { id: 'ink', label: 'ink', canSource: true },
  { id: 'glow', label: 'glow', canSource: true },
  { id: 'rainbow', label: 'rainbow' },
  { id: 'spray', label: 'spray', canSource: true },
  // Pollock physics (drip.js): pour, tapped-brush spatter, tool dragged through wet paint
  { id: 'drip', label: 'drip', canSource: true },
  { id: 'spatter', label: 'spatter', canSource: true },
  { id: 'scrape', label: 'scrape' },
  { id: 'eraser', label: 'eraser' }
];

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawSourceCentered(ctx, src, now) {
  const frame = src.frameAt(now);
  ctx.drawImage(frame, -src.width / 2, -src.height / 2, src.width, src.height);
}

// width modulated by captured velocity (v in px/ms, clamped at capture time)
const widthAt = (item, p) => Math.max(2, item.size * (0.4 + Math.min(p.v ?? 0, 3) * 0.5));

function eachSegment(item, fn) {
  const pts = item.points;
  for (let i = 1; i < pts.length; i++) fn(pts[i - 1], pts[i], i);
}

// resample stamp centers at fixed spacing along the polyline
function stampPositions(item, spacing) {
  const out = [];
  const pts = item.points;
  if (!pts.length) return out;
  out.push({ ...pts[0], d: 0 });
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    let t = spacing - acc;
    while (t <= seg) {
      const k = t / seg;
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, v: b.v, d: out.length });
      t += spacing;
    }
    acc = (acc + seg) % spacing;
  }
  return out;
}

function lineStroke(ctx, item, colorFor) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (item.points.length === 1) {
    const p = item.points[0];
    ctx.fillStyle = colorFor(0);
    ctx.beginPath();
    ctx.arc(p.x, p.y, widthAt(item, p) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  eachSegment(item, (a, b, i) => {
    ctx.strokeStyle = colorFor(i);
    ctx.lineWidth = (widthAt(item, a) + widthAt(item, b)) / 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });
}

let scratch = null; // shared offscreen for reveal brush
function getScratch(w, h) {
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w;
    scratch.height = h;
  }
  return scratch;
}

// Original yourimage.io ribbon: width is INVERSE to speed (200/step.length in
// the paper.js source) — move slow for a fat reveal, flick for a sliver.
function ribbonHalfWidth(item, p) {
  const v = Math.max(p.v ?? 0.2, 0.05); // px/ms
  const w = item.size * (0.18 / v);
  return Math.min(Math.max(w, 1.5), item.size * 2);
}

// Trace the stroke as one closed ribbon polygon (top edge out, bottom back),
// smoothed with midpoint quadratics — canvas twin of path.add/insert/smooth().
function traceRibbon(ctx, item) {
  const pts = item.points;
  if (pts.length < 2) {
    const p = pts[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, ribbonHalfWidth(item, p), 0, Math.PI * 2);
    return;
  }
  const top = [];
  const bot = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(i - 1, 0)];
    const b = pts[Math.min(i + 1, pts.length - 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const hw = ribbonHalfWidth(item, pts[i]);
    top.push({ x: pts[i].x + nx * hw, y: pts[i].y + ny * hw });
    bot.push({ x: pts[i].x - nx * hw, y: pts[i].y - ny * hw });
  }
  const walk = (arr) => {
    for (let i = 1; i < arr.length - 1; i++)
      ctx.quadraticCurveTo(arr[i].x, arr[i].y, (arr[i].x + arr[i + 1].x) / 2, (arr[i].y + arr[i + 1].y) / 2);
    const last = arr[arr.length - 1];
    ctx.lineTo(last.x, last.y);
  };
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  walk(top);
  bot.reverse();
  ctx.lineTo(bot[0].x, bot[0].y);
  walk(bot);
  ctx.closePath();
}

// cover-fit a source's current frame over the full canvas
function drawCover(ctx, src, now, W, H) {
  const frame = src.frameAt(now);
  const k = Math.max(W / src.width, H / src.height);
  ctx.drawImage(frame, (W - src.width * k) / 2, (H - src.height * k) / 2, src.width * k, src.height * k);
}

// draw a brush shape as a mask, then reveal the full-viewport source through it
function maskSource(ctx, src, now, W, H, drawShape) {
  const sc = getScratch(W, H);
  const sctx = sc.getContext('2d');
  sctx.clearRect(0, 0, W, H);
  drawShape(sctx);
  sctx.globalCompositeOperation = 'source-in';
  drawCover(sctx, src, now, W, H);
  sctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(sc, 0, 0);
}

function sprayDots(ctx, item) {
  const rnd = mulberry32(item.seed);
  for (const p of item.points) {
    const r = widthAt(item, p) * 1.4;
    for (let n = 0; n < 6; n++) {
      const ang = rnd() * Math.PI * 2;
      const dist = Math.sqrt(rnd()) * r;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, 1 + rnd() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function renderStroke(ctx, item, now, sources, W, H) {
  // ink/glow/spray double as reveal shapes when the stroke carries a source
  const src = item.srcId ? sources.get(item.srcId) : null;
  switch (item.brush) {
    case 'ink':
      if (src) maskSource(ctx, src, now, W, H, (c) => lineStroke(c, item, () => '#000'));
      else lineStroke(ctx, item, () => item.color);
      break;

    case 'glow':
      // colored halo stays on the main ctx; the source fills the core
      ctx.shadowColor = item.color;
      ctx.shadowBlur = item.size;
      lineStroke(ctx, item, () => item.color);
      ctx.shadowBlur = 0;
      if (src) maskSource(ctx, src, now, W, H, (c) => lineStroke(c, item, () => '#000'));
      break;

    case 'rainbow':
      lineStroke(ctx, item, (i) => `hsl(${(item.seed + i * 4) % 360} 100% 60%)`);
      break;

    case 'drip':
    case 'spatter':
      // with a source picked the poured shapes are the mask (source-in), same as ink/glow/spray
      if (src) maskSource(ctx, src, now, W, H, (c) => replayDripOps(c, item, { mask: true }));
      else replayDripOps(ctx, item);
      break;

    case 'scrape': {
      // scraped streaks keep the paint they came from: plain colour, or that pool's gif/video
      replayDripOps(ctx, item, { filter: (op) => !op.src });
      const bySrc = new Map();
      for (const op of item.ops ?? []) if (op.src) (bySrc.get(op.src) ?? bySrc.set(op.src, []).get(op.src)).push(op);
      for (const [srcId, subset] of bySrc) {
        const s = sources.get(srcId);
        if (s) maskSource(ctx, s, now, W, H, (c) => replayDripOps(c, { ops: subset, color: '#000' }, { mask: true }));
      }
      break;
    }

    case 'eraser':
      ctx.globalCompositeOperation = 'destination-out';
      lineStroke(ctx, item, () => '#000');
      ctx.globalCompositeOperation = 'source-over';
      break;

    case 'spray': {
      if (src) {
        maskSource(ctx, src, now, W, H, (c) => {
          c.fillStyle = '#000';
          sprayDots(c, item);
        });
      } else {
        ctx.fillStyle = item.color;
        sprayDots(ctx, item);
      }
      break;
    }

    case 'image': {
      const src = sources.get(item.srcId);
      if (!src) break;
      const frame = src.frameAt(now);
      const rnd = mulberry32(item.seed);
      for (const s of stampPositions(item, item.size * 0.7)) {
        const d = widthAt(item, s) * 2.2;
        const h = (d / src.width) * src.height;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate((rnd() - 0.5) * 0.5);
        ctx.drawImage(frame, -d / 2, -h / 2, d, h);
        ctx.restore();
      }
      break;
    }

    case 'reveal': {
      // the original yourimage.io / gifpaint mechanic: ONE source stretched
      // across the full canvas, masked by the ribbon the mouse carves out.
      const src = sources.get(item.srcId);
      if (!src || !item.points.length) break;
      // black shadow shape underneath (paper.js path2 w/ shadowBlur)
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 28;
      ctx.fillStyle = '#000';
      traceRibbon(ctx, item);
      ctx.fill();
      ctx.restore();
      // ribbon mask, then source-in the full-viewport frame (source-atop twin)
      maskSource(ctx, src, now, W, H, (c) => {
        c.fillStyle = '#000';
        traceRibbon(c, item);
        c.fill();
      });
      break;
    }
  }
}
