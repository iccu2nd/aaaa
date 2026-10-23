const { Router } = require('express');
const https = require('https');
const http = require('http');
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
  const genres = genreRaw
    .split(',')
    .map((g) => g.trim().toLocaleLowerCase('id-ID'))
    .filter(Boolean)
    .slice(0, 12);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const size = Math.min(200, Math.max(10, parseInt(req.query.size, 10) || EXPLORE_SIZE));
  const full = await loadAll(genres.length ? '' : q);
  if (!full || !full.status) return res.json(full || { status: false, message: 'Gagal memuat daftar' });
  const list = genres.length
    ? full.data.filter((item) => {
        const itemGenres = Array.isArray(item.genres)
          ? item.genres.map((g) => String(g).toLocaleLowerCase('id-ID'))
          : [];
        // AND: satu komik harus memuat SEMUA genre yang dipilih
        // (mis. Action + Romance → hanya judul yang punya keduanya)
        return genres.every((g) => itemGenres.includes(g));
      })
    : full.data;
  res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
  res.json({
    status: true,
    data: {
      items: list.slice((page - 1) * size, page * size),
      total: list.length,
      page,
      pages: Math.max(1, Math.ceil(list.length / size)),
    },
  });
});

// Thumbnail chapter: potongan gambar acak dari isi chapter
router.get(
  '/thumb',
  sourceUrl,
  handler((r) => 't:' + r.query.url, cfg.ttl.thumb, (r) => source.thumb(String(r.query.url))),
);

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

router.get('/img', async (req, res) => {
  try {
    const u = new URL(String(req.query.url || ''));
    const ok =
      u.protocol === 'https:' &&
      cfg.imgHosts.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
    if (!ok) return res.status(400).send('Host tidak diizinkan');

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
        res.set('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
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
