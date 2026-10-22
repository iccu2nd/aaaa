# RiMwa

Baca komik online. Sumber: Shinigami + Voratoon (dedupe otomatis).

## Jalankan
```bash
npm install
npm start
```

## Fitur
- Bottom navigation (mobile)
- Dual source + dedupe judul
- Detail dengan sinopsis, genre, daftar chapter
- Reader immersive: scroll = full layar, tap = kontrol, next di akhir chapter
- Detail: urut chapter (↑/↓, default terbaru dulu), kartu chapter + thumbnail potongan gambar acak, download per chapter & semua chapter (offline via Cache Storage)
- Explore: semua judul dari kedua sumber, tanpa limit, dimuat bertahap saat scroll
- Cache: server (memori + disk `data/cache.json`, stale-on-error), klien (localStorage, stale-while-revalidate), Service Worker (gambar & API)

> Download offline & Service Worker butuh HTTPS atau `localhost`.

## Reader UI update (v8)
- Chapter-end navigation is now minimal text-and-icon links without borders or card backgrounds; removed the “Akhir chapter” label.
- Replaced the auto-scroll settings icon with a cleaner gear icon.
- Auto-scroll speed now uses a touch-friendly range slider from 0.5× to 1.5× with a live value label.
- Updated the service-worker cache version to v8 so browsers can fetch the new reader assets.
