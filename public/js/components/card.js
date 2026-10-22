import { esc, img, link } from '../utils.js';

export const card = (c) => `
  <a class="card" href="${link('detail', c.url)}">
    <div class="card__cover">
      <img loading="lazy" src="${esc(img(c.poster))}" alt="">
      ${c.chapter ? `<span class="card__badge">${esc(c.chapter)}</span>` : ''}
    </div>
    <div class="card__title">${esc(c.title)}</div>
    <div class="card__meta">${esc([c.reads, c.star].filter(Boolean).join(' • ') || c.meta || '\u00A0')}</div>
  </a>`;

export const cardGrid = (items) =>
  items.length ? `<div class="grid">${items.map(card).join('')}</div>` : '<div class="state">Tidak ada hasil.</div>';
