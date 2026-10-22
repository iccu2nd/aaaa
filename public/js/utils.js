export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Bungkus URL gambar lewat proxy server. */
export const img = (u) => (u ? '/api/img?url=' + encodeURIComponent(u) : '');

export const link = (path, arg = '') => '#/' + path + (arg ? '/' + encodeURIComponent(arg) : '');
