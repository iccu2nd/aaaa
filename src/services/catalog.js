'use strict';

/**
 * Gabungan Shinigami + Voratoon.
 * Dedupe berdasarkan judul yang dinormalisasi.
 * Prioritas: Shinigami menang jika judul sama.
 */

const shinigami = require('./shinigami');
const voratoon = require('./voratoon');
const axios = require('axios');
const sharp = require('sharp');

const THUMB_UA =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36';

function normTitle(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Gabung array kartu, buang duplikat judul. first wins (panggil shinigami dulu). */
function dedupeCards(lists) {
  const seen = new Map();
  const out = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const key = normTitle(item.title);
      if (!key || seen.has(key)) continue;
      seen.set(key, true);
      out.push(item);
    }
  }
  return out;
}

function dedupeFeed(lists) {
  const seen = new Map();
  const out = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const key = normTitle(item.title);
      if (!key || seen.has(key)) continue;
      seen.set(key, true);
      out.push(item);
    }
  }
  return out;
}

async function settle(promise) {
  try {
    const r = await promise;
    if (r && r.status && Array.isArray(r.data)) return r.data;
    return [];
  } catch {
    return [];
  }
}

function detectSource(url) {
  const u = String(url || '').toLowerCase();
  if (u.includes('shinigami') || u.includes('shngm')) return 'shinigami';
  if (u.includes('voratoon')) return 'voratoon';
  // UUID murni → shinigami
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(url || '').trim())) {
    return 'shinigami';
  }
  return 'shinigami';
}

const home = async () => {
  const [a, b] = await Promise.all([
    settle(shinigami.home()),
    settle(voratoon.home()),
  ]);
  // Shinigami first → menang saat judul sama
  return { status: true, data: dedupeCards([a, b]) };
};

const update = async () => {
  const [a, b] = await Promise.all([
    settle(shinigami.update()),
    settle(voratoon.update()),
  ]);
  return { status: true, data: dedupeFeed([a, b]) };
};

const search = async (query) => {
  const q = String(query || '').trim();
  if (!q) {
    // tanpa query = list gabungan
    return home();
  }
  const [a, b] = await Promise.all([
    settle(shinigami.search(q)),
    settle(voratoon.search(q)),
  ]);
  return { status: true, data: dedupeCards([a, b]) };
};

/** Semua manhwa dari kedua sumber (tanpa limit), kartu ringkas. */
const all = async (query = '') => {
  const q = String(query || '').trim();
  const [a, b] = await Promise.all([
    settle(shinigami.all(q)),
    settle(voratoon.all(q)),
  ]);
  const data = dedupeCards([a, b]).map((c) => ({
    title: c.title,
    poster: c.poster,
    url: c.url,
    chapter: c.chapter || '',
    latest_chapter: c.latest_chapter ?? null,
    latest_chapter_time: c.latest_chapter_time ?? null,
    chapters: Array.isArray(c.chapters) ? c.chapters.slice(0, 2) : undefined,
    user_rate: c.user_rate ?? c.rating ?? c.rate ?? null,
    views: c.views ?? c.view_count ?? c.views_count ?? null,
    status: c.status || '',
    meta: c.meta || '',
    genres: Array.isArray(c.genres) ? c.genres : [],
    source: c.source,
  }));
  return { status: data.length > 0, data, message: data.length ? undefined : 'Daftar kosong' };
};

/**
 * Cuplikan chapter untuk list.
 * Pilih panel tengah chapter, lalu analisis warna/detail supaya
 * object-position CSS mengarah ke area wajah/karakter (bukan langit/kaki).
 */
async function fetchImageBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 9000,
    maxContentLength: 4 * 1024 * 1024,
    headers: {
      'User-Agent': THUMB_UA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://shinigami.id/',
    },
    validateStatus: (s) => s >= 200 && s < 400,
  });
  return Buffer.from(res.data);
}

/**
 * Skor band horizontal: favor area yang mirip wajah/tubuh karakter.
 * - warna kulit / warna baju (mid-tone, saturasi sedang)
 * - detail (varian lokal) tinggi
 * - hindari putih polos (balon teks) & hitam polos (gutter)
 */
function scoreBands(data, width, height, channels) {
  const bands = 24;
  const scores = new Array(bands).fill(0);
  const counts = new Array(bands).fill(0);
  const rowH = height / bands;

  for (let y = 0; y < height; y += 1) {
    const bi = Math.min(bands - 1, Math.floor(y / rowH));
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = max === 0 ? 0 : (max - min) / max;

      // skip gutter / pure bg
      if (lum < 12 || lum > 245) continue;
      // skip very flat pale (speech bubble)
      if (lum > 220 && sat < 0.08) continue;

      let s = 0;
      // skin-ish: R dominant, mid brightness
      if (r > 70 && r > g && g > b * 0.75 && lum > 55 && lum < 230 && sat > 0.08 && sat < 0.65) {
        s += 3.2;
      }
      // hair / dark clothing near face
      if (lum > 20 && lum < 90 && sat < 0.35) s += 0.6;
      // saturated mid-tone (clothes, eyes, accent)
      if (sat > 0.18 && lum > 40 && lum < 200) s += 1.1;
      // general mid detail preference
      if (lum > 40 && lum < 210) s += 0.35;

      scores[bi] += s;
      counts[bi] += 1;
    }
  }

  // normalize + smooth with neighbors (faces span multiple bands)
  const norm = scores.map((s, i) => (counts[i] ? s / counts[i] : 0));
  const smooth = norm.map((_, i) => {
    const a = norm[Math.max(0, i - 1)] || 0;
    const b = norm[i] || 0;
    const c = norm[Math.min(bands - 1, i + 1)] || 0;
    return a * 0.2 + b * 0.6 + c * 0.2;
  });
  return smooth;
}

