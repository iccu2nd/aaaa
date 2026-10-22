const MIN = 60 * 1000;

module.exports = {
  port: Number(process.env.PORT) || 3000,

  // Primary
  shinigami: {
    host: 'shinigami.id',
    baseUrl: 'https://shinigami.id',
    apiBase: 'https://api.shngm.io/v1',
  },

  // Secondary
  voratoon: {
    host: 'voratoon.com',
    baseUrl: 'https://v2.voratoon.com',
  },

  // Hosts yang boleh lewat proxy gambar
  imgHosts: (process.env.IMG_HOSTS ||
    [
      'shinigami.id',
      'shngm.io',
      'shngm.id',
      'assets.shngm.id',
      '11.shinigami.asia',
      'cdn.shinigami.id',
      'voratoon.com',
    ].join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  ttl: {
    home: 5 * MIN,
    update: 3 * MIN,
    search: 5 * MIN,
    detail: 10 * MIN,
    read: 30 * MIN,
    all: 30 * MIN,
    thumb: 24 * 60 * MIN,
  },
  rateLimit: { windowMs: MIN, max: 400 },
};
