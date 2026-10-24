import { api } from './api.js';
import { esc, img } from './utils.js';

const MAX = 4;
let active = 0;
const queue = [];

function pump() {
  while (active < MAX && queue.length) {
    const job = queue.shift();
    active += 1;
    job().finally(() => { active -= 1; pump(); });
  }
}

/**
 * Letakkan titik fokus (wajah) tepat di tengah kotak thumbnail.
 * fx/fy = pusat wajah (0..1 dari seluruh gambar), fw = lebar wajah (0..1).
 */
function frame(el, im, t) {
  const bw = el.clientWidth;
  const bh = el.clientHeight;
  const iw = im.naturalWidth;
  const ih = im.naturalHeight;
  if (!bw || !bh || !iw || !ih) return;
  const fw = Number.isFinite(Number(t.fw)) ? Number(t.fw) : 0.3;
  const show = Math.min(1, Math.max(0.4, fw / 0.34));
  const rw = bw / show;
  const rh = rw * (ih / iw);
  const fx = Number.isFinite(Number(t.fx)) ? Number(t.fx) : 0.5;
  const fy = Number.isFinite(Number(t.fy)) ? Number(t.fy) : 0.3;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const left = clamp(bw / 2 - fx * rw, Math.min(0, bw - rw), 0);
  const top = clamp(bh / 2 - fy * rh, Math.min(0, bh - rh), 0);
  im.style.objectFit = 'fill';
  im.style.width = `${rw}px`;
  im.style.height = `${rh}px`;
  im.style.inset = 'auto';
  im.style.left = `${left}px`;
  im.style.top = `${top}px`;
}

async function load(el) {
  const url = el.dataset.thumb;
  if (!url || el.dataset.state) return;
  el.dataset.state = 'loading';
  try {
    const t = await api('/api/thumb?v=6&url=' + encodeURIComponent(url));
    const im = new Image();
    im.alt = '';
    im.decoding = 'async';
    im.onload = () => {
      if (Number.isFinite(Number(t.fx))) frame(el, im, t);
      else {
        im.style.objectFit = 'cover';
        im.style.objectPosition = `${Number(t.x) || 50}% ${Number(t.pos) || 30}%`;
      }
      el.classList.add('is-ready');
      el.classList.remove('loading-surface');
      el.dataset.state = 'done';
    };
    im.onerror = () => { im.remove(); el.dataset.state = 'error'; el.classList.remove('loading-surface'); };
    im.src = img(t.url);
    el.appendChild(im);
  } catch {
    el.dataset.state = 'error';
    el.classList.remove('loading-surface');
  }
}

/** Muat thumbnail chapter hanya saat terlihat di layar (hemat request). */
export function watchThumbs(container, alive = () => true) {
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      io.unobserve(en.target);
      queue.push(() => (alive() ? load(en.target) : Promise.resolve()));
    }
    pump();
  }, { rootMargin: '500px 0px' });
  container.querySelectorAll('[data-thumb]').forEach((el) => io.observe(el));
  return io;
}

/**
 * Prefers server/API chapter thumbnail if available.
 * Falls back to progressive /api/thumb dengan fokus karakter.
 */
export const thumbBox = (chapterUrl, _letter, thumbUrl) => {
  if (thumbUrl) {
    return `<div class="ch-thumb is-ready" aria-label="Preview chapter">
      <img src="${esc(img(thumbUrl))}" alt="" decoding="async" style="object-fit:cover;object-position:50% 28%">
    </div>`;
  }
  return `<div class="ch-thumb loading-surface" data-thumb="${esc(chapterUrl)}" aria-label="Preview chapter"></div>`;
};
