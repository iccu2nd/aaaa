import { api } from '../api.js';
import { card } from '../components/card.js';
import { section, skeletonGrid, state as msg } from '../components/section.js';
import { esc } from '../utils.js';

const SIZE = 60;
const fmt = (n) => Number(n).toLocaleString('id-ID');

/** Explore: SEMUA judul, dimuat bertahap saat scroll (tanpa batas total). */
export async function explore({ root, alive }, q = '') {
  const input = document.getElementById('search-input');
  if (input) input.value = q;
  const title = q ? `Hasil: ${q}` : 'Explore';
  const url = (page) => `/api/explore?q=${encodeURIComponent(q)}&page=${page}&size=${SIZE}`;

  root.innerHTML = section(title, skeletonGrid(18)) + msg('Memuat semua judul…');
  const first = await api(url(1));
  if (!alive()) return;

  if (!first.items.length) {
    root.innerHTML = section(title, msg('Tidak ada hasil.'));
    return;
  }

  root.innerHTML = `
    <section class="section">
      <div class="section__head">
        <h2>${esc(title)}</h2>
        <span class="section__count" id="ex-count"></span>
      </div>
      <div class="grid" id="ex-grid"></div>
      <div class="state" id="ex-end"></div>
    </section>`;

  const grid = document.getElementById('ex-grid');
  const end = document.getElementById('ex-end');
  const count = document.getElementById('ex-count');
  const seen = new Set();
  let page = 0;
  let pages = first.pages;
  let loading = false;
  let io = null;

  const add = (data) => {
    const fresh = data.items.filter((c) => !seen.has(c.url) && seen.add(c.url));
    grid.insertAdjacentHTML('beforeend', fresh.map(card).join(''));
    count.textContent = `${fmt(data.total)} judul`;
  };

  const next = async () => {
    if (loading || page >= pages) return;
    loading = true;
    end.textContent = 'Memuat…';
    try {
      const data = page === 0 ? first : await api(url(page + 1));
      if (!alive()) { if (io) io.disconnect(); return; }
      page += 1;
      pages = data.pages;
      add(data);
    } catch (e) {
      end.innerHTML = `${esc(e.message)} · <a href="#" id="ex-retry">Coba lagi</a>`;
      const r = document.getElementById('ex-retry');
      if (r) r.addEventListener('click', (ev) => { ev.preventDefault(); loading = false; next(); });
      return;
    }
    loading = false;
    if (page >= pages) {
      end.textContent = `Semua ${fmt(seen.size)} judul sudah ditampilkan.`;
      if (io) io.disconnect();
    } else {
      end.textContent = '';
    }
  };

  await next();
  if (!alive() || page >= pages) return;

  io = new IntersectionObserver((entries) => {
    if (!alive()) { io.disconnect(); return; }
    if (entries.some((e) => e.isIntersecting)) next();
  }, { rootMargin: '1200px 0px' });
  io.observe(end);
}
