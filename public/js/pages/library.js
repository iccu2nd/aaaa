import { bookmarks, history } from '../store.js';
import { cardGrid } from '../components/card.js';
import { esc, img, link } from '../utils.js';

const empty = (title, detail, href, action) => `
  <div class="library-empty">
    <span class="library-empty__icon" aria-hidden="true">${title === 'Belum ada riwayat baca' ? '↻' : '☆'}</span>
    <strong>${esc(title)}</strong>
    <p>${esc(detail)}</p>
    <a class="library-empty__action" href="${href}">${esc(action)}</a>
  </div>`;

export function library({ root }) {
  const marks = bookmarks.list();
  const hist = history.list();

  const continueList = hist.length
    ? `<div class="library-history">${hist.slice(0, 12).map((h) => `
        <article class="library-history__item">
          <a class="library-history__cover" href="${link('detail', h.url)}" aria-label="Buka ${esc(h.title)}">
            <img loading="lazy" decoding="async" src="${esc(img(h.poster))}" alt="">
          </a>
          <div class="library-history__body">
            <a class="library-history__title" href="${link('detail', h.url)}">${esc(h.title)}</a>
            <span class="library-history__label">Terakhir dibaca</span>
            <a class="library-history__chapter" href="${link('read', h.chapterUrl)}">${esc(h.chapterTitle || 'Lanjut membaca')} <span aria-hidden="true">›</span></a>
          </div>
          <a class="library-history__resume" href="${link('read', h.chapterUrl)}" aria-label="Lanjut membaca ${esc(h.title)}">Lanjut</a>
        </article>`).join('')}</div>`
    : empty('Belum ada riwayat baca', 'Komik yang kamu baca akan muncul di sini agar mudah dilanjutkan.', '/search', 'Jelajahi komik');

  const bookmarkContent = marks.length
    ? cardGrid(marks)
    : empty('Belum ada bookmark', 'Simpan komik favorit dari halaman detail untuk menemukannya lagi di sini.', '/search', 'Cari komik');

  root.innerHTML = `
    <div class="library-page">
      <header class="library-page__head">
        <div><span class="library-page__eyebrow">KOLEKSI PRIBADI</span><h1>Library</h1><p>Riwayat baca dan komik yang kamu simpan.</p></div>
      </header>
      <section class="section library-section"><div class="section__head"><h2>Lanjut Baca <span class="library-count">${hist.length}</span></h2></div>${continueList}</section>
      <section class="section library-section"><div class="section__head"><h2>Bookmark <span class="library-count">${marks.length}</span></h2></div>${bookmarkContent}</section>
    </div>`;
}
