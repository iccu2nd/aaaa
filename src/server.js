const path = require('path');
const express = require('express');
const { port } = require('./config');
const rateLimit = require('./middleware/rateLimit');
const api = require('./routes/api');

const app = express();
app.disable('x-powered-by');

// gambar tidak dihitung rate limit (satu halaman reader = puluhan gambar)
app.use('/api', (req, res, next) => (req.path === '/img' ? next() : rateLimit(req, res, next)), api);
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders(res, file) {
    if (file.endsWith('sw.js')) res.set('Cache-Control', 'no-cache');
  },
}));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ status: false, message: 'Terjadi kesalahan server' });
});

app.listen(port, () => {
  console.log(`RiMwa http://localhost:${port}`);
  api.warm();
});
