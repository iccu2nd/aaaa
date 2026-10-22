'use strict';

const https = require('https');
const { baseUrl, apiBase } = require('../config');

const DEFAULT_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'User-Agent':
    'Mozilla/5.0 (Android 14; Mobile; rv:153.0) Gecko/153.0 Firefox/153.0',
  Referer: `${baseUrl}/`,
  Origin: baseUrl,
};

const ALLOWED_HOSTS = new Set(['api.shngm.io', 'shinigami.id', '11.shinigami.asia']);

function request(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      return reject(new Error('URL tidak valid'));
    }

    if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
      return reject(new Error('Host atau protokol tidak diizinkan'));
    }

    const req = https.get(
      target,
      { headers: DEFAULT_HEADERS, timeout },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP ${res.statusCode}`));
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error('Respons API bukan JSON yang valid'));
          }
        });
      },
    );

    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'));
    });
    req.on('error', reject);
  });
}

async function api(path) {
  const result = await request(`${apiBase}${path}`);
  if (result?.retcode !== undefined && result.retcode !== 0) {
    throw new Error(result.message || 'API request gagal');
  }
  return result;
}

const safe = (fn) => async (...args) => {
  try {
    return { status: true, data: await fn(...args) };
  } catch (e) {
    return { status: false, message: e.message || 'Terjadi kesalahan' };
  }
};

function getId(value = '') {
  return (
    String(value).match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    )?.[0] || null
  );
}

function getNames(data) {
  return Array.isArray(data) ? data.map((item) => item?.name).filter(Boolean) : [];
}

function getStatus(status) {
  return ({ 1: 'Ongoing', 2: 'Hiatus' })[status] || 'Completed';
}

function getTaxonomy(taxonomy = {}) {
  return {
    genre: getNames(taxonomy.Genre),
    author: getNames(taxonomy.Author),
    artist: getNames(taxonomy.Artist),
    format: getNames(taxonomy.Format),
    type: getNames(taxonomy.Type),
  };
}

function seriesUrl(id) {
  return `${baseUrl}/series/${id}/`;
}

function chapterUrl(id) {
  return `${baseUrl}/chapter/${id}`;
}

function relativeTime(isoOrTs) {
  try {
    const t = typeof isoOrTs === 'number' ? isoOrTs : Date.parse(isoOrTs);
    if (Number.isNaN(t)) return '';
    const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (sec < 60) return 'baru saja';
    if (sec < 3600) return `${Math.floor(sec / 60)} menit lalu`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} jam lalu`;
    if (sec < 604800) return `${Math.floor(sec / 86400)} hari lalu`;
    return new Date(t).toLocaleDateString('id-ID');
  } catch {
    return '';
  }
}

function mapMangaCard(manga) {
  const ch = manga.latest_chapter_number;
  return {
    title: manga.title,
    poster: manga.cover_portrait_url || manga.cover_image_url || null,
    url: seriesUrl(manga.manga_id),
    manga_id: manga.manga_id,
    chapter: ch != null ? `Ch. ${ch}` : '',
    meta: [getStatus(manga.status), manga.user_rate ? String(manga.user_rate) : '']
      .filter(Boolean)
      .join(' · '),
    status: getStatus(manga.status),
    user_rate: manga.user_rate,
    latest_chapter: ch,
    latest_chapter_time: manga.latest_chapter_time,
  };
}

const home = safe(async () => {
  const params = new URLSearchParams({ page: '1', page_size: '24' });
  const res = await api(`/manga/list?${params}`);
  const data = Array.isArray(res.data) ? res.data : [];
  return data.map(mapMangaCard);
});

