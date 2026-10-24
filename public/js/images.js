const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = window.requestIdleCallback ? (cb) => window.requestIdleCallback(cb, { timeout: 600 }) : (cb) => setTimeout(cb, 120);

const loaded = (im) =>
  im.complete && im.naturalWidth
    ? Promise.resolve()
    : new Promise((resolve) => {
        im.addEventListener('load', resolve, { once: true });
        im.addEventListener('error', resolve, { once: true });
      });

const preload = (url) =>
  new Promise((resolve) => {
    const im = new Image();
    im.onload = im.onerror = resolve;
    im.src = url;
  });

const bgUrls = (box) =>
  [...box.querySelectorAll('[style*="url("]')]
    .map((el) => (el.getAttribute('style').match(/url\(['"]?([^'")]+)['"]?\)/) || [])[1])
    .filter(Boolean)
    .slice(0, 2);

/**
 * Susun HTML di luar layar dan tunggu gambar layar pertama selesai dimuat.
 * Hasilnya langsung terisi penuh saat dipasang ke halaman.
 */
export async function stage(html, { first = 8, timeout = 2500 } = {}) {
  const box = document.createElement('div');
  box.innerHTML = html;
  const head = [...box.querySelectorAll('img')].slice(0, first);
  head.forEach((im) => {
    im.loading = 'eager';
    im.fetchPriority = 'high';
  });
  const jobs = head.map(loaded).concat(bgUrls(box).map(preload));
  await Promise.race([Promise.all(jobs), wait(timeout)]);
  return box;
}

/** Muat sisa gambar (rail, grid) bertahap di latar belakang, tanpa menunggu scroll. */
export function fillRest(root, alive = () => true) {
  const rest = [...root.querySelectorAll('img[loading="lazy"]')].filter((im) => !(im.complete && im.naturalWidth));
  rest.forEach((im) => {
    im.classList.add('is-pending');
    const done = () => im.classList.remove('is-pending');
    im.addEventListener('load', done, { once: true });
    im.addEventListener('error', done, { once: true });
  });
  const BATCH = 6;
  let i = 0;
  const next = async () => {
    if (!alive() || i >= rest.length) return;
    const batch = rest.slice(i, i + BATCH);
    i += BATCH;
    batch.forEach((im) => {
      im.loading = 'eager';
      im.fetchPriority = 'low';
    });
    await Promise.race([Promise.all(batch.map(loaded)), wait(4000)]);
    idle(next);
  };
  idle(next);
}
