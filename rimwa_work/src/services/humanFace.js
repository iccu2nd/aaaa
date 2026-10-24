'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { epicScore, THUMB_RATIO } = require('./faceFocus');

const PAGE_WIDTH = 416;
const MAX_TILES = 24;
const STOP_SCORE = 1.15;
const MIN_BOX_SCORE = 0.22;
const MIN_FACE_FRAC = 0.04;

const VERSION = 'v20-accurate';
let loading = null;
let failedAt = 0;
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
    hasFetch: typeof globalThis.fetch,
    fileFetch: !!globalThis.__rimwaFileFetch,
    cwd: process.cwd(),
    dirname: __dirname,
    tried: err.tried || null,
    nodeModules: listDir(path.join(process.cwd(), 'node_modules')),
    scope: listDir(path.join(process.cwd(), 'node_modules', '@vladmandic')),
    humanDir: listDir(path.join(process.cwd(), 'node_modules', '@vladmandic', 'human')),
    stack: String(err.stack || '').split('\n').slice(0, 4),
  };
}

function installFileFetch(prefixes) {
  if (globalThis.__rimwaFileFetch || typeof Response === 'undefined') return;
  const original = globalThis.fetch;
  const toPath = (input) => {
    const raw = typeof input === 'string' ? input : (input && input.url) || String(input);
    const p = raw.startsWith('file://') ? decodeURIComponent(raw.slice(7)) : raw;
    return prefixes.some((x) => p.startsWith(x)) ? p : null;
  };
  globalThis.fetch = async (input, init) => {
    const p = toPath(input);
    if (!p) return original(input, init);
    try {
      const buf = await fs.promises.readFile(p);
      const type = p.endsWith('.wasm') ? 'application/wasm' : p.endsWith('.json') ? 'application/json' : 'application/octet-stream';
      return new Response(buf, { status: 200, headers: { 'Content-Type': type } });
    } catch {
      return new Response(null, { status: 404 });
    }
  };
  globalThis.__rimwaFileFetch = true;
}

/* eslint-disable no-unused-vars */
function traceAssets() {
  const w = path.join(__dirname, '../../node_modules/@tensorflow/tfjs-backend-wasm/dist');
  fs.readFileSync(path.join(__dirname, '../../node_modules/@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm'));
  fs.readFileSync(path.join(__dirname, '../../node_modules/@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-simd.wasm'));
  fs.readFileSync(path.join(__dirname, '../../node_modules/@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-threaded-simd.wasm'));
  fs.readFileSync(path.join(__dirname, '../../node_modules/@vladmandic/human/models/blazeface.json'));
  fs.readFileSync(path.join(__dirname, '../../node_modules/@vladmandic/human/models/blazeface.bin'));
  fs.readdirSync(path.join(__dirname, '../../node_modules/@vladmandic/human/models'));
  fs.readdirSync(w);
}

function registerCpu() {
  try {
    require('@tensorflow/tfjs-backend-cpu');
  } catch { /* tidak terpasang */ }
}

async function attempt(backend, humanRoot, wasmRoot) {
  const logs = [];
  const saved = { warn: console.warn, error: console.error, log: console.log };
  const grab = (...args) => {
    if (logs.length < 25) logs.push(args.map((x) => (x && x.stack) || String(x)).join(' ').slice(0, 600));
  };
  console.warn = grab;
  console.error = grab;
  console.log = grab;
  try {
    if (backend === 'cpu') registerCpu();
    const mod = require(path.join(humanRoot, 'dist', 'human.node-wasm.js'));
    const Human = mod.default || mod.Human || mod;
    const off = { enabled: false };
    const human = new Human({
      backend,
      wasmPath: `${path.join(wasmRoot, 'dist')}${path.sep}`,
      modelBasePath: `file://${path.join(humanRoot, 'models')}/`,
      debug: false,
      async: false,
      cacheSensitivity: 0,
      filter: off,
      face: {
        enabled: true,
        detector: { rotation: false, maxDetected: 6, minConfidence: 0.15, return: false },
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
    return human;
  } catch (e) {
    e.logs = logs;
    throw e;
  } finally {
    console.warn = saved.warn;
    console.error = saved.error;
    console.log = saved.log;
  }
}

async function load() {
  const attempts = [];
  try {
    const humanRoot = dirOf('@vladmandic/human', path.join('dist', 'human.node-wasm.js'));
    const wasmRoot = dirOf('@tensorflow/tfjs-backend-wasm', 'package.json');
    installFileFetch([humanRoot, wasmRoot]);
    for (const backend of ['wasm', 'cpu']) {
      try {
        const human = await attempt(backend, humanRoot, wasmRoot);
        state = { ready: true, error: null, backend, attempts };
        return human;
      } catch (e) {
        attempts.push({ backend, error: e.message, logs: e.logs || [] });
      }
    }
    const err = new Error(attempts.map((x) => `${x.backend}: ${x.error}`).join(' | '));
    throw err;
  } catch (e) {
    state = { ready: false, error: e.message, debug: { ...debugInfo(e), attempts } };
    console.warn('[humanFace] detektor model tidak aktif, pakai cadangan warna:', e.message);
    return null;
  }
}

function getHuman() {
  if (loading && !(failedAt && Date.now() - failedAt > 60000)) return loading;
  loading = load().then((human) => {
    failedAt = human ? 0 : Date.now();
    return human;
  });
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
async function detectFace(buf, shared = { best: 0 }) {
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
  const stride = Math.max(1, Math.round(tile * 0.45)); // lebih rapat = lebih akurat
  const tops = [];
  for (let y = 0; y + tile <= h; y += stride) tops.push(y);
  if (!tops.length || tops[tops.length - 1] + tile < h) tops.push(Math.max(0, h - tile));
  const tileW = tile;
  if (tileW !== w) return null;

  return serial(async () => {
    let best = null;
    const step = Math.max(1, Math.ceil(tops.length / MAX_TILES));
    for (let ti = 0; ti < tops.length; ti += step) {
      if (shared.best >= STOP_SCORE) break;
      const top = tops[ti];
      const rgb = new Int32Array(tile * tile * 3);
      const src = data.subarray(top * w * 3, (top + tile) * w * 3);
      for (let i = 0; i < src.length; i += 1) rgb[i] = src[i];
      const faces = await detectTile(human, rgb, tile);
      for (const f of faces) {
        const [bx, by, bw, bh] = f.box;
        const conf = f.boxScore || f.score || 0;
        const frac = bw / w;
        if (conf < MIN_BOX_SCORE || frac < MIN_FACE_FRAC) continue;
        const cx = bx + bw / 2;
        const cy = top + by + bh / 2;
        const ww = Math.min(w, Math.max(w * 0.3, bw / 0.48));
        const wh = ww / THUMB_RATIO;
        const epic = epicScore(data, w, h, 3, cx - ww / 2, cy - wh / 2, cx + ww / 2, cy + wh / 2);
        const score = conf * conf * (0.45 + 0.55 * Math.min(1, frac / 0.18)) * (0.75 + 0.45 * epic);
        if (!best || score > best.score) {
          best = {
            score,
            epic,
            fx: (bx + bw / 2) / w,
            fy: (top + by + bh / 2) / h,
            fw: bw / w,
            fh: bh / h,
          };
        }
      }
    }
    if (best) shared.best = Math.max(shared.best, best.score);
    return best;
  });
}

const status = () => ({ version: VERSION, ...state });

module.exports = { detectFace, getHuman, status };
