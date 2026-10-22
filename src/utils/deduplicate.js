'use strict';

function normalizeTitle(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(manhwa|manga|manhua|indonesia|indo)/g, '')
    .trim();
}

function mergeAndDeduplicate(listA = [], listB = []) {
  const map = new Map();

  const processItem = (item, defaultSource) => {
    if (!item || !item.title) return;
    const key = normalizeTitle(item.title);
    if (!key) return;

    const sourceName = item.source || defaultSource;

    if (!map.has(key)) {
      map.set(key, {
        ...item,
        sources: [sourceName]
      });
    } else {
      const existing = map.get(key);
      map.set(key, {
        ...existing,
        poster: existing.poster || item.poster,
        star: existing.star || item.star,
        reads: existing.reads || item.reads,
        sources: Array.from(new Set([...(existing.sources || []), sourceName])),
        chapters: mergeChapters(existing.chapters || [], item.chapters || [])
      });
    }
  };

  listA.forEach(item => processItem(item, 'shinigami'));
  listB.forEach(item => processItem(item, 'voratoon'));

  return Array.from(map.values());
}

function mergeChapters(chA = [], chB = []) {
  const map = new Map();
  [...chA, ...chB].forEach(c => {
    const titleKey = normalizeTitle(c.title || c.chapter || '');
    if (titleKey && !map.has(titleKey)) {
      map.set(titleKey, c);
    }
  });
  return Array.from(map.values());
}

module.exports = { normalizeTitle, mergeAndDeduplicate };
