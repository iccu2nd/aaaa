import { api } from '../api.js';
import { state } from '../state.js';
import { bookmarks, history } from '../store.js';
import { esc, img, link } from '../utils.js';
import { ico, ring } from '../icons.js';
import { watchThumbs, thumbBox } from '../thumbs.js';
import { supported, isDownloaded, downloadChapter, removeChapter } from '../download.js';

const SORT_KEY = 'rimwa:chsort';
const getSort = () => { try { return localStorage.getItem(SORT_KEY) === 'asc' ? 'asc' : 'desc'; } catch { return 'desc'; } };
const setSort = (v) => { try { localStorage.setItem(SORT_KEY, v); } catch { /* ignore */ } };

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
  root.innerHTML = `<section class="detail-loading" aria-label="Memuat detail manhwa"><div class="loading-surface detail-loading__hero"></div><div class="detail-loading__head"><div class="loading-surface detail-loading__cover"></div><div class="detail-loading__copy"><i class="loading-surface"></i><i class="loading-surface"></i><i class="loading-surface"></i><i class="loading-surface"></i></div></div><i class="loading-surface detail-loading__line"></i><i class="loading-surface detail-loading__line detail-loading__line--short"></i><div class="detail-loading__chapters">${'<i class="loading-surface"></i>'.repeat(5)}</div></section>`;
  const d = await api('/api/detail?url=' + encodeURIComponent(url));
  if (!alive()) return;

  const seriesUrl = d.url || url;
  state.series = { url: seriesUrl, title: d.title, poster: d.poster, chapters: d.chapters };
  // Chapter 1 = nomor terkecil (bukan asumsi urutan array)
  const byNum = [...(d.chapters || [])].sort(
    (a, b) => Number(a.chapter_number || 0) - Number(b.chapter_number || 0),
  );
  const first = byNum[0] || d.chapters[d.chapters.length - 1];
  const resume = history.lastFor(seriesUrl);
  const readSet = history.readChapters(seriesUrl);
  const item = { url: seriesUrl, title: d.title, poster: d.poster, meta: `${d.total_chapters} chapter` };

  const startUrl = resume ? resume.chapterUrl : (first && first.url);
  const startLabel = resume ? 'Lanjut Baca' : 'Mulai Baca';
  const startSub = resume
    ? (resume.chapterTitle || '')
    : (first ? (first.title || 'Chapter 1') : '');

  const genres = (d.genres || []).map((g) => `<a class="tag tag--link" href="/search?genre=${encodeURIComponent(g)}" aria-label="Lihat manhwa genre ${esc(g)}">${esc(g)}</a>`).join('');
  const authors = (d.authors || []).join(', ');
  const status = d.status || '';
  const year = d.release_year || '';
  const rate = d.user_rate != null && d.user_rate > 0 ? String(d.user_rate) : '';

  const letter = (d.title || 'K').charAt(0).toUpperCase();
  let order = getSort(); // desc = terbaru dulu (default)
  const sorted = () => (order === 'desc' ? d.chapters.slice() : d.chapters.slice().reverse());

  const dlBtn = (c) => {
    const done = isDownloaded(c.url);
    return `<button type="button" class="ch-dl${done ? ' is-done' : ''}" data-dl="${esc(c.url)}"
      aria-label="${done ? 'Hapus unduhan' : 'Unduh chapter'}">${done ? ico.done() : ico.download()}</button>`;
  };

  const rowHtml = (c) => {
    const time = relative(c.release_date);
    return `<div class="ch-row${readSet.has(c.url) ? ' is-read' : ''}" data-ch="${esc(c.title)}">
      <a class="ch-row__link" href="${link('read', c.url)}">
        ${thumbBox(c.url, letter, c.thumbnail)}
        <div class="ch-row__info">
          <div class="ch-row__name">${esc(c.title)}</div>
          ${time ? `<div class="ch-row__time">${esc(time)}</div>` : ''}
        </div>
      </a>
      ${dlBtn(c)}
    </div>`;
  };

  // desc = terbaru dulu → chevron bawah; asc = terlama dulu → chevron atas
  const sortIcon = () => (order === 'desc' ? ico.chevronDown() : ico.chevronUp());

  root.innerHTML = `
    <article class="detail">
      <div class="detail__hero">
        <img class="detail__hero-bg" src="${esc(img(d.poster))}" alt="" aria-hidden="true">
        <div class="detail__hero-fade"></div>
        <div class="detail__hero-actions">
          <a class="detail__icon-btn" href="/" aria-label="Kembali">
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
          <div class="detail__desc-wrap" id="desc-wrap">
            <p class="detail__desc is-clamp" id="desc">${esc(d.description)}</p>
            <button type="button" class="detail__desc-toggle" id="desc-toggle" aria-expanded="false" aria-label="Selengkapnya" hidden>
              <svg class="detail__desc-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m7 10 5 5 5-5" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        ` : ''}

        ${genres ? `<div class="detail__tags">${genres}</div>` : ''}

        <div class="detail__chapters-head">
          <h2>Chapters</h2>
          <span style="font-size:12px;color:var(--dim)">${d.total_chapters || 0}</span>
        </div>
        <div class="detail__ch-search">
          <label class="ch-search">
            ${ico.search(16)}
            <input type="search" id="ch-filter" placeholder="Cari chapter…" autocomplete="off">
          </label>
          <button type="button" class="ch-tool ch-tool--round" id="ch-sort" aria-label="Urutkan chapter" title="Urutkan">
            ${sortIcon()}
          </button>
          <button type="button" class="ch-tool ch-tool--round" id="ch-dl-all" aria-label="Unduh semua chapter" title="Unduh semua">
            ${ico.downloadAll()}
          </button>
        </div>
        <div class="chapters" id="ch-list"></div>

        ${startUrl ? `
          <div class="detail__start">
            <a class="detail__start-link" href="${link('read', startUrl)}" aria-label="${startLabel}: ${startSub || d.title}">
              <span class="detail__start-play" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M8 5.8c0-.8.9-1.3 1.6-.9l9.2 5.3a1 1 0 0 1 0 1.7l-9.2 5.3c-.7.4-1.6-.1-1.6-.9V5.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
              </span>
              <span class="detail__start-copy">
                <span class="detail__start-title">${startLabel === 'Mulai Baca' ? 'Mulai Membaca' : startLabel}</span>
                <span class="detail__start-sub">${esc(startSub || 'Chapter 1')}</span>
              </span>
              <span class="detail__start-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
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
  const descWrap = document.getElementById('desc-wrap');
  if (desc && descToggle) {
    requestAnimationFrame(() => {
      const clipped = desc.scrollHeight > desc.clientHeight + 4;
      descToggle.hidden = !clipped;
      if (clipped) descWrap?.classList.add('has-toggle');
    });
    descToggle.addEventListener('click', () => {
      const clamped = desc.classList.toggle('is-clamp');
      descToggle.setAttribute('aria-expanded', String(!clamped));
      descToggle.setAttribute('aria-label', clamped ? 'Selengkapnya' : 'Sembunyikan');
      descWrap?.classList.toggle('is-open', !clamped);
    });
  }

  const list = document.getElementById('ch-list');
  const filter = document.getElementById('ch-filter');
  const sortBtn = document.getElementById('ch-sort');
  const allBtn = document.getElementById('ch-dl-all');
  let io = null;

  const applyFilter = () => {
    const q = filter.value.trim().toLowerCase();
    list.querySelectorAll('.ch-row').forEach((r) => {
      r.style.display = !q || (r.dataset.ch || '').toLowerCase().includes(q) ? '' : 'none';
    });
  };

  const renderList = () => {
    if (io) io.disconnect();
    list.innerHTML = sorted().map(rowHtml).join('');
    applyFilter();
    io = watchThumbs(list, alive);
  };
  renderList();

  sortBtn.addEventListener('click', () => {
    order = order === 'desc' ? 'asc' : 'desc';
    setSort(order);
    sortBtn.innerHTML = sortIcon();
    renderList();
  });
  filter.addEventListener('input', applyFilter);

  // ---- Download ----
  const jobs = new Map(); // url -> AbortController
  const paintDl = (url, st, pct = 0) => {
    const b = list.querySelector(`[data-dl="${CSS.escape(url)}"]`);
    if (!b) return;
    b.classList.toggle('is-busy', st === 'busy');
    b.classList.toggle('is-done', st === 'done');
    b.innerHTML = st === 'busy' ? ring(pct) : st === 'done' ? ico.done() : ico.download();
    b.setAttribute('aria-label', st === 'done' ? 'Hapus unduhan' : st === 'busy' ? 'Batalkan unduhan' : 'Unduh chapter');
  };

  const run = async (url) => {
    const ctl = new AbortController();
    jobs.set(url, ctl);
    paintDl(url, 'busy', 0);
    try {
      await downloadChapter(url, (p) => paintDl(url, 'busy', p), ctl.signal);
      paintDl(url, 'done');
      return true;
    } catch (e) {
      await removeChapter(url);
      paintDl(url, 'idle');
      if (e.name !== 'AbortError') alert(e.message || 'Gagal mengunduh');
      return false;
    } finally {
      jobs.delete(url);
    }
  };

  list.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-dl]');
    if (!b) return;
    const url = b.dataset.dl;
    if (!supported()) { alert('Download butuh HTTPS atau localhost.'); return; }
    if (jobs.has(url)) { jobs.get(url).abort(); return; }
    if (isDownloaded(url)) {
      if (confirm('Hapus unduhan chapter ini?')) { await removeChapter(url); paintDl(url, 'idle'); }
      return;
    }
    run(url);
  });

  let bulk = null;
  allBtn.addEventListener('click', async () => {
    if (bulk) { bulk.cancel = true; jobs.forEach((c) => c.abort()); return; }
    if (!supported()) { alert('Download butuh HTTPS atau localhost.'); return; }
    const todo = sorted().filter((c) => !isDownloaded(c.url));
    if (!todo.length) { alert('Semua chapter sudah diunduh.'); return; }
    if (!confirm(`Unduh ${todo.length} chapter? Ini bisa memakan banyak penyimpanan.`)) return;
    bulk = { cancel: false };
    allBtn.classList.add('is-busy');
    let n = 0;
    for (const c of todo) {
      if (bulk.cancel || !alive()) break;
      allBtn.innerHTML = `<span class="ch-tool__count">${n}/${todo.length}</span>`;
      // eslint-disable-next-line no-await-in-loop
      await run(c.url);
      n += 1;
    }
    bulk = null;
    allBtn.classList.remove('is-busy');
    allBtn.innerHTML = ico.downloadAll();
  });
}
