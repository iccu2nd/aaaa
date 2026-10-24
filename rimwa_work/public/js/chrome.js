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

let acc = 0;
let hidden = false;

function onScroll() {
  if (!enabled || !pageAllowsChromeScroll()) {
    if (hidden) { hidden = false; setHidden(false); }
    return;
  }
  const y = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
  const delta = y - lastY;
  lastY = y;
  if (y < 48) {
    acc = 0;
    if (hidden) { hidden = false; setHidden(false); }
    return;
  }
  if (delta === 0) return;
  if (Math.sign(delta) !== Math.sign(acc)) acc = 0;
  acc += delta;
  if (acc > 24 && !hidden) { hidden = true; setHidden(true); acc = 0; }
  else if (acc < -16 && hidden) { hidden = false; setHidden(false); acc = 0; }
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
  document.addEventListener('scroll', onScrollRaf, { passive: true, capture: true });
  window.addEventListener('rimwa:routechange', () => {
    lastY = 0;
    acc = 0;
    hidden = false;
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
  acc = 0;
  hidden = false;
  setHidden(false);
}
