import { api } from '../api.js';
import { feed } from '../components/feed.js';
import { section } from '../components/section.js';

export async function update({ root, alive }) {
  root.innerHTML = section('Update Terbaru', `<div class="grid explore-grid">${'<div class="explore-skeleton loading-surface"></div>'.repeat(8)}</div>`);
  const items = await api('/api/update');
  if (!alive()) return;
  root.innerHTML = section('Update Terbaru', feed(items));
}
