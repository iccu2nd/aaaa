import { api } from '../api.js';
import { state } from '../state.js';
import { history } from '../store.js';
import { state as msg } from '../components/section.js';
import { esc, img, link } from '../utils.js';

export async function reader({ root, alive }, url) {
  root.innerHTML = msg('Memuat chapter…');
  const d = await api('/api/read?url=' + encodeURIComponent(url)).catch(err => ({ error: err.message }));

  if (!alive()) return;

  if (d.error) {
    root.innerHTML = msg('Gagal memuat chapter: ' + d.error, true);
    return;
  }

  const s = state.series;
  const list = s ? s.chapters : [];
  const i = list.findIndex((c) => c.url === url || c.chapter_id === d.chapter_id);

  let prevUrl = d.prevChapterUrl || null;
  let nextUrl = d.nextChapterUrl || null;

  if (!prevUrl) {
    if (d.prev_chapter_id) prevUrl = `https://shinigami.id/chapter/${d.prev_chapter_id}`;
    else if (i >= 0 && i < list.length - 1) prevUrl = list[i + 1].url;
  }

  if (!nextUrl) {
    if (d.next_chapter_id) nextUrl = `https://shinigami.id/chapter/${d.next_chapter_id}`;
    else if (i > 0) nextUrl = list[i - 1].url;
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

  root.innerHTML = `
    <div class="reader-container" id="readerContainer">
      <div class="reader-top-controls" id="readerControls">
        <a class="reader-back-btn" href="javascript:history.back()" aria-label="Kembali">←</a>
        <h1 class="reader-title">${esc(d.title)}</h1>
      </div>

      <div class="reader-pages-wrap">
        ${d.images.map((src, idx) => `<img loading="lazy" src="${esc(img(src))}" alt="Page ${idx + 1}" class="reader-img">`).join('')}
      </div>

      <!-- Tombol Navigasi Chapter di bagian bawah komik -->
      <div class="reader-bottom-nav">
        ${prevUrl ? `<a class="btn-chapter-nav" href="${link('read', prevUrl)}">← Chapter Sebelumnya</a>` : '<div></div>'}
        ${s ? `<a class="btn-chapter-nav btn-list" href="${link('detail', s.url)}">📋 Daftar Chapter</a>` : ''}
        ${nextUrl ? `<a class="btn-chapter-nav primary" href="${link('read', nextUrl)}">Next Chapter Selanjutnya →</a>` : '<div></div>'}
      </div>
    </div>
  `;

  window.scrollTo(0, 0);

  let lastScroll = window.scrollY;
  const bottomNav = document.getElementById('bottomNav');
  const controls = document.getElementById('readerControls');

  const onScroll = () => {
    const curr = window.scrollY;
    if (curr > lastScroll && curr > 60) {
      bottomNav?.classList.add('bottom-nav--hidden');
      controls?.classList.add('hidden');
    } else {
      bottomNav?.classList.remove('bottom-nav--hidden');
      controls?.classList.remove('hidden');
    }
    lastScroll = curr;
  };

  window.addEventListener('scroll', onScroll, { passive: true });

  const container = document.getElementById('readerContainer');
  if (container) {
    container.addEventListener('click', (e) => {
      if (!e.target.closest('a') && !e.target.closest('button')) {
        bottomNav?.classList.toggle('bottom-nav--hidden');
        controls?.classList.toggle('hidden');
      }
    });
  }
}
