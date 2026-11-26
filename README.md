# UangKu — Aplikasi Pencatatan Keuangan Personal iOS

> Aplikasi pencatatan uang personal berbasis iOS dengan tampilan mewah & elegan, waktu input ultra-cepat ($\le 10$ detik), arsitektur *offline-first* dengan SQLite lokal & outbox sync, serta backend Bun + ElysiaJS + Drizzle ORM.

---

## ✨ Karakteristik & Desain Mewah (*Luxury & Elegance*)

- **Tema Desain:** *Onyx Obsidian & Royal Champagne Gold* (`#090A0E` dengan aksen `#D4AF37` dan `#E5C378`).
- **Indikator Finansial:**
  - Pemasukan (In Cash): *Emerald Green* (`#10B981`)
  - Pengeluaran (Out Cash): *Crimson Red* (`#EF4444`)
  - Transfer Antar Akun: *Celestial Slate & Gold* (`#6366F1` / `#D4AF37`)
- **Keypad Cepat Kustom:** In-app numeric keypad dengan format Rupiah real-time (`Rp 50.000`), chip nominal cepat (`+10rb`, `+50rb`, `+100rb`, `+500rb`), dan tactile haptic feedback.
- **Haptic Engine:** Umpan balik getaran fisik via `expo-haptics` (light tap untuk angka, selection untuk kategori, medium untuk simpan, notifikasi sukses/error).
- **Kepatuhan Privasi Apple App Store:**
  - Guideline 5.1.1(v) Penghapusan Akun mandiri & pembersihan total (*cascading purge*).
  - Proteksi biometrik Face ID / Touch ID lokal via `expo-local-authentication`.

---

## 🏛 Arsitektur Monorepo

```text
UangKu/
├── apps/
│   ├── mobile/         # iOS Mobile App (React Native, Expo SDK 52, Expo Router v4, Expo SQLite)
│   │   ├── app/        # Layar Expo Router ((tabs), transaction/new modal)
│   │   ├── src/
│   │   │   ├── components/ # Keypad kustom, BalanceHeroCard, TransactionItem, LuxuryCard
│   │   │   ├── db/         # SQLite lokal dengan WAL mode & relasi reaktif
│   │   │   ├── sync/       # Background sync worker (Push & Pull outbox)
│   │   │   └── theme/      # Token warna emas elegan & haptic feedback
│   │   └── app.json    # Konfigurasi iOS & deskripsi Face ID
│   │
│   └── api/            # Backend REST API (Bun runtime + ElysiaJS + Drizzle ORM)
│       └── src/
│           ├── config/     # Konfigurasi env
│           ├── db/         # Drizzle schema (PostgreSQL) & client
│           ├── middleware/ # Auth JWT Supabase, Envelope & Error Handler
│           └── modules/    # Auth, Accounts, Categories, Transactions, Reports, Sync
│
├── packages/
│   └── contracts/      # Shared domain models, Zod validation schemas, & money utilities
│
├── package.json        # Root monorepo (Bun Workspaces)
├── turbo.json          # Turborepo pipeline configuration
└── prd.md              # Product Requirement Document komprehensif
```

---

## 🚀 Panduan Menjalankan Proyek

### 1. Instalasi Dependensi
```bash
bun install --frozen-lockfile
```

### 2. Menjalankan Backend API (ElysiaJS)
```bash
bun run --cwd apps/api dev
```
* Server berjalan di: `http://localhost:3001`
* Dokumentasi Interaktif Swagger: `http://localhost:3001/swagger`
* Health Check: `http://localhost:3001/health`

### 3. Menjalankan Aplikasi Mobile (Expo iOS)
```bash
bun run --cwd apps/mobile start
```
* Tekan `i` untuk membuka iOS Simulator.

### 4. Menjalankan Pengujian & Typecheck
```bash
# Dari root, dengan Bun 1.3.14 dan PostgreSQL lokal terpasang (pg_config, initdb, pg_ctl).
bun run test

# Menjalankan TypeScript typecheck di seluruh monorepo
bun run typecheck
```

`bun run test` membuat cluster PostgreSQL baru di direktori sementara, menjalankan migrasi dan seed, lalu membuang cluster itu. Runner tidak memakai `DATABASE_URL` aplikasi. `bun test` langsung tidak diizinkan membuka database integrasi tanpa konfigurasi tes. Tes perangkat memakai SQLite di memori, bukan simulator atau ponsel pengguna.

### Sebelum memperbarui instalasi lama

