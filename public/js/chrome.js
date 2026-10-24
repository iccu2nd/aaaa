/**
 * Sembunyikan topbar + bottom-nav saat scroll ke bawah, munculkan saat scroll ke atas.
 * Reader/detail memakai chrome sendiri, jadi dilewati.
 */
const body = document.body;
let lastY = 0;
let ticking = false;
let away = false;

const allowed = () => !body.classList.contains('is-reader') && !body.classList.contains('is-detail');

function setAway(next) {
  if (away === next) return;
  away = next;
  body.classList.toggle('nav-away', next);
}

function update() {
  ticking = false;
  if (!allowed()) { setAway(false); return; }
  const root = document.scrollingElement || document.documentElement;
  const y = Math.max(0, root.scrollTop || window.scrollY || 0);
  const delta = y - lastY;
  const nearEnd = root.scrollHeight - (y + window.innerHeight) < 90;
  if (y < 56 || nearEnd) setAway(false);
  else if (delta > 6) setAway(true);
  else if (delta < -6) setAway(false);
  lastY = y;
}

function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(update);
}

export function resetChrome() {
  lastY = window.scrollY || 0;
  setAway(false);
}

export function initChrome() {
  resetChrome();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('rimwa:routechange', resetChrome);
}
