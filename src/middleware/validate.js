const { sourceHost } = require('../config');

const ALLOWED_HOSTS = [
  sourceHost,
  'shinigami.id',
  'shngm.io',
  '11.shinigami.asia',
  'voratoon.com',
  'v2.voratoon.com'
];

exports.sourceUrl = (req, res, next) => {
  const raw = String(req.query.url || '').trim();
  if (!raw) {
    return res.status(400).json({ status: false, message: 'URL tidak valid' });
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return next();
  }

  try {
    const host = new URL(raw).hostname;
    if (ALLOWED_HOSTS.some(h => host === h || host.endsWith('.' + h))) return next();
  } catch {
    /* jatuh ke 400 */
  }
  res.status(400).json({ status: false, message: 'URL tidak valid' });
};
