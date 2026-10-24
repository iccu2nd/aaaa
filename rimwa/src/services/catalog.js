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
const humanFace = require('./humanFace');
const { cropRect, cropDirt, THUMB_RATIO, ANALYZE_WIDTH, FACE_MIN_SCORE, findFace, findArt } = require('./faceFocus');

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
 * Cuplikan chapter — fokus wajah hanya di tengah halaman, hindari halaman promosi.
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

/** Unduh halaman lalu jalankan detektor model (bila aktif). Buffer selalu dikembalikan untuk cadangan. */
async function analyzeFocus(url, shared) {
  try {
    const buf = await fetchImageBuffer(url);
    const model = await humanFace.detectFace(buf, shared).catch(() => null);
    return { buf, model };
  } catch {
    return null;
  }
}

/** Cadangan tanpa model: wajah dari warna kulit, atau jendela gambar paling bersih. */
async function colorFocus(buf) {
  try {
    const { data, info } = await sharp(buf, { limitInputPixels: 80e6 })
      .rotate()
      .resize({ width: ANALYZE_WIDTH })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const face = findFace(data, info.width, info.height, 3);
    if (face && face.score >= FACE_MIN_SCORE && face.fx >= 0.28 && face.fx <= 0.72 && face.fy >= 0.22 && face.fy <= 0.78) {
      return { f: face, by: 'color', face: true };
    }
    // Jika wajah tidak berada di area tengah, gunakan crop tengah yang netral,
    // bukan mengejar wajah/banner promosi di pinggir gambar.
    return { f: { fx: 0.5, fy: 0.5, fw: 0, fh: 0, score: 0.01 }, by: 'center', face: false };
  } catch {
    return null;
  }
}

/** Ambil hanya halaman yang benar-benar dekat titik tengah chapter.
 * Halaman awal/akhir sering berisi sampul promosi, iklan, atau credit.
 */
function candidateIndexes(n) {
  if (!n) return [];
  const head = n >= 12 ? 3 : n >= 7 ? 2 : n >= 4 ? 1 : 0;
  const tail = n >= 12 ? 4 : n >= 7 ? 2 : n >= 4 ? 1 : 0;
  const lo = Math.min(n - 1, head);
  const hi = Math.max(lo, n - 1 - tail);
  const mid = Math.floor((lo + hi) / 2);
  // Maksimal 3 halaman berurutan di sekitar titik tengah, tanpa ekspansi ke luar.
  return [...new Set([mid - 1, mid, mid + 1].filter((i) => i >= lo && i <= hi))];
}

const thumbImage = async (chapterUrl) => {
  const r = await read(chapterUrl);
  if (!r.status) return r;
  const imgs = (r.data.images || []).filter(Boolean);
  if (!imgs.length) return { status: false, message: 'Tidak ada gambar' };

  // Model opsional: bila gagal dimuat, thumbnail tetap dibuat lewat cadangan warna/area
  await humanFace.getHuman().catch(() => null);

  const used = new Set();
  const shared = { best: 0 };
  const started = Date.now();
  const analyze = async (idxs) => {
    idxs.forEach((i) => used.add(i));
    const rows = await Promise.all(idxs.map(async (i) => ({ i, a: await analyzeFocus(imgs[i], shared) })));
    return rows.filter((row) => row.a && row.a.buf);
  };
  const modelCands = (rows) => rows
    .filter((row) => row.a.model)
    .map((row) => ({ by: 'model', row, f: row.a.model, face: true }));

  // Hanya halaman di sekitar titik tengah chapter; jangan ekspansi ke halaman promo.
  const rows = await analyze(candidateIndexes(imgs.length));
  let cands = modelCands(rows);
  if (!rows.length) return { status: false, message: 'Gambar chapter tidak bisa diunduh' };

  // Tanpa wajah dari model → warna kulit, lalu area paling bersih
  if (!cands.length) {
    const found = [];
    for (const row of rows) {
      const c = await colorFocus(row.a.buf);
      if (c) found.push({ by: c.by, row, f: c.f, face: c.face });
    }
    const faces = found.filter((x) => x.face);
    cands = faces.length ? faces : found;
  }
  if (!cands.length) return { status: false, message: 'Tidak ada area yang layak' };
  cands.sort((x, y) => y.f.score - x.f.score);

  let chosen = null;
  for (const c of cands.slice(0, 6)) {
    const meta = await sharp(c.row.a.buf).metadata();
    const rect = cropRect(meta.width, meta.height, c.f, c.face);
    const base = sharp(c.row.a.buf).rotate().extract(rect);
    const probe = await base.clone().resize(120).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const d = cropDirt(probe.data, probe.info.width, probe.info.height, probe.info.channels);
    const cur = { c, rect, base, dirt: d.dirt };
    if (d.clean) { chosen = cur; break; }
    if (!chosen || d.dirt < chosen.dirt) chosen = cur;
  }

  const out = await chosen.base
    .resize(240, Math.round(240 / THUMB_RATIO), { fit: 'cover' })
    .webp({ quality: 74 })
    .toBuffer();
  const { c } = chosen;
  return { status: true, data: out, face: c.face, by: c.by, score: c.f.score, page: c.row.i, rect: chosen.rect };
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

module.exports = { home, search, update, detail, read, all, thumbImage, analyzeFocus, candidateIndexes, detectSource, normTitle };