async function analyzeFocus(url) {
  try {
    const buf = await fetchImageBuffer(url);
    // sample kecil supaya cepat
    const { data, info } = await sharp(buf)
      .rotate() // respect EXIF
      .resize(48, 160, { fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    if (!width || !height || channels < 3) return null;

    const bands = scoreBands(data, width, height, channels);
    // hindari 10% paling atas & 15% paling bawah (langit / kaki / credit)
    const lo = Math.max(1, Math.floor(bands.length * 0.1));
    const hi = Math.min(bands.length - 2, Math.floor(bands.length * 0.85));

    let peak = 0;
    for (let i = lo; i <= hi; i += 1) {
      if (bands[i] > peak) peak = bands[i];
    }
    if (peak <= 0) return null;

    // Ambil rentang band yang mendekati peak (area karakter), lalu pakai pusatnya
    // supaya fokus di tengah wajah/tubuh, bukan di tepi area skor tinggi.
    const thresh = peak * 0.72;
    let left = lo;
    let right = hi;
    for (let i = lo; i <= hi; i += 1) {
      if (bands[i] >= thresh) {
        left = i;
        break;
      }
    }
    for (let i = hi; i >= lo; i -= 1) {
      if (bands[i] >= thresh) {
        right = i;
        break;
      }
    }
    // Bias sedikit ke atas dalam rentang (wajah biasanya di atas torso)
    const bestI = left + (right - left) * 0.35;
    const pos = Math.round(((bestI + 0.5) / bands.length) * 100);
    const clamped = Math.max(18, Math.min(58, pos));
    return { pos: clamped, score: peak };
  } catch {
    return null;
  }
}

function candidateIndexes(n, seed) {
  // Skip intro/iklan di awal & credit di akhir
  let lo = 0;
  let hi = n - 1;
  if (n >= 12) {
    lo = Math.floor(n * 0.22);
    hi = Math.floor(n * 0.72);
  } else if (n >= 6) {
    lo = 1;
    hi = n - 2;
  } else if (n >= 3) {
    lo = 1;
    hi = n - 1;
  }
  if (hi < lo) hi = lo;

  const span = hi - lo + 1;
  const primary = lo + (seed % span);
  // coba beberapa kandidat di sekitar primary
  const set = new Set([primary]);
  if (span > 1) set.add(lo + ((seed + Math.floor(span / 3)) % span));
  if (span > 2) set.add(lo + ((seed + Math.floor((2 * span) / 3)) % span));
  // panel tengah absolut sering bagus
  set.add(lo + Math.floor(span / 2));
  return [...set].slice(0, 3);
}

const thumb = async (chapterUrl) => {
  const r = await read(chapterUrl);
  if (!r.status) return r;
  const imgs = (r.data.images || []).filter(Boolean);
  if (!imgs.length) return { status: false, message: 'Tidak ada gambar' };

  let h = 0;
  for (const ch of String(chapterUrl)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;

  const idxs = candidateIndexes(imgs.length, h);
  let best = null;

  // Analisis paralel terbatas (maks 3 gambar)
  const results = await Promise.all(
    idxs.map(async (i) => {
      const focus = await analyzeFocus(imgs[i]);
      return { i, focus };
    }),
  );

  for (const row of results) {
    if (!row.focus) continue;
    if (!best || row.focus.score > best.focus.score) best = row;
  }

  if (best) {
    return {
      status: true,
      data: { url: imgs[best.i], pos: best.focus.pos, x: 50 },
    };
  }

  // fallback: panel primary + posisi karakter tipikal manhwa
  const fallbackIdx = idxs[0];
  return {
    status: true,
    data: { url: imgs[fallbackIdx], pos: 28 + (h % 14), x: 50 },
  };
};

const detail = async (url) => {
  const src = detectSource(url);
  const client = src === 'voratoon' ? voratoon : shinigami;
  const result = await client.detail(url);
  if (!result?.status) return result;
  return { status: true, data: result.data };
};

const read = async (url) => {
  const src = detectSource(url);
  const client = src === 'voratoon' ? voratoon : shinigami;
  const result = await client.read(url);
  if (!result?.status) return result;
  return { status: true, data: result.data };
};

module.exports = { home, search, update, detail, read, all, thumb, detectSource, normTitle };
