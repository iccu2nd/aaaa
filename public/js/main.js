import { route, start } from './router.js';
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
route(/^\/explore\/genre\/(.+)$/, (ctx, genre) => explore(ctx, '', genre));
route(/^\/explore$/, (ctx) => explore(ctx));
route(/^\/search$/, (ctx) => {
  const query = new URLSearchParams(location.search);
  return explore(ctx, query.get('q') || '', query.get('genre') || '', query.get('sort') || 'popular');
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
