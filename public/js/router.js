import { esc } from './utils.js';

const routes = [];
let current = 0;
let started = false;
let rootElement = null;

export const route = (pattern, handler) => routes.push({ pattern, handler });

function decodeRouteParam(part, pathname) {
  if (part == null) return '';
  let decoded;
  try { decoded = decodeURIComponent(part); } catch { decoded = part; }
  if (!/^\/(?:detail|read)\//.test(pathname)) return decoded;
  // New URLs use Base64URL; old URLs containing a literal source URL remain supported.
  if (/^https?:\/\//i.test(decoded)) return decoded;
  if (!/^[A-Za-z0-9_-]{24,}$/.test(decoded)) return decoded;
  try {
    const base64 = decoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - decoded.length % 4) % 4);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const value = new TextDecoder().decode(bytes);
    return /^https?:\/\//i.test(value) ? value : decoded;
  } catch { return decoded; }
}

function normalizeLegacyHash() {
  if (!location.hash || !location.hash.startsWith('#/')) return false;
  const legacy = location.hash.slice(1);
  history.replaceState(history.state, '', legacy);
  return true;
}

export function navigate(to, { replace = false, scroll = true } = {}) {
  const target = new URL(to, location.origin);
  if (target.origin !== location.origin) {
    location.href = target.href;
    return;
  }
  const next = `${target.pathname}${target.search}${target.hash}`;
  const now = `${location.pathname}${location.search}${location.hash}`;
  if (next === now) {
    if (rootElement) runRoute({ scroll: false });
    return;
  }
  if (replace) history.replaceState(history.state, '', next);
  else history.pushState({}, '', next);
  if (rootElement) runRoute({ scroll });
}

async function runRoute({ scroll = false } = {}) {
  if (!rootElement) return;
  // Notify active pages before replacing their DOM so reader timers/RAF are always stopped.
  window.dispatchEvent(new Event('rimwa:routechange'));
  const token = ++current;
  const pathname = location.pathname || '/';
  const pathWithQuery = `${pathname}${location.search}`;
  document.body.classList.toggle('is-reader', /^\/read\//.test(pathname));
  document.body.classList.toggle('is-detail', /^\/detail\//.test(pathname));
  markActive(pathname);
  if (scroll) window.scrollTo({ top: 0, behavior: 'auto' });
  window.dispatchEvent(new Event('rimwa:chrome-reset'));

  const ctx = { root: rootElement, alive: () => token === current };
  for (const { pattern, handler } of routes) {
    const match = pathWithQuery.match(pattern) || pathname.match(pattern);
    if (!match) continue;
    try {
      const params = match.slice(1).map((part) => decodeRouteParam(part, pathname));
      await handler(ctx, ...params);
    } catch (error) {
      if (ctx.alive()) {
        document.body.classList.remove('is-reader', 'is-detail');
        rootElement.innerHTML = `<div class="state state--error">${esc(error?.message || 'Terjadi kesalahan. Coba lagi.')}</div>`;
      }
    }
    return;
  }
  if (ctx.alive()) rootElement.innerHTML = '<div class="state">Halaman tidak ditemukan.</div>';
}

function markActive(pathname) {
  const segment = (pathname.split('/')[1] || 'home').split('?')[0];
  const active = segment === 'explore' ? 'search' : ['detail', 'read', 'update'].includes(segment) ? '' : segment;
  document.querySelectorAll('[data-nav]').forEach((anchor) => {
    if (active && anchor.dataset.nav === active) anchor.setAttribute('aria-current', 'page');
    else anchor.removeAttribute('aria-current');
  });
}

export function start(root) {
  rootElement = root;
  normalizeLegacyHash();
  if (!started) {
    started = true;
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest('a[href]');
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      const raw = anchor.getAttribute('href');
      if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return;
      const target = new URL(raw, location.href);
      if (target.origin !== location.origin) return;
      event.preventDefault();
      navigate(`${target.pathname}${target.search}${target.hash}`);
    });
    addEventListener('popstate', () => {
      normalizeLegacyHash();
      runRoute();
    });
    addEventListener('hashchange', () => {
      if (normalizeLegacyHash()) runRoute({ scroll: true });
    });
  }
  runRoute();
}
