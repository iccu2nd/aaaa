import { api } from '../api.js';
import { feed } from '../components/feed.js';
import { section } from '../components/section.js';
import { stage, fillRest } from '../images.js';

export async function update({ root, alive }) {
  root.innerHTML = section('Update Terbaru', `<div class="grid explore-grid">${'<div class="explore-skeleton loading-surface"></div>'.repeat(8)}</div>`);
  const items = await api('/api/update');
  if (!alive()) return;
  const box = await stage(section('Update Terbaru', feed(items)), { first: 10 });
  if (!alive()) return;
  root.replaceChildren(...box.childNodes);
  fillRest(root, alive);
}
