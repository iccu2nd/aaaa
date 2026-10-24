import { esc, img, link } from '../utils.js';

const starIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8l-6.2 3.2L7 14.2 2 9.3l6.9-1L12 2z"/></svg>';
const eyeIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

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

/** Nomor total chapter (untuk badge cover). */
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

function getChapterRows(item) {
  const rows = [];
  if (Array.isArray(item.chapters) && item.chapters.length) {
    for (const ch of item.chapters.slice(0, 2)) {
      const label = normalizeChapterLabel(ch.chapter || ch.title || ch.name);
      if (!label) continue;
      rows.push({
        label,
        time: formatUpdateTime(ch.time || ch.updated_at || ch.date || ''),
      });
    }
  }
  if (!rows.length) {
    const latest = item.latest_chapter ?? item.chapter;
    if (latest != null && latest !== '') {
      rows.push({
        label: normalizeChapterLabel(latest),
        time: formatUpdateTime(item.latest_chapter_time || ''),
      });
    }
  }
  return rows;
}

/** Stats di bawah judul: rating + views saja (total chapter pindah ke badge cover). */
function statsHtml(item) {
  const rate = getRating(item);
  const views = formatViews(item);
  const parts = [
    rate ? `<span class="card__stat card__stat--rate">${starIcon}<b>${esc(rate)}</b></span>` : '',
    views ? `<span class="card__stat card__stat--views">${eyeIcon}<b>${esc(views)}</b></span>` : '',
  ].filter(Boolean);
  return parts.length ? `<div class="card__stats">${parts.join('')}</div>` : '';
}

function chaptersHtml(item) {
  const chRows = getChapterRows(item);
  if (!chRows.length) return '';
  return `<div class="card__chs">${chRows
    .map(
      (r) => `<div class="card__ch-row">
        <span class="card__ch-badge">${esc(r.label)}</span>
        ${r.time ? `<span class="card__ch-time">${esc(r.time)}</span>` : ''}
      </div>`
    )
    .join('')}</div>`;
}

function coverBadges(item) {
  const total = getChapterTotalNum(item);
  const rate = getRating(item);
  const left = total != null
    ? `<span class="card__ch-total">Ch. ${esc(String(total))}</span>`
    : '';
  const right = rate
    ? `<span class="card__rate-badge">${starIcon} ${esc(rate)}</span>`
    : '';
  return left + right;
}

/** Kartu grid (explore / search). */
export const card = (c) => `
  <a class="card" href="${link('detail', c.url)}">
    <div class="card__cover">
      <img loading="lazy" decoding="async" src="${esc(img(c.poster))}" alt="">
      ${coverBadges(c)}
    </div>
    <div class="card__body">
      <div class="card__title">${esc(c.title)}</div>
      ${statsHtml(c)}
      ${chaptersHtml(c)}
    </div>
  </a>`;

export const cardGrid = (items) =>
  items.length ? `<div class="grid">${items.map(card).join('')}</div>` : '<div class="state">Tidak ada hasil.</div>';

/** Kartu horizontal rail (home Update / rekomendasi). */
export const railCard = (item) => `
    <a class="rail-card" href="${link('detail', item.url)}">
      <div class="rail-card__cover">
        <img loading="lazy" decoding="async" src="${esc(img(item.poster))}" alt="">
        ${coverBadges(item)}
      </div>
      <div class="rail-card__title">${esc(item.title)}</div>
      ${statsHtml(item)}
      ${chaptersHtml(item)}
    </a>`;
