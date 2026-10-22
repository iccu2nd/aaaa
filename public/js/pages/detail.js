import { api } from '../api.js';
import { state } from '../state.js';
import { bookmarks, history } from '../store.js';
import { section, state as msg } from '../components/section.js';
import { esc, img, link } from '../utils.js';

export async function detail({ root, alive }, url) {
  root.innerHTML = msg('Memuat detail komik…');
  const d = await api('/api/detail?url=' + encodeURIComponent(url)).catch(err => ({ error: err.message }));

  if (!alive()) return;

  if (d.error) {
    root.innerHTML = msg('Gagal memuat detail komik: ' + d.error, true);
    return;
  }

  state.series = { url: d.url || url, title: d.title, poster: d.poster, chapters: d.chapters || [] };
  const chapters = d.chapters || [];
  const firstChapter = chapters[chapters.length - 1];
  const resume = history.lastFor(d.url || url);
  const readSet = history.readChapters(d.url || url);

  const item = {
    url: d.url || url,
    title: d.title,
    poster: d.poster,
    meta: `${chapters.length} chapter`,
  };

  const genres = (d.genres || ['Action', 'Fantasy', 'Sci-fi', 'Mystery']).map(g => `<span class="tag">${esc(g)}</span>`).join('');

  root.innerHTML = `
    <div class="detail-hero">
      <div class="detail-hero__backdrop" style="background-image: url('${esc(img(d.poster))}')"></div>
      <div class="detail-hero__content">
        <img class="detail-hero__poster" src="${esc(img(d.poster))}" alt="${esc(d.title)}">
        <div class="detail-hero__info">
          <div class="detail-hero__badges">
            <span class="badge-type">${esc(d.type || 'Manhua')}</span>
            <span class="badge-year">${esc(d.release_year || '2020')}</span>
          </div>
          <h1 class="detail-hero__title">${esc(d.title)}</h1>
          <div class="detail-hero__author">👤 ${esc(d.author || 'Renshan Animation')}</div>
          <div class="detail-hero__views">👁️ ${esc(d.views || '1.4m views')}</div>
          <div class="detail-hero__status">🕒 ${esc(d.status || 'Ongoing')}</div>
        </div>
      </div>
    </div>

    <div class="detail-body">
      <div class="banner-ads-free">
        👑 Free: Watch Ads to Support Free Content
      </div>

      <div class="detail-synopsis-wrapper">
        <p class="detail-synopsis" id="synopsisText">
          ${esc(d.synopsis || d.description || 'Krisis mendadak membawa bumi langsung ke era Earth OL Age dan seluruh umat manusia direduksi menjadi tangan kekuatan yang tidak diketahui...')}
        </p>
        <button class="btn-toggle-synopsis" id="btnToggleSynopsis" type="button" aria-label="Lihat selengkapnya">▼</button>
      </div>

      <div class="detail-tags">
        ${genres}
      </div>

      <div class="detail-chapters-section">
        <div class="chapters-header">
          <h2>Chapters</h2>
          <div class="chapters-tools">
            <input type="text" id="chapterSearch" class="chapter-search" placeholder="Search chapter...">
          </div>
        </div>

        <div class="chapter-list-grid" id="chapterList">
          ${chapters.map(c => `
            <a class="chapter-card ${readSet.has(c.url) ? 'is-read' : ''}" href="${link('read', c.url)}">
              <div class="chapter-card__left">
                <span class="chapter-card__icon">K</span>
                <div class="chapter-card__info">
                  <span class="chapter-card__title">${esc(c.title)}</span>
                  <span class="chapter-card__time">${esc(c.time || '14 minutes ago')}</span>
                </div>
              </div>
              <span class="chapter-card__dl">⬇</span>
            </a>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Floating Start Reading Bar -->
    <div class="floating-read-bar">
      ${firstChapter ? `
        <a class="btn-start-reading" href="${link('read', resume ? resume.chapterUrl : firstChapter.url)}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <div class="btn-start-reading__text">
            <span>${resume ? 'Lanjut Baca' : 'Start Reading'}</span>
            <small>${resume ? resume.chapterTitle : firstChapter.title}</small>
          </div>
        </a>
      ` : ''}
      <button class="btn-bookmark-action" id="bm" type="button">❤️</button>
    </div>
  `;

  const searchInput = document.getElementById('chapterSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.chapter-card').forEach(el => {
        const text = el.textContent.toLowerCase();
        el.style.display = text.includes(q) ? 'flex' : 'none';
      });
    });
  }

  const btnToggle = document.getElementById('btnToggleSynopsis');
  const synEl = document.getElementById('synopsisText');
  if (btnToggle && synEl) {
    btnToggle.addEventListener('click', () => {
      synEl.classList.toggle('expanded');
      btnToggle.textContent = synEl.classList.contains('expanded') ? '▲' : '▼';
    });
  }

  const btnBm = document.getElementById('bm');
  if (btnBm) {
    const paint = () => {
      const on = bookmarks.has(item.url);
      btnBm.classList.toggle('active', on);
    };
    btnBm.addEventListener('click', () => { bookmarks.toggle(item); paint(); });
    paint();
  }
}
