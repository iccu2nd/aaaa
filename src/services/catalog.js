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
 * Cuplikan chapter: deteksi wajah via pasangan mata + zona kulit,
 * crop mencakup rambut → dagu. Cepat (gambar kecil, max 4 kandidat).
 */
async function fetchImageBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 7000,
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

function lumAt(data, width, channels, x, y) {
  const i = (y * width + x) * channels;
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

function skinScore(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = max === 0 ? 0 : (max - min) / max;
  const dRG = r - g;
  const dRB = r - b;
  if (lum < 50 || lum > 240 || sat > 0.55) return 0;
  // fair
  if (r > 140 && g > 100 && b > 80 && dRG > 3 && dRB > 10 && sat > 0.03 && sat < 0.4) return 3;
  // medium
  if (r > 95 && r > g && g >= b * 0.8 && lum > 70 && lum < 210 && sat > 0.06) return 2.6;
  // warm
  if (r > 70 && r > g + 5 && g > b && lum > 55 && lum < 170 && sat > 0.08) return 2.2;
  return 0;
}

/**
 * Cari pasangan mata (dua titik gelap horizontal di area kulit),
 * lalu perluas ke rambut (atas) dan dagu (bawah).
 */
function findFaceFocus(data, width, height, channels) {
  // Downsample step for speed
  const step = Math.max(1, Math.floor(Math.min(width, height) / 64));
  const skinMap = [];
  let white = 0;
  let total = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      total += 1;
      if (lum > 225 && sat < 0.1) {
        white += 1;
        continue;
      }
      const sk = skinScore(r, g, b);
      if (sk > 0) skinMap.push({ x, y, sk, lum });
    }
  }

  const whiteRatio = total ? white / total : 1;
  if (whiteRatio > 0.58) return { pageScore: -1, focus: null };
  if (skinMap.length < 8) return { pageScore: -0.5, focus: null };

  // Local darkness: candidate eye points = darker than neighborhood, on/near skin
  const eyePts = [];
  const eyeStep = step * 2;
  for (let y = Math.floor(height * 0.08); y < Math.floor(height * 0.72); y += eyeStep) {
    for (let x = Math.floor(width * 0.1); x < Math.floor(width * 0.9); x += eyeStep) {
      const L = lumAt(data, width, channels, x, y);
      if (L > 95 || L < 8) continue;
      // must be near skin
      let nearSkin = false;
      for (const s of skinMap) {
        if (Math.abs(s.x - x) < width * 0.12 && Math.abs(s.y - y) < height * 0.1) {
          nearSkin = true;
          break;
        }
      }
      if (!nearSkin) continue;
      // darker than left/right neighbors (pupil/eyelash)
      const Lx1 = x > eyeStep ? lumAt(data, width, channels, x - eyeStep, y) : L;
      const Lx2 = x + eyeStep < width ? lumAt(data, width, channels, x + eyeStep, y) : L;
      const Ly1 = y > eyeStep ? lumAt(data, width, channels, x, y - eyeStep) : L;
      const Ly2 = y + eyeStep < height ? lumAt(data, width, channels, x, y + eyeStep) : L;
      const around = (Lx1 + Lx2 + Ly1 + Ly2) / 4;
      if (around - L < 12) continue;
      eyePts.push({ x, y, depth: around - L });
    }
  }

  // Pair eyes: similar Y, reasonable horizontal distance
  let bestPair = null;
  const minDist = width * 0.06;
  const maxDist = width * 0.42;
  for (let i = 0; i < eyePts.length; i += 1) {
    for (let j = i + 1; j < eyePts.length; j += 1) {
      const a = eyePts[i];
      const b = eyePts[j];
      const dy = Math.abs(a.y - b.y);
      const dx = Math.abs(a.x - b.x);
      if (dy > height * 0.06) continue;
      if (dx < minDist || dx > maxDist) continue;
      const score = a.depth + b.depth + dx * 0.02 - dy * 0.05;
      // prefer upper half
      const midY = (a.y + b.y) / 2;
      const upperBoost = 1 + (1 - midY / height) * 0.4;
      const final = score * upperBoost;
      if (!bestPair || final > bestPair.score) {
        bestPair = {
          score: final,
          x: (a.x + b.x) / 2,
          y: midY,
          eyeDist: dx,
        };
      }
    }
  }

  if (bestPair) {
    // Expand: rambut di atas mata, dagu di bawah
    // eye line at pair.y; hair ~ 0.9*eyeDist above; chin ~ 1.35*eyeDist below
    const faceH = bestPair.eyeDist * 2.4;
    const faceCenterY = bestPair.y + bestPair.eyeDist * 0.25; // sedikit di bawah mata (tengah wajah)
    const faceCenterX = bestPair.x;

    // clamp so hair+chin stay in frame for object-position
    let posY = (faceCenterY / height) * 100;
    let posX = (faceCenterX / width) * 100;
    // bias sedikit ke atas supaya rambut ikut kelihatan di crop cover
    posY = posY - (bestPair.eyeDist / height) * 15;
    posY = Math.max(16, Math.min(52, posY));
    posX = Math.max(22, Math.min(78, posX));

    const pageScore =
      bestPair.score * 0.15 +
      (1 - whiteRatio) * 3 +
      Math.min(4, skinMap.length / 40);

    return {
      pageScore,
      focus: { x: Math.round(posX), pos: Math.round(posY), score: bestPair.score },
    };
  }

  // Fallback: pusat massa area kulit (bukan teks) — tetap usahakan rambut-dagu
  let sx = 0;
  let sy = 0;
  let sw = 0;
  for (const s of skinMap) {
    // abaikan sepertiga bawah (kaki)
    if (s.y > height * 0.75) continue;
    if (s.y < height * 0.05) continue;
    sx += s.x * s.sk;
    sy += s.y * s.sk;
    sw += s.sk;
  }
  if (sw < 1) return { pageScore: -0.2, focus: null };

  const cx = sx / sw;
  const cy = sy / sw;
  // geser ke atas sedikit untuk rambut
  let posY = (cy / height) * 100 - 6;
  let posX = (cx / width) * 100;
  posY = Math.max(18, Math.min(50, posY));
  posX = Math.max(24, Math.min(76, posX));

  const pageScore = (1 - whiteRatio) * 2 + Math.min(3, skinMap.length / 50);
  return {
    pageScore,
    focus: { x: Math.round(posX), pos: Math.round(posY), score: pageScore },
  };
}

