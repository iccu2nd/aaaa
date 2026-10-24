'use strict';

const fs = require('fs');
const path = require('path');
const source = require('../src/services/catalog');

const COUNT = Math.max(1, parseInt(process.argv[2], 10) || 8);
const OUT = path.join(__dirname, '..', 'thumb-test');

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await require('../src/services/humanFace').getHuman();
  console.log('Detektor model:', JSON.stringify(require('../src/services/humanFace').status()));
  const list = await source.all('');
  if (!list.status || !list.data.length) throw new Error('Daftar komik kosong / sumber tidak terjangkau');

  const rows = [];
  let tries = 0;
  while (rows.length < COUNT && tries < COUNT * 6) {
    tries += 1;
    const title = pick(list.data);
    try {
      const d = await source.detail(title.url);
      const chapters = (d.data && d.data.chapters) || [];
      if (!chapters.length) continue;
      const ch = pick(chapters);
      const t0 = Date.now();
      const r = await source.thumbImage(ch.url);
      const ms = Date.now() - t0;
      if (!r.status) { console.log('GAGAL', title.title, ch.title || ch.url, r.message); continue; }
      const file = `${String(rows.length + 1).padStart(2, '0')}-${String(title.title).replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.webp`;
      fs.writeFileSync(path.join(OUT, file), r.data);
      rows.push({ file, ms, face: r.face, by: r.by, score: +r.score.toFixed(2), kb: +(r.data.length / 1024).toFixed(1) });
      console.log(`${file}  ${ms}ms  ${r.by}  skor ${r.score.toFixed(2)}  ${(r.data.length / 1024).toFixed(1)}KB`);
    } catch (e) {
      console.log('GAGAL', title.title, e.message);
    }
  }
  const faces = rows.filter((x) => x.by === 'model').length;
  const avg = rows.length ? Math.round(rows.reduce((a, b) => a + b.ms, 0) / rows.length) : 0;
  console.log(`\n${rows.length} chapter, ${faces} wajah terdeteksi model, rata-rata ${avg}ms. Lihat folder thumb-test/`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
