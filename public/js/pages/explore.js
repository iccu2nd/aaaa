import { navigate as navigateTo } from '../router.js';
import { api } from '../api.js';
import { card } from '../components/card.js';
import { esc } from '../utils.js';

const SIZE = 24;
const GENRES = ['Action','Adaptation','Adult','Adventure','Comedy','Cooking','Crime','Drama','Ecchi','Fantasy','Harem','Historical','Horror','Isekai','Martial Arts','Mature','Mystery','Psychological','Reincarnation','Revenge','Romance','School Life','Sci-fi','Seinen','Shoujo','Shounen','Slice of Life','Sports','Supernatural','Thriller','Tragedy'];
const FORMATS = [
  { id: '', label: 'All' },
  { id: 'manhwa', label: 'Manhwa' },
  { id: 'manhua', label: 'Manhua' },
  { id: 'manga', label: 'Manga' },
];
const icon = (name) => ({
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>',
  filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6.3 7.2v5.4l-3.4 1.8v-7.2L4 5z"/></svg>',
  sort: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h12M8 12h12M8 17h12"/><path d="M4 7h.01M4 12h.01M4 17h.01"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
})[name];
const fmt = (n) => Number(n || 0).toLocaleString('id-ID');

export async function explore({ root, alive }, q = '', genre = '', sortMode = 'latest', format = '') {
  let currentQuery = q;
  let currentGenres = String(genre || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
  let sort = sortMode === 'title' ? 'title' : 'latest';
  let currentFormat = String(format || '').trim().toLowerCase();
  const genreKey = () => currentGenres.join(',');

  const topGenres = ['Action', 'Adaptation', 'Adult', 'Adventure', 'Romance', 'Fantasy', 'Comedy'];

  root.innerHTML = `
    <section class="section explore-page">
      <form class="explore-search" id="explore-search-form" role="search">
        <span class="explore-search__ico" aria-hidden="true">${icon('search')}</span>
        <input id="explore-search-input" type="search" placeholder="Search manga, manhwa, manhua" autocomplete="off" value="${esc(q)}" aria-label="Cari judul">
        <button type="button" id="search-clear" class="explore-search__clear" aria-label="Hapus" ${q ? '' : 'hidden'}>${icon('close')}</button>
      </form>

      <div class="explore-formats" id="format-row" role="tablist" aria-label="Format">
        ${FORMATS.map((f) => `
          <button type="button" class="explore-chip explore-chip--format ${currentFormat === f.id ? 'is-active' : ''}" data-format="${f.id}" role="tab" aria-selected="${currentFormat === f.id}">${f.label}</button>
        `).join('')}
      </div>

      <div class="explore-genres" id="genre-row">
        <button type="button" class="explore-chip explore-chip--filter ${currentGenres.length ? 'is-active' : ''}" id="genre-open" aria-label="Filter genre" aria-expanded="false">${icon('filter')}<span>Filters</span></button>
        ${topGenres.map((g) => {
          const on = currentGenres.some((x) => x.toLowerCase() === g.toLowerCase());
          return `<button type="button" class="explore-chip ${on ? 'is-active' : ''}" data-quick-genre="${esc(g)}">${esc(g)}</button>`;
        }).join('')}
      </div>

      <div class="explore-toolbar">
        <span class="explore-toolbar__label" id="explore-scope">${currentGenres.length || currentFormat ? 'Filtered' : 'All types'}</span>
        <button type="button" class="explore-toolbar__sort" id="sort-toggle" title="Urutkan">
          <span aria-hidden="true">↕</span>
          <span id="sort-label">${sort === 'title' ? 'A–Z' : 'Latest update'}</span>
        </button>
      </div>

      <div class="grid explore-grid" id="ex-grid">${'<div class="explore-skeleton loading-surface"></div>'.repeat(9)}</div>
      <div class="state" id="ex-end"></div>
      <p class="explore-count" id="ex-count" hidden></p>
    </section>

    <div class="genre-sheet-backdrop" id="genre-backdrop" hidden></div>
    <section class="genre-sheet" id="genre-sheet" role="dialog" aria-modal="true" aria-label="Filter genre" hidden>
      <div class="genre-sheet__handle"></div>
      <div class="genre-sheet__head"><h2>Filter komik</h2><button type="button" id="genre-close" aria-label="Tutup filter">${icon('close')}</button></div>
      <div class="genre-sheet__head"><h2>Genre</h2></div>
      <div class="genre-sheet__chips" id="genre-chips">${[...new Set(GENRES)].map((g) => {
        const on = currentGenres.some((x) => x.toLowerCase() === g.toLowerCase());
        return `<button type="button" class="genre-chip ${on ? 'is-selected' : ''}" data-genre="${esc(g)}" aria-pressed="${on}">${esc(g)}</button>`;
      }).join('')}</div>
      <div class="genre-sheet__actions"><button type="button" class="btn btn--secondary" id="genre-reset">Reset</button><button type="button" class="btn btn--brand" id="genre-apply">Terapkan</button></div>
    </section>`;

  const searchInput = root.querySelector('#explore-search-input');
  const searchForm = root.querySelector('#explore-search-form');
  const searchClear = root.querySelector('#search-clear');
  const grid = root.querySelector('#ex-grid');
  const end = root.querySelector('#ex-end');
  const count = root.querySelector('#ex-count');
  const sheet = root.querySelector('#genre-sheet');
  const backdrop = root.querySelector('#genre-backdrop');
  let draftGenres = [...currentGenres];
  let seen = new Set();
  let page = 0;
  let pages = 1;
  let loading = false;
  let io = null;
  let requestId = 0;

  const navigate = () => {
    const params = new URLSearchParams();
    if (currentQuery) params.set('q', currentQuery);
    if (currentGenres.length) params.set('genre', currentGenres.join(','));
    if (currentFormat) params.set('format', currentFormat);
    if (sort === 'title') params.set('sort', 'title');
    const qs = params.toString();
    navigateTo(qs ? `/search?${qs}` : '/search');
  };

  const paintQuick = () => {
    root.querySelectorAll('[data-format]').forEach((b) => {
      const on = b.dataset.format === currentFormat;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    root.querySelectorAll('[data-quick-genre]').forEach((b) => {
      const on = currentGenres.some((g) => g.toLowerCase() === b.dataset.quickGenre.toLowerCase());
      b.classList.toggle('is-active', on);
    });
    const filterBtn = root.querySelector('#genre-open');
    filterBtn?.classList.toggle('is-active', currentGenres.length > 0);
    const scope = root.querySelector('#explore-scope');
    if (scope) scope.textContent = currentGenres.length || currentFormat ? 'Filtered' : 'All types';
    const sortLabel = root.querySelector('#sort-label');
    if (sortLabel) sortLabel.textContent = sort === 'title' ? 'A–Z' : 'Latest update';
  };

  const openSheet = () => {
    draftGenres = [...currentGenres];
    root.querySelectorAll('#genre-chips [data-genre]').forEach((b) => {
      const on = draftGenres.some((g) => g.toLowerCase() === b.dataset.genre.toLowerCase());
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
    sheet.hidden = false;
    backdrop.hidden = false;
    root.querySelector('#genre-open')?.setAttribute('aria-expanded', 'true');
  };
  const closeSheet = () => {
    sheet.hidden = true;
    backdrop.hidden = true;
    root.querySelector('#genre-open')?.setAttribute('aria-expanded', 'false');
  };

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    currentQuery = searchInput.value.trim();
    navigate();
  });
  searchInput.addEventListener('input', () => { searchClear.hidden = !searchInput.value; });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.hidden = true;
    currentQuery = '';
    navigate();
  });

  root.querySelector('#format-row')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-format]');
    if (!b) return;
    currentFormat = b.dataset.format || '';
    paintQuick();
    navigate();
  });

  root.querySelector('#genre-row')?.addEventListener('click', (e) => {
    const quick = e.target.closest('[data-quick-genre]');
    if (quick) {
      const name = quick.dataset.quickGenre;
      const i = currentGenres.findIndex((g) => g.toLowerCase() === name.toLowerCase());
      if (i >= 0) currentGenres.splice(i, 1);
      else currentGenres = [name]; // single select quick for simplicity
      paintQuick();
      navigate();
      return;
    }
    if (e.target.closest('#genre-open')) openSheet();
  });

  root.querySelector('#genre-close')?.addEventListener('click', closeSheet);
  backdrop?.addEventListener('click', closeSheet);
  root.querySelector('#genre-chips')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-genre]');
    if (!b) return;
    const name = b.dataset.genre;
    const i = draftGenres.findIndex((g) => g.toLowerCase() === name.toLowerCase());
    if (i >= 0) draftGenres.splice(i, 1);
    else draftGenres.push(name);
    b.classList.toggle('is-selected');
    b.setAttribute('aria-pressed', String(b.classList.contains('is-selected')));
  });
  root.querySelector('#genre-reset')?.addEventListener('click', () => {
    draftGenres = [];
    root.querySelectorAll('#genre-chips [data-genre]').forEach((b) => {
      b.classList.remove('is-selected');
      b.setAttribute('aria-pressed', 'false');
    });
  });
  root.querySelector('#genre-apply')?.addEventListener('click', () => {
    currentGenres = [...draftGenres];
    closeSheet();
    paintQuick();
    navigate();
  });
  root.querySelector('#sort-toggle')?.addEventListener('click', () => {
    sort = sort === 'title' ? 'latest' : 'title';
    paintQuick();
    navigate();
  });

  async function loadResults() {
    io?.disconnect();
    requestId += 1;
    const myRequest = requestId;
    seen = new Set();
    page = 0;
    pages = 1;
    loading = false;
    paintQuick();
    grid.innerHTML = '<div class="explore-skeleton loading-surface"></div>'.repeat(9);
    end.textContent = '';
    count.hidden = true;
    const url = (n) =>
      `/api/explore?q=${encodeURIComponent(currentQuery)}&genre=${encodeURIComponent(genreKey())}&format=${encodeURIComponent(currentFormat)}&page=${n}&size=${SIZE}`;
    try {
      const first = await api(url(1));
      if (!alive() || myRequest !== requestId) return;
      grid.innerHTML = '';
      if (!first.items?.length) {
        end.textContent = currentGenres.length
          ? `Belum ada judul untuk genre: ${currentGenres.join(', ')}.`
          : 'Tidak ada hasil yang cocok.';
        count.textContent = '0 judul';
        count.hidden = false;
        return;
      }
      const add = (data) => {
        let items = data.items.filter((c) => c?.url && !seen.has(c.url) && seen.add(c.url));
        if (sort === 'title') {
          items = items.slice().sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'id'));
        }
        grid.insertAdjacentHTML('beforeend', items.map(card).join(''));
        count.textContent = `${fmt(data.total)} judul`;
        count.hidden = false;
      };
      if (sort === 'title') first.items.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'id'));
      add(first);
      page = 1;
      pages = first.pages || 1;
      if (page >= pages) return;
      io = new IntersectionObserver(async (entries) => {
        if (!entries.some((e) => e.isIntersecting) || loading || page >= pages || !alive() || myRequest !== requestId) return;
        loading = true;
        end.innerHTML = '<div class="inline-loading" aria-label="Memuat judul"><i></i><i></i><i></i></div>';
        try {
          const data = await api(url(page + 1));
          if (!alive() || myRequest !== requestId) return;
          add(data);
          page += 1;
          pages = data.pages || pages;
          end.textContent = '';
          if (page >= pages) io?.disconnect();
        } catch {
          end.textContent = 'Gagal memuat. Gulir lagi untuk mencoba.';
        } finally {
          loading = false;
        }
      }, { rootMargin: '450px 0px' });
      io.observe(end);
    } catch (e) {
      if (!alive() || myRequest !== requestId) return;
      grid.innerHTML = '';
      end.innerHTML = `${esc(e.message || 'Gagal memuat katalog')} · <button type="button" class="text-action" id="ex-retry">Coba lagi</button>`;
      root.querySelector('#ex-retry')?.addEventListener('click', loadResults);
    }
  }

  paintQuick();
  await loadResults();
}
