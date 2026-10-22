# RiMwa

RiMwa — platform baca komik dengan katalog terintegrasi.

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


## Navigation update (v10)
- Removed the global topbar to give the content more room.
- Bottom navigation is now Home, Search, Library, and Profile.
- Search opens an inline search field beside the search icon; genre filters are available in a bottom sheet.
- Updates remain in the Home feed instead of taking a bottom-navigation slot.
- Home includes a compact install recommendation with a native install prompt when supported and browser instructions as fallback.
- Profile currently shows a lightweight “coming in a future update” page with Library shortcuts and local reading counts.


## Clean URL routing (v13)
- Detail and reader pages use clean `/detail/{token}` and `/read/{token}` routes without hash fragments. Source URLs are Base64URL-obfuscated in the address bar; this is not encryption.
- Search filters are represented in the query string, e.g. `/search?q=...&genre=...`.
- Legacy `/#/detail/...` and other hash routes are migrated to clean paths on startup.
- Client-side navigation supports browser Back/Forward and direct deep links.
- Express and Vercel rewrites serve the SPA entry point for application routes while leaving `/api/*` unchanged.
