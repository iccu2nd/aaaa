'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

const VORA_BASE_URL = 'https://v2.voratoon.com';

const reqOptions = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  },
  timeout: 15000,
};

const abs = (p) => (p ? (p.startsWith('http') ? p : VORA_BASE_URL + (p.startsWith('/') ? '' : '/') + p) : '');

const load = async (url) => {
  const res = await axios.get(url, reqOptions);
  return cheerio.load(res.data);
};

const safe = (fn) => async (...args) => {
  try {
    return { status: true, data: await fn(...args) };
  } catch (e) {
    return { status: false, message: e.message };
  }
};

const home = safe(async () => {
  const $ = await load(VORA_BASE_URL);
  const out = [];
  $('.comic-card, .popular-card, .new-series-card').each((_, el) => {
    const url = abs($(el).attr('href') || $(el).find('a').attr('href'));
    const title = $(el).find('.comic-title').text().trim();
    const poster = $(el).find('img').first().attr('src');
    const [reads = '', star = ''] = $(el).find('.comic-stats').text().trim().split('•').map((s) => s.trim());
    if (title && url && !out.find((r) => r.url === url)) {
      out.push({ title, poster, reads, star, url, source: 'voratoon' });
    }
  });
  return out;
});

const search = safe(async (query = '') => {
  const $ = await load(`${VORA_BASE_URL}/browse?q=${encodeURIComponent(query)}`);
  const out = [];
  $('.card-image-wrapper').each((_, el) => {
    const url = abs($(el).attr('href'));
    const poster = $(el).find('img').attr('src');
    const parent = $(el).parent();
    const title = parent.find('.card-title').text().trim() || parent.find('a').not('.card-image-wrapper').first().text().trim();
    const chapter = parent.find('.card-chapter-text').text().trim() || parent.find('.card-chapter').text().trim();
    if (title && url) out.push({ title, poster, chapter, url, source: 'voratoon' });
  });
  return out;
});

const update = safe(async () => {
  const $ = await load(`${VORA_BASE_URL}/updates`);
  const out = [];
  $('[class*="update-series-card_card"]').each((_, el) => {
    const url = abs($(el).find('a').first().attr('href'));
    const poster = $(el).find('img').first().attr('src');
    const title = $(el).find('[class*="update-series-card_title"]').text().trim();
    const chapters = [];
    $(el).find('[class*="update-series-card_chapter__"]').each((__, c) => {
      const chUrl = abs($(c).attr('href'));
      const chapter = $(c).find('[class*="update-series-card_chapterLeft"]').text().replace('UP', '').trim();
      const time = $(c).find('[class*="update-series-card_time"]').text().trim();
      if (chUrl && chapter) chapters.push({ chapter, time, url: chUrl });
    });
    if (title && url) out.push({ title, poster, chapters, url, source: 'voratoon' });
  });
  return out;
});

const detail = safe(async (url) => {
  const $ = await load(abs(url));
  const title = $('h1').first().text().trim();
  const poster = $('img[src*="cover"]').first().attr('src') || $('img').first().attr('src');
  const chapters = [];
  $('a[href*="/chapter/"]').each((_, el) => {
    const chUrl = abs($(el).attr('href'));
    const chTitle = $(el).find('.chapter-title').text().trim() || $(el).text().trim();
    if (chUrl && !chapters.find((c) => c.url === chUrl)) {
      chapters.push({ title: chTitle, url: chUrl });
    }
  });

  const synopsis = $('.synopsis, .description, [class*="synopsis"]').text().trim() || '';
  const author = $('.author, [class*="author"]').text().trim() || 'Voratoon Creator';
  const views = $('.views, [class*="views"]').text().trim() || '';
  const status = $('.status, [class*="status"]').text().trim() || 'Ongoing';
  const genres = [];
  $('.genre, .genres a, [class*="genre"]').each((_, el) => {
    const g = $(el).text().trim();
    if (g && !genres.includes(g)) genres.push(g);
  });

  if (!title) throw new Error('Gagal mendapatkan informasi detail');
  return {
    title,
    poster,
    synopsis,
    author,
    views,
    status,
    genres: genres.length ? genres : ['Action', 'Fantasy', 'Sci-Fi'],
    total_chapters: chapters.length,
    chapters,
    url: abs(url),
    source: 'voratoon'
  };
});

const read = safe(async (url) => {
  const $ = await load(abs(url));
  const title = $('title').text().replace('| VoraToon', '').trim();
  const images = [];
  $('img[class*="reader-screen_chapterPage"]').each((_, el) => {
    const src = $(el).attr('data-chapter-page') || $(el).attr('src');
    if (src) images.push(src);
  });

  let prevChapterUrl = '';
  let nextChapterUrl = '';
  $('a[href*="/chapter/"]').each((_, el) => {
    const href = abs($(el).attr('href'));
    const text = $(el).text().toLowerCase();
    if (text.includes('prev') || text.includes('sebelum')) prevChapterUrl = href;
    if (text.includes('next') || text.includes('selanjut')) nextChapterUrl = href;
  });

  if (!images.length) throw new Error('Tidak ada gambar komik yang ditemukan');
  return { title, total_pages: images.length, images, prevChapterUrl, nextChapterUrl, source: 'voratoon' };
});

module.exports = { home, search, update, detail, read };
