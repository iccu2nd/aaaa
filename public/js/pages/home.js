import { api } from '../api.js';
import { history } from '../store.js';
import { esc, img, link } from '../utils.js';
import { skeletonGrid, state as msg } from '../components/section.js';

function relativeFromHist() {
  return 'baru saja';
}

function continueCard(h) {
  const ch = h.chapterTitle || 'Lanjut';
  return `
    <a class="rail-card rail-card--continue" href="${link('read', h.chapterUrl)}">
      <div class="rail-card__cover">
        <img loading="lazy" src="${esc(img(h.poster))}" alt="">
        <div class="rail-card__overlay">
          <span class="rail-card__ch">${esc(ch)}</span>
          <div class="rail-card__bar"><i style="width:62%"></i></div>
          <span class="rail-card__cta">Continue</span>
        </div>
      </div>
      <div class="rail-card__title">${esc(h.title)}</div>
      <div class="rail-card__sub">${relativeFromHist()}</div>
    </a>`;
}

function getRating(item) {
  const raw = item?.user_rate ?? item?.rating ?? item?.rate ?? item?.score ?? item?.rating_score;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value.toFixed(1).replace(/\.0$/, '') : '';
}

function formatUpdateTime(raw) {
  if (raw == null || raw === '') return '';
  const value = String(raw).trim();
  // Jangan tampilkan timestamp ISO mentah dari API.
  if (!/[Tt]\d{2}:\d{2}|Z$|[+-]\d{2}:?\d{2}$/.test(value)) return value;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return 'baru saja';
  if (sec < 3600) return `${Math.floor(sec / 60)} menit lalu`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} jam lalu`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} hari lalu`;
  return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getViews(item) {
  const raw = item?.views ?? item?.view_count ?? item?.views_count ?? item?.total_views ?? item?.reader_count ?? item?.viewers;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return '';
  return new Intl.NumberFormat('id-ID', { notation: value >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}

function updateCard(item) {
  const ch = item.chapters?.[0]?.chapter || item.chapter || (item.latest_chapter != null ? `Ch. ${item.latest_chapter}` : '');
  const time = formatUpdateTime(item.chapters?.[0]?.time || item.latest_chapter_time || '');
  const rate = getRating(item);
  const views = getViews(item);
  return `
    <a class="rail-card" href="${link('detail', item.url)}">
      <div class="rail-card__cover">
        <img loading="lazy" decoding="async" src="${esc(img(item.poster))}" alt="">
        ${rate ? `<span class="rail-card__rate"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.9L22 10l-5 4.7L18.2 22 12 18.2 5.8 22 7 14.7 2 10l7.1-1.1L12 2z"/></svg> ${esc(String(rate))}</span>` : ''}
      </div>
      <div class="rail-card__title">${esc(item.title)}</div>
      <div class="rail-card__meta">
        ${rate ? `<span>★ ${esc(String(rate))}</span>` : ''}
        ${ch ? `<span>${esc(ch)}</span>` : ''}
        ${views ? `<span>👁 ${esc(views)}</span>` : ''}
      </div>
      <div class="rail-card__sub">${esc(time || item.status || '')}</div>
    </a>`;
}

function spotlight(item) {
  if (!item) return '';
  const blurb = item.status || (item.meta || '').split(' · ')[0] || 'Pilihan untukmu';
  const rate = getRating(item);
  const chapter = item.latest_chapter != null ? `Ch. ${item.latest_chapter}` : (item.chapter || item.chapters?.[0]?.chapter || '');
  const views = getViews(item);
  const facts = [rate ? `★ ${rate}` : '', chapter, views ? `👁 ${views} pembaca` : ''].filter(Boolean);
  return `
    <a class="spotlight" data-spotlight href="${link('detail', item.url)}" aria-label="Lihat ${esc(item.title)}">
      <div class="spotlight__bg" style="background-image:url('${esc(img(item.poster))}')"></div>
      <div class="spotlight__fade"></div>
      <div class="spotlight__content">
        <div class="spotlight__copy">
          <div class="spotlight__meta-row">
            <span class="spotlight__label" data-spotlight-label>#1</span>
          </div>
          <h1 class="spotlight__title">${esc(item.title)}</h1>
          <p class="spotlight__desc">${esc(blurb)}</p>
          <div class="spotlight__facts">${facts.map((fact) => `<span>${esc(fact)}</span>`).join('')}</div>
          <span class="spotlight__cta">Baca sekarang <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
        </div>
        <div class="spotlight__art">
          <i class="spotlight__ghost spotlight__ghost--b"></i>
          <i class="spotlight__ghost spotlight__ghost--a"></i>
          <div class="spotlight__poster">
            <span class="spotlight__chapter" data-spotlight-chapter>${esc(chapter || 'Chapter terbaru')}</span>
            <img src="${esc(img(item.poster))}" alt="" decoding="async" fetchpriority="high">
          </div>
        </div>
      </div>
      <div class="spotlight__dots" data-spotlight-dots aria-hidden="true">
        <i class="is-on"></i><i></i><i></i>
      </div>
    </a>`;
}

function rail(title, body, moreHref = '') {
  return `
    <section class="rail-section">
      <div class="rail-section__head">
        <h2>${esc(title)}</h2>
        ${moreHref ? `<a class="rail-section__more" href="${moreHref}">View All</a>` : ''}
      </div>
      ${body}
    </section>`;
}

export async function home({ root, alive }) {
  const hist = history.list().slice(0, 12);

  root.innerHTML = `
    <div class="home-skel">
      <div class="spotlight spotlight--skel"></div>
      ${hist.length ? rail('Continue reading', '<div class="rail"><div class="skeleton" style="width:120px;height:170px;flex:none"></div></div>') : ''}
      ${rail('Update', skeletonGrid(6))}
    </div>`;

  const [popular, updates, explore1, explore2] = await Promise.all([
    api('/api/home'),
    api('/api/update').catch(() => []),
    api('/api/explore?q=&genre=&page=1&size=24').catch(() => ({ items: [] })),
    api('/api/explore?q=&genre=&page=2&size=24').catch(() => ({ items: [] })),
  ]);
  if (!alive()) return;

  const normalize = (u) => {
    if (u?.chapters) {
      return {
        ...u,
        chapter: u.chapters[0]?.chapter || u.chapter || '',
        user_rate: u.user_rate,
      };
    }
    return u;
  };

  // Update: hanya feed update (baru rilis) — jangan dicampur popular
  const updateRail = dedupeByUrl((updates.length ? updates : []).map(normalize)).slice(0, 24);

  // Rekomendasi: katalog lebar, beda dari update, diacak biar segar
  const updateUrls = new Set(updateRail.map((x) => x.url));
  const catalog = [
    ...(Array.isArray(popular) ? popular : []),
    ...(Array.isArray(explore1?.items) ? explore1.items : []),
    ...(Array.isArray(explore2?.items) ? explore2.items : []),
  ].map(normalize);

  let rekomendasi = mergeByUrl(catalog).filter((x) => x?.url && x?.poster && !updateUrls.has(x.url));
  if (rekomendasi.length < 48) {
    rekomendasi = mergeByUrl([...rekomendasi, ...(popular || []).map(normalize)]);
  }
  rekomendasi = shuffle(rekomendasi);
  // 6 layer × ~12 judul
  const REC_LAYERS = 6;
  const PER_LAYER = 12;
  const need = REC_LAYERS * PER_LAYER;
  while (rekomendasi.length < need && rekomendasi.length > 0) {
    rekomendasi = rekomendasi.concat(shuffle(rekomendasi.slice(0, PER_LAYER)));
  }
  rekomendasi = rekomendasi.slice(0, need);

  const layerTitles = [
    'Rekomendasi',
    'Untukmu',
    'Populer minggu ini',
    'Pilihan editor',
    'Mirip yang kamu baca',
    'Jelajah lainnya',
  ];
  const recRails = layerTitles.map((title, i) => {
    const slice = rekomendasi.slice(i * PER_LAYER, (i + 1) * PER_LAYER);
    if (!slice.length) return '';
    return rail(title, `<div class="rail rail--inset">${slice.map(updateCard).join('')}</div>`, i === 0 ? '/search' : '');
  }).join('');

  const feature = (popular && popular[0]) || rekomendasi[0] || updateRail[0];
  const contHtml = hist.length
    ? `<div class="rail">${hist.map(continueCard).join('')}</div>`
    : '';

  root.innerHTML = `
    ${spotlight(feature)}
    ${hist.length ? rail('Continue reading', contHtml, '/library') : ''}
    ${rail('Update', `<div class="rail rail--inset">${updateRail.map(updateCard).join('')}</div>`, '/update')}
    ${recRails}
  `;

  // Spotlight: prioritaskan popular, fallback rekomendasi (bukan update saja)
  startSpotlightRotation(
    dedupeByUrl([...(popular || []), ...rekomendasi]).filter((item) => item?.url && item?.poster).slice(0, 3),
    root,
    alive,
  );
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startSpotlightRotation(items, root, alive) {
  if (items.length < 2) return;
  const hero = root.querySelector('[data-spotlight]');
  if (!hero) return;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let timer = null;
  const change = () => {
    if (!alive() || !root.contains(hero)) {
      if (timer) clearInterval(timer);
      return;
    }
    if (document.hidden) return;
    index = (index + 1) % items.length;
    const item = items[index];
    const bg = hero.querySelector('.spotlight__bg');
    const cover = hero.querySelector('.spotlight__poster img');
    const title = hero.querySelector('.spotlight__title');
    const desc = hero.querySelector('.spotlight__desc');
    const factsEl = hero.querySelector('.spotlight__facts');
    const label = hero.querySelector('.spotlight__label');
    const chapterBadge = hero.querySelector('[data-spotlight-chapter]');
    const dots = hero.querySelectorAll('[data-spotlight-dots] i');
    hero.classList.add('is-changing');
    const nextUrl = img(item.poster);
    const preload = new Image();
    preload.onload = () => {
      if (!alive() || !root.contains(hero)) return;
      hero.href = link('detail', item.url);
      hero.setAttribute('aria-label', `Lihat ${item.title}`);
      if (bg) bg.style.backgroundImage = `url("${nextUrl.replace(/["\\]/g, '')}")`;
      if (cover) { cover.src = nextUrl; cover.alt = item.title || ''; }
      if (title) title.textContent = item.title || '';
      if (desc) desc.textContent = item.status || (item.meta || '').split(' · ')[0] || 'Pilihan untukmu';
      if (factsEl) {
        const rate = getRating(item);
        const chapter = item.latest_chapter != null ? `Ch. ${item.latest_chapter}` : (item.chapter || item.chapters?.[0]?.chapter || '');
        const views = getViews(item);
        factsEl.innerHTML = [rate ? `★ ${rate}` : '', chapter, views ? `👁 ${views} pembaca` : ''].filter(Boolean).map((fact) => `<span>${esc(fact)}</span>`).join('');
      }
      if (label) label.textContent = `#${index + 1}`;
      if (chapterBadge) chapterBadge.textContent = item.latest_chapter != null ? `Ch. ${item.latest_chapter}` : (item.chapter || item.chapters?.[0]?.chapter || 'Chapter terbaru');
      dots.forEach((d, i) => d.classList.toggle('is-on', i === index));
      hero.classList.remove('is-changing');
    };
    preload.onerror = () => hero.classList.remove('is-changing');
    preload.src = nextUrl;
  };
  timer = window.setInterval(change, reducedMotion ? 12000 : 5500);
  const onVisibility = () => {
    if (!alive() || !root.contains(hero)) {
      if (timer) clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisibility);
      return;
    }
    if (document.hidden && timer) { clearInterval(timer); timer = null; }
    else if (!document.hidden && !timer) timer = window.setInterval(change, reducedMotion ? 12000 : 5500);
  };
  document.addEventListener('visibilitychange', onVisibility);
}

function dedupeByUrl(list) {
  const seen = new Set();
  const out = [];
  for (const x of list) {
    if (!x?.url || seen.has(x.url)) continue;
    seen.add(x.url);
    out.push(x);
  }
  return out;
}

// Pertahankan metadata terlengkap saat judul sama datang dari beberapa endpoint.
function mergeByUrl(list) {
  const byUrl = new Map();
  for (const item of list) {
    if (!item?.url) continue;
    const prior = byUrl.get(item.url);
    if (!prior) { byUrl.set(item.url, { ...item }); continue; }
    const merged = { ...item, ...prior };
    for (const key of ['user_rate', 'rating', 'rate', 'score', 'latest_chapter', 'latest_chapter_time', 'views', 'view_count', 'views_count', 'total_views', 'reader_count', 'viewers', 'chapter', 'chapters', 'poster', 'status']) {
      const value = prior[key];
      const empty = value == null || value === '' || (typeof value === 'number' && value <= 0) || (Array.isArray(value) && value.length === 0);
      if (empty && item[key] != null && item[key] !== '' && !(Array.isArray(item[key]) && item[key].length === 0)) merged[key] = item[key];
    }
    byUrl.set(item.url, merged);
  }
  return [...byUrl.values()];
}
