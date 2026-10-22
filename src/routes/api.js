const { Router } = require('express');
const https = require('https');
const http = require('http');
const cfg = require('../config');
const cache = require('../services/cache');
const source = require('../services/shinigami');
const { sourceUrl } = require('../middleware/validate');

const router = Router();
const handler = (key, ttl, fn) => async (req, res) =>
  res.json(await cache.wrap(key(req), ttl, () => fn(req)));

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
          Referer: cfg.baseUrl + '/',
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