const update = safe(async () => {
  const params = new URLSearchParams({ page: '1', page_size: '30' });
  const res = await api(`/manga/list?${params}`);
  const data = Array.isArray(res.data) ? res.data : [];
  return data.map((manga) => {
    const time = manga.latest_chapter_time
      ? relativeTime(manga.latest_chapter_time)
      : '';
    const chNum = manga.latest_chapter_number;
    return {
      title: manga.title,
      poster: manga.cover_portrait_url || manga.cover_image_url || null,
      url: seriesUrl(manga.manga_id),
      manga_id: manga.manga_id,
      chapters: chNum != null
        ? [
            {
              chapter: `Ch. ${chNum}`,
              time,
              url: manga.latest_chapter_id
                ? chapterUrl(manga.latest_chapter_id)
                : seriesUrl(manga.manga_id),
            },
          ]
        : [],
    };
  });
});

const search = safe(async (query = '') => {
  const q = String(query).trim();
  const params = new URLSearchParams({ page: '1', page_size: '24' });
  if (q) params.set('q', q);
  const res = await api(`/manga/list?${params}`);
  const data = Array.isArray(res.data) ? res.data : [];
  return data.map(mapMangaCard);
});

const detail = safe(async (input) => {
  let id = getId(input);

  if (!id) {
    const found = await search(String(input).trim());
    if (!found.status || !found.data?.[0]?.manga_id) {
      throw new Error('Manga tidak ditemukan');
    }
    id = found.data[0].manga_id;
  }

  const params = new URLSearchParams({
    page: '1',
    page_size: '100',
    sort_by: 'chapter_number',
    sort_order: 'desc',
  });

  const [detailRes, chapterRes] = await Promise.all([
    api(`/manga/detail/${id}`),
    api(`/chapter/${id}/list?${params}`),
  ]);

  if (!detailRes?.data) throw new Error('Gagal mengambil detail manga');

  const d = detailRes.data;
  const chapters = (chapterRes.data || []).map((ch) => ({
    title: ch.chapter_title
      ? `Ch. ${ch.chapter_number} — ${ch.chapter_title}`
      : `Ch. ${ch.chapter_number}`,
    chapter_number: ch.chapter_number,
    url: chapterUrl(ch.chapter_id),
    chapter_id: ch.chapter_id,
    release_date: ch.release_date,
  }));

  const tax = getTaxonomy(d.taxonomy);

  return {
    title: d.title,
    poster: d.cover_portrait_url || d.cover_image_url || null,
    url: seriesUrl(d.manga_id || id),
    manga_id: d.manga_id || id,
    description: d.description || '',
    status: getStatus(d.status),
    alternative_title: d.alternative_title || '',
    release_year: d.release_year,
    user_rate: d.user_rate,
    genres: tax.genre,
    authors: tax.author,
    total_chapters: chapters.length,
    chapters,
  };
});

const read = safe(async (input) => {
  const id = getId(input);
  if (!id) throw new Error('Chapter ID atau URL chapter tidak valid');

  const res = await api(`/chapter/detail/${id}`);
  if (!res?.data) throw new Error('Detail chapter tidak ditemukan');

  const d = res.data;
  const ch = d.chapter || {};
  const base = ch.base_url || d.base_url || d.base_url_low || '';
  const path = ch.path || '';
  const images = Array.isArray(ch.data) ? ch.data : [];

  const resolved = images.map((image) => {
    if (/^https?:\/\//i.test(image)) return image;
    return `${base.replace(/\/+$/, '')}/${path
      .replace(/^\/+|\/+$/g, '')}/${String(image).replace(/^\/+/, '')}`.replace(
      /([^:]\/)\/+/g,
      '$1',
    );
  });

  return {
    title: d.chapter_title
      ? `Ch. ${d.chapter_number} — ${d.chapter_title}`
      : `Chapter ${d.chapter_number}`,
    chapter_number: d.chapter_number,
    chapter_id: d.chapter_id,
    manga_id: d.manga_id,
    prev_chapter_id: d.prev_chapter_id || null,
    next_chapter_id: d.next_chapter_id || null,
    total_pages: resolved.length,
    images: resolved,
  };
});

module.exports = { home, search, update, detail, read };
