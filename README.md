# UangKu — Aplikasi Pencatatan Keuangan Personal iOS

> Aplikasi pencatatan uang personal berbasis iOS dengan tampilan mewah & elegan, waktu input ultra-cepat ($\le 10$ detik), arsitektur *offline-first* dengan SQLite lokal & outbox sync, serta backend Bun + ElysiaJS + Drizzle ORM.

---

## ✨ Karakteristik & Desain Mewah (*Luxury & Elegance*)

- **Tema Desain:** *Onyx Obsidian & Royal Champagne Gold* (`#090A0E` dengan aksen `#D4AF37` dan `#E5C378`).
- **Indikator Finansial:**
  - Pemasukan: *Emerald Green* (`#10B981`)
  - Pengeluaran: *Ruby Rose* (`#F43F5E`)
  - Transfer Antar Akun: *Celestial Sapphire* (`#38BDF8`)
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
bun install
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
# Menjalankan unit tests (@uangku/contracts money & validation)
bun run test

# Menjalankan TypeScript typecheck di seluruh monorepo
bun run typecheck
```

---

## 🔒 Presisi Nilai Uang (Exact Minor Units)
Untuk mencegah bug *floating-point arithmetic*, seluruh nominal uang disimpan dalam bentuk **bilangan bulat (integer minor unit)**.
Contoh:
* `Rp 25.000` $\to$ disimpan sebagai integer `25000`.
* `formatRupiah(25000)` $\to$ `Rp 25.000`.
* `parseRupiah("Rp 25.000")` $\to$ `25000`.
