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
