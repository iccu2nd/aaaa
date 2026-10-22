const s = (body, size = 20, sw = 1.75) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ico = {
  // panah turun dalam lingkaran = download
  download: (n = 22) => s('<circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v8M8.5 12.5l3.5 3.5 3.5-3.5"/>', n),
  done: (n = 22) => s('<circle cx="12" cy="12" r="9.5"/><path d="M8 12.5l2.8 2.8L16.2 9.6"/>', n, 2),
  // download semua (kotak + panah)
  downloadAll: (n = 22) => s('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 7.5v7M8.8 12l3.2 3.2 3.2-3.2"/>', n),
  arrowDown: (n = 18) => s('<path d="M12 5v14M6 13l6 6 6-6"/>', n, 2),
  arrowUp: (n = 18) => s('<path d="M12 19V5M6 11l6-6 6 6"/>', n, 2),
  search: (n = 18) => s('<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>', n),
};

/** Cincin progres untuk tombol download (pct 0–100). */
export const ring = (pct = 0) => {
  const c = 2 * Math.PI * 9.5;
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/>
    <circle class="ring__bar" cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(2)}" transform="rotate(-90 12 12)"/>
  </svg>`;
};
