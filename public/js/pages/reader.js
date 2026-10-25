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
  focus: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/></svg>`,
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
  const neighbors = (dd, u) => {
    const k = list.findIndex((c) => c.url === u || (dd.chapter_id && c.chapter_id === dd.chapter_id));
    const prevC = dd.prev_chapter_id ? { url: `https://shinigami.id/chapter/${dd.prev_chapter_id}` } : (k >= 0 && k < list.length - 1 ? list[k + 1] : null);
    const nextC = dd.next_chapter_id ? { url: `https://shinigami.id/chapter/${dd.next_chapter_id}` } : (k > 0 ? list[k - 1] : null);
    return { prev: prevC, next: nextC, title: (list[k] || {}).title || dd.title };
  };
  const first = neighbors(d, url);
  const prev = first.prev;
  const next = first.next;

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

  const navPrev = (p) => p ? `<a id="nav-prev" class="reader__icon reader__icon--lg" href="${link('read', p.url)}" aria-label="Previous chapter">${ICO.prev}</a>` : `<span id="nav-prev" class="reader__icon reader__icon--lg is-disabled" aria-label="Tidak ada chapter sebelumnya">${ICO.prev}</span>`;
  const navNext = (n) => n ? `<a id="nav-next" class="reader__icon reader__icon--lg" href="${link('read', n.url)}" aria-label="Next chapter">${ICO.next}</a>` : `<span id="nav-next" class="reader__icon reader__icon--lg is-disabled" aria-label="Tidak ada chapter berikutnya">${ICO.next}</span>`;
  const endPrev = (p) => p ? `<a id="end-prev" class="reader__end-nav" href="${link('read', p.url)}">${ICO.prev}<span>Previous</span></a>` : `<span id="end-prev" class="reader__end-nav is-disabled" aria-disabled="true">${ICO.prev}<span>Previous</span></span>`;
  const endNext = (n) => n ? `<a id="end-next" class="reader__end-nav reader__end-nav--next" href="${link('read', n.url)}"><span>Next</span>${ICO.next}</a>` : s ? `<a id="end-next" class="reader__end-nav reader__end-nav--next" href="${backHref}"><span>Back to detail</span>${ICO.next}</a>` : `<span id="end-next" class="reader__end-nav reader__end-nav--next is-disabled" aria-disabled="true"><span>Next</span>${ICO.next}</span>`;

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

      <div id="reader-sentinel" aria-hidden="true"></div>
      <div class="reader__end" id="reader-end" aria-label="Navigasi chapter">
        <div class="reader__end-actions">${endPrev(prev)}${endNext(next)}</div>
      </div>

      <div class="reader__ui reader__bottom" id="reader-bottom">
        ${navPrev(prev)}
        <button type="button" class="reader__icon reader__icon--lg" id="btn-reader-settings" aria-label="Pengaturan auto-scroll" aria-expanded="false">${ICO.settings}</button>
        <button type="button" class="reader__icon reader__icon--lg reader__autoscroll" id="btn-autoscroll" aria-label="Mulai auto-scroll" aria-pressed="false">${ICO.play}</button>
        <button type="button" class="reader__icon reader__icon--lg" id="btn-focus" aria-label="Mode fokus">${ICO.focus}</button>
        ${navNext(next)}
      </div>
      <div class="reader-settings" id="reader-settings" hidden>
        <div class="rs-row">
          <span class="rs-row__label">Mode baca</span>
          <div class="rs-step" id="reader-modes" role="group" aria-label="Mode auto-scroll">
            <button type="button" id="mode-prev" aria-label="Mode sebelumnya"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
            <output id="mode-label" aria-live="polite">Halus</output>
            <button type="button" id="mode-next" aria-label="Mode berikutnya"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
          </div>
        </div>
        <p class="rs-hint" id="reader-mode-hint">Menggulir terus tanpa berhenti.</p>
        <label class="rs-row rs-row--sep" for="reader-continuous">
          <span class="rs-row__text"><b>Sambung chapter</b><small>Chapter berikutnya lanjut di bawah, tanpa pindah halaman</small></span>
          <input id="reader-continuous" type="checkbox" role="switch" checked>
          <i class="rs-switch" aria-hidden="true"></i>
        </label>
        <div class="rs-speed">
          <div class="rs-speed__head"><label for="reader-speed">Kecepatan</label><output id="reader-speed-value" for="reader-speed">1.0×</output></div>
          <input id="reader-speed" class="reader-settings__range" type="range" min="0.5" max="3" step="0.1" value="1" aria-label="Kecepatan auto-scroll">
          <div class="rs-speed__scale"><span>Pelan</span><span>Cepat</span></div>
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
  let autoPos = 0;
  let smoothDelta = 16.7;
  let smoothVel = 0;
  const MODES = [
    { id: 'smooth', label: 'Halus', hint: 'Menggulir terus tanpa berhenti.' },
    { id: 'swipe', label: 'Swipe', hint: 'Bergeser per layar seperti jari, lalu jeda sebentar.' },
  ];
  let mode = 'smooth';
  try { if (localStorage.getItem('rimwa:auto-mode') === 'swipe') mode = 'swipe'; } catch { /* storage may be unavailable */ }
  const swipe = { active: false, start: 0, from: 0, dist: 0, dur: 0, wait: 0 };
  const paintMode = () => {
    const m = MODES.find((x) => x.id === mode) || MODES[0];
    document.getElementById('mode-label').textContent = m.label;
    document.getElementById('reader-mode-hint').textContent = m.hint;
  };
  const stepMode = () => {
    mode = mode === 'smooth' ? 'swipe' : 'smooth';
    smoothVel = 0;
    swipe.active = false;
    swipe.wait = 0;
    try { localStorage.setItem('rimwa:auto-mode', mode); } catch { /* storage may be unavailable */ }
    paintMode();
  };
  paintMode();
  document.getElementById('mode-prev').addEventListener('click', (e) => { e.stopPropagation(); stepMode(); });
  document.getElementById('mode-next').addEventListener('click', (e) => { e.stopPropagation(); stepMode(); });

  let continuous = true;
  try { continuous = localStorage.getItem('rimwa:continuous') !== '0'; } catch { /* storage may be unavailable */ }
  const continuousInput = document.getElementById('reader-continuous');
  continuousInput.checked = continuous;

  if (speedInput) {
    speedInput.value = String(initialSpeed);
    speedInput.style.setProperty('--speed-progress', `${((initialSpeed - 0.5) / 2.5) * 100}%`);
  }
  if (speedValue) {
    const label = `${initialSpeed.toFixed(1)}×`;
    if ('value' in speedValue) speedValue.value = label;
    speedValue.textContent = label;
  }

  let focus = false;
  const closeSettings = () => {
    settings.hidden = true;
    settingsBtn.setAttribute('aria-expanded', 'false');
    settingsBtn.classList.remove('is-active');
  };
  const showUI = () => {
    if (focus) return;
    uiVisible = true;
    top.classList.add('is-visible');
    bottom.classList.add('is-visible');
  };
  const hideUI = () => {
    uiVisible = false;
    top.classList.remove('is-visible');
    bottom.classList.remove('is-visible');
    closeSettings();
  };

  const toast = document.createElement('div');
  toast.className = 'reader-toast';
  toast.setAttribute('role', 'status');
  readerEl.append(toast);
  let toastTimer = 0;
  const say = (title, sub = '', ms = 1600) => {
    toast.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), ms);
  };
  let fsEntered = false;
  let focusPushed = false;
  let swallowPop = false;
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const enterFs = () => {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn || fsEl()) return;
    try {
      const r = fn.call(el, { navigationUI: 'hide' });
      if (r && r.then) r.then(() => { fsEntered = true; }).catch(() => {});
      else fsEntered = true;
    } catch { /* fullscreen unavailable */ }
  };
  const leaveFs = () => {
    fsEntered = false;
    if (!fsEl()) return;
    try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch { /* ignore */ }
  };
  const setFocus = (on, { fromPop = false } = {}) => {
    if (focus === on) return;
    focus = on;
    readerEl.classList.toggle('is-focus', on);
    if (on) {
      hideUI();
      enterFs();
      try { window.history.pushState({ focus: 1 }, '', location.href); focusPushed = true; } catch { /* ignore */ }
      say('Mode fokus aktif', 'Tekan tombol kembali untuk keluar', 2800);
    } else {
      // Exit fullscreen often resets scroll to top (esp. mobile Chrome). Save & restore.
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      leaveFs();
      if (focusPushed && !fromPop) { swallowPop = true; window.history.back(); }
      focusPushed = false;
      say('Mode fokus nonaktif');
      showUI();
      const restore = () => {
        window.scrollTo(0, y);
        document.documentElement.scrollTop = y;
        document.body.scrollTop = y;
      };
      restore();
      requestAnimationFrame(() => {
        restore();
        requestAnimationFrame(restore);
      });
      // Some browsers apply the jump after a short delay
      setTimeout(restore, 50);
      setTimeout(restore, 150);
    }
  };
  const onPop = (e) => {
    if (swallowPop) { swallowPop = false; e.stopImmediatePropagation(); return; }
    if (focus && focusPushed) { e.stopImmediatePropagation(); setFocus(false, { fromPop: true }); }
  };
  window.addEventListener('popstate', onPop, true);
  const onFsChange = () => {
    // System exit (gesture / notification shade) — same path as back button so scroll is restored
    if (!fsEl() && fsEntered && focus) setFocus(false, { fromPop: true });
  };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  document.getElementById('btn-focus').addEventListener('click', (e) => { e.stopPropagation(); setFocus(true); });

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
    const raw = Math.min(time - previousFrameTime, 64);
    previousFrameTime = time;
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (maxY <= 0 || window.scrollY >= maxY - 2) {
      if (hasMore()) { autoScrollFrame = requestAnimationFrame(autoScrollTick); return; }
      stopAutoScroll();
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    if (Math.abs(window.scrollY - autoPos) > 4 && !swipe.active) autoPos = window.scrollY;
    if (mode === 'swipe') {
      if (!swipe.active) {
        swipe.wait -= raw;
        if (swipe.wait <= 0) {
          const dist = Math.min(window.innerHeight * 0.55, maxY - autoPos);
          if (dist < 1) {
            swipe.wait = 200;
          } else {
            const period = dist / autoScrollSpeed;
            swipe.dist = dist;
            swipe.dur = Math.min(650, period * 700);
            swipe.wait = Math.max(0, period * 1000 - swipe.dur);
            swipe.from = autoPos;
            swipe.start = time;
            swipe.active = true;
          }
        }
      } else {
        const t = Math.min(1, (time - swipe.start) / swipe.dur);
        autoPos = swipe.from + swipe.dist * (1 - Math.pow(1 - t, 3));
        window.scrollTo({ top: Math.round(autoPos * dpr) / dpr, behavior: 'instant' });
        if (t >= 1) swipe.active = false;
      }
    } else {
      smoothDelta += (raw - smoothDelta) * 0.12;
      smoothVel += (autoScrollSpeed - smoothVel) * Math.min(1, raw / 350);
      autoPos = Math.min(maxY, autoPos + smoothVel * smoothDelta / 1000);
      window.scrollTo({ top: Math.round(autoPos * dpr) / dpr, behavior: 'instant' });
    }
    if (window.scrollY >= maxY - 2 && !hasMore()) { stopAutoScroll(); return; }
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
    smoothVel = 0;
    swipe.active = false;
    swipe.wait = 0;
    autoPos = window.scrollY;
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
    if (focus) return;
    if (e.target.closest('a, button, .reader__end, .reader-drawer, .reader-settings')) return;
    if (scrolling && !autoScrolling) return;
    if (uiVisible) hideUI();
    else showUI();
  });

  let progressSaveTimer = null;
  const pagesEl = document.getElementById('reader-pages');
  const endEl = document.getElementById('reader-end');
  const sentinel = document.getElementById('reader-sentinel');
  const topTitle = readerEl.querySelector('.reader__top-title');
  const segs = [{ url, title: d.title, el: null, prev, next }];
  let curIdx = 0;
  let loadingNext = false;
  let loadFailed = false;
  const hasMore = () => continuous && !!segs[segs.length - 1].next && !loadFailed;
  const segTop = (k) => (k === 0 ? 0 : segs[k].el.getBoundingClientRect().top + window.scrollY);
  const segEnd = (k) => (k + 1 < segs.length ? segTop(k + 1) : document.documentElement.scrollHeight);
  const syncEnd = () => { endEl.hidden = hasMore(); };
  const updateReadingProgress = () => {
    const top0 = segTop(curIdx);
    const span = Math.max(1, segEnd(curIdx) - top0 - window.innerHeight);
    const ratio = Math.max(0, Math.min(1, (window.scrollY - top0) / span));
    progressFill.style.transform = `scaleX(${ratio})`;
    readingProgress.set(segs[curIdx].url, ratio);
  };
  const setCurrent = (k) => {
    if (k === curIdx) return;
    updateReadingProgress();
    curIdx = k;
    const seg = segs[k];
    if (topTitle) topTitle.textContent = seg.title || '';
    try { window.history.replaceState(window.history.state, '', link('read', seg.url)); } catch { /* ignore */ }
    document.getElementById('nav-prev').outerHTML = navPrev(seg.prev);
    document.getElementById('nav-next').outerHTML = navNext(seg.next);
    drawer.querySelectorAll('.reader-drawer__item').forEach((a) => {
      const on = a.getAttribute('href') === link('read', seg.url);
      a.classList.toggle('is-active', on);
    });
    if (s) {
      const prevHist = history.lastFor(s.url);
      const readList = Array.from(new Set([seg.url, ...((prevHist && prevHist.read) || [])])).slice(0, 500);
      history.push({ url: s.url, title: s.title, poster: s.poster, chapterUrl: seg.url, chapterTitle: seg.title, read: readList });
    }
    updateReadingProgress();
  };
  const syncSeg = () => {
    const edge = window.innerHeight * 0.35;
    for (let k = segs.length - 1; k > 0; k -= 1) {
      if (segs[k].el.getBoundingClientRect().top <= edge) { setCurrent(k); return; }
    }
    setCurrent(0);
  };
  const appendNext = async () => {
    if (loadingNext || !hasMore() || !alive()) return;
    loadingNext = true;
    const from = segs[segs.length - 1];
    try {
      const nd = await api('/api/read?url=' + encodeURIComponent(from.next.url));
      if (!alive()) return;
      const nb = neighbors(nd, from.next.url);
      const title = nb.title || nd.title || '';
      const divider = document.createElement('div');
      divider.className = 'reader__divider';
      divider.setAttribute('role', 'separator');
      const split = (t) => { const m = String(t || '').match(/^([^:]+):\s*(.+)$/); return m ? { main: m[1].trim(), sub: m[2].trim() } : { main: String(t || 'Chapter berikutnya').trim(), sub: '' }; };
      const done = split(from.title);
      const up = split(title);
      divider.innerHTML = `
        <div class="reader__divider-done"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>${esc(done.main)} selesai</span></div>
        <div class="reader__divider-arrows" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 8l6 6 6-6"/></svg><svg viewBox="0 0 24 24"><path d="M6 8l6 6 6-6"/></svg><svg viewBox="0 0 24 24"><path d="M6 8l6 6 6-6"/></svg></div>
        <div class="reader__divider-card">
          <span class="reader__divider-tag">Chapter berikutnya</span>
          <strong class="reader__divider-main">${esc(up.main)}</strong>
          ${up.sub ? `<span class="reader__divider-sub">${esc(up.sub)}</span>` : ''}
        </div>`;
      dividerIO.observe(divider);
      const frag = document.createDocumentFragment();
      frag.append(divider);
      (nd.images || []).forEach((src, index) => {
        const im = document.createElement('img');
        im.className = 'reader__page';
        im.loading = index < 3 ? 'eager' : 'lazy';
        im.decoding = 'async';
        im.alt = '';
        im.src = img(src);
        frag.append(im);
      });
      pagesEl.append(frag);
      segs.push({ url: from.next.url, title, el: divider, prev: nb.prev, next: nb.next });
      endEl.querySelector('.reader__end-actions').innerHTML = endPrev(nb.prev) + endNext(nb.next);
    } catch {
      loadFailed = true;
      setTimeout(() => { loadFailed = false; syncEnd(); watch(); }, 4000);
    } finally {
      loadingNext = false;
      syncEnd();
      watch();
    }
  };
  const dividerIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); dividerIO.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -12% 0px' });
  let sentinelIO = null;
  const watch = () => {
    sentinelIO?.disconnect();
    if (!hasMore() || !alive()) return;
    sentinelIO = new IntersectionObserver((entries) => {
      if (entries.some((x) => x.isIntersecting)) appendNext();
    }, { rootMargin: '0px 0px 2600px 0px' });
    sentinelIO.observe(sentinel);
  };
  continuousInput.addEventListener('change', () => {
    continuous = continuousInput.checked;
    try { localStorage.setItem('rimwa:continuous', continuous ? '1' : '0'); } catch { /* storage may be unavailable */ }
    syncEnd();
    watch();
  });
  syncEnd();
  watch();
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
    syncSeg();
    const y = window.scrollY;
    if (Math.abs(y - lastScrollY) > 4 && !autoScrolling) {
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
    clearTimeout(toastTimer);
    window.removeEventListener('popstate', onPop, true);
    document.removeEventListener('fullscreenchange', onFsChange);
    document.removeEventListener('webkitfullscreenchange', onFsChange);
    leaveFs();
    clearTimeout(progressSaveTimer);
    updateReadingProgress();
    sentinelIO?.disconnect();
    dividerIO.disconnect();
    stopAutoScroll();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('rimwa:routechange', cleanup, { once: true });
}
