const KEYS = { bookmarks: 'rimwa:bookmarks', history: 'rimwa:history', progress: 'rimwa:progress' };

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export const bookmarks = {
  list: () => read(KEYS.bookmarks),
  has: (url) => read(KEYS.bookmarks).some((b) => b.url === url),
  toggle(item) {
    const list = read(KEYS.bookmarks);
    const i = list.findIndex((b) => b.url === item.url);
    if (i >= 0) list.splice(i, 1); else list.unshift(item);
    write(KEYS.bookmarks, list);
    return i < 0;
  },
};

export const history = {
  list: () => read(KEYS.history),
  push(item) {
    const list = read(KEYS.history).filter((h) => h.url !== item.url);
    list.unshift(item);
    write(KEYS.history, list.slice(0, 30));
  },
  lastFor: (url) => read(KEYS.history).find((h) => h.url === url),
  readChapters: (url) => new Set((read(KEYS.history).find((h) => h.url === url) || {}).read || []),
};


// Posisi baca disimpan per chapter agar pembaca bisa melanjutkan dari bagian terakhir.
export const readingProgress = {
  list: () => { try { return JSON.parse(localStorage.getItem(KEYS.progress)) || {}; } catch { return {}; } },
  get: (chapterUrl) => { const all = readingProgress.list(); return Number(all[chapterUrl]) || 0; },
  set(chapterUrl, ratio) {
    if (!chapterUrl) return;
    const all = readingProgress.list();
    all[chapterUrl] = Math.max(0, Math.min(1, Number(ratio) || 0));
    try { localStorage.setItem(KEYS.progress, JSON.stringify(all)); } catch { /* storage may be unavailable */ }
  },
  clear(chapterUrl) {
    const all = readingProgress.list();
    if (chapterUrl) delete all[chapterUrl]; else Object.keys(all).forEach((key) => delete all[key]);
    try { localStorage.setItem(KEYS.progress, JSON.stringify(all)); } catch { /* storage may be unavailable */ }
  },
};

export const libraryBackup = {
  export() { return { app: 'Komikta', version: 1, exportedAt: new Date().toISOString(), bookmarks: bookmarks.list(), history: history.list(), progress: readingProgress.list() }; },
  import(data) {
    if (!data || !['Komikta', 'RiMwa'].includes(data.app) || !Array.isArray(data.bookmarks) || !Array.isArray(data.history)) throw new Error('File backup tidak valid.');
    const safeItems = (items) => items.filter((item) => item && typeof item === 'object' && typeof item.url === 'string' && typeof item.title === 'string').slice(0, 500);
    write(KEYS.bookmarks, safeItems(data.bookmarks));
    write(KEYS.history, safeItems(data.history).slice(0, 30));
    const progress = data.progress && typeof data.progress === 'object' && !Array.isArray(data.progress) ? data.progress : {};
    try { localStorage.setItem(KEYS.progress, JSON.stringify(progress)); } catch { /* storage may be unavailable */ }
  },
};
