import { esc, img, link } from '../utils.js';

const starIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8l-6.2 3.2L7 14.2 2 9.3l6.9-1L12 2z"/></svg>';
const eyeIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const authorIcon = '<svg width="14" height="12" viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="7.5" r="3.2"/><path d="M3.5 19c.6-3.1 2.9-4.8 6.5-4.8s5.9 1.7 6.5 4.8"/><path d="M18.2 14.2 22.5 9.9a1.35 1.35 0 0 1 1.9 0l.5.5a1.35 1.35 0 0 1 0 1.9L19.2 17.8 16.8 18.5l.7-2.3z"/><path d="m19.5 13.5 2.2 2.2"/></svg>';
const bookIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z"/><path d="M4 6v15M8 7h8M8 11h8"/></svg>';

function getRating(item) {
  const raw = item?.user_rate ?? item?.rating ?? item?.rate ?? item?.score ?? item?.rating_score;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value.toFixed(1) : '';
}

function formatViews(item) {
  const raw = item?.views ?? item?.view_count ?? item?.views_count ?? item?.total_views ?? item?.reader_count ?? item?.viewers;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return '';
  return new Intl.NumberFormat('id-ID').format(Math.round(value));
}

function formatUpdateTime(raw) {
  if (raw == null || raw === '') return '';
  const value = String(raw).trim();
  if (!/[Tt]\d{2}:\d{2}|Z$|[+-]\d{2}:?\d{2}$/.test(value) && !/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value;
  }
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return 'baru saja';
  if (sec < 3600) return `${Math.floor(sec / 60)} menit lalu`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} jam lalu`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} hari lalu`;
  if (sec < 2592000) return `${Math.floor(sec / 604800)} minggu lalu`;
  return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function normalizeChapterLabel(ch) {
  if (ch == null || ch === '') return '';
  const s = String(ch).trim();
  if (!s) return '';
  const m = s.match(/(?:ch(?:apter)?\.?\s*)?(\d+(?:\.\d+)?)/i);
  if (m) return `Chapter ${m[1]}`;
  return s.replace(/^ch\.?\s*/i, 'Chapter ');
}

function getChapterTotalNum(item) {
  const candidates = [
    item?.total_chapter,
    item?.total_chapters,
    item?.chapter_count,
    item?.chapters_count,
    item?.latest_chapter,
  ];
  for (const raw of candidates) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  if (item?.chapter) {
    const m = String(item.chapter).match(/(\d+(?:\.\d+)?)/);
    if (m) return Math.round(Number(m[1]));
  }
  if (Array.isArray(item?.chapters) && item.chapters[0]) {
    const m = String(item.chapters[0].chapter || '').match(/(\d+(?:\.\d+)?)/);
    if (m) return Math.round(Number(m[1]));
  }
  return null;
}

function getAuthor(item) {
  if (Array.isArray(item?.authors) && item.authors.length) return String(item.authors[0]).trim();
  if (item?.author) return String(item.author).trim();
  if (Array.isArray(item?.artists) && item.artists.length) return String(item.artists[0]).trim();
  return '';
}

