import { route, start } from './router.js';
import { home } from './pages/home.js';
import { update } from './pages/update.js';
import { explore } from './pages/explore.js';
import { library } from './pages/library.js';
import { detail } from './pages/detail.js';
import { reader } from './pages/reader.js';

route(/^\/$/, home);
route(/^\/update$/, update);
route(/^\/explore$/, explore);
route(/^\/search\/?(.*)$/, explore);
route(/^\/library$/, library);
route(/^\/detail\/(.+)$/, detail);
route(/^\/read\/(.+)$/, reader);

const input = document.getElementById('search-input');
document.getElementById('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = input.value.trim();
  location.hash = q ? '#/search/' + encodeURIComponent(q) : '#/explore';
  input.blur();
});
addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); input.select(); }
});

start(document.getElementById('app'));
