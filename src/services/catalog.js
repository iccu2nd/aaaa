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
    timeout: 6500,
    maxContentLength: 3 * 1024 * 1024,
    headers: {
      'User-Agent': THUMB_UA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://shinigami.id/',
    },
    validateStatus: (s) => s >= 200 && s < 400,
  });
  return Buffer.from(res.data);
}

function skinScore(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = max === 0 ? 0 : (max - min) / max;
  if (lum < 45 || lum > 235 || sat > 0.58) return 0;
  const dRG = r - g;
  const dRB = r - b;
  // fair / east-asian
  if (r > 145 && g > 105 && b > 85 && dRG > 4 && dRB > 12 && sat > 0.04 && sat < 0.4) return 4;
  // medium
  if (r > 100 && r > g && g >= b * 0.82 && lum > 70 && lum < 205 && sat > 0.07 && sat < 0.5) return 3.4;
  // warm
  if (r > 75 && r > g + 6 && g > b && lum > 55 && lum < 165 && sat > 0.09 && sat < 0.55) return 2.8;
  // blush / lip zone
  if (r > 165 && g > 115 && b > 115 && dRG > 8 && lum > 130 && lum < 225 && sat < 0.35) return 2.2;
  return 0;
}

/**
 * Analisis satu panel.
 * pageScore < 0 = tolak (teks/balon/putih).
 * focus = object-position ke wajah.
 */
function analyzePage(data, width, height, channels) {
  const stepX = Math.max(1, Math.floor(width / 48));
  const stepY = Math.max(1, Math.floor(height / 80));

  let total = 0;
  let white = 0;
  let inkOnWhite = 0; // indikasi teks di balon
  let skinW = 0;
  let skinN = 0;
  let colorN = 0;

  // histogram Y untuk zona kulit terbaik
  const bands = 20;
  const skinBand = new Array(bands).fill(0);
  const whiteBand = new Array(bands).fill(0);
  const bandCount = new Array(bands).fill(0);
  const skinXs = [];
  const skinYs = [];

  for (let y = 0; y < height; y += stepY) {
    const bi = Math.min(bands - 1, Math.floor((y / height) * bands));
    for (let x = 0; x < width; x += stepX) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = max === 0 ? 0 : (max - min) / max;
      total += 1;
      bandCount[bi] += 1;

      // putih / balon
      if (lum > 215 && sat < 0.12) {
        white += 1;
        whiteBand[bi] += 1;
        // tinta teks: tetangga gelap di area putih
        if (x + stepX < width) {
          const j = (y * width + (x + stepX)) * channels;
          const lum2 = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
          if (lum2 < 90) inkOnWhite += 1;
        }
        continue;
      }

      if (sat > 0.2 && lum > 40 && lum < 200) colorN += 1;

      const sk = skinScore(r, g, b);
      if (sk > 0) {
        skinW += sk;
        skinN += 1;
        skinBand[bi] += sk;
        skinXs.push(x);
        skinYs.push(y);
      }
    }
  }

  if (!total) return { pageScore: -1, focus: null };

  const whiteRatio = white / total;
  const skinRatio = skinN / total;
  const textHint = inkOnWhite / total;
  const colorRatio = colorN / total;

  // —— TOLAK panel balon teks / hampir putih ——
  if (whiteRatio > 0.42) return { pageScore: -3, focus: null };
  if (whiteRatio > 0.32 && textHint > 0.02) return { pageScore: -2.5, focus: null };
  if (skinRatio < 0.02 && whiteRatio > 0.25) return { pageScore: -2, focus: null };
  if (skinRatio < 0.015 && colorRatio < 0.08) return { pageScore: -1.5, focus: null };

  // band terbaik untuk wajah (hindari kaki & header)
  let bestBand = 3;
  let bestBandS = -1;
  const loB = Math.max(1, Math.floor(bands * 0.1));
  const hiB = Math.min(bands - 2, Math.floor(bands * 0.65));
  for (let i = loB; i <= hiB; i += 1) {
    const n = Math.max(1, bandCount[i]);
    const s = skinBand[i] / n - (whiteBand[i] / n) * 2;
    if (s > bestBandS) {
      bestBandS = s;
      bestBand = i;
    }
  }

  // centroid kulit di sekitar best band (±2 band)
  let sx = 0;
  let sy = 0;
  let sw = 0;
  const yLo = ((bestBand - 1.2) / bands) * height;
  const yHi = ((bestBand + 2.2) / bands) * height;
  for (let k = 0; k < skinXs.length; k += 1) {
    const y = skinYs[k];
    if (y < yLo || y > yHi) continue;
    // skip ekstrem kiri/kanan sedikit
    const x = skinXs[k];
    sx += x;
    sy += y;
    sw += 1;
  }

  // fallback: semua kulit di zona aman
  if (sw < 4) {
    sx = 0;
    sy = 0;
    sw = 0;
    for (let k = 0; k < skinXs.length; k += 1) {
      const y = skinYs[k];
      if (y < height * 0.08 || y > height * 0.72) continue;
      sx += skinXs[k];
      sy += y;
      sw += 1;
    }
  }

  if (sw < 2) return { pageScore: -1, focus: null };

  const cx = sx / sw;
  const cy = sy / sw;

  // geser ke atas sedikit (rambut)
  let posY = (cy / height) * 100 - 5;
  let posX = (cx / width) * 100;
  posY = Math.max(16, Math.min(48, posY));
  posX = Math.max(25, Math.min(75, posX));

  // skor halaman: kulit tinggi, putih rendah, sedikit teks
  const pageScore =
    skinRatio * 28 +
    Math.min(6, skinW / 40) +
    colorRatio * 3 -
    whiteRatio * 18 -
    textHint * 40 +
    (bestBandS > 0 ? bestBandS * 2 : 0);

  if (pageScore < 0.8) return { pageScore: -0.5, focus: null };

  return {
    pageScore,
    focus: {
      x: Math.round(posX),
      pos: Math.round(posY),
      score: pageScore,
    },
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
    return analyzePage(data, width, height, channels);
  } catch {
    return null;
  }
}

