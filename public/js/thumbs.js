import { api } from './api.js';
import { esc, img } from './utils.js';

const MAX = 3;
let active = 0;
const queue = [];

function pump() {
  while (active < MAX && queue.length) {
    const job = queue.shift();
    active += 1;
    job().finally(() => { active -= 1; pump(); });
  }
}

async function load(el) {
  const url = el.dataset.thumb;
  if (!url || el.dataset.state) return;
  el.dataset.state = 'loading';
  try {
    const t = await api('/api/thumb?url=' + encodeURIComponent(url));
    const im = new Image();
    im.alt = '';
    im.decoding = 'async';
    im.style.objectPosition = `50% ${Number(t.pos) || 30}%`;
    im.onload = () => { el.classList.add('is-ready'); el.dataset.state = 'done'; };
    im.onerror = () => { im.remove(); el.dataset.state = 'error'; };
    im.src = img(t.url);
    el.appendChild(im);
  } catch {
    el.dataset.state = 'error';
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
  }, { rootMargin: '400px 0px' });
  container.querySelectorAll('[data-thumb]').forEach((el) => io.observe(el));
  return io;
}

export const thumbBox = (chapterUrl) =>
  `<div class="ch-thumb" data-thumb="${esc(chapterUrl)}"><span aria-hidden="true">Preview unavailable</span></div>`;
