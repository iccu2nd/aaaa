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

function updateCard(item) {
  const ch = item.chapters?.[0]?.chapter || item.chapter || '';
  const time = item.chapters?.[0]?.time || item.meta || '';
  const rate = item.user_rate > 0 ? item.user_rate : '';
  return `
    <a class="rail-card" href="${link('detail', item.url)}">
      <div class="rail-card__cover">
        <img loading="lazy" src="${esc(img(item.poster))}" alt="">
        ${rate ? `<span class="rail-card__rate"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.9L22 10l-5 4.7L18.2 22 12 18.2 5.8 22 7 14.7 2 10l7.1-1.1L12 2z"/></svg> ${esc(String(rate))}</span>` : ''}
        ${item.source ? `<span class="rail-card__flag">${esc(item.source === 'shinigami' ? 'SG' : 'VT')}</span>` : ''}
      </div>
      <div class="rail-card__title">${esc(item.title)}</div>
      <div class="rail-card__sub">${esc(ch || time || '\u00A0')}</div>
    </a>`;
}

function spotlight(item) {
  if (!item) return '';
  const blurb = item.meta || item.chapter || 'Rekomendasi pilihan untukmu.';
  return `
    <a class="spotlight" data-spotlight href="${link('detail', item.url)}" aria-label="Lihat ${esc(item.title)}">
      <div class="spotlight__bg" style="background-image:url('${esc(img(item.poster))}')"></div>
      <div class="spotlight__fade"></div>
      <div class="spotlight__content">
        <div class="spotlight__copy">
          <span class="spotlight__label">#1 Spotlight</span>
          <h1 class="spotlight__title">${esc(item.title)}</h1>
          <p class="spotlight__desc">${esc(blurb)}</p>
        </div>
        <div class="spotlight__art">
          <div class="spotlight__phone">
            <img src="${esc(img(item.poster))}" alt="">
          </div>
        </div>
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

  const [popular, updates] = await Promise.all([
    api('/api/home'),
    api('/api/update').catch(() => []),
  ]);
  if (!alive()) return;

  const feature = popular[0] || updates[0];
  const updateItems = (updates.length ? updates : popular).map((u) => {
    // normalize update feed item → card fields
    if (u.chapters) {
      return {
        ...u,
        chapter: u.chapters[0]?.chapter || '',
        user_rate: u.user_rate,
      };
    }
    return u;
  });

  // also mix popular into update rail if update is short
  const updateRail = updateItems.length >= 8
    ? updateItems
    : dedupeByUrl([...updateItems, ...popular]);

  const contHtml = hist.length
    ? `<div class="rail">${hist.map(continueCard).join('')}</div>`
    : '';

  root.innerHTML = `
    ${spotlight(feature)}
    ${hist.length ? rail('Continue reading', contHtml, '#/library') : ''}
    ${rail('Update', `<div class="rail">${updateRail.map(updateCard).join('')}</div>`, '#/update')}
    ${rail('Rekomendasi', `<div class="rail rail--wrap">${popular.slice(0, 24).map(updateCard).join('')}</div>`, '#/explore')}
  `;

  // Lightweight spotlight rotation: update existing DOM instead of rerendering Home.
  startSpotlightRotation(dedupeByUrl([...popular, ...updates]).filter((item) => item?.url && item?.poster).slice(0, 8), root, alive);
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
    const cover = hero.querySelector('.spotlight__phone img');
    const title = hero.querySelector('.spotlight__title');
    const desc = hero.querySelector('.spotlight__desc');
    hero.classList.add('is-changing');
    // Decode the next cover before switching to avoid flashing an empty image.
    const nextUrl = img(item.poster);
    const preload = new Image();
    preload.onload = () => {
      if (!alive() || !root.contains(hero)) return;
      hero.href = link('detail', item.url);
      hero.setAttribute('aria-label', `Lihat ${item.title}`);
      bg.style.backgroundImage = `url("${nextUrl.replace(/["\\]/g, '')}")`;
      cover.src = nextUrl;
      cover.alt = item.title || '';
      title.textContent = item.title || '';
      desc.textContent = item.meta || item.chapter || 'Rekomendasi pilihan untukmu.';
      hero.classList.remove('is-changing');
    };
    preload.onerror = () => hero.classList.remove('is-changing');
    preload.src = nextUrl;
  };
  timer = window.setInterval(change, reducedMotion ? 10000 : 6500);
  const onVisibility = () => {
    if (!alive() || !root.contains(hero)) {
      if (timer) clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisibility);
      return;
    }
    if (document.hidden && timer) { clearInterval(timer); timer = null; }
    else if (!document.hidden && !timer) timer = window.setInterval(change, reducedMotion ? 10000 : 6500);
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
