'use strict';

const fs = require('fs');
const path = require('path');

const MAX_ENTRIES = 3000;
const FILE = path.join(__dirname, '..', '..', 'data', 'cache.json');
const store = new Map();
const inflight = new Map();
let dirty = false;

// Muat cache dari disk supaya restart server tidak mulai dari nol.
try {
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const now = Date.now();
  for (const [k, v] of raw) if (v && v.exp > now - v.ttl * 4) store.set(k, v);
} catch { /* belum ada cache */ }

function persist() {
  if (!dirty) return;
  dirty = false;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const skip = (k) => k.startsWith('r:') || k.startsWith('ti4:') || k.startsWith('ti5:') || k.startsWith('ti6:') || k.startsWith('ti7:'); // buffer thumb besar, tidak ke disk
    const rows = [...store.entries()].filter(([k]) => !skip(k));
    fs.writeFileSync(FILE, JSON.stringify(rows));
  } catch { /* abaikan */ }
}
setInterval(persist, 60 * 1000).unref();
process.on('SIGINT', () => { persist(); process.exit(0); });
process.on('SIGTERM', () => { persist(); process.exit(0); });

function put(key, val, ttlMs) {
  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
  store.delete(key);
  store.set(key, { val, exp: Date.now() + ttlMs, ttl: ttlMs });
  dirty = true;
}

/**
 * Jalankan fn() dan simpan hasil sukses selama ttlMs.
 * - request yang sama dan sedang berjalan digabung jadi satu
 * - jika sumber gagal, data lama (stale) tetap dipakai
 */
async function wrap(key, ttlMs, fn) {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.val;
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    let val;
    try {
      val = await fn();
    } catch (e) {
      if (hit) return hit.val;
      throw e;
    }
    if (val && val.status) {
      put(key, val, ttlMs);
      return val;
    }
    return hit ? hit.val : val;
  })().finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

module.exports = { wrap };
