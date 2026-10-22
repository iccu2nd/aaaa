import { api } from '../api.js';
import { cardGrid } from '../components/card.js';
import { feed } from '../components/feed.js';
import { section, skeletonGrid } from '../components/section.js';

export async function home({ root, alive }) {
  root.innerHTML =
    section('Rekomendasi', skeletonGrid(12)) +
    section('Update Terbaru', '<div class="state">Memuat…</div>');

  const [popular, updates] = await Promise.all([
    api('/api/home'),
    api('/api/update').catch(() => []),
  ]);
  if (!alive()) return;

  // Tampilkan semua, tanpa potong
  root.innerHTML =
    section('Rekomendasi', cardGrid(popular), '#/explore') +
    section('Update Terbaru', feed(updates), '#/update');
}