function candidateIndexes(n, seed) {
  // Skip intro watermark & ending credit lebih agresif
  let lo = 0;
  let hi = n - 1;
  if (n >= 20) {
    lo = Math.floor(n * 0.32);
    hi = Math.floor(n * 0.62);
  } else if (n >= 12) {
    lo = Math.floor(n * 0.28);
    hi = Math.floor(n * 0.65);
  } else if (n >= 7) {
    lo = 2;
    hi = n - 3;
  } else if (n >= 4) {
    lo = 1;
    hi = n - 2;
  }
  if (hi < lo) hi = lo;
  const span = hi - lo + 1;
  const picks = new Set();
  const count = Math.min(5, span);
  for (let s = 0; s < count; s += 1) {
    picks.add(lo + Math.floor(((s + 0.35) * span) / count) % span);
  }
  // sedikit offset seed agar chapter beda tidak sama semua
  picks.add(lo + ((Math.floor(span / 2) + (seed % Math.max(1, span))) % span));
  return [...picks].slice(0, 5);
}

const thumb = async (chapterUrl) => {
  const r = await read(chapterUrl);
  if (!r.status) return r;
  const imgs = (r.data.images || []).filter(Boolean);
  if (!imgs.length) return { status: false, message: 'Tidak ada gambar' };

  let h = 0;
  for (const ch of String(chapterUrl)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;

  const idxs = candidateIndexes(imgs.length, h);
  const results = await Promise.all(
    idxs.map(async (i) => {
      const analysis = await analyzeFocus(imgs[i]);
      return { i, analysis };
    }),
  );

  let best = null;
  for (const row of results) {
    if (!row.analysis || !row.analysis.focus) continue;
    if (row.analysis.pageScore < 0.8) continue;
    if (!best || row.analysis.pageScore > best.analysis.pageScore) best = row;
  }

  if (best) {
    return {
      status: true,
      data: {
        url: imgs[best.i],
        pos: best.analysis.focus.pos,
        x: best.analysis.focus.x,
      },
    };
  }

  // fallback: coba index tengah-tengah chapter (bukan page 0)
  const mid = Math.min(
    imgs.length - 1,
    Math.max(1, Math.floor(imgs.length * 0.4) + (h % Math.max(1, Math.floor(imgs.length * 0.15)))),
  );
  return {
    status: true,
    data: { url: imgs[mid], pos: 28, x: 50 },
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
