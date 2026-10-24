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
 * Cuplikan chapter untuk list.
 * Pilih panel yang kaya karakter/wajah, hindari balon teks, kaki, watermark.
 * object-position diarahkan ke zona wajah / momen menarik.
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

function isSkin(r, g, b, lum, sat) {
  const diffRG = r - g;
  const diffRB = r - b;
  // fair / light east-asian
  if (
    r > 145 && g > 105 && b > 85 &&
    diffRG > 4 && diffRB > 12 &&
    lum > 115 && lum < 235 && sat > 0.04 && sat < 0.42
  ) return 4.2;
  // medium
  if (
    r > 100 && r < 215 && g > 65 && b > 45 &&
    r > g && g >= b * 0.82 &&
    lum > 75 && lum < 205 && sat > 0.07 && sat < 0.52
  ) return 3.8;
  // warm / deeper
  if (
    r > 75 && r < 175 && g > 45 && b > 30 &&
    r > g + 6 && g > b &&
    lum > 55 && lum < 165 && sat > 0.1 && sat < 0.58
  ) return 3.2;
  // pale pinkish (blush / lips zone)
  if (
    r > 170 && g > 120 && b > 120 &&
    r > g + 10 && lum > 140 && lum < 230 && sat > 0.05 && sat < 0.35
  ) return 2.4;
  return 0;
}

/**
 * Skor keseluruhan halaman: tolak yang dominan teks/putih/watermark.
 * Return { pageScore, focus: {x, pos, score} } atau null jika jelek.
 */
