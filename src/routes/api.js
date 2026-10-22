const { Router } = require('express');
const cfg = require('../config');
const cache = require('../services/cache');
const shinigami = require('../services/shinigami');
const voratoon = require('../services/voratoon');
const { mergeAndDeduplicate } = require('../utils/deduplicate');
const { sourceUrl } = require('../middleware/validate');

const router = Router();
const handler = (key, ttl, fn) => async (req, res) =>
  res.json(await cache.wrap(key(req), ttl, () => fn(req)));

router.get('/home', handler(() => 'home_v2', cfg.ttl.home, async () => {
  const [shiniRes, voraRes] = await Promise.allSettled([
    shinigami.home(),
    voratoon.home()
  ]);

  const listA = (shiniRes.status === 'fulfilled' && Array.isArray(shiniRes.value)) ? shiniRes.value : [];
  const listB = (voraRes.status === 'fulfilled' && voraRes.value.status) ? voraRes.value.data : [];

  return mergeAndDeduplicate(listA, listB);
}));

router.get('/update', handler(() => 'update_v2', cfg.ttl.update, async () => {
  const [shiniRes, voraRes] = await Promise.allSettled([
    shinigami.update(),
    voratoon.update()
  ]);

  const listA = (shiniRes.status === 'fulfilled' && Array.isArray(shiniRes.value)) ? shiniRes.value : [];
  const listB = (voraRes.status === 'fulfilled' && voraRes.value.status) ? voraRes.value.data : [];

  return mergeAndDeduplicate(listA, listB);
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

    const listA = (shiniRes.status === 'fulfilled' && Array.isArray(shiniRes.value)) ? shiniRes.value : [];
    const listB = (voraRes.status === 'fulfilled' && voraRes.value.status) ? voraRes.value.data : [];

    return mergeAndDeduplicate(listA, listB);
  }
));

router.get('/detail', sourceUrl, handler(
  (r) => 'd:' + r.query.url,
  cfg.ttl.detail,
  async (r) => {
    const url = String(r.query.url);
    if (url.includes('voratoon.com')) {
      const res = await voratoon.detail(url);
      if (!res.status) throw new Error(res.message);
      return res.data;
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
      const res = await voratoon.read(url);
      if (!res.status) throw new Error(res.message);
      return res.data;
    }
    return await shinigami.read(url);
  }
));

module.exports = router;
