import { api } from '../api.js';
import { state } from '../state.js';
import { history } from '../store.js';
import { state as msg } from '../components/section.js';
import { esc, img, link } from '../utils.js';

export async function reader({ root, alive }, url) {
  root.innerHTML = msg('Memuat chapter…');
  const d = await api('/api/read?url=' + encodeURIComponent(url));
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

  const bar = `<div class="reader__bar">
    ${prev ? `<a class="btn btn--secondary" href="${link('read', prev.url)}">Sebelumnya</a>` : ''}
    ${s ? `<a class="btn btn--secondary" href="${link('detail', s.url)}">Daftar</a>` : ''}
    ${next ? `<a class="btn btn--brand" href="${link('read', next.url)}">Selanjutnya</a>` : ''}
  </div>`;

  root.innerHTML = `
    <h1 class="reader__title">${esc(d.title)}</h1>${bar}
    <div class="reader__pages">${d.images.map((src) => `<img loading="lazy" src="${esc(img(src))}" alt="">`).join('')}</div>${bar}`;
  window.scrollTo(0, 0);
}
