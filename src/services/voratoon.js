'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const { voratoon: cfg } = require('../config');

const baseUrl = cfg.baseUrl;

const reqOptions = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
  },
  timeout: 15000,
};

const abs = (p) => (p ? (p.startsWith('http') ? p : baseUrl + p) : '');
const load = async (url) => cheerio.load((await axios.get(url, reqOptions)).data);

const safe = (fn) => async (...args) => {
  try {
    return { status: true, data: await fn(...args) };
  } catch (e) {
    return { status: false, message: e.message || 'Terjadi kesalahan' };
  }
};

const home = safe(async () => {
  const $ = await load(baseUrl);
  const out = [];
  $('.comic-card, .popular-card, .new-series-card').each((_, el) => {
    const url = abs($(el).attr('href') || $(el).find('a').attr('href'));
    const title = $(el).find('.comic-title').text().trim();
    const poster = $(el).find('img').first().attr('src');
    const [reads = '', star = ''] = $(el)
      .find('.comic-stats')
      .text()
      .trim()
      .split('•')
      .map((s) => s.trim());
    if (title && url && !out.find((r) => r.url === url)) {
      out.push({
        title,
        poster,
        url,
        chapter: '',
        meta: [reads, star].filter(Boolean).join(' · '),
        source: 'voratoon',
      });
    }
  });
  return out;
});

const search = safe(async (query = '') => {
  const $ = await load(`${baseUrl}/browse?q=${encodeURIComponent(query)}`);
  const out = [];
  $('.card-image-wrapper').each((_, el) => {
    const url = abs($(el).attr('href'));
    const poster = $(el).find('img').attr('src');
    const parent = $(el).parent();
    const title =
      parent.find('.card-title').text().trim() ||
      parent.find('a').not('.card-image-wrapper').first().text().trim();
    const chapter =
      parent.find('.card-chapter-text').text().trim() ||
      parent.find('.card-chapter').text().trim();
    if (title && url) {
      out.push({
        title,
        poster,
        url,
        chapter,
        meta: chapter || '',
        source: 'voratoon',
      });
    }
  });
  return out;
});

const update = safe(async () => {
  const $ = await load(`${baseUrl}/updates`);
  const out = [];
  $('[class*="update-series-card_card"]').each((_, el) => {
    const url = abs($(el).find('a').first().attr('href'));
    const poster = $(el).find('img').first().attr('src');
    const title = $(el).find('[class*="update-series-card_title"]').text().trim();
    const chapters = [];
    $(el)
      .find('[class*="update-series-card_chapter__"]')
      .each((__, c) => {
        const chUrl = abs($(c).attr('href'));
        const chapter = $(c)
          .find('[class*="update-series-card_chapterLeft"]')
          .text()
          .replace('UP', '')
          .trim();
        const time = $(c).find('[class*="update-series-card_time"]').text().trim();
        if (chUrl && chapter) chapters.push({ chapter, time, url: chUrl });
      });
    if (title && url) {
      out.push({ title, poster, chapters, url, source: 'voratoon' });
    }
  });
  return out;
});

const detail = safe(async (url) => {
  const $ = await load(abs(url));
  const title = $('h1').first().text().trim();
  const poster =
    $('img[src*="cover"]').first().attr('src') || $('img').first().attr('src');
  const description =
    $('[class*="description"], .synopsis, .summary').first().text().trim() || '';
  const chapters = [];
  $('a[href*="/chapter/"]').each((_, el) => {
    const chUrl = abs($(el).attr('href'));
    const chTitle =
      $(el).find('.chapter-title').text().trim() || $(el).text().trim();
    if (chUrl && !chapters.find((c) => c.url === chUrl)) {
      chapters.push({ title: chTitle, url: chUrl });
    }
  });
  if (!title) throw new Error('Gagal mendapatkan informasi detail');
  return {
    title,
    poster,
    url: abs(url),
    description,
    status: '',
    alternative_title: '',
    release_year: '',
    user_rate: null,
    genres: [],
    authors: [],
    total_chapters: chapters.length,
    chapters,
    source: 'voratoon',
  };
});

const read = safe(async (url) => {
  const $ = await load(abs(url));
  const title = $('title').text().replace(/\|.*$/, '').trim();
  const images = [];
  $('img[class*="reader-screen_chapterPage"]').each((_, el) => {
    const src = $(el).attr('data-chapter-page') || $(el).attr('src');
    if (src) images.push(src);
  });
  if (!images.length) {
    $('img').each((_, el) => {
      const src = $(el).attr('src') || '';
      if (/chapter|page|cdn|storage/i.test(src) && !/logo|icon|avatar/i.test(src)) {
        images.push(src);
      }
    });
  }
  if (!images.length) throw new Error('Tidak ada gambar komik yang ditemukan');
  return {
    title,
    total_pages: images.length,
    images,
    prev_chapter_id: null,
    next_chapter_id: null,
    source: 'voratoon',
  };
});

module.exports = { home, search, update, detail, read };
