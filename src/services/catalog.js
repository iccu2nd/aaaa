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
const { ANALYZE_WIDTH, FACE_MIN_SCORE, findFace, findArt } = require('./faceFocus');

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
    authors: Array.isArray(c.authors) ? c.authors : (c.author ? [c.author] : []),
    author: Array.isArray(c.authors) && c.authors[0] ? c.authors[0] : (c.author || ''),
    formats: Array.isArray(c.formats) ? c.formats : (c.format ? [c.format] : []),
    format: Array.isArray(c.formats) && c.formats[0]
      ? c.formats[0]
      : (c.format || (Array.isArray(c.types) && c.types[0]) || c.type || ''),
    source: c.source,
  }));
  return { status: data.length > 0, data, message: data.length ? undefined : 'Daftar kosong' };
};

/**
 * Cuplikan chapter — prioritaskan wajah/karakter, tolak balon teks.
 * Cepat: resize kecil, max 5 kandidat, reject agresif panel putih/teks.
 */
async function fetchImageBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 9000,
    maxContentLength: 12 * 1024 * 1024,
    headers: {
      'User-Agent': THUMB_UA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://shinigami.id/',
    },
    validateStatus: (s) => s >= 200 && s < 400,
  });
  return Buffer.from(res.data);
}

async function analyzeFocus(url) {
  try {
    const buf = await fetchImageBuffer(url);
    const { data, info } = await sharp(buf, { limitInputPixels: 80e6 })
      .rotate()
      .resize({ width: ANALYZE_WIDTH })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    if (!width || !height || channels < 3) return null;
    return {
      face: findFace(data, width, height, channels),
      art: findArt(data, width, height, channels),
    };
  } catch {
    return null;
  }
}

function candidateIndexes(n) {
  let lo = 0;
  let hi = n - 1;
  if (n >= 20) {
    lo = Math.floor(n * 0.2);
    hi = Math.floor(n * 0.8);
  } else if (n >= 12) {
    lo = Math.floor(n * 0.2);
    hi = Math.floor(n * 0.8);
  } else if (n >= 7) {
    lo = 1;
    hi = n - 2;
  } else if (n >= 4) {
    lo = 1;
    hi = n - 1;
  }
  if (hi < lo) hi = lo;
  const span = hi - lo + 1;
  const count = Math.min(7, span);
  const picks = new Set();
  for (let s = 0; s < count; s += 1) picks.add(lo + Math.floor(((s + 0.5) * span) / count));
  return [...picks];
}

const thumb = async (chapterUrl) => {
  const r = await read(chapterUrl);
  if (!r.status) return r;
  const imgs = (r.data.images || []).filter(Boolean);
  if (!imgs.length) return { status: false, message: 'Tidak ada gambar' };

  const idxs = candidateIndexes(imgs.length);
  const results = await Promise.all(
    idxs.map(async (i) => ({ i, a: await analyzeFocus(imgs[i]) })),
  );

  let bestFace = null;
  let bestArt = null;
  for (const row of results) {
    if (!row.a) continue;
    if (row.a.face && row.a.face.score >= FACE_MIN_SCORE && (!bestFace || row.a.face.score > bestFace.f.score)) {
      bestFace = { i: row.i, f: row.a.face };
    }
    if (row.a.art && (!bestArt || row.a.art.score > bestArt.f.score)) bestArt = { i: row.i, f: row.a.art };
  }

  const pick = bestFace || bestArt;
  if (!pick) {
    const mid = Math.min(imgs.length - 1, Math.max(1, Math.floor(imgs.length * 0.4)));
    return { status: true, data: { url: imgs[mid], fx: 0.5, fy: 0.3, fw: 0.6, face: false, v: 6 } };
  }
  const { f } = pick;
  return {
    status: true,
    data: {
      url: imgs[pick.i],
      fx: +f.fx.toFixed(4),
      fy: +f.fy.toFixed(4),
      fw: +f.fw.toFixed(4),
      face: !!bestFace,
      v: 6,
    },
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
