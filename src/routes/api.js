const { Router } = require('express');
const https = require('https');
const http = require('http');
const cfg = require('../config');
const cache = require('../services/cache');
const shinigami = require('../services/shinigami');
const voratoon = require('../services/voratoon');
const { mergeAndDeduplicate } = require('../utils/deduplicate');
const { sourceUrl } = require('../middleware/validate');

const router = Router();
const handler = (key, ttl, fn) => async (req, res) => {
  try {
    const result = await cache.wrap(key(req), ttl, () => fn(req));
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: false, message: err.message || 'Gagal memproses permintaan' });
  }
};

router.get('/home', handler(() => 'home_v2', cfg.ttl.home, async () => {
  const [shiniRes, voraRes] = await Promise.allSettled([
    shinigami.home(),
    voratoon.home()
  ]);

  const listA = (shiniRes.status === 'fulfilled' && shiniRes.value?.status) ? shiniRes.value.data : [];
  const listB = (voraRes.status === 'fulfilled' && voraRes.value?.status) ? voraRes.value.data : [];

  const merged = mergeAndDeduplicate(listA, listB);
  return { status: true, data: merged };
}));

router.get('/update', handler(() => 'update_v2', cfg.ttl.update, async () => {
  const [shiniRes, voraRes] = await Promise.allSettled([
    shinigami.update(),
    voratoon.update()
  ]);

  const listA = (shiniRes.status === 'fulfilled' && shiniRes.value?.status) ? shiniRes.value.data : [];
  const listB = (voraRes.status === 'fulfilled' && voraRes.value?.status) ? voraRes.value.data : [];

  const merged = mergeAndDeduplicate(listA, listB);
  return { status: true, data: merged };
}));

router.get('/search', handler(
  (r) => 's:' + String(r.query.q || '').slice(0, 100),
  cfg.ttl.search,
  async (r) => {
    const q = String(r.query.q || '').slice(0, 100);
    const [shiniRes, voraRes] = await Promise.allSettled([
      shinigami.search(q),
      voratoon.search(q)
    ]);

    const listA = (shiniRes.status === 'fulfilled' && shiniRes.value?.status) ? shiniRes.value.data : [];
    const listB = (voraRes.status === 'fulfilled' && voraRes.value?.status) ? voraRes.value.data : [];

    const merged = mergeAndDeduplicate(listA, listB);
    return { status: true, data: merged };
  }
));

router.get('/detail', sourceUrl, handler(
  (r) => 'd:' + r.query.url,
  cfg.ttl.detail,
  async (r) => {
    const url = String(r.query.url);
    if (url.includes('voratoon.com')) {
      return await voratoon.detail(url);
    }
    return await shinigami.detail(url);
  }
));

router.get('/read', sourceUrl, handler(
  (r) => 'r:' + r.query.url,
  cfg.ttl.read,
  async (r) => {
    const url = String(r.query.url);
    if (url.includes('voratoon.com')) {
      return await voratoon.read(url);
    }
    return await shinigami.read(url);
  }
));

router.get('/img', async (req, res) => {
  try {
    const rawUrl = String(req.query.url || '');
    if (!rawUrl) return res.status(400).send('URL gambar wajib diisi');

    const u = new URL(rawUrl);
    const ok =
      (u.protocol === 'https:' || u.protocol === 'http:') &&
      cfg.imgHosts.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));

    if (!ok) return res.status(400).send('Host gambar tidak diizinkan');

    const lib = u.protocol === 'https:' ? https : http;
    const proxyReq = lib.get(
      u.href,
      {
        timeout: 20000,
        headers: {
          Referer: u.origin + '/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
