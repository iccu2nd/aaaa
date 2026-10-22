import { api } from '../api.js';
import { cardGrid } from '../components/card.js';
import { feed } from '../components/feed.js';
import { section, skeletonGrid } from '../components/section.js';

export async function home({ root, alive }) {
  root.innerHTML = section('Rekomendasi Populer', skeletonGrid(12));
  const [popular, updates] = await Promise.all([
    api('/api/home').catch(() => []),
    api('/api/update').catch(() => [])
  ]);

  if (!alive()) return;

  // Tampilkan semua data komik tanpa dibatasi
  root.innerHTML =
    section('Rekomendasi Populer', cardGrid(popular), '#/explore') +
    section('Update Terbaru', feed(updates), '#/update');
}
