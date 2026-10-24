import { bookmarks, history, libraryBackup } from '../store.js';

const ico = {
  user: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 19c0-3.4 3-5.5 7-5.5s7 2.1 7 5.5"/></svg>',
  gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M5.2 18.8l1.4-1.4M17.4 6.6l1.4-1.4"/></svg>',
  chevron: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  download: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10M8 10l4 4 4-4M6 18h12"/></svg>',
  upload: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14V4M8 8l4-4 4 4M6 18h12"/></svg>',
  phone: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/></svg>',
};

export function profile({ root }) {
  const bm = bookmarks.list().length;
  const hist = history.list().length;

  root.innerHTML = `
    <section class="profile-page profile-page--guest">
      <div class="profile-hero">
        <div class="profile-avatar" aria-hidden="true">${ico.user}</div>
        <h1 class="profile-hero__title">Guest reader</h1>
        <p class="profile-hero__sub">Library tersimpan hanya di perangkat ini</p>
        <div class="profile-hero__stats">
          <span><strong>${bm}</strong> bookmark</span>
          <span class="profile-hero__dot">·</span>
          <span><strong>${hist}</strong> riwayat</span>
        </div>
      </div>

      <p class="profile-section-label">APP</p>
      <div class="profile-menu" role="list">
        <button type="button" class="profile-menu__item" id="btn-settings" role="listitem">
          <span class="profile-menu__ico">${ico.gear}</span>
          <span class="profile-menu__text">
            <span class="profile-menu__title">Settings</span>
            <span class="profile-menu__desc">Cadangan data &amp; pasang aplikasi</span>
          </span>
          <span class="profile-menu__chev">${ico.chevron}</span>
        </button>
      </div>

      <div class="profile-settings" id="profile-settings" hidden>
        <p class="profile-section-label">SETTINGS</p>
        <div class="profile-menu" role="list">
          <button type="button" class="profile-menu__item" id="btn-install" hidden>
            <span class="profile-menu__ico">${ico.phone}</span>
            <span class="profile-menu__text">
              <span class="profile-menu__title">Pasang aplikasi</span>
              <span class="profile-menu__desc">Tambahkan Komikta ke layar utama</span>
            </span>
            <span class="profile-menu__chev">${ico.chevron}</span>
          </button>
          <button type="button" class="profile-menu__item" id="backup-export">
            <span class="profile-menu__ico">${ico.download}</span>
            <span class="profile-menu__text">
              <span class="profile-menu__title">Ekspor backup</span>
              <span class="profile-menu__desc">Simpan bookmark &amp; riwayat ke file</span>
            </span>
            <span class="profile-menu__chev">${ico.chevron}</span>
          </button>
          <label class="profile-menu__item" for="backup-file">
            <span class="profile-menu__ico">${ico.upload}</span>
            <span class="profile-menu__text">
              <span class="profile-menu__title">Impor backup</span>
              <span class="profile-menu__desc">Pulihkan data dari file JSON</span>
            </span>
            <span class="profile-menu__chev">${ico.chevron}</span>
          </label>
          <input id="backup-file" type="file" accept="application/json,.json" hidden>
        </div>
        <p class="profile-settings__hint" id="install-hint" hidden></p>
        <p class="profile-settings__status" id="backup-status" role="status" aria-live="polite"></p>
      </div>
    </section>`;

  const settingsPanel = root.querySelector('#profile-settings');
  const status = root.querySelector('#backup-status');
  const installBtn = root.querySelector('#btn-install');
  const installHint = root.querySelector('#install-hint');

  root.querySelector('#btn-settings').addEventListener('click', () => {
    const open = settingsPanel.hidden;
    settingsPanel.hidden = !open;
  });

  const paintInstall = () => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (standalone) {
      installBtn.hidden = true;
      installHint.hidden = false;
      installHint.textContent = 'Aplikasi sudah terpasang di perangkat ini.';
      return;
    }
    if (window.__rimwaInstall) {
      installBtn.hidden = false;
      installHint.hidden = true;
    } else {
      installBtn.hidden = true;
      installHint.hidden = false;
      installHint.textContent = 'Untuk memasang: menu browser → Add to Home Screen / Install app.';
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
    const a = document.createElement('a');
    a.href = url;
    a.download = `komikta-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    status.textContent = 'Backup berhasil dibuat.';
  });

  root.querySelector('#backup-file').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!window.confirm('Impor backup akan mengganti bookmark dan riwayat di perangkat ini. Lanjutkan?')) return;
      libraryBackup.import(data);
      status.textContent = 'Backup berhasil diimpor. Memuat ulang…';
      setTimeout(() => location.reload(), 500);
    } catch (error) {
      status.textContent = error instanceof SyntaxError
        ? 'File JSON tidak bisa dibaca.'
        : (error.message || 'Backup gagal diimpor.');
    } finally {
      event.target.value = '';
    }
  });
}
