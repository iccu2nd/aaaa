import { esc } from '../utils.js';

export const section = (title, body, moreHref = '', moreLabel = 'Lihat semua') => `
  <section class="section">
    <div class="section__head"><h2>${esc(title)}</h2>${moreHref ? `<a class="section__more" href="${moreHref}">${esc(moreLabel)}</a>` : ''}</div>
    ${body}
  </section>`;

export const state = (text, error = false) => `<div class="state${error ? ' state--error' : ''}">${esc(text)}</div>`;

export const skeletonGrid = (n = 12) => `<div class="grid">${'<div class="skeleton"></div>'.repeat(n)}</div>`;
