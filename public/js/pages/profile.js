import { bookmarks, history, libraryBackup } from '../store.js';

export function profile({ root }) {
  root.innerHTML = `
    <section class="profile-page">
      <img class="profile-page__logo" src="/icons/rimwa-logo.png" width="88" height="88" alt="RiMwa">
      <h1>RiMwa</h1>
      <p class="profile-page__copy">Baca manhwa &amp; manga<br>cepat, rapi, bisa offline.</p>
      <div class="profile-page__stats">
        <div><strong>${bookmarks.list().length}</strong><span>Bookmark</span></div>
        <div><strong>${history.list().length}</strong><span>Riwayat baca</span></div>
      </div>
      <button class="btn btn--brand profile-page__install" id="btn-install" type="button" hidden>Pasang aplikasi</button>
      <p class="profile-page__install-hint" id="install-hint" hidden></p>
      <a class="btn btn--secondary profile-page__library" href="/library">Buka Library</a>
      <section class="profile-backup" aria-labelledby="profile-backup-title">
        <h2 id="profile-backup-title">Cadangan data</h2>
        <p>Ekspor bookmark dan riwayat agar tidak hilang saat ganti browser atau perangkat. Impor backup akan mengganti data lokal saat ini.</p>
        <button class="btn btn--secondary" id="backup-export" type="button">Ekspor backup</button>
        <label class="profile-backup__import btn btn--secondary" for="backup-file">Impor backup</label>
        <input id="backup-file" type="file" accept="application/json,.json" hidden>
        <p class="profile-backup__status" id="backup-status" role="status" aria-live="polite"></p>
      </section>
    </section>`;

  const status = root.querySelector('#backup-status');
  const installBtn = root.querySelector('#btn-install');
  const installHint = root.querySelector('#install-hint');

  const paintInstall = () => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (standalone) {
      installBtn.hidden = true;
      installHint.hidden = false;
      installHint.textContent = 'Aplikasi sudah terpasang.';
      return;
    }
    if (window.__rimwaInstall) {
      installBtn.hidden = false;
      installHint.hidden = true;
    } else {
      installBtn.hidden = true;
      installHint.hidden = false;
      installHint.textContent = 'Untuk memasang: menu browser → “Add to Home Screen” / “Install app”.';
    }
  };
  paintInstall();
  window.addEventListener('rimwa:caninstall', paintInstall, { once: true });

  installBtn.addEventListener('click', async () => {
    const ev = window.__rimwaInstall;
    if (!ev) return;
    ev.prompt();
    await ev.userChoice;
    window.__rimwaInstall = null;
    paintInstall();
  });

  root.querySelector('#backup-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(libraryBackup.export(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `rimwa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    status.textContent = 'Backup berhasil dibuat.';
  });
  root.querySelector('#backup-file').addEventListener('change', async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!window.confirm('Impor backup akan mengganti bookmark dan riwayat yang ada di perangkat ini. Lanjutkan?')) return;
      libraryBackup.import(data); status.textContent = 'Backup berhasil diimpor. Memuat ulang data…';
      setTimeout(() => location.reload(), 500);
    } catch (error) {
      status.textContent = error instanceof SyntaxError ? 'File JSON tidak bisa dibaca.' : (error.message || 'Backup gagal diimpor.');
    } finally { event.target.value = ''; }
  });
}