- Cadangkan PostgreSQL dan berkas struk. Jalankan `bun run --cwd apps/api db:migrate` pada database tujuan setelah memeriksa koneksinya. Migrasi menolak email duplikat; jangan hapus profil untuk memaksanya lolos.
- Siapkan `JWT_SECRET` (atau `SUPABASE_JWT_SECRET`) privat minimal 32 karakter. Rilis API sebelum aplikasi. Token sesi lama harus diganti lewat login kembali; kata sandi lama ditingkatkan ke Argon2id saat login berhasil. Logout tidak menghapus antrean offline.
- Simpan `STORAGE_LOCAL_DIR` di volume privat yang persisten. Untuk S3/R2 gunakan bucket privat, cabut akses publik lama dan invalidasi cache CDN. Jangan sajikan direktori unggahan melalui static server.
- Struk lokal lama berada di direktori datar tanpa identitas pemilik. Akses HTTP baru tidak membacanya. Cocokkan pemilik dari sumber tepercaya sebelum memindahkannya ke `STORAGE_LOCAL_DIR/receipts/<userId>/`. Jika lokasi asal berbeda, tetapkan `STORAGE_LEGACY_DIR` ke direktori struk lama. Selama masih ada struk lama yang belum direkonsiliasi, API menolak konfirmasi penghapusan akun.
- Cadangan `.ukbak` menyimpan data dan antrean milik satu akun, bukan salinan biner foto. Rilis ini tidak dapat merekonstruksi baris yang telanjur terhapus atau menentukan transaksi mana yang pernah menerima konfirmasi palsu. Bandingkan ekspor lokal dan cadangan server sebelum rilis ke pengguna lama.

Untuk instalasi Compose, tetapkan `POSTGRES_PASSWORD` dan `JWT_SECRET` melalui pengelola rahasia. PostgreSQL hanya dapat diakses melalui jaringan Compose. Mengubah `POSTGRES_PASSWORD` tidak mengganti kata sandi role pada volume PostgreSQL lama; koordinasikan perubahan kredensial tanpa menghapus volume. Sebelum mengganti kontainer lama, salin struk dari penyimpanan sebelumnya ke volume `receipt_data` dan periksa bahwa struk dapat dibaca.

Setelah memeriksa cadangan dan koneksi tujuan, jalankan migrasi sebagai langkah terpisah dengan **image baru**, sebelum mengganti API: `docker compose run --rm api bun dist/migrate.js`. Migrasi `0004` menyimpan porsi pengeluaran yang dibiayai kantong; `0005` menambah metadata dompet. Jalankan API baru sebelum memperbarui klien. Porsi debit kantong lama tidak dapat disimpulkan dari nominal pengeluaran: edit alokasi dan pembatalannya ditolak sampai direkonsiliasi dengan catatan yang tepercaya.

Sinkronisasi membawa transaksi, dompet (termasuk dompet kosong), dan kategori ke perangkat kedua. Cadangan tetap diperlukan untuk data yang hanya dikelola di perangkat, termasuk anggota patungan, riwayat setoran, dan mutasi bank lokal. Kantong patungan di aplikasi seluler tidak menawarkan undangan lintas perangkat.

### Pembaruan keamanan: migrasi 0006

1. Cadangkan PostgreSQL dan volume struk. Hentikan penulisan dari API lama saat menerapkan `0006_security_boundaries`. Migrasi menolak tautan rekonsiliasi lama yang duplikat atau tidak cocok dengan pemilik, dompet, atau status. Selidiki catatan itu, jangan menghapus transaksi untuk meloloskan migrasi.
2. Jalankan API dan aplikasi baru sebagai satu pembaruan terkoordinasi. Token lama tidak berlaku. Tiap login menerbitkan sesi perangkat selama satu jam; masuk kembali dari kartu profil untuk melanjutkan sinkronisasi setelah kedaluwarsa. Pencatatan offline dan antrean lokal tetap tersedia. Klien lama tidak mendukung konfirmasi kata sandi untuk hapus akun. Pembaruan mobile memerlukan **build native baru** karena memakai `expo-crypto`, bukan hanya pembaruan JavaScript.
3. Tempatkan API di belakang HTTPS. Compose mengikat port API ke loopback host. Jika menggunakan reverse proxy, tetapkan `TRUSTED_PROXY_IPS` hanya ke alamat peer proxy yang benar-benar terlihat oleh API; proxy wajib **menimpa** `X-Real-IP`. Tanpa konfigurasi itu, pembatas memakai IP koneksi langsung. Penghitung per IP dan akun dibagikan antarinstans melalui PostgreSQL. Jika builder sebelumnya menggunakan cache bersama, tinjau akses historis ke cache: `.dockerignore` baru tidak membersihkan cache lama.
4. Terbitkan ulang undangan yang masih dibutuhkan. Satu kode berlaku untuk satu kali bergabung, maksimal 24 jam. Menerbitkan kode baru atau mencabut anggota membatalkan kode lama. Unggahan struk dibatasi 5 MiB per berkas, 100 berkas dan 100 MiB per akun, termasuk berkas lama. Berkas lama yang melebihi kuota tidak dihapus otomatis.

---

## 🔒 Presisi Nilai Uang (Exact Minor Units)
Untuk mencegah bug *floating-point arithmetic*, seluruh nominal uang disimpan dalam bentuk **bilangan bulat (integer minor unit)**.
Contoh:
* `Rp 25.000` $\to$ disimpan sebagai integer `25000`.
* `formatRupiah(25000)` $\to$ `Rp 25.000`.
* `parseRupiah("Rp 25.000")` $\to$ `25000`.
