import { bookmarks, history } from '../store.js';
import { isDownloaded, removeChapter } from '../download.js';
import { esc, img, link } from '../utils.js';

const readDownloads = () => {
  try { return Object.keys(JSON.parse(localStorage.getItem('rimwa:downloads')) || {}); }
  catch { return []; }
};

const relativeTime = (value) => {
  const time = Number(value || 0);
  if (!time) return '';
  const minutes = Math.max(1, Math.floor((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days} hari lalu` : `${Math.floor(days / 7)} minggu lalu`;
};

const empty = (title, detail, href, action) => `
  <div class="library-empty">
    <strong>${esc(title)}</strong><p>${esc(detail)}</p>
    <a class="library-empty__action" href="${href}">${esc(action)}</a>
  </div>`;

function historyItems(items) {
  if (!items.length) return empty('Belum ada riwayat baca', 'Komik yang kamu baca akan muncul di sini.', '/search', 'Jelajahi komik');
  return `<div class="library-list">${items.map((item) => `
    <article class="library-entry">
      <a class="library-entry__cover" href="${link('detail', item.url)}" aria-label="Buka ${esc(item.title)}"><img loading="lazy" decoding="async" src="${esc(img(item.poster, 240))}" alt=""></a>
      <div class="library-entry__info">
        <a class="library-entry__title" href="${link('detail', item.url)}">${esc(item.title)}</a>
        <span class="library-entry__chapter">${esc(item.chapterTitle || 'Belum ada chapter')}</span>
        <span class="library-entry__time">${esc(relativeTime(item.updatedAt || item.time || item.lastRead))}</span>
      </div>
      <a class="library-entry__action" href="${link('read', item.chapterUrl)}" aria-label="Lanjut membaca ${esc(item.title)}"><span aria-hidden="true">⌃</span></a>
    </article>`).join('')}</div>`;
}

function favoriteItems(items) {
  if (!items.length) return empty('Belum ada favorit', 'Simpan komik yang ingin kamu baca lagi.', '/search', 'Cari komik');
  return `<div class="library-list">${items.map((item) => `
    <article class="library-entry">
      <a class="library-entry__cover" href="${link('detail', item.url)}" aria-label="Buka ${esc(item.title)}"><img loading="lazy" decoding="async" src="${esc(img(item.poster, 240))}" alt=""></a>
      <div class="library-entry__info"><a class="library-entry__title" href="${link('detail', item.url)}">${esc(item.title)}</a><span class="library-entry__chapter">${esc(item.status || 'Tersimpan di favorit')}</span></div>
      <a class="library-entry__action" href="${link('detail', item.url)}" aria-label="Lihat detail"><span aria-hidden="true">›</span></a>
    </article>`).join('')}</div>`;
}

export function library({ root }) {
  const marks = bookmarks.list();
  const hist = history.list();
  const downloadedUrls = readDownloads();
  const known = [...hist, ...marks];
  const downloads = downloadedUrls.map((url) => known.find((item) => item.chapterUrl === url || item.url === url)).filter(Boolean);
  const tabs = [
    { id: 'favorite', label: 'Favorite', count: marks.length },
    { id: 'history', label: 'History', count: hist.length },
    { id: 'download', label: 'Download', count: downloadedUrls.length },
  ];

  root.innerHTML = `
    <section class="library-page" aria-label="Library">
      <div class="library-tabs" role="tablist" aria-label="Kategori Library">
        ${tabs.map((tab) => `<button class="library-tab${tab.id === 'history' ? ' is-active' : ''}" id="library-tab-${tab.id}" type="button" role="tab" aria-selected="${tab.id === 'history'}" aria-controls="library-panel" data-tab="${tab.id}">${tab.label}</button>`).join('')}
      </div>
      <form class="library-search" role="search">
        <input type="search" id="library-search-input" placeholder="Search..." aria-label="Cari koleksi" autocomplete="off">
        <button type="submit" aria-label="Cari"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.2"></circle><path d="m16.2 16.2 5 5"></path></svg></button>
      </form>
      <p class="library-hint" id="library-hint">Tekan lama item riwayat untuk memilih beberapa item.</p>
      <div id="library-panel" role="tabpanel" aria-labelledby="library-tab-history"></div>
    </section>`;

  let active = 'history';
  const panel = root.querySelector('#library-panel');
  const searchInput = root.querySelector('#library-search-input');
  const hint = root.querySelector('#library-hint');

  const render = () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    let html = '';
    if (active === 'favorite') html = favoriteItems(marks.filter((item) => item.title.toLocaleLowerCase().includes(query)));
    else if (active === 'download') {
      const items = downloads.filter((item) => item.title.toLocaleLowerCase().includes(query));
      html = items.length ? historyItems(items) : empty('Belum ada download', 'Chapter yang berhasil disimpan untuk dibaca offline akan muncul di sini.', '/search', 'Jelajahi komik');
    } else html = historyItems(hist.filter((item) => item.title.toLocaleLowerCase().includes(query)));
    panel.innerHTML = html;
    panel.setAttribute('aria-labelledby', `library-tab-${active}`);
    hint.hidden = active !== 'history';
  };

  root.querySelectorAll('.library-tab').forEach((button) => button.addEventListener('click', () => {
    active = button.dataset.tab;
    root.querySelectorAll('.library-tab').forEach((tab) => {
      const selected = tab === button;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    render();
  }));
  root.querySelector('.library-search').addEventListener('submit', (event) => { event.preventDefault(); render(); });
  searchInput.addEventListener('input', render);
  render();
}
