export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Bungkus URL gambar lewat proxy server. */
export const img = (u) => (u ? '/api/img?url=' + encodeURIComponent(u) : '');

/**
 * URL aplikasi. Detail/reader menyimpan URL sumber sebagai token Base64URL agar
 * domain provider tidak terbaca di address bar. Ini obfuscation URL, bukan enkripsi.
 */
const encodeOpaque = (value) => {
  const bytes = new TextEncoder().encode(String(value));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const link = (path, arg = '') => {
  const cleanPath = String(path || '').replace(/^\/+|\/+$/g, '');
  if (!arg) return '/' + cleanPath;
  const value = String(arg);
  const segment = ['detail', 'read'].includes(cleanPath) && /^https?:\/\//i.test(value)
    ? encodeOpaque(value)
    : encodeURIComponent(value);
  return '/' + cleanPath + '/' + segment;
};
