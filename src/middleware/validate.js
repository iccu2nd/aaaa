const { sourceHost } = require('../config');

/** Pastikan ?url= mengarah ke situs sumber (cegah SSRF). Terima juga UUID murni. */
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
    if (host === sourceHost || host.endsWith('.' + sourceHost)) return next();
  } catch {
    /* jatuh ke 400 */
  }
  res.status(400).json({ status: false, message: 'URL tidak valid' });
};
