/**
 * Show/hide topbar + bottom-nav on scroll (halaman utama).
 * Reader/detail: chrome global sudah di-hide lewat body class.
 */
const topbar = () => document.getElementById('topbar');
const bottomNav = () => document.getElementById('bottom-nav');

let lastY = 0;
let ticking = false;
let enabled = true;

function pageAllowsChromeScroll() {
  const b = document.body;
  return !b.classList.contains('is-reader') && !b.classList.contains('is-detail');
}

function setHidden(hidden) {
  const t = topbar();
  const n = bottomNav();
  if (t) t.classList.toggle('is-hidden', hidden);
  if (n) n.classList.toggle('is-hidden', hidden);
  document.body.classList.toggle('chrome-collapsed', hidden);
}

function onScroll() {
  if (!enabled || !pageAllowsChromeScroll()) {
    setHidden(false);
    return;
  }
  const y = window.scrollY || 0;
  const delta = y - lastY;
  // di puncak selalu tampil
  if (y < 24) {
    setHidden(false);
    lastY = y;
    return;
  }
  // scroll turun cukup → sembunyi; naik → muncul
  if (delta > 8) setHidden(true);
  else if (delta < -8) setHidden(false);
  lastY = y;
}

function onScrollRaf() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    onScroll();
    ticking = false;
  });
}

export function initChrome() {
  lastY = window.scrollY || 0;
  setHidden(false);
  window.addEventListener('scroll', onScrollRaf, { passive: true });
  window.addEventListener('rimwa:routechange', () => {
    lastY = 0;
    setHidden(false);
  });
  // pastikan class body berubah (reader/detail) → chrome reset
  const obs = new MutationObserver(() => {
    if (!pageAllowsChromeScroll()) setHidden(false);
  });
  obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

export function resetChrome() {
  lastY = window.scrollY || 0;
  setHidden(false);
}
