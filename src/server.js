const path = require('path');
const express = require('express');
const { port } = require('./config');
const rateLimit = require('./middleware/rateLimit');
const api = require('./routes/api');

const app = express();
app.disable('x-powered-by');

app.use('/api', rateLimit, api);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ status: false, message: err.message || 'Terjadi kesalahan server' });
});

if (require.main === module) {
  app.listen(port, () => console.log(`RiMwa http://localhost:${port}`));
}

module.exports = app;
