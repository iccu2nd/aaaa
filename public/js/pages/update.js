import { api } from '../api.js';
import { feed } from '../components/feed.js';
import { section, state } from '../components/section.js';

export async function update({ root, alive }) {
  root.innerHTML = state('Memuat…');
  const items = await api('/api/update');
  if (!alive()) return;
  root.innerHTML = section('Update Terbaru', feed(items));
}
