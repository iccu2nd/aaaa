import { api } from '../api.js';
import { state } from '../state.js';
import { bookmarks, history } from '../store.js';
import { section, state as msg } from '../components/section.js';
import { esc, img, link } from '../utils.js';

export async function detail({ root, alive }, url) {
  root.innerHTML = msg('Memuat…');
  const d = await api('/api/detail?url=' + encodeURIComponent(url));
  if (!alive()) return;

  state.series = { url: d.url || url, title: d.title, poster: d.poster, chapters: d.chapters };
  const first = d.chapters[d.chapters.length - 1];
  const resume = history.lastFor(d.url || url);
  const readSet = history.readChapters(d.url || url);
  const item = {
    url: d.url || url,
    title: d.title,
    poster: d.poster,
    meta: `${d.total_chapters} chapter`,
  };

  const metaBits = [
    d.status,
    d.release_year,
    d.user_rate != null && d.user_rate > 0 ? `${d.user_rate}` : '',
    d.total_chapters ? `${d.total_chapters} chapter` : '',
  ].filter(Boolean);

  const genres = (d.genres || []).length
    ? `<div class="series__tags">${d.genres.map((g) => `<span class="tag">${esc(g)}</span>`).join('')}</div>`
    : '';

  const desc = d.description
    ? `<p class="series__desc">${esc(d.description)}</p>`
    : '';

  root.innerHTML = `
    <div class="series">
      <img class="series__cover" src="${esc(img(d.poster))}" alt="">
      <div class="series__info">
        <h1>${esc(d.title)}</h1>
        ${d.alternative_title ? `<div class="series__alt">${esc(d.alternative_title)}</div>` : ''}
        <div class="series__meta">${esc(metaBits.join(' · '))}</div>
        ${genres}
        ${desc}
        <div class="series__actions">
          ${resume ? `<a class="btn btn--brand" href="${link('read', resume.chapterUrl)}">Lanjut baca</a>` : ''}
          ${first ? `<a class="btn ${resume ? 'btn--secondary' : 'btn--brand'}" href="${link('read', first.url)}">Mulai dari awal</a>` : ''}
          <button class="btn btn--secondary" id="bm" type="button"></button>
        </div>
      </div>
    </div>
    ${section('Daftar Chapter', `<div class="chapters">${d.chapters.map((c) =>
      `<a class="${readSet.has(c.url) ? 'is-read' : ''}" href="${link('read', c.url)}"><span>${esc(c.title)}</span></a>`).join('')}</div>`)}`;

  const btn = document.getElementById('bm');
  const paint = () => {
    const on = bookmarks.has(item.url);
    btn.textContent = on ? 'Tersimpan' : 'Simpan';
    btn.classList.toggle('btn--active', on);
  };
  btn.addEventListener('click', () => { bookmarks.toggle(item); paint(); });
  paint();
}
