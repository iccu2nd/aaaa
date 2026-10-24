/**
 * Fetch JSON + cache klien.
 * - fresh (< ttl): langsung dari cache, tanpa request
 * - stale: tampilkan cache dulu, perbarui di belakang layar
 * - gagal/offline: pakai cache selama masih ada
 */
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const PREFIX = 'rimwa:c:';
const STALE_MAX = 3 * DAY;

// [pola, ttl, simpan ke localStorage?]
const RULES = [
  [/^\/api\/thumb/, 30 * DAY, true],
  [/^\/api\/explore/, 10 * MIN, true],
  [/^\/api\/detail/, 10 * MIN, true],
  [/^\/api\/home/, 5 * MIN, true],
  [/^\/api\/update/, 3 * MIN, true],
  [/^\/api\/search/, 5 * MIN, true],
  [/^\/api\/read/, 30 * MIN, false], // besar → hanya memori (+ Service Worker)
];

const mem = new Map();

function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(PREFIX + key)); } catch { return null; }
}

function prune(count = 40) {
  try {
    const rows = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) {
        let t = 0;
        try { t = JSON.parse(localStorage.getItem(k)).t || 0; } catch { /* rusak → hapus dulu */ }
        rows.push([k, t]);
      }
    }
    rows.sort((a, b) => a[1] - b[1]).slice(0, count).forEach(([k]) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

function lsSet(key, entry) {
  const raw = JSON.stringify(entry);
  try { localStorage.setItem(PREFIX + key, raw); } catch {
    prune();
    try { localStorage.setItem(PREFIX + key, raw); } catch { /* penuh, abaikan */ }
  }
}

function getCache(path, persist) {
  return mem.get(path) || (persist ? lsGet(path) : null);
}

function setCache(path, data, persist) {
  const entry = { t: Date.now(), d: data };
  mem.set(path, entry);
  if (mem.size > 80) mem.delete(mem.keys().next().value);
  if (persist) lsSet(path, entry);
}

async function fetchJson(path) {
  const res = await fetch(path);
  const json = await res.json().catch(() => ({ status: false, message: 'Respons server tidak valid' }));
  if (!json.status) throw new Error(json.message || 'Gagal memuat data');
  return json.data;
}

export async function api(path) {
  const rule = RULES.find(([re]) => re.test(path));
  if (!rule) return fetchJson(path);

  const [, ttl, persist] = rule;
  const hit = getCache(path, persist);
  const age = hit ? Date.now() - hit.t : Infinity;

  if (hit && age < ttl) return hit.d;

  if (hit && age < STALE_MAX) {
    fetchJson(path).then((d) => setCache(path, d, persist)).catch(() => {});
    return hit.d;
  }

  try {
    const d = await fetchJson(path);
    setCache(path, d, persist);
    return d;
  } catch (e) {
    if (hit) return hit.d;
    throw e;
  }
}
