import { bookmarks, history } from '../store.js';
import { cardGrid } from '../components/card.js';
import { section } from '../components/section.js';
import { esc, img, link } from '../utils.js';

export function library({ root }) {
  const marks = bookmarks.list();
  const hist = history.list();

  const continueList = hist.length
    ? `<div class="feed">${hist.slice(0, 10).map((h) => `
        <div class="feed__row">
          <img class="feed__thumb" loading="lazy" src="${esc(img(h.poster))}" alt="">
          <div class="feed__body">
            <a class="feed__title" href="${link('detail', h.url)}">${esc(h.title)}</a>
            <div class="feed__chapters"><a class="feed__chapter" href="${link('read', h.chapterUrl)}"><span>Lanjut: ${esc(h.chapterTitle)}</span></a></div>
          </div>
        </div>`).join('')}</div>`
    : '<div class="state">Belum ada riwayat baca.</div>';

  root.innerHTML =
    section('Lanjut Baca', continueList) +
    section('Bookmark', marks.length ? cardGrid(marks) : '<div class="state">Belum ada bookmark. Buka komik lalu tekan Simpan.</div>');
}
