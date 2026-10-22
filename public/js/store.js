const KEYS = { bookmarks: 'rimwa:bookmarks', history: 'rimwa:history' };

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
