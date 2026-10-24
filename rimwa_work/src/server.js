const path = require('path');
const express = require('express');
const { port } = require('./config');
const rateLimit = require('./middleware/rateLimit');
const api = require('./routes/api');

const app = express();
app.disable('x-powered-by');

// Batasi seluruh endpoint termasuk proxy gambar agar tidak bisa dipakai sebagai proxy terbuka tanpa batas.
app.use('/api', rateLimit, api);
app.use(express.static(path.join(__dirname, '..', 'public'), {
  dotfiles: 'allow',
  setHeaders(res, file) {
    if (file.endsWith('sw.js')) res.set('Cache-Control', 'no-cache');
    else if (file.includes(`${path.sep}icons${path.sep}`)) res.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
    else res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=604800');
  },
}));

// SPA fallback for clean URLs; keep API routes and static assets untouched.
app.get(['/detail/*', '/read/*', '/search', '/explore', '/explore/*', '/library', '/profile', '/update'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ status: false, message: 'Terjadi kesalahan server' });
});

app.listen(port, () => {
  console.log(`Komikta http://localhost:${port}`);
  api.warm();
});
