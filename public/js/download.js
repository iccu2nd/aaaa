import { img } from './utils.js';

const KEY = 'rimwa:downloads';
const DL = 'rimwa-dl';
const CONCURRENCY = 4;

const readMap = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const writeMap = (m) => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* ignore */ } };

export const supported = () => typeof caches !== 'undefined';
export const isDownloaded = (url) => !!readMap()[url];
export const downloadedCount = () => Object.keys(readMap()).length;

const readPath = (url) => '/api/read?url=' + encodeURIComponent(url);

/** Unduh satu chapter (JSON + semua gambar) ke Cache Storage. */
export async function downloadChapter(url, onProgress = () => {}, signal) {
  if (!supported()) throw new Error('Download butuh HTTPS atau localhost');
  const cache = await caches.open(DL);

  const res = await fetch(readPath(url), { signal });
  const json = await res.clone().json();
  if (!json.status) throw new Error(json.message || 'Gagal memuat chapter');
  const images = json.data.images || [];
  await cache.put(readPath(url), res);

  let done = 0;
  onProgress(0);
  const queue = images.slice();
  const worker = async () => {
    while (queue.length) {
      if (signal && signal.aborted) throw new DOMException('Dibatalkan', 'AbortError');
      const src = img(queue.shift());
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt += 1) {
        try {
          const r = await fetch(src, { signal });
          if (r.ok) { await cache.put(src, r); ok = true; }
        } catch (e) {
          if (e.name === 'AbortError') throw e;
        }
      }
      if (!ok) throw new Error('Sebagian gambar gagal diunduh');
      done += 1;
      onProgress(Math.round((done / images.length) * 100));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, images.length) }, worker));

  const m = readMap();
  m[url] = { t: Date.now(), n: images.length };
  writeMap(m);
}

export async function removeChapter(url) {
  const m = readMap();
  delete m[url];
  writeMap(m);
  if (!supported()) return;
  const cache = await caches.open(DL);
  try {
    const r = await cache.match(readPath(url));
    if (r) {
      const json = await r.json();
      for (const src of json.data.images || []) await cache.delete(img(src));
    }
  } catch { /* ignore */ }
  await cache.delete(readPath(url));
}
