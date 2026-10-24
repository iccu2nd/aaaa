'use strict';

/**
 * Cari wajah di satu halaman chapter (termasuk halaman webtoon yang sangat panjang).
 * Tanpa model ML: kandidat wajah = gumpalan kulit yang bentuknya wajar, dinilai dari
 * ukuran, kerapatan, rambut gelap di atasnya, dan jauh dari balon teks / area putih.
 * Hasilnya titik pusat wajah (0..1 terhadap seluruh gambar), bukan tebakan zona.
 */

const ANALYZE_WIDTH = 160;

function skinScore(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = max === 0 ? 0 : (max - min) / max;
  if (lum < 45 || lum > 235 || sat > 0.58) return 0;
  const dRG = r - g;
  const dRB = r - b;
  if (r > 145 && g > 105 && b > 85 && dRG > 4 && dRB > 12 && sat > 0.04 && sat < 0.4) return 4;
  if (r > 100 && r > g && g >= b * 0.82 && lum > 70 && lum < 205 && sat > 0.07 && sat < 0.5) return 3.4;
  if (r > 75 && r > g + 6 && g > b && lum > 55 && lum < 165 && sat > 0.09 && sat < 0.55) return 2.8;
  if (r > 165 && g > 115 && b > 115 && dRG > 8 && lum > 130 && lum < 225 && sat < 0.35) return 2.2;
  return 0;
}

const SKIN = 1;
const WHITE = 2;
const DARK = 3;

function classify(data, w, h, ch) {
  const cls = new Uint8Array(w * h);
  for (let p = 0, i = 0; p < w * h; p += 1, i += ch) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = max === 0 ? 0 : (max - min) / max;
    if (lum > 215 && sat < 0.12) cls[p] = WHITE;
    else if (lum < 75) cls[p] = DARK;
    else if (skinScore(r, g, b) > 0) cls[p] = SKIN;
  }
  return cls;
}

function dilate(mask, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = y * w + x;
      if (!mask[p]) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          if (xx >= 0 && xx < w) out[yy * w + xx] = 1;
        }
      }
    }
  }
  return out;
}

