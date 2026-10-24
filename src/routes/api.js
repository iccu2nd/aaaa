const { Router } = require('express');
const https = require('https');
const http = require('http');
const sharp = require('sharp');
const cfg = require('../config');
const cache = require('../services/cache');
const source = require('../services/catalog');
const { sourceUrl } = require('../middleware/validate');

const router = Router();
const handler = (key, ttl, fn) => async (req, res) => {
  const out = await cache.wrap(key(req), ttl, () => fn(req));
  // browser boleh pakai ulang sebentar, lalu revalidate di belakang layar
  if (out && out.status) {
    res.set('Cache-Control', `public, max-age=${Math.min(300, Math.floor(ttl / 2000))}, stale-while-revalidate=600`);
  }
  res.json(out);
};

const EXPLORE_SIZE = 60;
const allKey = (q) => 'all:' + q;
const loadAll = (q) => cache.wrap(allKey(q), cfg.ttl.all, () => source.all(q));

/** Dipanggil saat server start supaya Explore pertama sudah siap. */
router.warm = () => loadAll('').catch(() => {});

router.get('/home', handler(() => 'home', cfg.ttl.home, () => source.home()));
router.get('/update', handler(() => 'update', cfg.ttl.update, () => source.update()));
router.get(
  '/search',
  handler(
    (r) => 's:' + String(r.query.q || '').slice(0, 100),
    cfg.ttl.search,
    (r) => source.search(String(r.query.q || '').slice(0, 100)),
  ),
);
// Explore: SEMUA judul dari kedua sumber, dikirim per potongan (tanpa batas total)
router.get('/explore', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const genreRaw = String(req.query.genre || '').trim().slice(0, 200);
  const format = String(req.query.format || '').trim().toLocaleLowerCase('id-ID').slice(0, 30);
  const genres = genreRaw
    .split(',')
    .map((g) => g.trim().toLocaleLowerCase('id-ID'))
    .filter(Boolean)
    .slice(0, 12);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const size = Math.min(200, Math.max(10, parseInt(req.query.size, 10) || EXPLORE_SIZE));
  const full = await loadAll(genres.length ? '' : q);
  if (!full || !full.status) return res.json(full || { status: false, message: 'Gagal memuat daftar' });
  let list = genres.length
    ? full.data.filter((item) => {
        const itemGenres = Array.isArray(item.genres)
          ? item.genres.map((g) => String(g).toLocaleLowerCase('id-ID'))
          : [];
        // AND: satu komik harus memuat SEMUA genre yang dipilih
        // (mis. Action + Romance → hanya judul yang punya keduanya)
        return genres.every((g) => itemGenres.includes(g));
      })
    : full.data.filter((item) => !q || String(item.title || '').toLocaleLowerCase('id-ID').includes(q.toLocaleLowerCase('id-ID')));
  if (format) {
    const supported = new Set(['manhwa', 'manhua', 'manga']);
    if (supported.has(format)) list = list.filter((item) => {
      const values = [item.format, item.formats, item.type].flatMap((v) => Array.isArray(v) ? v : [v]).filter(Boolean).map((v) => String(v).toLocaleLowerCase('id-ID'));
      return values.some((v) => v.includes(format));
    });
  }

  // Sort server-side supaya Latest / Popular benar di semua halaman
  const sort = String(req.query.sort || 'latest').toLowerCase();
  const timeOf = (item) => {
    const raw = item.latest_chapter_time || item.updated_at || item.time || '';
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : 0;
  };
  const chOf = (item) => {
    const n = Number(item.latest_chapter ?? item.chapter_count ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  const viewsOf = (item) => {
    const n = Number(item.views ?? item.view_count ?? item.views_count ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  if (sort === 'popular') {
    list = list.slice().sort((a, b) => viewsOf(b) - viewsOf(a) || chOf(b) - chOf(a));
  } else {
    // latest update: waktu chapter terbaru, fallback nomor chapter
    list = list.slice().sort((a, b) => {
      const tb = timeOf(b);
      const ta = timeOf(a);
      if (tb !== ta) return tb - ta;
      return chOf(b) - chOf(a);
    });
  }

  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({
    status: true,
    data: {
      items: list.slice((page - 1) * size, page * size),
      total: list.length,
      page,
      pages: Math.max(1, Math.ceil(list.length / size)),
      sort: sort === 'popular' ? 'popular' : 'latest',
    },
  });
});

router.get('/detector', async (req, res) => {
  const humanFace = require('../services/humanFace');
  const t0 = Date.now();
  await humanFace.getHuman();
  res.set('Cache-Control', 'no-store');
  res.json({ ...humanFace.status(), loadMs: Date.now() - t0 });
});

// Thumbnail chapter: crop kecil (±8KB) fokus wajah (model tier 0), cache agresif
router.get('/thumbimg', sourceUrl, async (req, res) => {
  try {
    const out = await cache.wrap('ti6:' + req.query.url, cfg.ttl.thumb, () => source.thumbImage(String(req.query.url)));
    if (!out || !out.status) return res.status(404).end();
    res.set('Content-Type', 'image/webp');
    res.set('X-Thumb-By', String(out.by || ''));
    res.set('Cache-Control', 'public, max-age=1209600, s-maxage=2592000, immutable');
    res.send(out.data);
  } catch {
    res.status(404).end();
  }
});

router.get(
  '/detail',
  sourceUrl,
  handler((r) => 'd:' + r.query.url, cfg.ttl.detail, (r) => source.detail(String(r.query.url))),
);
router.get(
  '/read',
  sourceUrl,
  handler((r) => 'r:' + r.query.url, cfg.ttl.read, (r) => source.read(String(r.query.url))),
);


const IMG_HEADERS = {
  Referer: 'https://shinigami.id/',
  'User-Agent': 'Mozilla/5.0 (Android 14; Mobile; rv:153.0) Gecko/153.0 Firefox/153.0',
};
const IMG_MAX = 15 * 1024 * 1024;
const IMG_WIDTHS = new Set([160, 240, 360, 480, 720]);

function fetchImageBuffer(href) {
  return new Promise((resolve, reject) => {
    const req = https.get(href, { timeout: 15000, headers: IMG_HEADERS }, (res) => {
      const type = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (res.statusCode < 200 || res.statusCode >= 300 || !type.startsWith('image/')) {
        res.resume();
        return reject(new Error('bad image response'));
      }
      const chunks = [];
      let bytes = 0;
      res.on('data', (c) => {
        bytes += c.length;
        if (bytes > IMG_MAX) {
          res.destroy();
          reject(new Error('image too large'));
        } else chunks.push(c);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function sendResized(href, width, res) {
  try {
    const buf = await fetchImageBuffer(href);
    const out = await sharp(buf, { limitInputPixels: 80e6 })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 76 })
      .toBuffer();
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Type', 'image/webp');
    res.set('Cache-Control', 'public, max-age=604800, s-maxage=2592000, immutable');
    res.send(out);
  } catch {
    if (!res.headersSent) res.status(502).send('Gagal memuat gambar');
  }
}

router.get('/img', async (req, res) => {
  try {
    const u = new URL(String(req.query.url || ''));
    const ok =
      u.protocol === 'https:' &&
      cfg.imgHosts.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
    if (!ok) return res.status(400).send('Host tidak diizinkan');

    const width = Number(req.query.w);
    if (IMG_WIDTHS.has(width)) return sendResized(u.href, width, res);

    const lib = u.protocol === 'https:' ? https : http;
    const proxyReq = lib.get(
      u.href,
      {
        timeout: 20000,
        headers: {
          Referer: 'https://shinigami.id/',
          'User-Agent': 'Mozilla/5.0 (Android 14; Mobile; rv:153.0) Gecko/153.0 Firefox/153.0',
        },
      },
      (proxyRes) => {
        if (proxyRes.statusCode < 200 || proxyRes.statusCode >= 300) {
          res.status(502).send('Gagal memuat gambar');
          proxyRes.resume();
          return;
        }
        const contentType = String(proxyRes.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        const length = Number(proxyRes.headers['content-length'] || 0);
        if (!contentType.startsWith('image/') || (length && length > 15 * 1024 * 1024)) {
          proxyRes.resume();
          if (!res.headersSent) res.status(502).send('Format atau ukuran gambar tidak diizinkan');
          return;
        }
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=604800, immutable');
        let bytes = 0;
        proxyRes.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > 15 * 1024 * 1024) {
            proxyRes.destroy();
            if (!res.headersSent) res.status(502).send('Ukuran gambar terlalu besar');
            else res.destroy();
          }
        });
        proxyRes.pipe(res);
      },
    );
    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) res.status(504).send('Timeout gambar');
    });
    proxyReq.on('error', () => {
      if (!res.headersSent) res.status(502).send('Gagal memuat gambar');
    });
  } catch {
    res.status(502).send('Gagal memuat gambar');
  }
});

module.exports = router;
