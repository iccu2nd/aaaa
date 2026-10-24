import { navigate as navigateTo } from '../router.js';
import { api } from '../api.js';
import { richCardAt } from '../components/card.js';
import { esc, link, img } from '../utils.js';

const SIZE = 18;
const card = (c) => richCardAt(c, 240);
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
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  sort: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h11M8 12h8M8 16h5"/><path d="M5 7v10M5 7l-1.5 2M5 7l1.5 2M5 17l-1.5-2M5 17l1.5-2"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l2.5 1.5"/></svg>',
  fire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c2 3 3 4.5 3 7a3 3 0 0 1-6 0c0-1.5.5-2.8 1.2-4C9 8 8 9.2 8 11.5A4.5 4.5 0 0 0 12.5 16c2.5 0 4.5-2 4.5-4.8 0-3.2-2-5.7-5-8.2z"/></svg>',
})[name];
const fmt = (n) => Number(n || 0).toLocaleString('id-ID');

export async function explore({ root, alive }, q = '', genre = '', sortMode = 'latest', format = '', mode = 'browse') {
  const isSearchMode = mode === 'search';
  let currentQuery = q;
  let currentGenres = String(genre || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
  let sort = sortMode === 'popular' ? 'popular' : sortMode === 'title' ? 'title' : 'latest';
  let currentFormat = String(format || '').trim().toLowerCase();
  const genreKey = () => currentGenres.join(',');
  const topGenres = ['Action', 'Comedy', 'Adaptation', 'Adventure', 'Romance', 'Fantasy', 'Drama'];

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
        <button type="button" class="explore-chip explore-chip--filter ${currentGenres.length ? 'is-active' : ''}" id="genre-open" aria-label="Filter genre" aria-expanded="false">
          ${icon('filter')}<span id="filters-label">Filters${currentGenres.length ? ` · ${currentGenres.length}` : ''}</span>
        </button>
        ${topGenres.map((g) => {
          const on = currentGenres.some((x) => x.toLowerCase() === g.toLowerCase());
          return `<button type="button" class="explore-chip ${on ? 'is-active' : ''}" data-quick-genre="${esc(g)}">${on ? icon('check') : ''}<span>${esc(g)}</span></button>`;
        }).join('')}
      </div>

      <div class="explore-toolbar">
        <span class="explore-toolbar__label" id="explore-scope"></span>
        <div class="explore-sort">
          <button type="button" class="explore-toolbar__sort" id="sort-toggle" aria-haspopup="listbox" aria-expanded="false">
            <span class="explore-toolbar__sort-ico" aria-hidden="true">${icon('sort')}</span>
            <span id="sort-label">${sort === 'popular' ? 'Most popular' : 'Latest update'}</span>
          </button>
          <div class="explore-sort__menu" id="sort-menu" hidden role="listbox">
            <button type="button" role="option" data-sort="latest" class="explore-sort__opt ${sort !== 'popular' ? 'is-selected' : ''}">
              <span class="explore-sort__opt-main">${icon('clock')}<span>Latest update</span></span>
              <span class="explore-sort__opt-check" aria-hidden="true">${sort !== 'popular' ? icon('check') : ''}</span>
            </button>
            <button type="button" role="option" data-sort="popular" class="explore-sort__opt ${sort === 'popular' ? 'is-selected' : ''}">
              <span class="explore-sort__opt-main">${icon('fire')}<span>Most popular</span></span>
              <span class="explore-sort__opt-check" aria-hidden="true">${sort === 'popular' ? icon('check') : ''}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="grid explore-grid" id="ex-grid">${'<div class="explore-skeleton loading-surface"></div>'.repeat(9)}</div>
      <div class="state" id="ex-end"></div>
      <p class="explore-count" id="ex-count" hidden></p>
    </section>

    <div class="genre-sheet-backdrop" id="genre-backdrop" hidden></div>
    <section class="genre-sheet" id="genre-sheet" role="dialog" aria-modal="true" aria-label="Filter genre" hidden>
      <div class="genre-sheet__handle"></div>
      <div class="genre-sheet__head"><h2>Filter komik</h2><button type="button" id="genre-close" aria-label="Tutup filter">${icon('close')}</button></div>
      <p class="genre-sheet__hint">Pilih satu atau lebih genre</p>
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
  const sortMenu = root.querySelector('#sort-menu');
  const sortToggle = root.querySelector('#sort-toggle');
  let draftGenres = [...currentGenres];
  let seen = new Set();
  let page = 0;
  let pages = 1;
  let loading = false;
  let io = null;
  let requestId = 0;

  const basePath = isSearchMode ? '/search' : '/explore';
  const navigate = () => {
    const params = new URLSearchParams();
    if (currentQuery) params.set('q', currentQuery);
    if (currentGenres.length) params.set('genre', currentGenres.join(','));
    if (currentFormat) params.set('format', currentFormat);
    params.set('sort', sort === 'popular' ? 'popular' : 'latest');
    const qs = params.toString();
    navigateTo(qs ? `${basePath}?${qs}` : basePath);
  };

  const paintQuick = () => {
    root.querySelectorAll('#format-row [data-format]').forEach((b) => {
      const on = b.dataset.format === currentFormat;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });

    // rebuild quick genre chips to show checks
    const row = root.querySelector('#genre-row');
    if (row) {
      const filterBtn = row.querySelector('#genre-open');
      const chips = topGenres.map((g) => {
        const on = currentGenres.some((x) => x.toLowerCase() === g.toLowerCase());
        return `<button type="button" class="explore-chip ${on ? 'is-active' : ''}" data-quick-genre="${esc(g)}">${on ? icon('check') : ''}<span>${esc(g)}</span></button>`;
      }).join('');
      row.innerHTML = `
        <button type="button" class="explore-chip explore-chip--filter ${currentGenres.length ? 'is-active' : ''}" id="genre-open" aria-label="Filter genre" aria-expanded="false">
          ${icon('filter')}<span id="filters-label">Filters${currentGenres.length ? ` · ${currentGenres.length}` : ''}</span>
        </button>${chips}`;
      row.querySelector('#genre-open')?.addEventListener('click', openSheet);
    }

    const scope = root.querySelector('#explore-scope');
    if (scope) {
      const parts = ['All types'];
      if (currentFormat) parts.push(currentFormat[0].toUpperCase() + currentFormat.slice(1));
      currentGenres.forEach((g) => parts.push(g));
      scope.textContent = parts.join(' · ');
    }
    const sortLabel = root.querySelector('#sort-label');
    if (sortLabel) sortLabel.textContent = sort === 'popular' ? 'Most popular' : 'Latest update';
    const menu = root.querySelector('#sort-menu');
    if (menu) {
      menu.innerHTML = `
        <button type="button" role="option" data-sort="latest" class="explore-sort__opt ${sort !== 'popular' ? 'is-selected' : ''}">
          <span class="explore-sort__opt-main">${icon('clock')}<span>Latest update</span></span>
          <span class="explore-sort__opt-check">${sort !== 'popular' ? icon('check') : ''}</span>
        </button>
        <button type="button" role="option" data-sort="popular" class="explore-sort__opt ${sort === 'popular' ? 'is-selected' : ''}">
          <span class="explore-sort__opt-main">${icon('fire')}<span>Most popular</span></span>
          <span class="explore-sort__opt-check">${sort === 'popular' ? icon('check') : ''}</span>
        </button>`;
    }
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
  };
  const closeSheet = () => {
    sheet.hidden = true;
    backdrop.hidden = true;
  };

  const listRow = (c) => {
    const type = c.type || c.format || c.source || 'Manhwa';
    const ch = c.latest_chapter != null ? `Ch. ${c.latest_chapter}` : (c.chapter || '');
    const cover = c.poster || c.cover || c.thumbnail || '';
    return `<a class="search-hit" href="${link('detail', c.url)}">
      <img class="search-hit__cover" src="${esc(img(cover, 120))}" alt="" loading="lazy" decoding="async">
      <span class="search-hit__body">
        <span class="search-hit__title">${esc(c.title || '')}</span>
        <span class="search-hit__meta">${esc(type)}${ch ? ` · ${esc(ch)}` : ''}</span>
      </span>
      <span class="search-hit__chev" aria-hidden="true">›</span>
    </a>`;
  };

  let debounceTimer = 0;
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    currentQuery = searchInput.value.trim();
    navigate();
  });
  searchInput.addEventListener('input', () => {
    searchClear.hidden = !searchInput.value;
    const next = searchInput.value.trim();
    window.clearTimeout(debounceTimer);
    // live search tanpa reload halaman — debounce pendek
    debounceTimer = window.setTimeout(() => {
      if (next === currentQuery) return;
      currentQuery = next;
      // update URL diam-diam agar back/share tetap benar
      const params = new URLSearchParams();
      if (currentQuery) params.set('q', currentQuery);
      if (currentGenres.length) params.set('genre', currentGenres.join(','));
      if (currentFormat) params.set('format', currentFormat);
      params.set('sort', sort === 'popular' ? 'popular' : 'latest');
      const qs = params.toString();
      const path = qs ? `${basePath}?${qs}` : basePath;
      try { history.replaceState(history.state, '', path); } catch { /* ignore */ }
      loadResults();
    }, 300);
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.hidden = true;
    currentQuery = '';
    navigate();
  });
  // auto-focus hanya dari ikon search Home
  if (isSearchMode) {
    requestAnimationFrame(() => {
      searchInput.focus({ preventScroll: true });
    });
  }

  root.querySelector('#format-row')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-format]');
    if (!b) return;
    currentFormat = b.dataset.format || '';
    paintQuick();
    navigate();
  });

  root.querySelector('#genre-row')?.addEventListener('click', (e) => {
    if (e.target.closest('#genre-open')) {
      openSheet();
      return;
    }
    const quick = e.target.closest('[data-quick-genre]');
    if (!quick) return;
    const name = quick.dataset.quickGenre;
    const i = currentGenres.findIndex((g) => g.toLowerCase() === name.toLowerCase());
    if (i >= 0) currentGenres.splice(i, 1);
    else currentGenres.push(name); // multi-select
    paintQuick();
    navigate();
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

  const closeSortMenu = () => {
    if (!sortMenu) return;
    sortMenu.hidden = true;
    sortToggle?.setAttribute('aria-expanded', 'false');
  };
  const openSortMenu = () => {
    if (!sortMenu) return;
    sortMenu.hidden = false;
    sortToggle?.setAttribute('aria-expanded', 'true');
  };

  sortToggle?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (sortMenu?.hidden) openSortMenu();
    else closeSortMenu();
  });

  // Event delegation — tetap jalan setelah paintQuick rebuild innerHTML
  sortMenu?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const b = e.target.closest('[data-sort]');
    if (!b) return;
    const next = b.dataset.sort === 'popular' ? 'popular' : 'latest';
    closeSortMenu();
    if (next === sort) return;
    sort = next;
    paintQuick();
    navigate();
  });

  // Tutup menu hanya jika klik di luar
  const onDocClick = (e) => {
    if (!root.isConnected) {
      document.removeEventListener('click', onDocClick);
      return;
    }
    if (!sortMenu || sortMenu.hidden) return;
    if (e.target.closest('#sort-toggle') || e.target.closest('#sort-menu')) return;
    closeSortMenu();
  };
  document.addEventListener('click', onDocClick);

  async function loadResults() {
    io?.disconnect();
    requestId += 1;
    const myRequest = requestId;
    seen = new Set();
    page = 0;
    pages = 1;
    loading = false;
    paintQuick();

    const isQuery = currentQuery.trim().length >= 2;

    // Saat ada query: tampil list baris (cover + judul), bukan grid kartu
    if (isQuery) {
      grid.className = 'search-hits';
      grid.innerHTML = '<div class="search-hit search-hit--skel loading-surface"></div>'.repeat(6);
    } else {
      grid.className = 'grid explore-grid';
      grid.innerHTML = '<div class="explore-skeleton loading-surface"></div>'.repeat(9);
    }

    end.textContent = '';
    count.hidden = true;
    const url = (n) =>
      `/api/explore?q=${encodeURIComponent(currentQuery)}&genre=${encodeURIComponent(genreKey())}&format=${encodeURIComponent(currentFormat)}&sort=${encodeURIComponent(sort === 'popular' ? 'popular' : 'latest')}&page=${n}&size=${SIZE}`;
    try {
      const first = await api(url(1));
      if (!alive() || myRequest !== requestId) return;

      grid.innerHTML = '';
      if (!first.items?.length) {
        end.textContent = currentGenres.length
          ? `Belum ada judul untuk: ${currentGenres.join(', ')}.`
          : 'Tidak ada hasil yang cocok.';
        count.textContent = '0 judul';
        count.hidden = false;
        return;
      }
      const useList = isQuery;
      const add = (data) => {
        const items = (data.items || []).filter((c) => c?.url && !seen.has(c.url) && seen.add(c.url));
        grid.insertAdjacentHTML('beforeend', items.map(useList ? listRow : card).join(''));
        count.textContent = `${fmt(data.total)} judul`;
        count.hidden = false;
      };
      add(first);
      page = 1;
      pages = first.pages || 1;
      if (page >= pages) return;
      io = new IntersectionObserver(async (entries) => {
        if (!entries.some((e) => e.isIntersecting) || loading || page >= pages || !alive() || myRequest !== requestId) return;
        loading = true;
        end.innerHTML = '<div class="inline-loading" aria-label="Memuat"><i></i><i></i><i></i></div>';
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
      end.innerHTML = `${esc(e.message || 'Gagal memuat')} · <button type="button" class="text-action" id="ex-retry">Coba lagi</button>`;
      root.querySelector('#ex-retry')?.addEventListener('click', loadResults);
    }
  }

  paintQuick();
  await loadResults();
}
