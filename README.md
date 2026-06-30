# Website HIMA IP

Website dokumentasi kegiatan & LPJ (Laporan Pertanggungjawaban) untuk Himpunan
Mahasiswa Ilmu Pemerintahan — STISIP Tasikmalaya. Dibuat dengan React + Vite.

## ⚠️ Penting soal penyimpanan data

Website ini memakai **localStorage** browser untuk menyimpan data kegiatan,
foto, dan berkas LPJ. Artinya:

- Data **tersimpan di browser masing-masing perangkat**, bukan di server.
- Kalau kamu upload foto dari laptop, foto itu **tidak otomatis muncul** di
  HP teman kamu yang membuka link yang sama — karena localStorage punya 1 dan
  punya 1 lagi terpisah di tiap perangkat/browser.
- Cocok untuk: demo, arsip pribadi admin, atau prototipe sebelum naik ke
  database sungguhan.
- **Belum cocok** kalau tujuannya: semua anggota HIMA IP buka link yang sama
  dan langsung lihat foto terbaru yang diupload admin dari perangkat lain.

Kalau nanti butuh data yang benar-benar tersinkron untuk semua pengunjung
(misalnya admin upload dari HP, semua orang langsung bisa lihat di device
masing-masing), beri tahu Claude — perlu ditambahkan database seperti
Supabase atau Firebase (gratis untuk skala kecil).

Hapus cache/data browser = foto & LPJ ikut hilang. Sebaiknya backup berkas asli
foto/LPJ di tempat lain juga (Google Drive dsb).

## Menjalankan di komputer sendiri

Butuh [Node.js](https://nodejs.org) terinstal (versi 18 ke atas).

```bash
npm install
npm run dev
```

Buka link yang muncul di terminal (biasanya `http://localhost:5173`).

## Build untuk produksi

```bash
npm run build
```

Hasilnya ada di folder `dist/`.

## Deploy ke Vercel (gratis)

1. Buat akun di [vercel.com](https://vercel.com), login pakai GitHub
2. Upload folder project ini ke repository GitHub baru
3. Di Vercel, klik **Add New Project**, pilih repo tadi
4. Framework Preset otomatis terdeteksi sebagai **Vite** — biarkan saja
5. Klik **Deploy**
6. Selesai, kamu dapat link seperti `himaip.vercel.app`

## Deploy ke Netlify (gratis, tanpa GitHub)

1. Jalankan `npm run build` di komputer untuk menghasilkan folder `dist/`
2. Buka [netlify.com](https://app.netlify.com/drop)
3. Drag-and-drop folder `dist/` ke halaman tersebut
4. Selesai, langsung dapat link publik

## Mengubah kode admin

Kode admin diatur di `src/App.jsx`, baris paling atas:

```js
const ADMIN_CODE = "himaip2026";
```

Ganti teks di dalam tanda kutip sesuai keinginan, lalu build/deploy ulang.

## Menambahkan logo

Taruh file logo (PNG/SVG) di folder `public/`, lalu di `src/App.jsx` bagian
`brandRow` di komponen header, tambahkan tag `<img src="/nama-logo.png" />`
di samping logo HIMA yang sudah ada.
