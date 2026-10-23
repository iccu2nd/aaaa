const s = (body, size = 20, sw = 1.75) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ico = {
  // panah unduh dalam lingkaran (tanpa stroke kotak)
  download: (n = 22) => s('<path d="M12 7v8M8.5 12.5l3.5 3.5 3.5-3.5M6.5 18.5h11"/>', n),
  downloadCircle: (n = 22) => s('<circle cx="12" cy="12" r="9.25"/><path d="M12 7.5v7M8.8 12l3.2 3.2 3.2-3.2"/>', n),
  done: (n = 22) => s('<circle cx="12" cy="12" r="9.25"/><path d="M8 12.5l2.8 2.8L16.2 9.6"/>', n, 2),
  // unduh semua: hanya panah + garis, lingkaran di CSS
  downloadAll: (n = 20) => s('<path d="M12 6v9M8 12.5l4 4 4-4M7 18.5h10"/>', n, 1.85),
  // chevron seperti ">" menghadap bawah / atas
  chevronDown: (n = 18) => s('<path d="m7 10 5 5 5-5"/>', n, 2.1),
  chevronUp: (n = 18) => s('<path d="m7 14 5-5 5 5"/>', n, 2.1),
  arrowDown: (n = 18) => s('<path d="m7 10 5 5 5-5"/>', n, 2.1),
  arrowUp: (n = 18) => s('<path d="m7 14 5-5 5 5"/>', n, 2.1),
  search: (n = 18) => s('<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>', n),
};

export const ring = (pct = 0) => {
  const c = 2 * Math.PI * 9.5;
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/>
    <circle class="ring__bar" cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(2)}" transform="rotate(-90 12 12)"/>
  </svg>`;
};