function analyzePage(data, width, height, channels) {
  const cols = 10;
  const rows = 24;
  const cellW = width / cols;
  const cellH = height / rows;

  const skinC = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const edgeC = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const whiteC = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const darkC = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const pixC = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const colorVar = Array.from({ length: rows }, () => new Array(cols).fill(0));

  let totalWhite = 0;
  let totalSkin = 0;
  let totalPix = 0;

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

      pixC[ry][cx] += 1;
      totalPix += 1;

      // white / speech-bubble-like
      if (lum > 220 && sat < 0.1) {
        whiteC[ry][cx] += 1;
        totalWhite += 1;
        continue;
      }
      // near-black gutter
      if (lum < 18) {
        darkC[ry][cx] += 1;
        continue;
      }

      const sk = isSkin(r, g, b, lum, sat);
      if (sk > 0) {
        skinC[ry][cx] += sk;
        totalSkin += 1;
      }

      // edge / detail (mata, rambut, garis wajah)
      if (x + 1 < width) {
        const j = (y * width + (x + 1)) * channels;
        const dl =
          Math.abs(r - data[j]) +
          Math.abs(g - data[j + 1]) +
          Math.abs(b - data[j + 2]);
        if (dl > 45) edgeC[ry][cx] += 1;
      }
      if (y + 1 < height) {
        const j = ((y + 1) * width + x) * channels;
        const dl =
          Math.abs(r - data[j]) +
          Math.abs(g - data[j + 1]) +
          Math.abs(b - data[j + 2]);
        if (dl > 45) edgeC[ry][cx] += 0.7;
      }

      // color interest (aksi / efek)
      if (sat > 0.22 && lum > 40 && lum < 200) colorVar[ry][cx] += 1;
    }
  }

  const whiteRatio = totalPix ? totalWhite / totalPix : 1;
  const skinRatio = totalPix ? totalSkin / totalPix : 0;

  // Tolak halaman yang kebanyakan balon teks / putih
  if (whiteRatio > 0.55) {
    return { pageScore: -1, focus: null };
  }
  // Tolak yang hampir tanpa kulit/karakter (logo, pure FX, kaki saja sering rendah skin)
  // tapi jangan terlalu ketat — aksi gelap tetap boleh
  if (skinRatio < 0.01 && whiteRatio > 0.35) {
    return { pageScore: -1, focus: null };
  }

  // Grid score per cell
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let ry = 0; ry < rows; ry += 1) {
    for (let cx = 0; cx < cols; cx += 1) {
      const n = Math.max(1, pixC[ry][cx]);
      const whiteR = whiteC[ry][cx] / n;
      const skin = skinC[ry][cx] / n;
      const edge = edgeC[ry][cx] / n;
      const darkR = darkC[ry][cx] / n;
      const col = colorVar[ry][cx] / n;

      // hukuman keras untuk sel penuh teks putih
      if (whiteR > 0.45) {
        grid[ry][cx] = -2;
        continue;
      }

      let s = 0;
      s += skin * 1.15; // wajah/tubuh
      s += Math.min(2.8, edge * 0.12); // detail wajah
      s += Math.min(1.4, col * 0.08); // momen berwarna / epic
      s -= whiteR * 3.5; // teks
      s -= darkR * 0.4; // void

      // kaki/alas biasanya di sepertiga bawah — turunkan
      if (ry > rows * 0.78) s *= 0.35;
      // header / watermark sering di atas ekstrem
      if (ry < rows * 0.06) s *= 0.5;

      grid[ry][cx] = s;
    }
  }

  // smooth
  const smooth = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let ry = 0; ry < rows; ry += 1) {
    for (let cx = 0; cx < cols; cx += 1) {
      let sum = 0;
      let w = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const yy = ry + dy;
          const xx = cx + dx;
          if (yy < 0 || yy >= rows || xx < 0 || xx >= cols) continue;
          const ww = dy === 0 && dx === 0 ? 3 : 1;
          sum += grid[yy][xx] * ww;
          w += ww;
        }
      }
      smooth[ry][cx] = sum / w;
    }
  }

  // cari peak di zona wajah (atas–tengah, hindari kaki & header)
  const rowLo = Math.max(1, Math.floor(rows * 0.1));
  const rowHi = Math.min(rows - 2, Math.floor(rows * 0.68));
  const colLo = 1;
  const colHi = cols - 2;

  let best = { s: -99, r: rowLo, c: Math.floor(cols / 2) };
  for (let ry = rowLo; ry <= rowHi; ry += 1) {
    for (let cx = colLo; cx <= colHi; cx += 1) {
      // prefer sedikit ke tengah horizontal
      const centerBias = 1 + (1 - Math.abs(cx - (cols - 1) / 2) / (cols / 2)) * 0.1;
      // prefer sedikit ke atas (wajah di atas torso)
      const upperBias = 1 + ((rowHi - ry) / (rowHi - rowLo + 1)) * 0.12;
      const val = smooth[ry][cx] * centerBias * upperBias;
      if (val > best.s) best = { s: val, r: ry, c: cx };
    }
  }

  if (best.s < 0.15) {
    return { pageScore: best.s, focus: null };
  }

  // cluster di sekitar peak
  const thresh = best.s * 0.7;
  let r0 = best.r;
  let r1 = best.r;
  let c0 = best.c;
  let c1 = best.c;
  for (let ry = rowLo; ry <= rowHi; ry += 1) {
    for (let cx = colLo; cx <= colHi; cx += 1) {
      if (
        smooth[ry][cx] >= thresh &&
        Math.abs(ry - best.r) <= 3 &&
        Math.abs(cx - best.c) <= 3
      ) {
        if (ry < r0) r0 = ry;
        if (ry > r1) r1 = ry;
        if (cx < c0) c0 = cx;
        if (cx > c1) c1 = cx;
      }
    }
  }

  // pusat wajah: bias ke atas cluster
  const faceRow = r0 + (r1 - r0) * 0.28;
  const faceCol = (c0 + c1) / 2;
  const y = Math.round(((faceRow + 0.5) / rows) * 100);
  const x = Math.round(((faceCol + 0.5) / cols) * 100);

  // pageScore: kombinasikan kualitas halaman + kekuatan fokus
  const pageScore =
    best.s * 2.2 +
    skinRatio * 8 -
    whiteRatio * 6 +
    (1 - Math.abs(0.35 - y / 100)) * 0.5;

  return {
    pageScore,
    focus: {
      x: Math.max(22, Math.min(78, x)),
      pos: Math.max(14, Math.min(55, y)),
      score: best.s,
    },
  };
}

async function analyzeFocus(url) {
  try {
    const buf = await fetchImageBuffer(url);
    // resolusi sampel lebih tinggi sedikit agar mata/wajah kebaca
    const { data, info } = await sharp(buf)
      .rotate()
      .resize(96, 320, { fit: 'inside', withoutEnlargement: true })
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
  // Skip keras intro/iklan/watermark awal & credit akhir
  let lo = 0;
  let hi = n - 1;
  if (n >= 16) {
    lo = Math.floor(n * 0.28);
    hi = Math.floor(n * 0.68);
  } else if (n >= 10) {
    lo = Math.floor(n * 0.22);
    hi = Math.floor(n * 0.7);
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
  // sebar merata di zona aman + sedikit offset seed
  const steps = Math.min(6, span);
  for (let s = 0; s < steps; s += 1) {
    const offset = Math.floor((s * span) / steps);
    picks.add(lo + ((offset + (seed % Math.max(1, Math.floor(span / steps)))) % span));
  }
  picks.add(lo + Math.floor(span / 2));
  return [...picks].slice(0, 6);
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

  // fallback: panel tengah, fokus upper-mid (zona wajah tipikal)
  const mid = idxs[Math.floor(idxs.length / 2)] ?? idxs[0];
  return {
    status: true,
    data: { url: imgs[mid], pos: 30, x: 50 },
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
