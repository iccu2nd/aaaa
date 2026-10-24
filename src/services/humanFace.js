'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PAGE_WIDTH = 384;
const MIN_BOX_SCORE = 0.3;
const MIN_FACE_FRAC = 0.05;

let loading = null;
let state = { ready: false, error: null };
let chain = Promise.resolve();

function candidates(pkg) {
  const parts = pkg.split('/');
  const roots = new Set([
    path.join(__dirname, '..', '..', 'node_modules'),
    path.join(process.cwd(), 'node_modules'),
    '/var/task/node_modules',
  ]);
  try {
    for (const p of require.resolve.paths(pkg) || []) roots.add(p);
  } catch { /* abaikan */ }
  return [...roots].map((r) => path.join(r, ...parts));
}

function dirOf(pkg, probe) {
  const tried = [];
  for (const dir of candidates(pkg)) {
    const ok = fs.existsSync(path.join(dir, probe));
    tried.push({ dir, ok });
    if (ok) return dir;
  }
  const err = new Error(`file ${probe} dari paket ${pkg} tidak ditemukan`);
  err.tried = tried;
  throw err;
}

function listDir(dir) {
  try {
    return fs.readdirSync(dir).slice(0, 40);
  } catch (e) {
    return `tidak bisa dibaca: ${e.code || e.message}`;
  }
}

function debugInfo(err) {
  return {
    node: process.version,
    cwd: process.cwd(),
    dirname: __dirname,
    tried: err.tried || null,
    nodeModules: listDir(path.join(process.cwd(), 'node_modules')),
    scope: listDir(path.join(process.cwd(), 'node_modules', '@vladmandic')),
    humanDir: listDir(path.join(process.cwd(), 'node_modules', '@vladmandic', 'human')),
    stack: String(err.stack || '').split('\n').slice(0, 4),
  };
}

async function load() {
  try {
    const humanRoot = dirOf('@vladmandic/human', path.join('dist', 'human.node-wasm.js'));
    const wasmRoot = dirOf('@tensorflow/tfjs-backend-wasm', 'package.json');
    const mod = require(path.join(humanRoot, 'dist', 'human.node-wasm.js'));
    const Human = mod.default || mod.Human || mod;
    const off = { enabled: false };
    const human = new Human({
      backend: 'wasm',
      wasmPath: `${path.join(wasmRoot, 'dist')}${path.sep}`,
      modelBasePath: `file://${path.join(humanRoot, 'models')}/`,
      debug: false,
      async: false,
      cacheSensitivity: 0,
      filter: off,
      face: {
        enabled: true,
        detector: { rotation: false, maxDetected: 4, minConfidence: 0.2, return: false },
        mesh: off,
        iris: off,
        description: off,
        emotion: off,
        antispoof: off,
        liveness: off,
        attention: off,
      },
      body: off,
      hand: off,
      object: off,
      gesture: off,
      segmentation: off,
    });
    await human.load();
    await human.warmup();
    state = { ready: true, error: null };
    return human;
  } catch (e) {
    state = { ready: false, error: e.message, debug: debugInfo(e) };
    console.warn('[humanFace] detektor model tidak aktif, pakai cadangan warna:', e.message);
    return null;
  }
}

function getHuman() {
  if (!loading) loading = load();
  return loading;
}

function serial(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

async function detectTile(human, rgb, size) {
  const tensor = human.tf.tensor3d(rgb, [size, size, 3], 'int32');
  try {
    const res = await human.detect(tensor);
    return res.face || [];
  } finally {
    human.tf.dispose(tensor);
  }
}

/**
 * Cari wajah terbaik di satu halaman (termasuk strip webtoon panjang) dengan
 * memindai jendela persegi yang saling tumpang tindih.
 * @returns {Promise<{score:number,fx:number,fy:number,fw:number,fh:number}|null>}
 */
async function detectFace(buf) {
  const human = await getHuman();
  if (!human) return null;
  const { data, info } = await sharp(buf, { limitInputPixels: 80e6 })
    .rotate()
    .resize({ width: PAGE_WIDTH })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  if (!w || !h) return null;

  const tile = Math.min(w, h);
  const stride = Math.max(1, Math.round(tile * 0.45));
  const tops = [];
  for (let y = 0; y + tile <= h; y += stride) tops.push(y);
  if (!tops.length || tops[tops.length - 1] + tile < h) tops.push(Math.max(0, h - tile));
  const tileW = tile;
  if (tileW !== w) return null;

  return serial(async () => {
    let best = null;
    for (const top of tops.slice(0, 40)) {
      const rgb = new Int32Array(tile * tile * 3);
      const src = data.subarray(top * w * 3, (top + tile) * w * 3);
      for (let i = 0; i < src.length; i += 1) rgb[i] = src[i];
      const faces = await detectTile(human, rgb, tile);
      for (const f of faces) {
        const [bx, by, bw, bh] = f.box;
        const conf = f.boxScore || f.score || 0;
        const frac = bw / w;
        if (conf < MIN_BOX_SCORE || frac < MIN_FACE_FRAC) continue;
        const score = conf * (0.5 + 0.5 * Math.min(1, frac / 0.2));
        if (!best || score > best.score) {
          best = {
            score,
            fx: (bx + bw / 2) / w,
            fy: (top + by + bh / 2) / h,
            fw: bw / w,
            fh: bh / h,
          };
        }
      }
    }
    return best;
  });
}

const status = () => ({ ...state });

module.exports = { detectFace, getHuman, status };
