import { bookmarks, history } from '../store.js';

export function profile({ root }) {
  root.innerHTML = `
    <section class="profile-page">
      <div class="profile-page__avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M4.8 20c.8-3.4 3.3-5.2 7.2-5.2s6.4 1.8 7.2 5.2"/></svg></div>
      <h1>Profile</h1>
      <p class="profile-page__copy">Halaman profil sedang disiapkan dan akan hadir pada pembaruan berikutnya.</p>
      <div class="profile-page__stats"><div><strong>${bookmarks.list().length}</strong><span>Bookmark</span></div><div><strong>${history.list().length}</strong><span>Riwayat baca</span></div></div>
      <a class="btn btn--secondary profile-page__library" href="#/library">Buka Library</a>
    </section>`;
}