function getFormat(item) {
  const raw =
    (Array.isArray(item?.formats) && item.formats[0]) ||
    item?.format ||
    (Array.isArray(item?.types) && item.types[0]) ||
    item?.type ||
    '';
  const s = String(raw).trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  if (lower.includes('manhwa')) return 'Manhwa';
  if (lower.includes('manhua')) return 'Manhua';
  if (lower.includes('manga')) return 'Manga';
  if (lower.includes('comic') || lower.includes('webtoon')) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function chapterNum(label) {
  const m = String(label || '').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : -1;
}

/** Ambil 1 chapter nomor terbesar (max / terbaru). */
function getChapterRows(item) {
  const rows = [];
  if (Array.isArray(item.chapters) && item.chapters.length) {
    for (const ch of item.chapters) {
      const label = normalizeChapterLabel(ch.chapter || ch.title || ch.name);
      if (!label) continue;
      rows.push({
        label,
        time: formatUpdateTime(ch.time || ch.updated_at || ch.date || ''),
        num: chapterNum(label),
      });
    }
  }
  if (!rows.length) {
    const latest = item.latest_chapter ?? item.chapter;
    if (latest != null && latest !== '') {
      const label = normalizeChapterLabel(latest);
      rows.push({
        label,
        time: formatUpdateTime(item.latest_chapter_time || ''),
        num: chapterNum(label),
      });
    }
  }
  // Urut nomor terbesar dulu, unik
  rows.sort((a, b) => b.num - a.num);
  const uniq = [];
  const seen = new Set();
  for (const r of rows) {
    const key = r.num >= 0 ? r.num : r.label;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(r);
  }
  // Hanya 1 chapter terbaru (nomor max)
  return uniq.slice(0, 1).map(({ label, time }) => ({ label, time }));
}

/**
 * Meta di bawah judul:
 *  - Author (icon)
 *  - Views (icon)
 *  - Format manhwa/manhua/manga (icon)
 * Rating hanya di badge cover.
 */
function metaHtml(item) {
  const author = getAuthor(item);
  const views = formatViews(item);
  const format = getFormat(item);
  const parts = [
    author ? `<span class="card__meta-row card__meta-row--author">${authorIcon}<span>${esc(author)}</span></span>` : '',
    views ? `<span class="card__meta-row card__meta-row--views">${eyeIcon}<span>${esc(views)}</span></span>` : '',
    format ? `<span class="card__meta-row card__meta-row--format">${bookIcon}<span>${esc(format)}</span></span>` : '',
  ].filter(Boolean);
  return parts.length ? `<div class="card__meta-list">${parts.join('')}</div>` : '';
}

function chaptersHtml(item) {
  const chRows = getChapterRows(item);
  if (!chRows.length) return '';
  return `<div class="card__chs">${chRows
    .map((r) => {
      const text = r.time ? `${r.label} · ${r.time}` : r.label;
      return `<div class="card__ch-pill">${esc(text)}</div>`;
    })
    .join('')}</div>`;
}

function coverBadges(item, { showFormat = false } = {}) {
  const total = getChapterTotalNum(item);
  const rate = getRating(item);
  const format = getFormat(item);
  const left = showFormat && format
    ? `<span class="card__format-badge">${esc(format)}</span>`
    : (total != null ? `<span class="card__ch-total">Ch. ${esc(String(total))}</span>` : '');
  const right = rate
    ? `<span class="card__rate-badge">${starIcon} ${esc(rate)}</span>`
    : '';
  return left + right;
}

/** Kartu grid explore — mirip referensi: format badge, judul, ch. */
export const card = (c) => {
  const total = getChapterTotalNum(c);
  const chLabel = total != null ? `Ch. ${total}` : (getChapterRows(c)[0]?.label || '');
  return `
  <a class="card card--explore" href="${link('detail', c.url)}">
    <div class="card__cover">
      <img loading="lazy" decoding="async" src="${esc(img(c.poster))}" alt="">
      ${coverBadges(c, { showFormat: true })}
    </div>
    <div class="card__body">
      <div class="card__title">${esc(c.title)}</div>
      ${chLabel ? `<div class="card__ch-line">${esc(chLabel)}</div>` : ''}
    </div>
  </a>`;
};

/** Kartu penuh (home rail) dengan author / views / 1 chapter pill. */
export const richCard = (c) => `
  <a class="card" href="${link('detail', c.url)}">
    <div class="card__cover">
      <img loading="lazy" decoding="async" src="${esc(img(c.poster))}" alt="">
      ${coverBadges(c)}
    </div>
    <div class="card__body">
      <div class="card__title">${esc(c.title)}</div>
      ${metaHtml(c)}
      ${chaptersHtml(c)}
    </div>
  </a>`;

export const cardGrid = (items) =>
  items.length ? `<div class="grid">${items.map(card).join('')}</div>` : '<div class="state">Tidak ada hasil.</div>';

/** Kartu horizontal rail (home). */
export const railCard = (item) => `
    <a class="rail-card" href="${link('detail', item.url)}">
      <div class="rail-card__cover">
        <img loading="lazy" decoding="async" src="${esc(img(item.poster))}" alt="">
        ${coverBadges(item)}
      </div>
      <div class="rail-card__title">${esc(item.title)}</div>
      ${metaHtml(item)}
      ${chaptersHtml(item)}
    </a>`;

