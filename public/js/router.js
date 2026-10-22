import { esc } from './utils.js';

const routes = [];
let current = 0;

export const route = (pattern, handler) => routes.push({ pattern, handler });

export function start(root) {
  const run = async () => {
    const token = ++current;
    const hash = location.hash.slice(1) || '/';
    // Reader mode mengikuti URL aktif. Jangan reset ke mode biasa saat berpindah
    // langsung dari satu chapter ke chapter berikutnya.
    document.body.classList.toggle('is-reader', /^\/read\//.test(hash));
    document.body.classList.toggle('is-detail', /^\/detail\//.test(hash));
    const ctx = { root, alive: () => token === current };
    markActive(hash);
    for (const { pattern, handler } of routes) {
      const m = hash.match(pattern);
      if (!m) continue;
      try {
        await handler(ctx, ...m.slice(1).map((p) => decodeURIComponent(p || '')));
      } catch (e) {
        if (ctx.alive()) {
          document.body.classList.remove('is-reader');
          root.innerHTML = `<div class="state state--error">${esc(e.message)}</div>`;
        }
      }
      return;
    }
    root.innerHTML = '<div class="state">Halaman tidak ditemukan.</div>';
  };
  addEventListener('hashchange', run);
  run();
}

function markActive(hash) {
  const seg = hash.split('/')[1] || 'home';
  const active = seg === 'search' ? 'explore' : seg === 'detail' || seg === 'read' ? '' : seg;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (active && a.dataset.nav === active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}
