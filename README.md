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

## Thumbnail chapter fokus wajah (v14)
- `/api/thumbimg?url=<chapter>` mengirim crop webp kecil (±8KB) yang berpusat di wajah + rambut, bukan halaman penuh; hasilnya di-cache server dan Service Worker.
- Deteksi: `src/services/faceFocus.js` (gumpalan kulit berbentuk wajah + fitur gelap + rambut, menjauhi balon teks). Bila tidak yakin, dipilih area gambar paling bersih dari teks.
- Uji dengan chapter acak dari sumber asli: `npm run test:thumb 8` → hasil di `thumb-test/`.
- Deteksi utama: `@vladmandic/human` (BlazeFace, backend WASM, dipasang sebagai optionalDependencies). Halaman panjang dipindai per jendela persegi. Jika paket tidak terpasang/gagal dimuat, otomatis pakai deteksi warna kulit lalu area bersih (lihat log `[humanFace]`).
- Setiap crop diperiksa sebelum dipakai (porsi putih/balon dan tinta teks). Crop kotor ditolak dan diganti kandidat berikutnya (model → warna → area bersih).

## Performa & aplikasi Android (v15)
- Sampul di daftar dimuat lewat `/api/img?url=...&w=<160|240|360|480|720>` (di-resize ke webp oleh `sharp`, di-cache CDN `s-maxage`); halaman reader tetap ukuran asli.
- `public/css/perf.css`: tanpa `backdrop-filter` pada badge di daftar, blur bottom-nav lebih ringan, `content-visibility` untuk baris chapter/library/halaman reader.
- `index.html`: `modulepreload` untuk semua modul JS (tanpa waterfall), font Google dimuat non-blocking.
- Header cache statis di `vercel.json` dan `src/server.js`; `sw.js` tetap `no-cache`.
- APK (TWA): `manifest.webmanifest` sudah punya `id`. Setelah paket dibuat di pwabuilder.com, taruh isi `assetlinks.json` di `public/.well-known/assetlinks.json`.
- v16: topbar dan bar atas reader hitam solid; bottom nav hilang saat scroll turun dan muncul saat scroll naik (tanpa lompatan layout); bar bawah reader mengambang; ikon Explore berupa kompas diagonal; kartu Explore memakai `content-visibility`.
- v17: bila 4 halaman tengah chapter tidak menghasilkan wajah, dicari lagi di sampai 10 halaman lain (14–86% chapter); crop wajah lebih rapat; pemilih cadangan tidak lagi menyukai area penuh kulit (tangan).
