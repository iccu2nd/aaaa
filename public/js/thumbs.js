import { esc, img } from './utils.js';

const MAX = 6;
let active = 0;
const queue = [];

function pump() {
  while (active < MAX && queue.length) {
    const job = queue.shift();
    active += 1;
    job().finally(() => { active -= 1; pump(); });
  }
}

function load(el) {
  const url = el.dataset.thumb;
  if (!url || el.dataset.state) return Promise.resolve();
  el.dataset.state = 'loading';
  return new Promise((resolve) => {
    const im = new Image();
    im.alt = '';
    im.decoding = 'async';
    im.onload = () => {
      el.classList.add('is-ready');
      el.classList.remove('loading-surface');
      el.dataset.state = 'done';
      resolve();
    };
    im.onerror = () => {
      im.remove();
      el.dataset.state = 'error';
      el.classList.remove('loading-surface');
      resolve();
    };
    im.src = '/api/thumbimg?v=3&url=' + encodeURIComponent(url);
    el.appendChild(im);
  });
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
