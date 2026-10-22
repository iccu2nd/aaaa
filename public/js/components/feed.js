import { esc, img, link } from '../utils.js';

export const feed = (items) =>
  items.length
    ? `<div class="feed">${items.map((s) => `
      <div class="feed__row">
        <img class="feed__thumb" loading="lazy" src="${esc(img(s.poster))}" alt="">
        <div class="feed__body">
          <a class="feed__title" href="${link('detail', s.url)}">${esc(s.title)}</a>
          <div class="feed__chapters">
            ${s.chapters.slice(0, 3).map((c) => `
              <a class="feed__chapter" href="${link('read', c.url)}"><span>${esc(c.chapter)}</span><small>${esc(c.time)}</small></a>`).join('')}
          </div>
        </div>
      </div>`).join('')}</div>`
    : '<div class="state">Belum ada update.</div>';
