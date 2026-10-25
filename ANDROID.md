# Komikta → Aplikasi Android (seperti APK Play Store)

Project ini adalah **PWA + TWA-ready**. Setelah di-deploy HTTPS dan dibungkus TWA, hasilnya aplikasi fullscreen tanpa URL bar — terasa seperti app native.

## Yang sudah disiapkan di project

- `manifest.webmanifest` — standalone, shortcut Library/Explore, launch handler
- Service worker — cache offline chapter & aset
- `public/.well-known/assetlinks.json` — placeholder untuk Digital Asset Links
- Meta viewport / theme-color / deteksi `is-app`
- CSS: overscroll terkunci, tap highlight hilang, animasi halaman ringan
- Fix mode fokus: posisi scroll tidak loncat ke atas saat back

## Langkah 1 — Deploy HTTPS

```bash
npm install
npm start          # lokal
# atau
npx vercel         # production HTTPS
```

Pastikan URL live bisa dibuka, contoh: `https://komikta.vercel.app`

Cek:
- `https://domain/manifest.webmanifest`
- `https://domain/sw.js`
- Ikon `/icons/icon-512.png` tidak 404

## Langkah 2 — Generate APK (PWABuilder — recommended)

1. Buka https://www.pwabuilder.com
2. Masukkan URL live → **Start**
3. **Package for stores** → **Android**
4. Isi:
   - Package ID: `com.komikta.app` (sama dengan di assetlinks)
   - App name: Komikta
   - Host: domain kamu tanpa `https://`
5. Download paket (APK + AAB + `assetlinks.json`)

## Langkah 3 — Digital Asset Links (wajib full-screen)

Ambil `sha256_cert_fingerprints` dari paket PWABuilder, isi di:

`public/.well-known/assetlinks.json`

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.komikta.app",
    "sha256_cert_fingerprints": ["AA:BB:CC:...dari PWABuilder..."]
  }
}]
```

Deploy ulang. Verifikasi:
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://DOMAIN&relation=delegate_permission/common.handle_all_urls

Kalau valid, app Android buka **tanpa browser bar** (benar-benar seperti APK).

## Langkah 4 — Install

- **Tes cepat:** salin `.apk` ke HP → buka → izinkan unknown sources
- **Play Store:** upload `.aab` ke Google Play Console

## Alternatif CLI (Bubblewrap)

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://DOMAIN/manifest.webmanifest
bubblewrap build
```

## Tips biar “enak & smooth” seperti app store

| Aspek | Status |
|--------|--------|
| Fullscreen / no URL bar | TWA + assetlinks valid |
| Offline chapter | SW + download di reader |
| Gesture back di mode fokus | Sudah (history + restore scroll) |
| Safe area notch | `viewport-fit=cover` + CSS env() |
| Tidak zoom tak sengaja | `user-scalable=no` |
| Tidak select teks di chrome | CSS user-select |
| Shortcut long-press ikon | Library & Explore di manifest |

## Catatan penting

- Tanpa HTTPS + assetlinks yang benar, APK masih bisa jalan tapi **masih ada bar browser** → terasa website.
- Package name di assetlinks **harus sama** dengan yang di PWABuilder/Bubblewrap.
- Fingerprint SHA-256 harus dari keystore yang menandatangani APK (debug vs release berbeda).
