/* RiMwa Service Worker — cache gambar, API, aset; mendukung chapter offline */
const V = 'v39';
const STATIC = `rimwa-static-${V}`;
const IMG = `rimwa-img-${V}`;
const API = `rimwa-api-${V}`;
const DL = 'rimwa-dl'; // chapter yang diunduh user (tidak pernah dihapus otomatis)
const IMG_MAX = 700;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([STATIC, IMG, API, DL]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i += 1) await c.delete(keys[i]);
}

async function isOkJson(res) {
  try {
    const j = await res.clone().json();
    return !!j.status;
  } catch { return false; }
}

async function imgStrategy(req) {
  const dl = await caches.open(DL);
  const own = await dl.match(req);
  if (own) return own;
  const c = await caches.open(IMG);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    c.put(req, res.clone());
    if (Math.random() < 0.05) trim(IMG, IMG_MAX);
  }
  return res;
}

async function apiStrategy(req, url) {
  if (url.pathname === '/api/read') {
    const dl = await caches.open(DL);
    const own = await dl.match(req);
    if (own) return own;
  }
  const c = await caches.open(API);
  const hit = await c.match(req);
  const net = fetch(req).then(async (res) => {
    if (res.ok && (await isOkJson(res))) c.put(req, res.clone());
    return res;
  });
  // stale-while-revalidate: tampil cepat dari cache, diperbarui di belakang layar
  if (hit) {
    net.catch(() => {});
    return hit;
  }
  try { return await net; } catch (e) {
    return new Response(JSON.stringify({ status: false, message: 'Offline' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staticStrategy(req) {
  const c = await caches.open(STATIC);
  const hit = await c.match(req);
  const net = fetch(req).then((res) => {
    if (res.ok) c.put(req, res.clone());
    return res;
  });
  if (hit) { net.catch(() => {}); return hit; }
  return net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname === '/api/img' || url.pathname === '/api/thumbimg') return e.respondWith(imgStrategy(req));
  if (url.pathname.startsWith('/api/')) return e.respondWith(apiStrategy(req, url));
  if (url.pathname === '/sw.js') return;
  e.respondWith(staticStrategy(req));
});
