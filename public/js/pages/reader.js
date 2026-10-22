import { api } from '../api.js';
import { state } from '../state.js';
import { history } from '../store.js';
import { state as msg } from '../components/section.js';
import { esc, img, link } from '../utils.js';

const ICO = {
  back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  prev: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  list: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
};

export async function reader({ root, alive }, url) {
  document.body.classList.add('is-reader');
  root.innerHTML = msg('Memuat chapter…');

  let d;
  try {
    d = await api('/api/read?url=' + encodeURIComponent(url));
  } catch (e) {
    throw e;
  }
  if (!alive()) return;

  const s = state.series;
  const list = s ? s.chapters : [];
  const i = list.findIndex((c) => c.url === url || c.chapter_id === d.chapter_id);

  let prev = null;
  let next = null;
  if (d.prev_chapter_id) {
    prev = { url: `https://shinigami.id/chapter/${d.prev_chapter_id}` };
  } else if (i >= 0 && i < list.length - 1) {
    prev = list[i + 1];
  }
  if (d.next_chapter_id) {
    next = { url: `https://shinigami.id/chapter/${d.next_chapter_id}` };
  } else if (i > 0) {
    next = list[i - 1];
  }

  if (s) {
    const prevHist = history.lastFor(s.url);
    const readList = Array.from(new Set([url, ...((prevHist && prevHist.read) || [])])).slice(0, 500);
    history.push({
      url: s.url,
      title: s.title,
      poster: s.poster,
      chapterUrl: url,
      chapterTitle: (list[i] || {}).title || d.title,
      read: readList,
    });
  }

  const backHref = s ? link('detail', s.url) : '#/';
  const readSet = s ? history.readChapters(s.url) : new Set();

  const drawerList = list.length
    ? list.map((c) => {
        const active = c.url === url || c.chapter_id === d.chapter_id;
        const isRead = readSet.has(c.url);
        return `<a class="reader-drawer__item${active ? ' is-active' : ''}${isRead ? ' is-read' : ''}" href="${link('read', c.url)}">${esc(c.title)}</a>`;
      }).join('')
    : '<div class="state">Daftar chapter tidak tersedia. Buka dari halaman detail dulu.</div>';

  root.innerHTML = `
    <div class="reader" id="reader">
      <div class="reader__ui reader__top" id="reader-top">
        <a class="reader__icon" href="${backHref}" aria-label="Kembali">${ICO.back}</a>
        <div class="reader__top-title">${esc(d.title)}</div>
        <button type="button" class="reader__icon" id="btn-list" aria-label="Daftar chapter">${ICO.list}</button>
      </div>

      <div class="reader__pages" id="reader-pages">
        ${d.images.map((src, index) => `<img loading="${index < 2 ? 'eager' : 'lazy'}" fetchpriority="${index === 0 ? 'high' : 'auto'}" decoding="async" src="${esc(img(src))}" alt=""${index === 0 ? ' data-first-page' : ''}>`).join('')}
      </div>

      <div class="reader__end" id="reader-end">
        <div class="reader__end-label">Akhir chapter</div>
        ${next
          ? `<a class="btn btn--brand btn--pill" href="${link('read', next.url)}">Chapter selanjutnya</a>`
          : s
            ? `<a class="btn btn--secondary btn--pill" href="${backHref}">Selesai</a>`
            : ''}
      </div>

      <div class="reader__ui reader__bottom" id="reader-bottom">
        ${prev
          ? `<a class="reader__icon reader__icon--lg" href="${link('read', prev.url)}" aria-label="Sebelumnya">${ICO.prev}</a>`
          : `<span class="reader__icon reader__icon--lg is-disabled" aria-hidden="true">${ICO.prev}</span>`}
        <button type="button" class="reader__icon reader__icon--lg" id="btn-list-2" aria-label="Daftar chapter">${ICO.list}</button>
        ${next
          ? `<a class="reader__icon reader__icon--lg" href="${link('read', next.url)}" aria-label="Selanjutnya">${ICO.next}</a>`
          : `<span class="reader__icon reader__icon--lg is-disabled" aria-hidden="true">${ICO.next}</span>`}
      </div>

      <div class="reader-drawer" id="reader-drawer" hidden>
        <div class="reader-drawer__backdrop" id="drawer-backdrop"></div>
        <div class="reader-drawer__panel" role="dialog" aria-label="Daftar chapter">
          <div class="reader-drawer__head">
            <h2>Chapters</h2>
            <button type="button" class="reader__icon" id="drawer-close" aria-label="Tutup">${ICO.close}</button>
          </div>
          <div class="reader-drawer__search">
            <input type="search" id="drawer-filter" placeholder="Cari chapter…" autocomplete="off">
          </div>
          <div class="reader-drawer__list" id="drawer-list">${drawerList}</div>
        </div>
      </div>
    </div>`;

  window.scrollTo(0, 0);

  const top = document.getElementById('reader-top');
  const bottom = document.getElementById('reader-bottom');
  const readerEl = document.getElementById('reader');
  const drawer = document.getElementById('reader-drawer');
  let uiVisible = false;
  let scrollTimer = null;
  let lastScrollY = window.scrollY;
  let scrolling = false;

  const showUI = () => {
    uiVisible = true;
    top.classList.add('is-visible');
    bottom.classList.add('is-visible');
  };
  const hideUI = () => {
    uiVisible = false;
    top.classList.remove('is-visible');
    bottom.classList.remove('is-visible');
  };

  const openDrawer = () => {
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    showUI();
    // scroll active into view
    const active = drawer.querySelector('.is-active');
    if (active) active.scrollIntoView({ block: 'center' });
  };
  const closeDrawer = () => {
    drawer.classList.remove('is-open');
    setTimeout(() => { drawer.hidden = true; }, 200);
  };

  document.getElementById('btn-list').addEventListener('click', (e) => { e.stopPropagation(); openDrawer(); });
  document.getElementById('btn-list-2').addEventListener('click', (e) => { e.stopPropagation(); openDrawer(); });
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('drawer-backdrop').addEventListener('click', closeDrawer);

  const filter = document.getElementById('drawer-filter');
  const listEl = document.getElementById('drawer-list');
  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    listEl.querySelectorAll('a').forEach((a) => {
      a.style.display = !q || a.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  readerEl.addEventListener('click', (e) => {
    if (e.target.closest('a, button, .reader__end, .reader-drawer')) return;
    if (scrolling) return;
    if (uiVisible) hideUI();
    else showUI();
  });

  const onScroll = () => {
    const y = window.scrollY;
    if (Math.abs(y - lastScrollY) > 4) {
      scrolling = true;
      if (uiVisible) hideUI();
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { scrolling = false; }, 180);
    }
    lastScrollY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  const cleanup = () => {
    window.removeEventListener('scroll', onScroll);
    clearTimeout(scrollTimer);
  };
  const onHash = () => {
    cleanup();
    window.removeEventListener('hashchange', onHash);
  };
  window.addEventListener('hashchange', onHash);
}
