import { api } from '../api.js';
import { state } from '../state.js';
import { history, readingProgress } from '../store.js';
import { esc, img, link } from '../utils.js';

const ICO = {
  back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  prev: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  list: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  settings: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
  play: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.8c0-.8.9-1.3 1.6-.9l9.1 5.2a1 1 0 0 1 0 1.8l-9.1 5.2a1 1 0 0 1-1.6-.9V5.8Z"/></svg>`,
  pause: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>`,
};

export async function reader({ root, alive }, url) {
  document.body.classList.add('is-reader');
  root.innerHTML = `<div class="reader-loading" aria-label="Memuat halaman chapter">${'<div class="reader-loading__page loading-surface"></div>'.repeat(3)}</div>`;

  let d;
  try {
    d = await api('/api/read?url=' + encodeURIComponent(url));
  } catch (e) {
    throw e;
  }
  if (!alive()) return;

  const s = state.series;
  const list = s ? s.chapters : [];
  const i = list.findIndex((c) => c.url === url || c.chapter_id === d.chapter_id);

  let prev = null;
  let next = null;
  if (d.prev_chapter_id) {
    prev = { url: `https://shinigami.id/chapter/${d.prev_chapter_id}` };
  } else if (i >= 0 && i < list.length - 1) {
    prev = list[i + 1];
  }
  if (d.next_chapter_id) {
    next = { url: `https://shinigami.id/chapter/${d.next_chapter_id}` };
  } else if (i > 0) {
    next = list[i - 1];
  }

  if (s) {
    const prevHist = history.lastFor(s.url);
    const readList = Array.from(new Set([url, ...((prevHist && prevHist.read) || [])])).slice(0, 500);
    history.push({
      url: s.url,
      title: s.title,
      poster: s.poster,
      chapterUrl: url,
      chapterTitle: (list[i] || {}).title || d.title,
      read: readList,
    });
  }

  const backHref = s ? link('detail', s.url) : '/';
  const readSet = s ? history.readChapters(s.url) : new Set();

  const drawerList = list.length
    ? list.map((c) => {
        const active = c.url === url || c.chapter_id === d.chapter_id;
        const isRead = readSet.has(c.url);
        return `<a class="reader-drawer__item${active ? ' is-active' : ''}${isRead ? ' is-read' : ''}" href="${link('read', c.url)}">${esc(c.title)}</a>`;
      }).join('')
    : '<div class="state">Daftar chapter tidak tersedia. Buka dari halaman detail dulu.</div>';

  root.innerHTML = `
    <div class="reader" id="reader">
      <div class="reader__ui reader__top" id="reader-top">
        <a class="reader__icon" href="${backHref}" aria-label="Kembali">${ICO.back}</a>
        <div class="reader__top-title">${esc(d.title)}</div>
        <button type="button" class="reader__icon" id="btn-list" aria-label="Daftar chapter">${ICO.list}</button>
      </div>

      <div class="reader__pages" id="reader-pages">
        ${d.images.map((src, index) => {
          const eager = index < 5;
          const prio = index === 0 ? 'high' : index < 3 ? 'high' : 'auto';
          return `<img class="reader__page" loading="${eager ? 'eager' : 'lazy'}" fetchpriority="${prio}" decoding="async" src="${esc(img(src))}" alt="" data-page="${index}"${index === 0 ? ' data-first-page' : ''}>`;
        }).join('')}
      </div>

      <div class="reader__end" id="reader-end" aria-label="Navigasi chapter">
        <div class="reader__end-actions">
          ${prev ? `<a class="reader__end-nav" href="${link('read', prev.url)}">${ICO.prev}<span>Previous</span></a>` : '<span class="reader__end-nav is-disabled" aria-disabled="true">'+ICO.prev+'<span>Previous</span></span>'}
          ${next ? `<a class="reader__end-nav reader__end-nav--next" href="${link('read', next.url)}"><span>Next</span>${ICO.next}</a>` : s ? `<a class="reader__end-nav reader__end-nav--next" href="${backHref}"><span>Back to detail</span>${ICO.next}</a>` : '<span class="reader__end-nav reader__end-nav--next is-disabled" aria-disabled="true"><span>Next</span>'+ICO.next+'</span>'}
        </div>
      </div>

      <div class="reader__ui reader__bottom" id="reader-bottom">
        ${prev ? `<a class="reader__icon reader__icon--lg" href="${link('read', prev.url)}" aria-label="Previous chapter">${ICO.prev}</a>` : `<span class="reader__icon reader__icon--lg is-disabled" aria-label="Tidak ada chapter sebelumnya">${ICO.prev}</span>`}
        <button type="button" class="reader__icon reader__icon--lg" id="btn-reader-settings" aria-label="Pengaturan auto-scroll" aria-expanded="false">${ICO.settings}</button>
        <button type="button" class="reader__icon reader__icon--lg reader__autoscroll" id="btn-autoscroll" aria-label="Mulai auto-scroll" aria-pressed="false">${ICO.play}</button>
        <button type="button" class="reader__icon reader__icon--lg" id="btn-list-2" aria-label="Daftar chapter">${ICO.list}</button>
        ${next ? `<a class="reader__icon reader__icon--lg" href="${link('read', next.url)}" aria-label="Next chapter">${ICO.next}</a>` : `<span class="reader__icon reader__icon--lg is-disabled" aria-label="Tidak ada chapter berikutnya">${ICO.next}</span>`}
      </div>
      <div class="reader-settings" id="reader-settings" hidden>
        <div class="reader-settings__title">Kecepatan auto-scroll</div>
        <div class="reader-settings__range-wrap">
          <input id="reader-speed" class="reader-settings__range" type="range" min="0.5" max="3" step="0.1" value="1" aria-label="Kecepatan auto-scroll">
          <div class="reader-settings__range-labels"><span>0.5×</span><output id="reader-speed-value" for="reader-speed">1.0×</output><span>3×</span></div>
        </div>
      </div>

      <div class="reader-drawer" id="reader-drawer" hidden>
        <div class="reader-drawer__backdrop" id="drawer-backdrop"></div>
        <div class="reader-drawer__panel" role="dialog" aria-label="Daftar chapter">
          <div class="reader-drawer__head">
            <h2>Chapters</h2>
            <button type="button" class="reader__icon" id="drawer-close" aria-label="Tutup">${ICO.close}</button>
          </div>
          <div class="reader-drawer__search">
            <input type="search" id="drawer-filter" placeholder="Cari chapter…" autocomplete="off">
          </div>
          <div class="reader-drawer__list" id="drawer-list">${drawerList}</div>
        </div>
      </div>
    </div>`;

  const savedProgress = readingProgress.get(url);

  const top = document.getElementById('reader-top');
  const bottom = document.getElementById('reader-bottom');
  const readerEl = document.getElementById('reader');
  const progressBar = document.createElement('div');
  progressBar.className = 'reader-progress';
  progressBar.setAttribute('aria-hidden', 'true');
  progressBar.innerHTML = '<span></span>';
  readerEl.prepend(progressBar);
  const progressFill = progressBar.firstElementChild;

  // Prefetch sisa halaman di background (cepat, tidak blok UI)
  (function preloadQueue() {
    const urls = (d.images || []).map((src) => img(src));
    let i = 5; // 0–4 sudah eager
    const pump = () => {
      if (i >= urls.length) return;
      const end = Math.min(i + 3, urls.length);
      for (; i < end; i++) {
        const im = new Image();
        im.decoding = 'async';
        im.src = urls[i];
      }
      if (i < urls.length) setTimeout(pump, 40);
    };
    if ('requestIdleCallback' in window) requestIdleCallback(pump, { timeout: 400 });
    else setTimeout(pump, 60);
  })();

  const drawer = document.getElementById('reader-drawer');
  const settings = document.getElementById('reader-settings');
  const settingsBtn = document.getElementById('btn-reader-settings');
  const autoBtn = document.getElementById('btn-autoscroll');
  let uiVisible = false;
  let scrollTimer = null;
  let lastScrollY = window.scrollY;
  let scrolling = false;
  let autoScrollFrame = 0;
  let autoScrolling = false;
  const speedInput = document.getElementById('reader-speed');
  const speedValue = document.getElementById('reader-speed-value');
  const initialSpeed = Math.min(3, Math.max(0.5, Number(localStorage.getItem('rimwa:auto-speed')) || 1));
  let autoScrollSpeed = 220 * initialSpeed;
  // Default reading mode is always top-to-bottom. Direction preferences are intentionally removed.
  const readerDirection = 'down';
  let previousFrameTime = 0;

  if (speedInput) {
    speedInput.value = String(initialSpeed);
    speedInput.style.setProperty('--speed-progress', `${((initialSpeed - 0.5) / 2.5) * 100}%`);
  }
  if (speedValue) {
    const label = `${initialSpeed.toFixed(1)}×`;
    if ('value' in speedValue) speedValue.value = label;
    speedValue.textContent = label;
  }

  const showUI = () => {
    uiVisible = true;
    top.classList.add('is-visible');
    bottom.classList.add('is-visible');
  };
  const hideUI = () => {
    uiVisible = false;
    top.classList.remove('is-visible');
    bottom.classList.remove('is-visible');
  };

  const openDrawer = () => {
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    showUI();
    // scroll active into view
    const active = drawer.querySelector('.is-active');
    if (active) active.scrollIntoView({ block: 'center' });
  };
  const closeDrawer = () => {
    drawer.classList.remove('is-open');
    setTimeout(() => { drawer.hidden = true; }, 200);
  };

  document.getElementById('btn-list').addEventListener('click', (e) => { e.stopPropagation(); openDrawer(); });
  document.getElementById('btn-list-2').addEventListener('click', (e) => { e.stopPropagation(); openDrawer(); });

  const stopAutoScroll = () => {
    autoScrolling = false;
    cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = 0;
    previousFrameTime = 0;
    autoBtn.innerHTML = ICO.play;
    autoBtn.setAttribute('aria-label', 'Mulai auto-scroll');
    autoBtn.setAttribute('aria-pressed', 'false');
    autoBtn.classList.remove('is-active');
  };
  const autoScrollTick = (time) => {
    if (!autoScrolling) return;
    if (!previousFrameTime) previousFrameTime = time;
    const delta = Math.min(time - previousFrameTime, 64);
    previousFrameTime = time;
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (maxY <= 0 || window.scrollY >= maxY - 2) { stopAutoScroll(); return; }
    window.scrollBy(0, autoScrollSpeed * delta / 1000);
    if (window.scrollY >= maxY - 2) { stopAutoScroll(); return; }
    autoScrollFrame = requestAnimationFrame(autoScrollTick);
  };
  autoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (autoScrolling) { stopAutoScroll(); return; }
    autoScrolling = true;
    autoBtn.innerHTML = ICO.pause;
    autoBtn.setAttribute('aria-label', 'Jeda auto-scroll');
    autoBtn.setAttribute('aria-pressed', 'true');
    autoBtn.classList.add('is-active');
    previousFrameTime = 0;
    autoScrollFrame = requestAnimationFrame(autoScrollTick);
  });
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = settings.hidden;
    settings.hidden = !opening;
    settingsBtn.setAttribute('aria-expanded', String(opening));
    settingsBtn.classList.toggle('is-active', opening);
    showUI();
  });
  if (speedInput) {
    speedInput.addEventListener('input', () => {
      const multiplier = Math.min(3, Math.max(0.5, Number(speedInput.value) || 1));
      autoScrollSpeed = 220 * multiplier;
      try { localStorage.setItem('rimwa:auto-speed', String(multiplier)); } catch { /* storage may be unavailable */ }
      const label = `${multiplier.toFixed(1)}×`;
      if (speedValue) {
        if ('value' in speedValue) speedValue.value = label;
        speedValue.textContent = label;
      }
      speedInput.style.setProperty('--speed-progress', `${((multiplier - 0.5) / 2.5) * 100}%`);
      if (autoScrolling) {
        cancelAnimationFrame(autoScrollFrame);
        previousFrameTime = 0;
        autoScrollFrame = requestAnimationFrame(autoScrollTick);
      }
    });
  }
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('drawer-backdrop').addEventListener('click', closeDrawer);

  const filter = document.getElementById('drawer-filter');
  const listEl = document.getElementById('drawer-list');
  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    listEl.querySelectorAll('a').forEach((a) => {
      a.style.display = !q || a.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  readerEl.addEventListener('click', (e) => {
    if (e.target.closest('a, button, .reader__end, .reader-drawer, .reader-settings')) return;
    if (scrolling) return;
    if (uiVisible) hideUI();
    else showUI();
  });

  let progressSaveTimer = null;
  const updateReadingProgress = () => {
    const maxY = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = Math.max(0, Math.min(1, window.scrollY / maxY));
    progressFill.style.transform = `scaleX(${ratio})`;
    readingProgress.set(url, ratio);
  };
  const restoreReadingProgress = () => {
    if (!savedProgress || savedProgress < 0.01) return;
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (maxY > 0) window.scrollTo(0, maxY * savedProgress);
  };
  const pageImages = Array.from(document.querySelectorAll('#reader-pages img'));
  Promise.all(pageImages.slice(0, 3).map((image) => image.complete ? Promise.resolve() :
    new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 1800);
    }))).then(() => {
      if (alive()) {
        if (savedProgress > 0.01) restoreReadingProgress();
        updateReadingProgress();
      }
    });
  const onScroll = () => {
    clearTimeout(progressSaveTimer);
    progressSaveTimer = setTimeout(updateReadingProgress, 180);
    const y = window.scrollY;
    if (Math.abs(y - lastScrollY) > 4) {
      scrolling = true;
      if (uiVisible) hideUI();
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { scrolling = false; }, 180);
    }
    lastScrollY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  const onVisibilityChange = () => { if (document.hidden) stopAutoScroll(); };
  const cleanup = () => {
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('rimwa:routechange', cleanup);
    clearTimeout(scrollTimer);
    clearTimeout(progressSaveTimer);
    updateReadingProgress();
    stopAutoScroll();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('rimwa:routechange', cleanup, { once: true });
}
