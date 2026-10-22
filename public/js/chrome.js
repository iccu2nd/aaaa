const THRESHOLD = 10;
const TOP_ZONE = 24;

export function initChrome() {
  const topbar = document.getElementById('topbar');
  const nav = document.getElementById('bottom-nav');
  if (!topbar || !nav) return;

  let lastY = window.scrollY;
  let ticking = false;
  let hidden = false;

  const set = (value) => {
    if (hidden === value) return;
    hidden = value;
    topbar.classList.toggle('is-hidden', value);
    nav.classList.toggle('is-hidden', value);
  };

  const update = () => {
    ticking = false;
    const body = document.body;
    if (body.classList.contains('is-reader') || body.classList.contains('is-detail')) {
      lastY = window.scrollY;
      set(false);
      return;
    }
    const y = Math.max(0, window.scrollY);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const delta = y - lastY;
    if (y <= TOP_ZONE || y >= max - 2) set(false);
    else if (Math.abs(delta) >= THRESHOLD) set(delta > 0);
    if (Math.abs(delta) >= THRESHOLD || y <= TOP_ZONE) lastY = y;
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });

  window.addEventListener('rimwa:chrome-reset', () => {
    lastY = window.scrollY;
    set(false);
  });

  document.addEventListener('focusin', (event) => {
    if (event.target.closest?.('input, textarea')) set(false);
  });
}