async function analyzeFocus(url) {
  try {
    const buf = await fetchImageBuffer(url);
    // kecil & cepat; cukup untuk pasangan mata
    const { data, info } = await sharp(buf)
      .rotate()
      .resize(80, 260, { fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    if (!width || !height || channels < 3) return null;
    return findFaceFocus(data, width, height, channels);
  } catch {
    return null;
  }
}

function candidateIndexes(n, seed) {
  let lo = 0;
  let hi = n - 1;
  if (n >= 16) {
    lo = Math.floor(n * 0.3);
    hi = Math.floor(n * 0.65);
  } else if (n >= 10) {
    lo = Math.floor(n * 0.25);
    hi = Math.floor(n * 0.68);
  } else if (n >= 6) {
    lo = 2;
    hi = n - 3;
  } else if (n >= 3) {
    lo = 1;
    hi = n - 2;
  }
  if (hi < lo) hi = lo;
  const span = hi - lo + 1;
  const picks = new Set();
  const count = Math.min(4, span);
  for (let s = 0; s < count; s += 1) {
    picks.add(lo + Math.floor(((s + 0.5) * span) / count + (seed % 3)) % span);
  }
  picks.add(lo + Math.floor(span / 2));
  return [...picks].slice(0, 4);
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

  // paralel max 4, timeout singkat sudah di axios
  const results = await Promise.all(
    idxs.map(async (i) => {
      const analysis = await analyzeFocus(imgs[i]);
      return { i, analysis };
    }),
  );

  for (const row of results) {
    if (!row.analysis || !row.analysis.focus) continue;
    if (row.analysis.pageScore < 0) continue;
    if (!best || row.analysis.pageScore > best.analysis.pageScore) best = row;
  }

  if (best && best.analysis.focus) {
    return {
      status: true,
      data: {
        url: imgs[best.i],
        pos: best.analysis.focus.pos,
        x: best.analysis.focus.x,
      },
    };
  }

  const mid = idxs[Math.floor(idxs.length / 2)] ?? idxs[0];
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
