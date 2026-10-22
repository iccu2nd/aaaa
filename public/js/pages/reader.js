import { api } from '../api.js';
import { state } from '../state.js';
import { history } from '../store.js';
import { state as msg } from '../components/section.js';
import { esc, img, link } from '../utils.js';

export async function reader({ root, alive }, url) {
  document.body.classList.add('is-reader');
  root.innerHTML = msg('Memuat chapter…');

  let d;
  try {
    d = await api('/api/read?url=' + encodeURIComponent(url));
  } catch (e) {
    document.body.classList.remove('is-reader');
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

  root.innerHTML = `
    <div class="reader" id="reader">
      <div class="reader__ui reader__top" id="reader-top">
        <a class="detail__icon-btn" href="${backHref}" aria-label="Kembali" id="reader-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
        <div class="reader__top-title">${esc(d.title)}</div>
      </div>

      <div class="reader__pages" id="reader-pages">
        ${d.images.map((src) => `<img loading="lazy" src="${esc(img(src))}" alt="">`).join('')}
      </div>

      <div class="reader__end" id="reader-end">
        <div class="reader__end-label">Akhir chapter</div>
        ${next
          ? `<a class="btn btn--brand" href="${link('read', next.url)}">Chapter Selanjutnya</a>`
          : s
            ? `<a class="btn btn--secondary" href="${backHref}">Kembali ke daftar</a>`
            : ''}
      </div>

      <div class="reader__ui reader__bottom" id="reader-bottom">
        ${prev ? `<a class="btn" href="${link('read', prev.url)}">Sebelumnya</a>` : '<span></span>'}
        <a class="btn" href="${backHref}">Daftar</a>
        ${next ? `<a class="btn btn--brand" href="${link('read', next.url)}">Selanjutnya</a>` : '<span></span>'}
      </div>
    </div>`;

  window.scrollTo(0, 0);

  const top = document.getElementById('reader-top');
  const bottom = document.getElementById('reader-bottom');
  const readerEl = document.getElementById('reader');
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

  // Tap / click di area halaman → toggle UI
  // Abaikan klik pada tombol/link
  readerEl.addEventListener('click', (e) => {
    if (e.target.closest('a, button, .reader__end')) return;
    if (scrolling) return;
    if (uiVisible) hideUI();
    else showUI();
  });

  // Scroll → mode baca (sembunyikan UI)
  const onScroll = () => {
    const y = window.scrollY;
    if (Math.abs(y - lastScrollY) > 4) {
      scrolling = true;
      if (uiVisible) hideUI();
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        scrolling = false;
      }, 180);
    }
    lastScrollY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  // Cleanup saat pindah halaman
  const cleanup = () => {
    document.body.classList.remove('is-reader');
    window.removeEventListener('scroll', onScroll);
  };
  // router akan unmount root; pasang flag di alive check berikutnya via hashchange
  const onHash = () => {
    cleanup();
    window.removeEventListener('hashchange', onHash);
  };
  window.addEventListener('hashchange', onHash);
}
