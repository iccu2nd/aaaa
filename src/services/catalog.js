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
 * Deteksi area wajah/karakter (2D grid).
 * Kombinasi: skin-tone multi-etnis + tepi/detail + hindari balon teks & gutter.
 * Mengembalikan object-position x/y (%) yang mengarahkan crop ke wajah.
 */
function analyzeGrid(data, width, height, channels) {
  const cols = 12;
  const rows = 20;
  const scores = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const counts = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const edge = Array.from({ length: rows }, () => new Array(cols).fill(0));

  const cellW = width / cols;
  const cellH = height / rows;

  // Pass 1: color / skin / midtone
  for (let y = 0; y < height; y += 1) {
    const ry = Math.min(rows - 1, Math.floor(y / cellH));
    for (let x = 0; x < width; x += 1) {
      const cx = Math.min(cols - 1, Math.floor(x / cellW));
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = max === 0 ? 0 : (max - min) / max;
      const diffRG = r - g;
      const diffRB = r - b;

      // gutter / pure bg
      if (lum < 10 || lum > 248) continue;
      // speech bubble / white panel
      if (lum > 225 && sat < 0.07) continue;

      let s = 0;

      // --- multi skin ranges (manhwa: light east-asian, tan, warm) ---
      // light / fair
      if (
        r > 140 && g > 100 && b > 80 &&
        diffRG > 5 && diffRB > 15 &&
        lum > 110 && lum < 235 && sat > 0.05 && sat < 0.45
      ) s += 4.0;
      // medium
      if (
        r > 95 && r < 210 && g > 60 && b > 40 &&
        r > g && g >= b * 0.85 &&
        lum > 70 && lum < 200 && sat > 0.08 && sat < 0.55
      ) s += 3.5;
      // deeper / warm
      if (
        r > 70 && r < 170 && g > 40 && b > 25 &&
        r > g + 8 && g > b &&
        lum > 50 && lum < 160 && sat > 0.1 && sat < 0.6
      ) s += 3.0;

      // hair / dark features near face
      if (lum > 15 && lum < 75 && sat < 0.3) s += 0.55;
      // saturated mid (eyes, clothes near bust-up)
      if (sat > 0.2 && lum > 35 && lum < 190) s += 0.9;
      // general living midtone
      if (lum > 45 && lum < 205 && sat > 0.04) s += 0.25;

      scores[ry][cx] += s;
      counts[ry][cx] += 1;

      // simple horizontal edge (detail)
      if (x + 1 < width) {
        const j = (y * width + (x + 1)) * channels;
        const dl =
          Math.abs(r - data[j]) +
          Math.abs(g - data[j + 1]) +
          Math.abs(b - data[j + 2]);
        if (dl > 40) edge[ry][cx] += 1;
      }
    }
  }

  // normalize + blend edge
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let ry = 0; ry < rows; ry += 1) {
    for (let cx = 0; cx < cols; cx += 1) {
      const n = counts[ry][cx] || 1;
      const color = scores[ry][cx] / n;
      const ed = edge[ry][cx] / n;
      grid[ry][cx] = color + Math.min(2.2, ed * 0.08);
    }
  }

  // smooth 3x3
  const smooth = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let ry = 0; ry < rows; ry += 1) {
    for (let cx = 0; cx < cols; cx += 1) {
      let sum = 0;
      let wsum = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const yy = ry + dy;
          const xx = cx + dx;
          if (yy < 0 || yy >= rows || xx < 0 || xx >= cols) continue;
          const w = dy === 0 && dx === 0 ? 2.5 : 1;
          sum += grid[yy][xx] * w;
          wsum += w;
        }
      }
      smooth[ry][cx] = sum / wsum;
    }
  }

  // cari peak di zona wajah tipikal (bukan footer/header)
  const rowLo = Math.max(1, Math.floor(rows * 0.08));
  const rowHi = Math.min(rows - 2, Math.floor(rows * 0.72)); // wajah jarang di kaki
  const colLo = 1;
  const colHi = cols - 2;

  let best = { s: -1, r: rowLo, c: Math.floor(cols / 2) };
  for (let ry = rowLo; ry <= rowHi; ry += 1) {
    for (let cx = colLo; cx <= colHi; cx += 1) {
      // slight preference upper-center (close-up faces)
      const bias = 1 + (1 - Math.abs(cx - (cols - 1) / 2) / cols) * 0.08;
      const val = smooth[ry][cx] * bias;
      if (val > best.s) best = { s: val, r: ry, c: cx };
    }
  }

  if (best.s <= 0.05) return null;

  // expand cluster around peak for more stable center
  const thresh = best.s * 0.78;
  let r0 = best.r;
  let r1 = best.r;
  let c0 = best.c;
  let c1 = best.c;
  for (let ry = rowLo; ry <= rowHi; ry += 1) {
    for (let cx = colLo; cx <= colHi; cx += 1) {
      if (smooth[ry][cx] >= thresh && Math.abs(ry - best.r) <= 3 && Math.abs(cx - best.c) <= 3) {
        if (ry < r0) r0 = ry;
        if (ry > r1) r1 = ry;
        if (cx < c0) c0 = cx;
        if (cx > c1) c1 = cx;
      }
    }
  }

  // bias sedikit ke atas cluster (mata/wajah di atas centroid tubuh)
  const faceRow = r0 + (r1 - r0) * 0.32;
  const faceCol = (c0 + c1) / 2;

  const y = Math.round(((faceRow + 0.5) / rows) * 100);
  const x = Math.round(((faceCol + 0.5) / cols) * 100);

  return {
    x: Math.max(20, Math.min(80, x)),
    pos: Math.max(16, Math.min(58, y)),
    score: best.s,
  };
}

async function analyzeFocus(url) {
  try {
    const buf = await fetchImageBuffer(url);
    const { data, info } = await sharp(buf)
      .rotate()
      .resize(72, 240, { fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    if (!width || !height || channels < 3) return null;

    return analyzeGrid(data, width, height, channels);
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
      data: { url: imgs[best.i], pos: best.focus.pos, x: best.focus.x ?? 50 },
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
