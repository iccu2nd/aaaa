import { api } from '../api.js';
import { state } from '../state.js';
import { bookmarks, history } from '../store.js';
import { state as msg } from '../components/section.js';
import { esc, img, link } from '../utils.js';

function relative(iso) {
  if (!iso) return '';
  try {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return '';
    const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (sec < 60) return 'baru saja';
    if (sec < 3600) return `${Math.floor(sec / 60)} menit lalu`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} jam lalu`;
    if (sec < 604800) return `${Math.floor(sec / 86400)} hari lalu`;
    return new Date(t).toLocaleDateString('id-ID');
  } catch { return ''; }
}

export async function detail({ root, alive }, url) {
  root.innerHTML = msg('Memuat…');
  const d = await api('/api/detail?url=' + encodeURIComponent(url));
  if (!alive()) return;

  const seriesUrl = d.url || url;
  state.series = { url: seriesUrl, title: d.title, poster: d.poster, chapters: d.chapters };
  const first = d.chapters[d.chapters.length - 1];
  const resume = history.lastFor(seriesUrl);
  const readSet = history.readChapters(seriesUrl);
  const item = { url: seriesUrl, title: d.title, poster: d.poster, meta: `${d.total_chapters} chapter` };

  const startUrl = resume ? resume.chapterUrl : (first && first.url);
  const startLabel = resume ? 'Lanjut Baca' : 'Mulai Baca';
  const startSub = resume
    ? esc(resume.chapterTitle || '')
    : (first ? esc(first.title) : '');

  const genres = (d.genres || []).map((g) => `<span class="tag">${esc(g)}</span>`).join('');
  const authors = (d.authors || []).join(', ');
  const status = d.status || '';
  const year = d.release_year || '';
  const rate = d.user_rate != null && d.user_rate > 0 ? String(d.user_rate) : '';

  const chapterRows = d.chapters.map((c, idx) => {
    const letter = (d.title || 'K').charAt(0).toUpperCase();
    const time = relative(c.release_date);
    return `<a class="${readSet.has(c.url) ? 'is-read' : ''}" href="${link('read', c.url)}" data-ch="${esc(c.title)}">
      <div class="chapters__thumb">${esc(letter)}</div>
      <div class="chapters__info">
        <div class="chapters__name">${esc(c.title)}</div>
        ${time ? `<div class="chapters__time">${esc(time)}</div>` : ''}
      </div>
    </a>`;
  }).join('');

  root.innerHTML = `
    <article class="detail">
      <div class="detail__hero">
        <img class="detail__hero-bg" src="${esc(img(d.poster))}" alt="" aria-hidden="true">
        <div class="detail__hero-fade"></div>
        <div class="detail__hero-actions">
          <a class="detail__icon-btn" href="#/" aria-label="Kembali">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>
          <button class="detail__icon-btn" id="bm" type="button" aria-label="Simpan">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" id="bm-icon"><path d="M6 4h11a1 1 0 0 1 1 1v15l-6.5-3.5L5 20V5a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>

      <div class="detail__body">
        <div class="detail__header">
          <img class="detail__cover" src="${esc(img(d.poster))}" alt="">
          <div class="detail__meta">
            <div class="detail__badges">
              ${status ? `<span class="detail__badge">${esc(status)}</span>` : ''}
              ${year ? `<span class="detail__badge">${esc(String(year))}</span>` : ''}
              ${d.source ? `<span class="detail__badge">${esc(d.source === 'shinigami' ? 'Shinigami' : 'Voratoon')}</span>` : ''}
            </div>
            <h1 class="detail__title">${esc(d.title)}</h1>
            ${authors ? `<div class="detail__row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 19c0-3.5 3-5.5 7-5.5s7 2 7 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              ${esc(authors)}
            </div>` : ''}
            ${rate ? `<div class="detail__row">Rating ${esc(rate)}</div>` : ''}
            <div class="detail__row">${d.total_chapters || 0} chapter${status ? ' · ' + esc(status) : ''}</div>
          </div>
        </div>

        ${d.description ? `
          <p class="detail__desc is-clamp" id="desc">${esc(d.description)}</p>
          <button type="button" class="detail__desc-toggle" id="desc-toggle">Selengkapnya</button>
        ` : ''}

        ${genres ? `<div class="detail__tags">${genres}</div>` : ''}

        <div class="detail__chapters-head">
          <h2>Chapters</h2>
          <span style="font-size:12px;color:var(--dim)">${d.total_chapters || 0}</span>
        </div>
        <div class="detail__ch-search">
          <input type="search" id="ch-filter" placeholder="Cari chapter…" autocomplete="off">
        </div>
        <div class="chapters" id="ch-list">${chapterRows}</div>

        ${startUrl ? `
          <div class="detail__start">
            <a class="btn btn--brand" href="${link('read', startUrl)}">
              ${startLabel}${startSub ? ' · ' + startSub : ''}
            </a>
          </div>
        ` : ''}
      </div>
    </article>`;

  const btn = document.getElementById('bm');
  const paint = () => {
    const on = bookmarks.has(item.url);
    btn.classList.toggle('btn--active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const path = btn.querySelector('path');
    if (path) path.setAttribute('fill', on ? 'currentColor' : 'none');
  };
  btn.addEventListener('click', () => { bookmarks.toggle(item); paint(); });
  paint();

  const desc = document.getElementById('desc');
  const descToggle = document.getElementById('desc-toggle');
  if (desc && descToggle) {
    descToggle.addEventListener('click', () => {
      const open = desc.classList.toggle('is-clamp');
      descToggle.textContent = open ? 'Selengkapnya' : 'Sembunyikan';
    });
  }

  const filter = document.getElementById('ch-filter');
  const list = document.getElementById('ch-list');
  if (filter && list) {
    filter.addEventListener('input', () => {
      const q = filter.value.trim().toLowerCase();
      list.querySelectorAll('a').forEach((a) => {
        const t = (a.dataset.ch || '').toLowerCase();
        a.style.display = !q || t.includes(q) ? '' : 'none';
      });
    });
  }
}
