const { rateLimit } = require('../config');
const hits = new Map();

setInterval(() => hits.clear(), rateLimit.windowMs).unref();

module.exports = function limiter(req, res, next) {
  const n = (hits.get(req.ip) || 0) + 1;
  hits.set(req.ip, n);
  if (n > rateLimit.max) return res.status(429).json({ status: false, message: 'Terlalu banyak request, coba lagi sebentar.' });
  next();
};
