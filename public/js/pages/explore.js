import { api } from '../api.js';
import { cardGrid } from '../components/card.js';
import { section, skeletonGrid } from '../components/section.js';

export async function explore({ root, alive }, q = '') {
  const input = document.getElementById('search-input');
  if (input) input.value = q;
  const title = q ? `Hasil: ${q}` : 'Explore';
  root.innerHTML = section(title, skeletonGrid(18));
  const items = await api('/api/search?q=' + encodeURIComponent(q));
  if (!alive()) return;
  root.innerHTML = section(title, cardGrid(items));
}
