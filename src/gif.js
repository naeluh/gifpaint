// GIF decode + playback. Decodes once into full-frame canvases, then
// frameAt(now) returns the canvas for the current loop position.
import { parseGIF, decompressFrames } from 'gifuct-js';

// frames are stored as canvases; native size until the pixel budget binds
// (150 frames × 1200² would be 860MB — the budget keeps a decode under ~160MB)
const MAX_DIM = 1200;
const MAX_PIXELS = 40e6; // total frame pixels per gif
const MAX_FRAMES = 150;

export async function loadGif(url) {
  const buf = await fetch(url).then((r) => {
    if (!r.ok) throw new Error(`gif fetch ${r.status}`);
    return r.arrayBuffer();
  });
  const gif = parseGIF(buf);
  const raw = decompressFrames(gif, true).slice(0, MAX_FRAMES);
  if (!raw.length) throw new Error('gif has no frames');

  const W = gif.lsd.width;
  const H = gif.lsd.height;
  const k = Math.min(1, MAX_DIM / Math.max(W, H), Math.sqrt(MAX_PIXELS / (W * H * raw.length)));
  const w = Math.max(1, Math.round(W * k));
  const h = Math.max(1, Math.round(H * k));

  // compositing surface at native size
  const full = document.createElement('canvas');
  full.width = W;
  full.height = H;
  const fctx = full.getContext('2d');
  const patch = document.createElement('canvas');
  const pctx = patch.getContext('2d');

  const frames = [];
  const delays = [];
  let total = 0;
  let prev = null;

  for (const f of raw) {
    if (prev && prev.disposalType === 2) {
      const d = prev.dims;
      fctx.clearRect(d.left, d.top, d.width, d.height);
    }
    patch.width = f.dims.width;
    patch.height = f.dims.height;
    pctx.putImageData(new ImageData(f.patch, f.dims.width, f.dims.height), 0, 0);
    fctx.drawImage(patch, f.dims.left, f.dims.top);

    const snap = document.createElement('canvas');
    snap.width = w;
    snap.height = h;
    snap.getContext('2d').drawImage(full, 0, 0, w, h);
    frames.push(snap);

    const delay = f.delay && f.delay > 10 ? f.delay : 100;
    total += delay;
    delays.push(total); // cumulative end time
    prev = f;
  }

  let cursor = 0;
  return {
    kind: 'gif',
    width: w,
    height: h,
    duration: total,
    frames,
    frameAt(now) {
      if (frames.length === 1) return frames[0];
      const t = now % total;
      if (delays[cursor] <= t || (cursor > 0 && delays[cursor - 1] > t)) {
        cursor = 0;
        while (delays[cursor] <= t) cursor++;
      }
      return frames[cursor];
    }
  };
}

export function loadVideo(url) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.addEventListener('loadeddata', () => {
      video.play().catch(() => {});
      resolve({
        kind: 'video',
        width: video.videoWidth,
        height: video.videoHeight,
        frameAt: () => video
      });
    }, { once: true });
    video.addEventListener('error', () => reject(new Error(`video failed: ${url}`)), { once: true });
    video.src = url;
  });
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () =>
      resolve({
        kind: 'img',
        width: img.naturalWidth,
        height: img.naturalHeight,
        frameAt: () => img
      });
    img.onerror = () => reject(new Error(`image failed: ${url}`));
    img.src = url;
  });
}
