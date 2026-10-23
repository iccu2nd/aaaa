import { navigate as navigateTo } from '../router.js';
import { api } from '../api.js';
import { card } from '../components/card.js';
import { esc } from '../utils.js';

const SIZE = 24;
const GENRES = ['Action','Adaptation','Adult','Adventure','Comedy','Cooking','Crime','Demon','Demons','Drama','Ecchi','Fantasy','Fight','Fighting','Game','Gender Bender','Harem','Historical','Horror','Isekai','Josei','Latest','Love','Magic','Martial Arts','Mature','Mecha','Medical','Murin','Mystery','Philosophical','Psychological','Regression','Reincarnation','Revenge','Romance','School Life','Sci-fi','Seinen','Shoujo','Shounen','Slice of Life','Smut','Sports','Supernatural','Supernatural','Thriller','Tragedy','Violence','Wuxia'];
const icon = (name) => ({
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>',
  filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6.3 7.2v5.4l-3.4 1.8v-7.2L4 5z"/></svg>',
  sort: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
})[name];
const fmt = (n) => Number(n || 0).toLocaleString('id-ID');

export async function explore({ root, alive }, q = '', genre = '', sortMode = 'popular') {
  let currentQuery = q;
  let currentGenres = String(genre || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
  let sort = sortMode;
  const genreKey = () => currentGenres.join(',');
  const title = () => currentGenres.length
    ? `Genre: ${currentGenres.join(', ')}`
    : currentQuery ? 'Hasil pencarian' : 'Jelajahi manhwa';
  const apiUrl = (page) => `/api/explore?q=${encodeURIComponent(currentQuery)}&genre=${encodeURIComponent(genreKey())}&page=${page}&size=${SIZE}`;

  root.innerHTML = `
    <section class="section search-page">
      <div class="search-tools">
        <form class="search-tools__form ${q ? 'is-open' : ''}" id="explore-search-form" role="search">
          <input id="explore-search-input" type="search" placeholder="Cari judul manhwa…" autocomplete="off" value="${esc(q)}" aria-label="Cari judul manhwa">
          <button type="button" id="search-clear" aria-label="Hapus pencarian" ${q ? '' : 'hidden'}>${icon('close')}</button>
        </form>
        <button class="search-tools__icon ${currentGenres.length ? 'is-active' : ''}" id="genre-open" type="button" aria-label="Filter genre" aria-expanded="false">${icon('filter')}</button>
        <button class="search-tools__icon" id="sort-toggle" type="button" aria-label="Urutkan judul" title="Urutkan judul">${icon('sort')}</button>
        <button class="search-tools__icon" id="search-expand" type="button" aria-label="Buka pencarian" aria-expanded="${!!q}">${icon('search')}</button>
      </div>
      <div class="search-active-filter" id="search-active-filter" ${currentGenres.length ? '' : 'hidden'}><span>${esc(currentGenres.join(', '))}</span><button id="genre-remove" type="button" aria-label="Hapus filter genre">${icon('close')}</button></div>
      <div class="section__head search-page__heading"><h1 id="search-title">${esc(title())}</h1><span class="section__count" id="ex-count"></span></div>
      <div class="grid explore-grid" id="ex-grid">${'<div class="explore-skeleton loading-surface"></div>'.repeat(8)}</div>
      <div class="state" id="ex-end"></div>
    </section>
    <div class="genre-sheet-backdrop" id="genre-backdrop" hidden></div>
    <section class="genre-sheet" id="genre-sheet" role="dialog" aria-modal="true" aria-label="Filter genre" hidden>
      <div class="genre-sheet__handle"></div>
      <div class="genre-sheet__head"><h2>Genre</h2><button type="button" id="genre-close" aria-label="Tutup filter">${icon('close')}</button></div>
      <div class="genre-sheet__chips" id="genre-chips">${[...new Set(GENRES)].map((g) => {
        const on = currentGenres.some((x) => x.toLowerCase() === g.toLowerCase());
        return `<button type="button" class="genre-chip ${on ? 'is-selected' : ''}" data-genre="${esc(g)}" aria-pressed="${on}">${esc(g)}</button>`;
      }).join('')}</div>
      <div class="genre-sheet__actions"><button type="button" class="btn btn--secondary" id="genre-reset">Reset</button><button type="button" class="btn btn--brand" id="genre-apply">Terapkan</button></div>
    </section>`;

  const searchInput = root.querySelector('#explore-search-input');
  const searchForm = root.querySelector('#explore-search-form');
  const searchExpand = root.querySelector('#search-expand');
  const searchClear = root.querySelector('#search-clear');
  const grid = root.querySelector('#ex-grid');
  const end = root.querySelector('#ex-end');
  const count = root.querySelector('#ex-count');
  const heading = root.querySelector('#search-title');
  const sheet = root.querySelector('#genre-sheet');
  const backdrop = root.querySelector('#genre-backdrop');
  const activeFilter = root.querySelector('#search-active-filter');
  let draftGenres = [...currentGenres];
  let seen = new Set();
  let page = 0, pages = 1, loading = false, io = null, requestId = 0;

  const paintChips = () => {
    const set = new Set(draftGenres.map((g) => g.toLowerCase()));
    root.querySelectorAll('.genre-chip').forEach((b) => {
      const on = set.has(b.dataset.genre.toLowerCase());
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
  };
  const closeSheet = () => { sheet.hidden = true; backdrop.hidden = true; root.querySelector('#genre-open').setAttribute('aria-expanded', 'false'); };
  const openSheet = () => {
    draftGenres = [...currentGenres];
    paintChips();
    sheet.hidden = false;
    backdrop.hidden = false;
    root.querySelector('#genre-open').setAttribute('aria-expanded', 'true');
  };
  const updateTitle = () => {
    heading.textContent = title();
    activeFilter.hidden = !currentGenres.length;
    activeFilter.querySelector('span').textContent = currentGenres.join(', ');
    root.querySelector('#genre-open').classList.toggle('is-active', currentGenres.length > 0);
  };

  searchExpand.addEventListener('click', () => {
    const opened = searchForm.classList.toggle('is-open');
    searchExpand.setAttribute('aria-expanded', String(opened));
    if (opened) searchInput.focus();
  });
  searchForm.addEventListener('submit', (e) => { e.preventDefault(); currentQuery = searchInput.value.trim(); navigate(); });
  searchInput.addEventListener('input', () => { searchClear.hidden = !searchInput.value; });
  searchClear.addEventListener('click', () => { searchInput.value = ''; searchClear.hidden = true; currentQuery = ''; navigate(); });
  root.querySelector('#genre-open').addEventListener('click', openSheet);
  root.querySelector('#genre-close').addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
  root.querySelector('#genre-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-genre]'); if (!b) return;
    const name = b.dataset.genre;
    const i = draftGenres.findIndex((g) => g.toLowerCase() === name.toLowerCase());
    if (i >= 0) draftGenres.splice(i, 1);
    else draftGenres.push(name);
    paintChips();
  });
  root.querySelector('#genre-reset').addEventListener('click', () => { draftGenres = []; paintChips(); });
  root.querySelector('#genre-apply').addEventListener('click', () => { currentGenres = [...draftGenres]; closeSheet(); navigate(); });
  root.querySelector('#genre-remove').addEventListener('click', () => { currentGenres = []; navigate(); });
  root.querySelector('#sort-toggle').addEventListener('click', () => { sort = sort === 'popular' ? 'title' : 'popular'; root.querySelector('#sort-toggle').classList.toggle('is-active', sort === 'title'); root.querySelector('#sort-toggle').title = sort === 'title' ? 'Urutan: judul' : 'Urutan: default'; navigate(); });

  function navigate() {
    const params = new URLSearchParams();
    if (currentQuery) params.set('q', currentQuery);
    if (currentGenres.length) params.set('genre', currentGenres.join(','));
    if (sort === 'title') params.set('sort', 'title');
    const next = '/search' + (params.size ? '?' + params.toString() : '');
    const current = location.pathname + location.search;
    if (current === next) loadResults(); else navigateTo(next, { scroll: false });
  }

  async function loadResults() {
    if (io) io.disconnect();
    requestId += 1; const myRequest = requestId;
    seen = new Set(); page = 0; pages = 1; loading = false;
    updateTitle(); grid.innerHTML = '<div class="explore-skeleton loading-surface"></div>'.repeat(8); end.textContent = '';
    const url = (n) => `/api/explore?q=${encodeURIComponent(currentQuery)}&genre=${encodeURIComponent(genreKey())}&page=${n}&size=${SIZE}`;
    try {
      const first = await api(url(1));
      if (!alive() || myRequest !== requestId) return;
      grid.innerHTML = '';
      if (!first.items?.length) { end.textContent = currentGenres.length ? `Belum ada judul untuk genre: ${currentGenres.join(', ')}.` : 'Tidak ada hasil yang cocok.'; count.textContent = '0 judul'; return; }
      const add = (data) => { const fresh = data.items.filter((c) => c?.url && !seen.has(c.url) && seen.add(c.url)); grid.insertAdjacentHTML('beforeend', fresh.map(card).join('')); count.textContent = `${fmt(data.total)} judul`; };
      if (sort === 'title') first.items.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'id'));
      add(first); page = 1; pages = first.pages || 1;
      if (page >= pages) { end.textContent = ''; return; }
      io = new IntersectionObserver(async (entries) => {
        if (!entries.some((e) => e.isIntersecting) || loading || page >= pages || !alive() || myRequest !== requestId) return;
        loading = true; end.innerHTML = '<div class="inline-loading" aria-label="Memuat judul"><i></i><i></i><i></i></div>';
        try { const data = await api(url(page + 1)); if (!alive() || myRequest !== requestId) return; if (sort === 'title') data.items.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'id')); add(data); page += 1; pages = data.pages || pages; end.textContent = ''; if (page >= pages) io?.disconnect(); }
        catch { end.textContent = 'Gagal memuat. Gulir lagi untuk mencoba.'; }
        finally { loading = false; }
      }, { rootMargin: '450px 0px' });
      io.observe(end);
    } catch (e) {
      if (!alive() || myRequest !== requestId) return;
      grid.innerHTML = ''; end.innerHTML = `${esc(e.message || 'Gagal memuat katalog')} · <button type="button" class="text-action" id="ex-retry">Coba lagi</button>`;
      root.querySelector('#ex-retry')?.addEventListener('click', loadResults);
    }
  }

  // Preserve filter and search state when entering through a genre link.
  if (q) { searchForm.classList.add('is-open'); searchExpand.setAttribute('aria-expanded', 'true'); searchClear.hidden = false; }
  updateTitle();
  await loadResults();
}
