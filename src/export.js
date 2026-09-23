// Export: PNG snapshot, animated GIF (gifenc), WebM video (MediaRecorder).
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { renderScene } from './scene.js';

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

export function exportPNG(canvas) {
  canvas.toBlob((blob) => blob && download(blob, `gifpaint-${stamp()}.png`), 'image/png');
}

export async function exportGIF(scene, sources, w, h, seconds, setStatus) {
  const fps = 15;
  const total = Math.round(seconds * fps);
  const k = Math.min(1, 640 / w); // ponytail: quantize is slow, cap export at 640px wide
  const ew = Math.round(w * k);
  const eh = Math.round(h * k);

  const off = document.createElement('canvas');
  off.width = ew;
  off.height = eh;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  ctx.scale(k, k);

  const enc = GIFEncoder();
  const t0 = performance.now();
  for (let i = 0; i < total; i++) {
    renderScene(scene, ctx, sources, t0 + (i * 1000) / fps, w, h);
    const { data } = ctx.getImageData(0, 0, ew, eh);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    enc.writeFrame(index, ew, eh, { palette, delay: 1000 / fps });
    setStatus(`gif ${i + 1}/${total}`);
    await new Promise((r) => setTimeout(r)); // keep UI alive
  }
  enc.finish();
  download(new Blob([enc.bytes()], { type: 'image/gif' }), `gifpaint-${stamp()}.gif`);
  setStatus('');
}

export function exportWebM(canvas, seconds, setStatus) {
  if (!('MediaRecorder' in window) || !canvas.captureStream) {
    setStatus('video capture unsupported in this browser');
    return;
  }
  const stream = canvas.captureStream(30);
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    download(new Blob(chunks, { type: 'video/webm' }), `gifpaint-${stamp()}.webm`);
    setStatus('');
  };
  rec.start();
  setStatus(`recording ${seconds}s…`);
  setTimeout(() => rec.stop(), seconds * 1000);
}
