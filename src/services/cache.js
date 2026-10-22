const MAX_ENTRIES = 500;
const store = new Map();

/** Jalankan fn() dan simpan hasil sukses selama ttlMs. */
async function wrap(key, ttlMs, fn) {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.val;
  const val = await fn();
  if (val && val.status) {
    if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
    store.set(key, { val, exp: Date.now() + ttlMs });
  }
  return val;
}

module.exports = { wrap };