function components(skin, w, h) {
  const grown = dilate(skin, w, h);
  const seen = new Uint8Array(w * h);
  const stack = [];
  const list = [];
  for (let start = 0; start < w * h; start += 1) {
    if (!grown[start] || seen[start]) continue;
    let minx = w;
    let maxx = 0;
    let miny = h;
    let maxy = 0;
    let area = 0;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p - x) / w;
      if (skin[p]) {
        area += 1;
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
      if (x > 0 && grown[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && grown[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && grown[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && grown[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
    }
    if (area >= 40) list.push({ minx, maxx, miny, maxy, area });
  }
  return list;
}

function ratio(cls, w, h, x0, y0, x1, y1, kind) {
  const xa = Math.max(0, Math.floor(x0));
  const xb = Math.min(w - 1, Math.ceil(x1));
  const ya = Math.max(0, Math.floor(y0));
  const yb = Math.min(h - 1, Math.ceil(y1));
  let n = 0;
  let k = 0;
  for (let y = ya; y <= yb; y += 1) {
    for (let x = xa; x <= xb; x += 1) {
      n += 1;
      if (cls[y * w + x] === kind) k += 1;
    }
  }
  return n ? k / n : 0;
}

function inkOnWhite(cls, w, h, x0, y0, x1, y1) {
  const xa = Math.max(0, Math.floor(x0));
  const xb = Math.min(w - 2, Math.ceil(x1));
  const ya = Math.max(0, Math.floor(y0));
  const yb = Math.min(h - 1, Math.ceil(y1));
  let n = 0;
  let k = 0;
  for (let y = ya; y <= yb; y += 1) {
    for (let x = xa; x <= xb; x += 1) {
      n += 1;
      if (cls[y * w + x] === WHITE && cls[y * w + x + 1] === DARK) k += 1;
    }
  }
  return n ? k / n : 0;
}

function scoreFace(cls, w, h, c) {
  const bw = c.maxx - c.minx + 1;
  const bh = c.maxy - c.miny + 1;
  if (bw < w * 0.06 || bw > w * 0.55 || bh < 9) return null;
  const aspect = bh / bw;
  if (aspect < 0.62 || aspect > 2.2) return null;
  const fill = c.area / (bw * bh);
  if (fill < 0.4) return null;

  const cx = (c.minx + c.maxx) / 2;
  const cy = c.miny + bh * 0.46;

  const hair = ratio(cls, w, h, c.minx - bw * 0.1, c.miny - bh * 0.6, c.maxx + bw * 0.1, c.miny + bh * 0.12, DARK);
  const hairBonus = 0.55 + 0.45 * Math.min(1, hair / 0.3);

  const px0 = cx - bw * 1.6;
  const px1 = cx + bw * 1.6;
  const py0 = cy - bh * 1.4;
  const py1 = cy + bh * 1.4;
  const white = ratio(cls, w, h, px0, py0, px1, py1, WHITE);
  const ink = inkOnWhite(cls, w, h, px0, py0, px1, py1);
  const clean = Math.max(0, 1 - white * 1.8 - ink * 14);

  const ideal = w * 0.24;
  const size = Math.max(0.15, 1 - Math.abs(Math.log(bw / ideal)) / Math.log(3.2));
  const shape = Math.max(0.3, 1 - Math.abs(Math.log(aspect / 1.25)) / Math.log(2.4));
  const solid = Math.min(1, (fill - 0.3) / 0.35);

  const score = hairBonus * size * shape * solid * clean;
  return {
    score,
    fx: cx / w,
    fy: cy / h,
    fw: bw / w,
    fh: bh / h,
    white,
    ink,
  };
}

/**
 * @returns {{score:number, fx:number, fy:number, fw:number, fh:number}|null}
 * fx/fy = pusat wajah, fw/fh = ukuran wajah; semuanya pecahan 0..1 dari seluruh gambar.
 */
function findFace(data, w, h, ch = 3) {
  if (!w || !h || ch < 3) return null;
  const cls = classify(data, w, h, ch);
  const skin = new Uint8Array(w * h);
  let skinN = 0;
  for (let p = 0; p < w * h; p += 1) {
    if (cls[p] === SKIN) { skin[p] = 1; skinN += 1; }
  }
  if (skinN < 60) return null;
  let best = null;
  for (const c of components(skin, w, h)) {
    const s = scoreFace(cls, w, h, c);
    if (s && (!best || s.score > best.score)) best = s;
  }
  return best && best.score >= 0.1 ? best : null;
}

const FACE_MIN_SCORE = 0.25;

/**
 * Cadangan bila tidak ada wajah yang meyakinkan: jendela gambar (rasio thumbnail)
 * yang paling bersih dari balon teks dan area putih, dengan banyak warna/detail.
 */
function findArt(data, w, h, ch = 3, ratioWH = 1.45) {
  if (!w || !h || ch < 3) return null;
  const cls = classify(data, w, h, ch);
  const wh = Math.max(8, Math.round(w / ratioWH));
  const stride = Math.max(4, Math.round(wh / 5));
  let best = null;
  for (let y0 = 0; y0 + wh <= h || y0 === 0; y0 += stride) {
    const y1 = Math.min(h - 1, y0 + wh - 1);
    const white = ratio(cls, w, h, 0, y0, w - 1, y1, WHITE);
    const ink = inkOnWhite(cls, w, h, 0, y0, w - 1, y1);
    const dark = ratio(cls, w, h, 0, y0, w - 1, y1, DARK);
    const skin = ratio(cls, w, h, 0, y0, w - 1, y1, SKIN);
    const score = 1 - white * 2.2 - ink * 16 - Math.max(0, dark - 0.55) * 2 + skin * 1.5;
    if (!best || score > best.score) best = { score, fx: 0.5, fy: (y0 + wh / 2) / h, fw: 0.6, fh: wh / h };
    if (y0 + wh >= h) break;
  }
  return best;
}

module.exports = { ANALYZE_WIDTH, FACE_MIN_SCORE, findFace, findArt, skinScore };
