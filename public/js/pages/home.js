import { api } from '../api.js';
import { cardGrid } from '../components/card.js';
import { feed } from '../components/feed.js';
import { section, skeletonGrid } from '../components/section.js';

export async function home({ root, alive }) {
  root.innerHTML = section('Rekomendasi', skeletonGrid(6));
  const [popular, updates] = await Promise.all([api('/api/home'), api('/api/update').catch(() => [])]);
  if (!alive()) return;
  root.innerHTML =
    section('Rekomendasi', cardGrid(popular.slice(0, 12)), '#/explore') +
    section('Update Terbaru', feed(updates.slice(0, 12)), '#/update');
}
