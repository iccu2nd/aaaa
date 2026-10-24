import { route, start, navigate } from './router.js';
import { home } from './pages/home.js';
import { explore } from './pages/explore.js';
import { library } from './pages/library.js';
import { profile } from './pages/profile.js';
import { detail } from './pages/detail.js';
import { reader } from './pages/reader.js';
import { update } from './pages/update.js';
import { initChrome } from './chrome.js';

route(/^\/$/, home);
route(/^\/update$/, update); // legacy route; updates remain accessible from Home
route(/^\/explore\/genre\/(.+)$/, (ctx, genre) => {
  const query = new URLSearchParams(location.search);
  return explore(ctx, query.get('q') || '', genre || query.get('genre') || '', query.get('sort') || 'latest', query.get('format') || '', 'browse');
});
route(/^\/explore$/, (ctx) => {
  const query = new URLSearchParams(location.search);
  // mode browse dari bottom-nav Explore — tanpa panel Recent searches
  return explore(ctx, query.get('q') || '', query.get('genre') || '', query.get('sort') || 'latest', query.get('format') || '', 'browse');
});
// /search = dari ikon search di Home — tampilkan Recent searches + live search
route(/^\/search$/, (ctx) => {
  const query = new URLSearchParams(location.search);
  return explore(ctx, query.get('q') || '', query.get('genre') || '', query.get('sort') || 'latest', query.get('format') || '', 'search');
});
route(/^\/library$/, library);
route(/^\/profile$/, profile);
route(/^\/detail\/(.+)$/, detail);
route(/^\/read\/(.+)$/, reader);


start(document.getElementById('app'));

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

initChrome();

// Nuansa aplikasi: matikan menu long-press gambar
document.addEventListener('contextmenu', (e) => {
  if (e.target instanceof Element && e.target.closest('img, a, button')) e.preventDefault();
});

const notifBtn = document.getElementById('topbar-notif');
if (notifBtn) {
  notifBtn.addEventListener('click', () => {
    // placeholder — bisa dihubungkan ke feed notifikasi nanti
    notifBtn.classList.toggle('is-on');
  });
}


/* PWA install prompt (tersimpan; tombol Install bisa di Profile) */
window.__rimwaInstall = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__rimwaInstall = e;
  window.dispatchEvent(new Event('rimwa:caninstall'));
});
addEventListener('appinstalled', () => {
  window.__rimwaInstall = null;
});
