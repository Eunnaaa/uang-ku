# PRD — Aplikasi Pencatatan Keuangan Personal iOS

**Document status:** Draft  
**Version:** 1.0  
**Target platform:** iOS  
**Frontend:** React Native + Expo + TypeScript  
**Server:** Bun + ElysiaJS + TypeScript  
**Database:** Supabase PostgreSQL + Drizzle ORM  
**Authentication:** Supabase Auth  
**Architecture style:** Modular monolith / API-first  
**Primary language:** Bahasa Indonesia  
**Initial release:** MVP

---

## 1. Product Overview

Aplikasi ini adalah aplikasi pencatatan uang personal berbasis iOS yang membantu pengguna mencatat pemasukan, pengeluaran, dan transfer antar dompet/rekening secara cepat, melihat kondisi keuangan secara sederhana, dan memahami pola pengeluaran melalui ringkasan serta laporan.

Produk diprioritaskan untuk:

1. pencatatan transaksi yang sangat cepat (<= 10 detik dengan custom numeric keypad);
2. histori transaksi yang mudah dicari, difilter, dan dikelola (termasuk mutasi transfer antar akun);
3. ringkasan saldo akumulatif dan arus kas riil yang mudah dipahami;
4. pengelompokan transaksi berdasarkan kategori hierarkis/kustom;
5. keamanan, privasi data keuangan, dan kepatuhan penuh pedoman privasi iOS/App Store (App Store Review Guidelines 5.1.1);
6. pengalaman offline-first yang andal menggunakan SQLite lokal dan outbox sync pattern;
7. pengalaman iOS yang ramah, taktil, dan responsif (Haptic feedback, dynamic type, dark mode, gestures);
8. fondasi arsitektur yang dapat dikembangkan ke fitur budgeting, recurring transaction, export, dan multi-account tanpa melakukan rewrite besar.

### 1.1 Problem Statement

Pencatatan keuangan sering gagal dilakukan secara konsisten karena proses input terlalu panjang, informasi keuangan tersebar, dan pengguna sulit melihat hubungan antara transaksi harian dengan kondisi saldo secara keseluruhan.

Aplikasi harus menjawab masalah utama:

> "Bagaimana pengguna dapat mencatat uang masuk/keluar dalam beberapa detik dan langsung memahami kondisi keuangannya?"

### 1.2 Product Goal

Membangun aplikasi personal finance yang:

- memungkinkan transaksi dicatat dalam <= 10 detik pada alur normal;
- memberikan saldo dan cash-flow summary yang konsisten;
- meminimalkan risiko kehilangan data ketika koneksi internet tidak tersedia;
- menjaga isolasi data antar pengguna;
- memiliki backend yang typed, testable, dan scalable secara horizontal.

### 1.3 Non-Goals untuk MVP

Fitur berikut tidak menjadi scope MVP:

- integrasi langsung dengan rekening bank;
- open banking;
- pembayaran/transfer uang;
- investasi/trading;
- pinjaman;
- sinkronisasi kartu kredit secara otomatis;
- AI financial advisor;
- multi-user household/shared wallet;
- web dashboard;
- desktop app;
- subscription/billing;
- OCR struk sebagai fitur wajib.

Fitur non-goal dapat masuk roadmap setelah fondasi transaksi stabil.

---

# 2. Target User

## 2.1 Primary Persona

### Persona A — Personal Expense Tracker

Pengguna individu yang ingin:

- mengetahui uang tersisa;
- mencatat pengeluaran harian;
- mengetahui kategori pengeluaran terbesar;
- melihat pemasukan vs pengeluaran;
- mengevaluasi kebiasaan keuangan.

### Persona B — Young Professional / Student

Karakteristik:

- transaksi relatif sering;
- membutuhkan input cepat;
- banyak transaksi kecil;
- menggunakan smartphone sebagai perangkat utama;
- tidak membutuhkan accounting software yang kompleks.

---

# 3. Product Principles

1. **Fast first** — pencatatan transaksi adalah aksi utama dan harus sangat cepat.
2. **Simple over comprehensive** — MVP tidak boleh terasa seperti software accounting.
3. **Local-first where practical** — pengguna tetap dapat mencatat transaksi dasar ketika offline.
4. **Server as source of truth** — server/database menjadi sumber kebenaran setelah synchronization.
5. **Money must be exact** — jangan menggunakan floating-point untuk nilai uang.
6. **Secure by default** — data finansial bersifat private.
7. **Explicit state** — transaction state, sync state, dan error state harus jelas.
8. **Observable** — error backend dan sync harus dapat dilacak tanpa mengekspos data sensitif.
9. **Backward compatible API** — perubahan API harus dapat dilakukan tanpa memutus versi aplikasi lama secara tiba-tiba.

---

# 4. Core User Journeys

## 4.1 First Launch

1. User membuka aplikasi.
2. User melihat onboarding singkat.
3. User memilih Sign In / Sign Up.
4. User melakukan authentication.
5. Backend memastikan profile dan default categories tersedia.
6. User masuk ke Home Dashboard.

## 4.2 Add Expense

1. User membuka Add Transaction.
2. Default type = Expense.
3. User memasukkan amount.
4. User memilih category.
5. User dapat menambahkan note.
6. User memilih date.
7. User menekan Save.
8. Aplikasi menyimpan transaksi.
9. Saldo/summary diperbarui.
10. Jika offline, transaksi masuk ke local outbox dan diberi status `pending_sync`.

## 4.3 Add Income

Flow sama dengan expense, tetapi transaction type = `income`.

## 4.4 Transfer Between Accounts (Mutasi Antar Dompet)

1. User membuka Add Transaction dan memilih tab **Transfer**.
2. User memasukkan amount nominal yang ditransfer.
3. User memilih **Source Account** (Akun asal, misal: Rekening BCA).
4. User memilih **Destination Account** (Akun tujuan, misal: Dompet Tunai atau GoPay).
5. User dapat mengisi **Transfer Fee** jika ada (misal: biaya admin Rp 1.000, opsional).
6. User dapat menambahkan catatan (opsional) dan memilih tanggal/waktu transaksi.
7. User menekan Simpan.
8. Aplikasi memvalidasi: akun asal tidak boleh sama dengan akun tujuan.
9. Saldo akun asal terpotong (`amount + fee`), saldo akun tujuan bertambah (`amount`).
10. Arus kas bulanan (Net Cash Flow) **tidak terpengaruh** oleh pokok nominal transfer, melainkan hanya oleh transfer fee (diperlakukan sebagai expense operasional).
11. Jika offline, transaksi transfer masuk ke SQLite lokal dan dicatat ke `mutation_outbox` dengan status `pending_sync`.

## 4.5 Review Transactions

1. User membuka Transactions.
2. App menampilkan transaksi terbaru (income, expense, dan transfer dengan visual badge pembeda).
3. User dapat filter:
   - type (`all`, `expense`, `income`, `transfer`);
   - category;
   - date range;
   - account;
4. User dapat membuka detail.
5. User dapat edit atau delete transaction (soft-delete).

## 4.6 Monthly Summary & Cash Flow

1. User membuka Dashboard/Reports.
2. App menampilkan:
   - total income;
   - total expense;
   - net cash flow (Income - Expense - Transfer Fees);
   - current balance (agregasi saldo seluruh akun aktif);
   - expense by category (pie chart / ranking list);
   - comparison dengan periode sebelumnya.
3. User dapat mengganti bulan / periode.

---

# 5. Functional Requirements

## 5.1 Authentication

### MVP

- Email/password sign up.
- Email/password sign in.
- Sign out.
- Session persistence.
- Refresh session.
- Forgot/reset password.
- Account deletion request.

### Future

- Sign in with Apple.
- Passkey.
- Biometric re-authentication.

### Acceptance Criteria

- User tidak dapat mengakses data user lain.
- Session tetap tersedia setelah app restart selama session masih valid.
- Expired access token harus dapat diperbarui melalui refresh flow.
- Logout harus membersihkan credential/session lokal.

---

# 6. Dashboard

Dashboard harus menjadi screen pertama setelah authentication.

### Components

1. Current balance.
2. Current period income.
3. Current period expense.
4. Net cash flow.
5. Recent transactions.
6. Expense category summary.
7. Quick Add button.

### Balance Definition

Untuk MVP:

- **Per-Account Balance:**
  `account_balance = initial_balance + SUM(income) - SUM(expense) + SUM(transfer_in) - SUM(transfer_out + transfer_fee)`
- **Overall Total Balance (Net Worth):**
  `total_balance = SUM(all active account_balances)`
- **Net Cash Flow (Arus Kas Bersih Periode Berjalan):**
  `net_cash_flow = total_income - total_expense - total_transfer_fees`
  *(Catatan: pokok nominal transfer antar akun milik sendiri adalah pergeseran aset, bukan pengurang cash flow).*

### Important Rule

Balance tidak boleh dihitung menggunakan data transaksi yang belum diketahui status sync-nya tanpa memberi indikasi kepada user apabila data tersebut belum tersinkronisasi. Indikator `pending_sync` harus tampak di UI jika ada mutasi lokal yang belum ter-ACK oleh server.

---

# 7. Transaction Management

## 7.1 Transaction Fields

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key (UUIDv7 atau canonical server UUID) |
| user_id | UUID | Yes | Pemilik data (diverifikasi dari token auth) |
| account_id | UUID | Yes | Akun utama / sumber dana (`source account`) |
| destination_account_id | UUID | Conditional | Wajib diisi jika `type = 'transfer'`. Akun tujuan mutasi dana. Null jika income/expense |
| type | VARCHAR | Yes | Enum: `'income'`, `'expense'`, `'transfer'` |
| amount | BIGINT | Yes | Nominal uang dalam minor unit (contoh: 25000 untuk IDR Rp 25.000). Nilai > 0 |
| transfer_fee | BIGINT | No | Biaya transfer/admin (hanya berlaku pada transfer, default 0) |
| currency | VARCHAR(3) | Yes | ISO 4217 standard (contoh: `'IDR'`, `'USD'`) |
| category_id | UUID | Conditional | Wajib untuk `'income'` dan `'expense'`. Nullable untuk `'transfer'` (atau otomatis berkategori sistem "Transfer Antar Akun") |
| note | TEXT | No | Catatan bebas transaksi (maksimal 255 karakter) |
| transaction_date | TIMESTAMPTZ | Yes | Waktu terjadinya transaksi (disimpan dengan offset/timezone) |
| client_id | UUID | Yes | Kunci idempoten unik yang di-generate perangkat client |
| version | INTEGER | Yes | Angka versi mutasi (dimulai dari 1) untuk deteksi konflik LWW |
| created_at | TIMESTAMPTZ | Yes | Waktu pencatatan di database |
| updated_at | TIMESTAMPTZ | Yes | Waktu update terakhir di database |
| deleted_at | TIMESTAMPTZ | No | Nullable timestamp untuk soft delete (tombstone) |

### Invariant & Integrity Rules

1. Jika `type = 'transfer'`:
   - `destination_account_id` wajib diisi dan harus berbeda dengan `account_id` (`destination_account_id != account_id`).
   - `destination_account_id` dan `account_id` harus milik `user_id` yang sama.
   - `transfer_fee >= 0`.
2. Jika `type IN ('income', 'expense')`:
   - `destination_account_id` harus `NULL`.
   - `category_id` wajib mereferensikan kategori valid milik user atau sistem.

### Money Representation

Untuk IDR:

`Rp 25.000` disimpan sebagai integer `25000`.

Jangan menyimpan:

```text
25000.00
```

sebagai JavaScript `number` jika dapat mengakibatkan precision issue.

Untuk mata uang dengan minor unit, backend menyimpan nilai dalam minor unit.

Contoh:

- USD 10.50 → `1050`
- IDR 25,000 → `25000`

Currency harus menentukan cara formatting di client.

---

# 8. Categories

## 8.1 Default Expense Categories

- Makanan
- Transportasi
- Belanja
- Tagihan
- Hiburan
- Kesehatan
- Pendidikan
- Lainnya

## 8.2 Default Income Categories

- Gaji
- Bonus
- Freelance
- Bisnis
- Hadiah
- Lainnya

User dapat:

- create category;
- rename category;
- archive category.

Category yang telah digunakan oleh transaksi tidak boleh hard-delete. Gunakan soft archive.

---

# 9. Accounts / Wallets

Walaupun MVP dapat dimulai dengan satu dompet default (misal "Dompet Utama" / "Cash"), domain model dan database mendukung multi-account secara penuh sejak hari pertama.

### Tipe Akun yang Didukung

- `cash`: Uang tunai fisik di dompet
- `bank`: Rekening tabungan bank (BCA, Mandiri, BRI, BNI, dll.)
- `e_wallet`: Dompet digital (GoPay, OVO, Dana, ShopeePay)
- `investment`: Reksadana/Saham (tahap lanjutan)
- `other`: Aset likuid lainnya

### Account Fields

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| user_id | UUID | Yes | Pemilik akun (FK ke `profiles.id`) |
| name | VARCHAR(50) | Yes | Nama akun, misal: "BCA Utama", "Dompet Tunai" |
| type | VARCHAR(20) | Yes | Enum: `'cash'`, `'bank'`, `'e_wallet'`, `'other'` |
| currency | VARCHAR(3) | Yes | Default: `'IDR'` |
| initial_balance | BIGINT | Yes | Saldo pembuka saat akun pertama dibuat (minor unit, default 0) |
| is_default | BOOLEAN | Yes | Penanda dompet utama default saat user baru mendaftar |
| is_archived | BOOLEAN | Yes | Default false. Soft archive jika akun tidak lagi dipakai |
| created_at | TIMESTAMPTZ | Yes | Waktu pembuatan |
| updated_at | TIMESTAMPTZ | Yes | Waktu pembaruan |

### Rules & Lifecycle

1. **Auto-provisioning saat Sign Up:**
   Saat pengguna baru selesai registrasi, backend otomatis membuatkan 1 default account:
   - Nama: `"Kas / Dompet"`
   - Tipe: `'cash'`
   - `initial_balance`: `0`
   - `is_default`: `true`
2. **Transfer Mutasi Antar Akun:**
   - Ketika transfer dicatat, akun asal berkurang (`amount + fee`) dan akun tujuan bertambah (`amount`).
   - Akun yang sudah diarsipkan (`is_archived = true`) tidak dapat dipilih sebagai sumber maupun tujuan transfer baru.
3. **Pencegahan Penghapusan Permanen (Zero Data Loss):**
   - Akun yang memiliki histori transaksi tidak boleh di-hard delete. Pengguna hanya dapat melakukan **Archive**.
   - Saldo akun yang diarsipkan tetap dihitung dalam kekayaan bersih (*Net Worth*) historis kecuali pengguna memilih menutup dan memindahkan saldo sisa lewat transaksi transfer.

---

# 10. Transaction List

### Required Features

- newest first;
- grouped by date;
- amount formatting;
- income/expense visual distinction;
- category icon;
- search note/category;
- filter;
- pagination/infinite scrolling.

### Pagination

Backend menggunakan cursor-based pagination untuk transaction list.

Contoh:

```text
GET /v1/transactions?limit=30&cursor=<opaque_cursor>
```

Jangan menggunakan offset pagination sebagai strategi utama untuk dataset besar.

---

# 11. Transaction Detail

User dapat melihat:

- amount;
- type;
- category;
- account;
- date/time;
- note;
- created timestamp;
- sync status bila relevan.

Actions:

- Edit.
- Delete.

Delete menggunakan soft delete agar synchronization dan audit behavior lebih aman.

---

# 12. Reports

## MVP

### Monthly Cash Flow

```text
Income
Expense
Net Cash Flow
```

### Expense by Category

Contoh:

```text
Makanan       Rp 1.200.000
Transportasi  Rp   450.000
Belanja       Rp   700.000
```

### Period

- Current month.
- Previous month.
- Custom date range.

### Future

- budget vs actual;
- trend 6/12 bulan;
- recurring expense;
- financial goals.

## 12.3 Data Export Specification (CSV & Backup)

Pengguna dapat mengekspor seluruh histori transaksi atau rentang tanggal tertentu ke file `.csv` untuk keperluan backup pribadi atau analisis di Microsoft Excel / Google Sheets / Numbers:

### Struktur File CSV

- **Encoding:** `UTF-8 dengan BOM` (`\uFEFF`) agar Excel di macOS dan Windows otomatis mengenali karakter khusus dan format pemisah tanpa perlu konfigurasi teks impor manual.
- **Delimiter:** Koma (`,`) dengan standard RFC 4180 (bidang yang mengandung koma atau enter diapit tanda kutip ganda `"`).
- **Header Kolom:**
  ```csv
  Tanggal,Waktu,Tipe,Kategori,Nominal (IDR),Dari Akun,Ke Akun,Biaya Admin,Catatan
  ```
- **Contoh Data Baris:**
  ```csv
  "2026-10-04","12:30:00","Pengeluaran","Makanan",25000,"Dompet Tunai","","0","Nasi Padang"
  "2026-10-04","14:00:00","Transfer","Transfer Antar Akun",100000,"BCA Utama","GoPay",2500,"Top up e-wallet"
  "2026-10-01","09:00:00","Pemasukan","Gaji",12000000,"BCA Utama","","0","Gaji Bulanan"
  ```

### Flow & Sharing iOS

1. User memilih rentang tanggal di menu `Laporan > Ekspor CSV`.
2. Generator CSV berjalan secara lokal menggunakan data SQLite (atau streaming endpoint API).
3. File disimpan sementara di `FileSystem.cacheDirectory + '/UangKu_Export_YYYYMMDD.csv'`.
4. Dipanggil `Sharing.shareAsync()` (`expo-sharing`) untuk membuka **iOS Native Share Sheet** (opsi: Simpan ke Files, AirDrop, Kirim via WhatsApp/Email).
5. File cache otomatis dibersihkan setelah selesai.

---

# 13. Offline-First & Synchronization

Offline capability adalah salah satu architectural requirement penting.

## 13.1 Local Storage Architecture (Expo SQLite)

React Native app menggunakan **Expo SQLite** (`expo-sqlite`) dengan mode *WAL (Write-Ahead Logging)* untuk performa baca/tulis konkurensi tinggi tanpa memblokir thread UI.

### Skema Tabel SQLite Lokal

```sql
-- 1. Mirror Tabel Transaksi
CREATE TABLE IF NOT EXISTS local_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  destination_account_id TEXT,
  category_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount INTEGER NOT NULL,
  transfer_fee INTEGER DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  note TEXT,
  transaction_date TEXT NOT NULL,
  client_id TEXT UNIQUE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending_sync', 'failed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_local_tx_date ON local_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_local_tx_sync ON local_transactions(sync_status);

-- 2. Mirror Tabel Akun
CREATE TABLE IF NOT EXISTS local_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  initial_balance INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3. Mirror Tabel Kategori
CREATE TABLE IF NOT EXISTS local_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  icon TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 4. Tabel Antrean Mutasi (Mutation Outbox)
CREATE TABLE IF NOT EXISTS mutation_outbox (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('transaction', 'account', 'category')),
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON string payload
  retry_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'failed')),
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 5. Tabel Metadata Sinkronisasi
CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Untuk secret material (Supabase Access Token & Refresh Token), **WAJIB** disimpan menggunakan `expo-secure-store` yang memanfaatkan iOS Keychain, bukan di SQLite atau AsyncStorage.

## 13.2 Outbox Pattern & Lifecycle

Setiap aksi penulisan data oleh pengguna (create, update, delete) dilakukan secara atomik di SQLite lokal melalui `db.withTransactionSync()`:

1. Insert / update data pada tabel lokal (`local_transactions`) dengan flag `sync_status = 'pending_sync'`.
2. Insert instruksi mutasi ke `mutation_outbox` dengan `status = 'pending'`.
3. Notifikasi UI secara instan (respons <= 50ms) menggunakan data lokal (*Optimistic UX*).
4. Picu background worker `syncEngine.processOutbox()`.

### Struktur Payload Outbox

```json
{
  "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "clientId": "a3b4c5d6-e7f8-4a9b-8c0d-1e2f3a4b5c6d",
  "entityType": "transaction",
  "operation": "create",
  "entityId": "a3b4c5d6-e7f8-4a9b-8c0d-1e2f3a4b5c6d",
  "payload": {
    "accountId": "b4c5d6e7-f8a9-4b0c-9d1e-2f3a4b5c6d7e",
    "destinationAccountId": null,
    "categoryId": "c5d6e7f8-a9b0-4c1d-0e2f-3a4b5c6d7e8f",
    "type": "expense",
    "amount": 45000,
    "currency": "IDR",
    "note": "Kopi sore",
    "transactionDate": "2026-10-04T15:30:00+07:00",
    "version": 1
  },
  "retryCount": 0,
  "status": "pending",
  "createdAt": "2026-10-04T08:30:00.000Z"
}
```

## 13.3 Sync Engine Orchestration

Sync Engine dijalankan secara reaktif pada kondisi:

1. **App Foregrounding:** Setiap aplikasi dibuka dari background (`AppState === 'active'`).
2. **Koneksi Pulih:** Mendeteksi perubahan jaringan via `@react-native-community/netinfo` (`isConnected === true && isInternetReachable === true`).
3. **Post-Mutation:** Sesaat setelah mutasi baru berhasil ditulis ke outbox lokal.
4. **Manual Pull-to-Refresh:** Trigger gestur pengguna pada layar transaksi atau dashboard.

### Algoritma Retry (Exponential Backoff with Jitter)

Jika push outbox gagal akibat masalah jaringan atau server 5xx:

$$\text{Delay} = \min\left(2^{\text{retry\_count}} \times 1000 + \text{random}(0, 1000), 30000\right)\text{ ms}$$

- Mutasi yang gagal akan diberi status `'failed'`, dan `retry_count` bertambah.
- Batas maksimal retry: **5 kali**. Jika melebihi 5 kali akibat *client validation error* (4xx), mutasi ditandai `dead_letter` dan dilaporkan ke user untuk tindakan manual.
- Batching: Mengirim maksimal **50 mutasi per request push** untuk menjaga ukuran payload HTTP tetap efisien.

## 13.4 Idempotency & Unique Keys

- Setiap mutasi membawa `clientId` (UUIDv7 yang memiliki komponen timestamp terurut).
- Header HTTP wajib dikirim: `Idempotency-Key: <clientId>`.
- Jika server menerima mutasi dengan `clientId` yang sudah pernah diproses:
  * Server **tidak mengeksekusi ulang** perubahan ke DB.
  * Server langsung merespons dengan status `200 OK` berisi data kanonikal transaksi yang tersimpan.
  * Local outbox menghapus entri tersebut dan menandai record lokal sebagai `sync_status = 'synced'`.

## 13.5 Comprehensive Conflict Resolution Matrix

| Kasus Konflik | Kondisi Server | Kondisi Client (Offline Mutation) | Strategi Resolusi | Hasil Akhir |
|---|---|---|---|---|
| **Create Duplication** | Record dengan `client_id` sudah ada di server (akibat timeout retry sebelumnya) | Client mencoba push `create` ulang dengan `client_id` yang sama | **Idempotent Acknowledge** | Server mengembalikan record kanonikal; Client menghapus mutasi dari outbox. Status lokal menjadi `synced`. |
| **Concurrent Update (LWW)** | Record diperbarui di device lain (`version` server = 3, `updated_at` server > client) | Client mengedit transaksi secara offline (`version` client = 2) | **Last-Write-Wins (LWW) per Versi** | Jika `version` server > `version` client, server menolak update dengan kode `SYNC_CONFLICT`. Client menerima data server terbaru dan menimpa state lokal. |
| **Update vs Soft-Delete** | Transaksi telah dihapus di server (`deleted_at IS NOT NULL`) | Client mengedit data transaksi tersebut saat offline | **Tombstone Wins** | Server menolak mutasi update karena entitas telah mati. Client menandai transaksi lokal sebagai terhapus (`deleted_at` terisi) dan membersihkan outbox. |
| **Delete vs Update** | Transaksi telah diperbarui di server | Client menghapus transaksi saat offline | **Tombstone Wins** | Penghapusan (soft-delete) oleh client tetap dieksekusi di server. `deleted_at` diisi di database server. |
| **Foreign Key Archived (Kategori/Akun)** | Kategori atau Akun diarsipkan di server saat client offline | Client membuat transaksi baru mengaitkan kategori/akun tersebut | **Graceful Degradation** | Transaksi tetap diterima di server. Jika akun/kategori berstatus soft-archived, transaksi tetap dicatat valid untuk menjaga integritas historis, tetapi di UI client kategori tersebut ditandai `(Arsip)`. |
| **Unrecoverable Payload** | Data corrupt atau validasi skema gagal permanen (400 Bad Request) | Payload lokal tidak valid | **Dead-Letter Quarantine** | Mutasi dipindahkan dari outbox ke tabel `dead_letter_mutations`. User diberi notifikasi ramah: *"Transaksi gagal disinkronkan dan perlu disimpan ulang."* |

## 13.6 Local SQLite Migration Runner (`PRAGMA user_version`)

Ketika aplikasi mobile diperbarui melalui App Store (misal: penambahan kolom atau indeks baru), skema SQLite lokal harus bermigrasi tanpa menghapus data transaksi pengguna yang belum tersinkronisasi.

### Mekanisme Migrasi

Aplikasi menggunakan pragma SQLite native: `PRAGMA user_version` untuk melacak versi skema lokal saat ini.

```ts
// src/db/migrations.ts
export interface LocalMigration {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
}

export const localMigrations: LocalMigration[] = [
  {
    version: 1,
    up: async (db) => {
      await db.execAsync(`
        -- DDL V1: Inisialisasi tabel dasar
        CREATE TABLE IF NOT EXISTS local_transactions (...);
        CREATE TABLE IF NOT EXISTS local_accounts (...);
        CREATE TABLE IF NOT EXISTS local_categories (...);
        CREATE TABLE IF NOT EXISTS mutation_outbox (...);
        CREATE TABLE IF NOT EXISTS sync_metadata (...);
      `);
    }
  },
  {
    version: 2,
    up: async (db) => {
      // Contoh migrasi V2: Penambahan kolom indeks performa
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_tx_amount ON local_transactions(amount);
      `);
    }
  }
];

export async function runLocalMigrations(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = result?.user_version ?? 0;

  for (const migration of localMigrations) {
    if (migration.version > currentVersion) {
      await db.withTransactionAsync(async () => {
        await migration.up(db);
        await db.execAsync(`PRAGMA user_version = ${migration.version};`);
      });
    }
  }
}
```

- **Zero Data Loss:** Migrasi dijalankan di dalam blok transaksi (`withTransactionAsync`). Jika ada kegagalan, migrasi dibatalkan (*rollback*) dan status database tetap utuh.
- **Boot Integrity:** `runLocalMigrations` dijalankan pada *splash screen / app bootstrap* sebelum UI render pertama kali.

---

# 14. System Architecture

## 14.1 High-Level Architecture

```text
┌──────────────────────────────┐
│          iOS App             │
│ React Native + Expo          │
│                              │
│ UI / Navigation              │
│ Feature Modules              │
│ State Management             │
│ Local SQLite                 │
│ Sync Engine                  │
└──────────────┬───────────────┘
               │ HTTPS
               │ JSON
               v
┌──────────────────────────────┐
│       Bun + ElysiaJS         │
│                              │
│ API / Auth Middleware        │
│ Validation                   │
│ Business Services            │
│ Transaction Service          │
│ Sync Service                 │
│ Report Service               │
│ Error Handling               │
└──────────────┬───────────────┘
               │
               │ Drizzle ORM
               v
┌──────────────────────────────┐
│       Supabase Postgres      │
│                              │
│ users/profile metadata       │
│ accounts                     │
│ categories                   │
│ transactions                 │
│ sync/idempotency records     │
└──────────────────────────────┘

Additional Supabase services:
- Supabase Auth
- Postgres
- Storage only if future receipt upload is implemented
```

## 14.2 Responsibility Boundaries

### Mobile App

Responsible for:

- UI;
- local state;
- local cache;
- optimistic UX;
- offline outbox;
- request orchestration;
- client-side validation for UX.

### ElysiaJS Server

Responsible for:

- authentication verification;
- authorization;
- request validation;
- business rules;
- transaction consistency;
- sync;
- report aggregation;
- rate limiting;
- API versioning;
- observability.

### Supabase

Responsible for:

- PostgreSQL;
- Auth;
- managed database infrastructure;
- backups/recovery facilities;
- optional storage.

### Drizzle

Responsible for:

- typed SQL access;
- schema definitions;
- migrations;
- query composition;
- database type safety.

---

# 15. Backend Architecture

Recommended structure:

```text
server/
├── src/
│   ├── app/
│   │   ├── config.ts
│   │   ├── env.ts
│   │   └── server.ts
│   │
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── error-handler.ts
│   │   ├── request-id.ts
│   │   └── rate-limit.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── accounts/
│   │   ├── categories/
│   │   ├── transactions/
│   │   ├── reports/
│   │   └── sync/
│   │
│   ├── db/
│   │   ├── client.ts
│   │   ├── schema/
│   │   └── migrations/
│   │
│   ├── shared/
│   │   ├── errors/
│   │   ├── types/
│   │   ├── utils/
│   │   └── constants/
│   │
│   └── index.ts
│
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

## 15.1 Module Structure

Setiap feature module sebaiknya memiliki:

```text
transactions/
├── transaction.route.ts
├── transaction.service.ts
├── transaction.repository.ts
├── transaction.schema.ts
├── transaction.types.ts
└── transaction.test.ts
```

Route tidak boleh langsung melakukan query database.

Recommended flow:

```text
HTTP Route
   ↓
Schema Validation
   ↓
Service
   ↓
Repository
   ↓
Drizzle
   ↓
PostgreSQL
```

---

# 16. API Design

Base URL:

```text
/api/v1
```

## 16.1 Authentication

Jika authentication menggunakan Supabase Auth, client memperoleh session/token dari Supabase Auth dan mengirim access token ke API.

```http
Authorization: Bearer <access_token>
```

Backend memverifikasi token sebelum mengakses resource user.

## 16.2 Endpoints

### Profile

```http
GET    /api/v1/me
PATCH  /api/v1/me
DELETE /api/v1/me
```

### Accounts

```http
GET    /api/v1/accounts
POST   /api/v1/accounts
PATCH  /api/v1/accounts/:id
DELETE /api/v1/accounts/:id
```

### Categories

```http
GET    /api/v1/categories
POST   /api/v1/categories
PATCH  /api/v1/categories/:id
DELETE /api/v1/categories/:id
```

### Transactions

```http
GET    /api/v1/transactions
POST   /api/v1/transactions
GET    /api/v1/transactions/:id
PATCH  /api/v1/transactions/:id
DELETE /api/v1/transactions/:id
```

### Reports

```http
GET /api/v1/reports/summary
### Reports

```http
GET /api/v1/reports/summary?month=2026-10
GET /api/v1/reports/expenses-by-category?month=2026-10
GET /api/v1/reports/cash-flow?startDate=2026-01-01&endDate=2026-12-31
```

### Sync

```http
POST /api/v1/sync/push
GET  /api/v1/sync/pull?cursor=<opaque_cursor>&limit=100
```

---

# 17. API Response Contract & Endpoint Specifications

Semua response API dibungkus dalam format standar yang konsisten.

## 17.1 Response Envelope Structure

### Success Single Resource (200 / 201)

```json
{
  "data": {
    "id": "7b2e8a1f-825f-4a37-b671-3312c98d7fa2",
    "accountId": "b4c5d6e7-f8a9-4b0c-9d1e-2f3a4b5c6d7e",
    "destinationAccountId": null,
    "categoryId": "c5d6e7f8-a9b0-4c1d-0e2f-3a4b5c6d7e8f",
    "type": "expense",
    "amount": 25000,
    "transferFee": 0,
    "currency": "IDR",
    "note": "Makan Siang Nasi Padang",
    "transactionDate": "2026-10-04T12:30:00+07:00",
    "clientId": "a3b4c5d6-e7f8-4a9b-8c0d-1e2f3a4b5c6d",
    "version": 1,
    "createdAt": "2026-10-04T05:30:00.123Z",
    "updatedAt": "2026-10-04T05:30:00.123Z"
  },
  "meta": {
    "requestId": "9c8a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
    "timestamp": "2026-10-04T05:30:00.125Z"
  }
}
```

### Paginated Collection (200)

```json
{
  "data": [
    {
      "id": "7b2e8a1f-825f-4a37-b671-3312c98d7fa2",
      "type": "expense",
      "amount": 25000,
      "currency": "IDR",
      "category": {
        "id": "c5d6e7f8-a9b0-4c1d-0e2f-3a4b5c6d7e8f",
        "name": "Makanan",
        "icon": "utensils"
      },
      "account": {
        "id": "b4c5d6e7-f8a9-4b0c-9d1e-2f3a4b5c6d7e",
        "name": "Dompet Tunai"
      },
      "transactionDate": "2026-10-04T12:30:00+07:00"
    }
  ],
  "meta": {
    "nextCursor": "eyJsYXN0VmFsdWUiOiIyMDI2LTEwLTA0VDEyOjMwOjAwWiIsImxhc3RJZCI6IjdiMmU4YTFmIn0=",
    "hasMore": true,
    "limit": 30,
    "requestId": "9c8a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c"
  }
}
```

### Error Response (4xx / 5xx)

```json
{
  "error": {
    "code": "ACCOUNT_NOT_FOUND",
    "message": "Akun sumber dana tidak ditemukan atau telah diarsipkan.",
    "details": [
      {
        "field": "accountId",
        "issue": "Invalid UUID or unauthorized account ownership"
      }
    ],
    "requestId": "9c8a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c"
  }
}
```

## 17.2 Spesifikasi Endpoint Sync

### `POST /api/v1/sync/push`

**Request Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**Request Body:**

```json
{
  "mutations": [
    {
      "id": "11111111-2222-3333-4444-555555555555",
      "clientId": "a3b4c5d6-e7f8-4a9b-8c0d-1e2f3a4b5c6d",
      "entityType": "transaction",
      "operation": "create",
      "entityId": "a3b4c5d6-e7f8-4a9b-8c0d-1e2f3a4b5c6d",
      "version": 1,
      "payload": {
        "accountId": "b4c5d6e7-f8a9-4b0c-9d1e-2f3a4b5c6d7e",
        "destinationAccountId": "e8f9a0b1-c2d3-4e5f-6a7b-8c9d0e1f2a3b",
        "type": "transfer",
        "amount": 100000,
        "transferFee": 2500,
        "currency": "IDR",
        "note": "Top up e-wallet",
        "transactionDate": "2026-10-04T14:00:00+07:00"
      }
    }
  ]
}
```

**Response (200 OK):**

```json
{
  "data": {
    "processed": [
      {
        "id": "11111111-2222-3333-4444-555555555555",
        "clientId": "a3b4c5d6-e7f8-4a9b-8c0d-1e2f3a4b5c6d",
        "status": "applied",
        "serverEntityId": "a3b4c5d6-e7f8-4a9b-8c0d-1e2f3a4b5c6d",
        "version": 1
      }
    ],
    "conflicts": [],
    "rejected": []
  },
  "meta": {
    "requestId": "8f7a6b5c-4d3e-2a1f-0e9d-8c7b6a5f4e3d"
  }
}
```

## 17.3 Standard Error Catalog

| HTTP Status | Error Code | Kondisi Penyebab | Pesan User-Facing (ID) |
|---|---|---|---|
| **400** | `VALIDATION_ERROR` | Schema input tidak valid (misal: amount $\le$ 0, format UUID keliru) | Masukan tidak valid. Periksa kembali form transaksi. |
| **400** | `SAME_ACCOUNT_TRANSFER` | `destination_account_id` sama dengan `account_id` pada transaksi transfer | Akun asal dan akun tujuan transfer tidak boleh sama. |
| **401** | `UNAUTHORIZED` | Token JWT tidak ada, kadaluarsa, atau signature tidak valid | Sesi login telah berakhir. Silakan masuk kembali. |
| **403** | `FORBIDDEN` | Akses ke resource milik pengguna lain (IDOR defense) | Kamu tidak memiliki izin untuk mengakses data ini. |
| **404** | `RESOURCE_NOT_FOUND` | Transaksi, akun, atau kategori tidak ditemukan di database | Data yang dicari tidak ditemukan. |
| **409** | `SYNC_CONFLICT` | Versi mutasi client tertinggal dari versi server (`client.version < server.version`) | Terjadi perbedaan versi data. Sistem memperbarui data terbaru. |
| **429** | `RATE_LIMITED` | Permintaan melebihi batas (misal: spam login / brute-force) | Terlalu banyak permintaan. Mohon tunggu beberapa saat. |
| **500** | `INTERNAL_SERVER_ERROR` | Kesalahan internal backend / koneksi basis data | Terjadi kendala pada sistem. Tim kami sedang memperbaikinya. |

---

# 18. Validation

Gunakan schema validation di server.

Contoh create transaction:

```ts
{
  type: "expense",
  amount: 25000,
  currency: "IDR",
  categoryId: "uuid",
  accountId: "uuid",
  transactionDate: "2026-09-30T10:00:00Z",
  note?: "Lunch"
}
```

Rules:

- amount > 0;
- currency valid;
- category harus milik user atau global default category;
- account harus milik user;
- transaction date memiliki batas yang masuk akal;
- note memiliki maximum length;
- UUID harus valid.

Client-side validation tetap diperlukan untuk UX, tetapi server-side validation adalah authoritative.

---

# 19. Database Design

## 19.1 `profiles`

```text
id UUID PK REFERENCES auth.users(id) ON DELETE CASCADE
display_name VARCHAR(100)
default_currency VARCHAR(3) DEFAULT 'IDR'
timezone VARCHAR(50) DEFAULT 'Asia/Jakarta'
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

## 19.2 `accounts`

```text
id UUID PK DEFAULT gen_random_uuid()
user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
name VARCHAR(50) NOT NULL
type VARCHAR(20) NOT NULL CHECK (type IN ('cash', 'bank', 'e_wallet', 'other'))
currency VARCHAR(3) NOT NULL DEFAULT 'IDR'
initial_balance BIGINT NOT NULL DEFAULT 0
is_default BOOLEAN NOT NULL DEFAULT false
is_archived BOOLEAN NOT NULL DEFAULT false
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Indexes:

```sql
CREATE INDEX idx_accounts_user_active ON accounts(user_id, is_archived);
```

## 19.3 `categories`

```text
id UUID PK DEFAULT gen_random_uuid()
user_id UUID NULL REFERENCES profiles(id) ON DELETE CASCADE
name VARCHAR(50) NOT NULL
type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense'))
icon VARCHAR(50) NULL
is_system BOOLEAN NOT NULL DEFAULT false
is_archived BOOLEAN NOT NULL DEFAULT false
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Indexes:

```sql
CREATE INDEX idx_categories_user ON categories(user_id, is_archived);
```

## 19.4 `transactions`

```text
id UUID PK DEFAULT gen_random_uuid()
user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
account_id UUID NOT NULL REFERENCES accounts(id)
destination_account_id UUID NULL REFERENCES accounts(id)
category_id UUID NULL REFERENCES categories(id)
type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense', 'transfer'))
amount BIGINT NOT NULL CHECK (amount > 0)
transfer_fee BIGINT NOT NULL DEFAULT 0 CHECK (transfer_fee >= 0)
currency VARCHAR(3) NOT NULL DEFAULT 'IDR'
note TEXT NULL
transaction_date TIMESTAMPTZ NOT NULL
client_id UUID NOT NULL UNIQUE
version INTEGER NOT NULL DEFAULT 1
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
deleted_at TIMESTAMPTZ NULL
```

### Constraints & Partial Indexes

```sql
-- Constraint integritas transfer
ALTER TABLE transactions ADD CONSTRAINT chk_transfer_destination
  CHECK (
    (type = 'transfer' AND destination_account_id IS NOT NULL AND destination_account_id != account_id) OR
    (type != 'transfer' AND destination_account_id IS NULL)
  );

-- Constraint kategori wajib untuk non-transfer
ALTER TABLE transactions ADD CONSTRAINT chk_category_non_transfer
  CHECK (
    (type != 'transfer' AND category_id IS NOT NULL) OR
    (type = 'transfer')
  );

-- Partial indexes untuk query data aktif (mengabaikan deleted_at)
CREATE INDEX idx_tx_active_user_date ON transactions (user_id, transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_tx_active_account ON transactions (user_id, account_id, transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_tx_active_dest_account ON transactions (user_id, destination_account_id, transaction_date DESC) WHERE deleted_at IS NULL AND destination_account_id IS NOT NULL;
CREATE INDEX idx_tx_active_category ON transactions (user_id, category_id, transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_tx_client_id ON transactions (user_id, client_id);
CREATE INDEX idx_tx_updated_at ON transactions (user_id, updated_at);
```

## 19.5 `idempotency_keys`

```text
id UUID PK DEFAULT gen_random_uuid()
user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
key VARCHAR(128) NOT NULL UNIQUE
request_hash VARCHAR(64) NOT NULL
response_json JSONB NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
expires_at TIMESTAMPTZ NOT NULL
```

Index:

```sql
CREATE INDEX idx_idempotency_lookup ON idempotency_keys(user_id, key);
CREATE INDEX idx_idempotency_expiry ON idempotency_keys(expires_at);
```

## 19.6 `sync_events` (Change Feed)

Digunakan untuk sinkronisasi pull inkremental berkinerja tinggi:

```text
id BIGSERIAL PK
user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
entity_type VARCHAR(20) NOT NULL
entity_id UUID NOT NULL
operation VARCHAR(10) NOT NULL CHECK (operation IN ('create', 'update', 'delete'))
version INTEGER NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Index:

```sql
CREATE INDEX idx_sync_events_user_cursor ON sync_events(user_id, id ASC);
```

## 19.7 Implementasi Drizzle ORM Schema (`src/db/schema.ts`)

Kode referensi typed TypeScript untuk backend Bun + ElysiaJS:

```ts
import { pgTable, uuid, varchar, bigint, boolean, timestamp, integer, jsonb, text, index, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// 1. Profiles Table (Linked to Supabase auth.users)
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  displayName: varchar('display_name', { length: 100 }),
  defaultCurrency: varchar('default_currency', { length: 3 }).default('IDR').notNull(),
  timezone: varchar('timezone', { length: 50 }).default('Asia/Jakarta').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Accounts Table
export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'cash' | 'bank' | 'e_wallet' | 'other'
  currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
  initialBalance: bigint('initial_balance', { mode: 'number' }).default(0).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_accounts_user_active').on(table.userId, table.isArchived)
]);

// 3. Categories Table
export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }), // NULL for system categories
  name: varchar('name', { length: 50 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'income' | 'expense'
  icon: varchar('icon', { length: 50 }),
  isSystem: boolean('is_system').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_categories_user').on(table.userId, table.isArchived)
]);

// 4. Transactions Table
export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
  destinationAccountId: uuid('destination_account_id').references(() => accounts.id),
  categoryId: uuid('category_id').references(() => categories.id),
  type: varchar('type', { length: 20 }).notNull(), // 'income' | 'expense' | 'transfer'
  amount: bigint('amount', { mode: 'number' }).notNull(),
  transferFee: bigint('transfer_fee', { mode: 'number' }).default(0).notNull(),
  currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
  note: text('note'),
  transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull(),
  clientId: uuid('client_id').notNull().unique(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_tx_active_user_date').on(table.userId, table.transactionDate.desc()).where(sql`deleted_at IS NULL`),
  index('idx_tx_active_account').on(table.userId, table.accountId, table.transactionDate.desc()).where(sql`deleted_at IS NULL`),
  index('idx_tx_active_dest_account').on(table.userId, table.destinationAccountId, table.transactionDate.desc()).where(sql`deleted_at IS NULL AND destination_account_id IS NOT NULL`),
  index('idx_tx_active_category').on(table.userId, table.categoryId, table.transactionDate.desc()).where(sql`deleted_at IS NULL`),
  index('idx_tx_client_id').on(table.userId, table.clientId),
  index('idx_tx_updated_at').on(table.userId, table.updatedAt),
  check('chk_tx_amount', sql`amount > 0`),
  check('chk_tx_fee', sql`transfer_fee >= 0`),
  check('chk_tx_transfer_dest', sql`(type = 'transfer' AND destination_account_id IS NOT NULL AND destination_account_id != account_id) OR (type != 'transfer' AND destination_account_id IS NULL)`),
]);

// 5. Idempotency Keys Table
export const idempotencyKeys = pgTable('idempotency_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  key: varchar('key', { length: 128 }).notNull().unique(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  responseJson: jsonb('response_json').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => [
  index('idx_idempotency_lookup').on(table.userId, table.key),
  index('idx_idempotency_expiry').on(table.expiresAt)
]);

// Type Inference Exports
export type Profile = typeof profiles.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
```

---

# 20. Database Security

Karena menggunakan Supabase, desain harus memperhatikan Row Level Security jika client memiliki akses langsung ke database/Supabase.

Recommended MVP architecture:

```text
Mobile
  ↓
Elysia API
  ↓
Drizzle
  ↓
Postgres
```

Mobile tidak melakukan direct database mutation.

Jika suatu saat mobile menggunakan Supabase client secara langsung:

- RLS wajib aktif;
- policy harus berdasarkan authenticated user;
- service role key tidak boleh masuk aplikasi mobile;
- privileged operations tetap dilakukan server-side.

---

# 21. Authentication & Authorization

## Authentication

Supabase Auth digunakan sebagai identity provider.

## Authorization

Setiap resource harus diverifikasi berdasarkan authenticated user.

Contoh:

```sql
WHERE transactions.user_id = authenticatedUserId
```

Jangan pernah mempercayai:

```json
{
  "userId": "..."
}
```

dari request body sebagai sumber identity.

Identity harus berasal dari verified access token.

---

# 22. Secrets & Environment Variables

## Server

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
APP_ENV
PORT
LOG_LEVEL
```

## Mobile

Hanya public/client-safe configuration:

```text
EXPO_PUBLIC_API_URL
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### Never ship to mobile

```text
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
private signing secrets
server API secrets
```

---

# 23. iOS App Architecture

Recommended:

```text
app/
├── (auth)/
│   ├── login.tsx
│   └── register.tsx
│
├── (tabs)/
│   ├── index.tsx
│   ├── transactions.tsx
│   └── reports.tsx
│
├── transaction/
│   ├── new.tsx
│   └── [id].tsx
│
└── settings.tsx

src/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── transactions/
│   ├── categories/
│   ├── accounts/
│   └── reports/
│
├── db/
├── sync/
├── api/
├── components/
├── hooks/
├── lib/
└── types/
```

Expo Router dapat digunakan untuk navigation.

---

# 24. State Management

State dibagi menjadi tiga:

## Server State

Contoh:

- transaction list;
- reports;
- profile;
- categories.

Gunakan server-state/query abstraction yang mendukung cache dan invalidation.

## Local UI State

Contoh:

- modal open;
- selected category;
- form state;
- filter state.

## Persistent Local State

Contoh:

- cached transactions;
- outbox;
- selected account;
- sync metadata.

Jangan menjadikan satu global store sebagai tempat semua jenis state.

## 24.1 Reactive Loop: TanStack Query + SQLite Lokal

Untuk menghasilkan pengalaman pengguna yang instan tanpa jeda loading jaringan (0ms UI latency), TanStack Query **TIDAK** memanggil HTTP API secara langsung untuk read query normal. TanStack Query membaca dari **SQLite lokal** sebagai sumber data primer:

```text
┌────────────────────────────────────────────────────────┐
│                      React UI                          │
│          useTransactions(), useAccounts()              │
└───────────────────────────▲────────────────────────────┘
                            │
               Instant Read │ Query Invalidation
                            ▼
┌────────────────────────────────────────────────────────┐
│                   TanStack Query                       │
│     queryKey: ['transactions', { month: '2026-10' }]   │
└───────────────────────────▲────────────────────────────┘
                            │
              queryFn calls │ withTransactionSync
                            ▼
┌────────────────────────────────────────────────────────┐
│               Local SQLite Data Layer                  │
│       local_transactions, local_accounts, outbox       │
└───────────────────────────▲────────────────────────────┘
                            │
               Push Outbox  │ Pull Delta Changes
               (Background) │ (Background Worker)
                            ▼
┌────────────────────────────────────────────────────────┐
│                  ElysiaJS Backend API                  │
│               POST /sync/push, GET /sync/pull          │
└────────────────────────────────────────────────────────┘
```

### Mutasi & Siklus Invalidation

1. Saat user menyimpan transaksi:
   - Mutation Hook (`useCreateTransactionMutation`) menulis record ke `local_transactions` dan menambahkan entri ke `mutation_outbox` di SQLite secara atomik.
   - Panggil `queryClient.invalidateQueries({ queryKey: ['transactions'] })` dan `queryClient.invalidateQueries({ queryKey: ['dashboard'] })`.
   - UI ter-update seketika (respons < 16ms).
2. Background sync worker memicu `syncEngine.processOutbox()` ke endpoint Elysia API `/api/v1/sync/push`.
3. Saat server mengembalikan ACK atau perubahan delta (pull), local database diperbarui dengan data kanonikal, lalu `queryClient.invalidateQueries()` dipanggil kembali secara halus di latar belakang.

---

# 25. UI/UX Requirements

## 25.1 Navigation

Recommended bottom tabs:

1. Home
2. Transactions
3. Reports
4. Settings

Add transaction dapat menggunakan prominent action button.

## 25.2 Add Transaction UX

Priority order:

1. Amount
2. Type
3. Category
4. Account
5. Date
6. Note
7. Save

Amount input harus mendapatkan focus secara default.

## 25.3 Feedback

Setelah save:

- success feedback;
- transaction muncul di list;
- dashboard summary ter-update;
- jika offline, tampilkan status pending sync.

## 25.4 Loading & Transitions

Gunakan skeleton/loading state shimmer yang meniru bentuk konten aktual, bukan blank screen atau spinner statis di tengah layar.

## 25.5 Empty State

Transactions:

> "Belum ada transaksi. Yuk catat transaksi pertamamu."

Reports:

> "Belum cukup data untuk menampilkan laporan."

## 25.6 Fast Amount Input & Custom Numeric Keypad (Target <= 10 Detik)

Untuk mencapai target pencatatan transaksi $\le 10$ detik, input nominal tidak menggunakan keyboard sistem standar yang memunculkan deretan karakter tidak perlu. Digunakan **Custom In-App Numeric Keypad**:

```text
┌─────────┬─────────┬─────────┐
│    1    │    2    │    3    │
├─────────┼─────────┼─────────┤
│    4    │    5    │    6    │
├─────────┼─────────┼─────────┤
│    7    │    8    │    9    │
├─────────┼─────────┼─────────┤
│   000   │    0    │    ⌫    │
└─────────┴─────────┴─────────┘
```

- **Formatting Rupiah Real-time:** Format otomatis saat mengetik (`Rp 0` $\to$ `Rp 50.000` $\to$ `Rp 500.000`).
- **Quick Amount Chips:** Tombol pintas penambah nominal cepat di atas keypad: `+10rb`, `+50rb`, `+100rb`, `+500rb`.
- **Amount-First Screen:** Begitu sheet "Tambah Transaksi" terbuka, kursor sudah aktif pada field Amount dan keypad langsung siap digunakan tanpa memerlukan tap tambahan.

## 25.7 Taptic Engine & Haptic Feedback Specification

Menggunakan modul `expo-haptics` untuk memberikan sensasi fisik yang memuaskan dan responsif:

| Aksi Pengguna | Metode Haptic iOS | Respons Sensori |
|---|---|---|
| Menekan tombol keypad nominal | `impactAsync(ImpactFeedbackStyle.Light)` | Ketukan ringan dan halus pada setiap input angka |
| Memilih kategori / tab (Expense, Income, Transfer) | `selectionAsync()` | Transisi pilihan yang taktil (*mechanical click*) |
| Menekan tombol Simpan Transaksi | `impactAsync(ImpactFeedbackStyle.Medium)` | Konfirmasi fisik bahwa aksi telah tercatat |
| Transaksi berhasil tersinkronisasi | `notificationAsync(NotificationFeedbackType.Success)` | Dobel getaran halus konfirmasi cloud sync |
| Validasi gagal / Error | `notificationAsync(NotificationFeedbackType.Error)` | Getaran peringatan tegas saat input tidak valid |

## 25.8 Native iOS Gestures

- **Swipe-to-Action:** Geser ke kiri pada baris transaksi di list untuk memunculkan tombol hapus cepat (Destructive Red) dan edit.
- **Pull-to-Refresh:** Tarik ke bawah pada Home Dashboard dan Transaksi untuk memicu sinkronisasi manual ke server secara instan.
- **Interactive Dismiss:** Form tambah transaksi menggunakan modal sheet iOS yang dapat di-swipe ke bawah untuk menutup (*drag to dismiss* dengan konfirmasi jika sudah ada perubahan input).

## 25.9 Dark Mode & Semantic Color Tokens (WCAG 2.1 AA)

Aplikasi mendukung perpindahan otomatis Light Mode dan Dark Mode sesuai pengaturan iOS:

| Token Desain | Light Mode | Dark Mode | Fungsi UI |
|---|---|---|---|
| `bg-primary` | `#F2F2F7` (System Grouped) | `#000000` | Latar belakang layar utama |
| `bg-card` | `#FFFFFF` | `#1C1C1E` (Secondary Grouped) | Latar kartu saldo & transaksi |
| `text-primary` | `#000000` | `#FFFFFF` | Teks utama, judul, nominal uang |
| `text-secondary`| `#8E8E93` | `#8E8E93` | Teks keterangan, tanggal, catatan |
| `accent-expense`| `#FF3B30` | `#FF453A` (iOS System Red) | Nominal pengeluaran & tombol hapus |
| `accent-income` | `#34C759` | `#30D158` (iOS System Green) | Nominal pemasukan |
| `accent-transfer`| `#007AFF`| `#0A84FF` (iOS System Blue) | Nominal mutasi transfer |

---

# 26. Accessibility

Minimum:

- Dynamic Type support;
- VoiceOver labels;
- sufficient touch target;
- semantic labels;
- jangan hanya mengandalkan warna untuk membedakan income/expense;
- support reduced motion jika memungkinkan.

---

# 27. Performance Requirements

## Mobile

Target:

- app launch interactive state <= 2.5s pada device modern;
- Add Transaction save feedback <= 300ms untuk local write;
- transaction list scrolling harus smooth;
- local query tidak boleh blocking UI thread.

## Backend

Target awal:

- p95 read API < 500ms;
- p95 mutation API < 700ms;
- report query < 1s untuk dataset personal normal.

Performance target adalah engineering target, bukan SLA publik pada MVP.

---

# 28. Reliability

Server harus:

- menggunakan database transaction untuk mutation yang membutuhkan atomicity;
- idempotent untuk retryable writes;
- memberikan request ID;
- memiliki structured logging;
- memiliki health endpoint.

```http
GET /health
GET /ready
```

`/health` menunjukkan process hidup.

`/ready` menunjukkan dependency penting siap digunakan.

---

# 29. Error Handling

Kategori error:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
RATE_LIMITED
SYNC_CONFLICT
DATABASE_ERROR
INTERNAL_ERROR
```

Mobile harus memiliki mapping:

```text
network error
server error
validation error
auth error
sync error
unknown error
```

User-facing error message harus ramah.

Developer-facing logs harus memiliki detail teknis.

Jangan menampilkan stack trace ke user.

---

# 30. Observability

Minimum:

- request ID;
- structured JSON logs;
- endpoint latency;
- status code;
- error code;
- database error monitoring;
- sync failure count;
- authentication failure count.

Jangan log:

- access token;
- password;
- service role key;
- full financial transaction payload;
- sensitive personal information.

---

# 31. Security Requirements

## Critical

1. TLS/HTTPS only.
2. Supabase Auth token verification.
3. Authorization per user.
4. Server-side validation.
5. Parameterized/typed DB queries melalui Drizzle.
6. No service role key in mobile.
7. Rate limiting pada auth-sensitive endpoints.
8. Secure local secret storage.
9. Soft delete/tombstone untuk sync-sensitive records.
10. Auditability untuk mutation penting.

## Threats

### IDOR
User mencoba:

```http
GET /transactions/transaction-id-milik-user-lain
```

Expected:

```text
404 / 403
```

dan tidak boleh membocorkan apakah resource tersebut milik user lain.

### Duplicate Transaction
Network timeout menyebabkan client retry.

Expected:

- hanya satu transaction tersimpan.

### Stolen Device
Sensitive session material harus disimpan menggunakan secure storage.

## 31.3 Kepatuhan Apple App Store (Guideline 5.1.1(v) — Account Deletion)

Apple mewajibkan aplikasi yang mendukung pembuatan akun untuk menyediakan alur penghapusan akun secara mandiri dan mudah diakses di dalam aplikasi:

1. **Aksesibilitas Menu:** Pengguna dapat mengakses opsi *"Hapus Akun & Semua Data"* di menu `Pengaturan > Akun & Keamanan`.
2. **Double Confirmation Dialog:** Memunculkan modal dialog dengan teks peringatan tegas mengenai kehilangan data secara permanen.
3. **Cascading Hard Purge (Server-Side):**
   - Menghapus record pada `auth.users` Supabase (menonaktifkan login seketika).
   - Relasi database PostgreSQL (`profiles`, `accounts`, `categories`, `transactions`, `sync_events`) terhapus secara *hard delete* via `ON DELETE CASCADE`.
4. **Client Cleanup:**
   - Membersihkan seluruh database lokal Expo SQLite (`local_transactions`, `local_accounts`, `local_categories`, `mutation_outbox`).
   - Menghapus secure tokens di `expo-secure-store`.
   - Me-reset state aplikasi dan mengarahkan kembali ke layar onboarding/login.

## 31.4 Keamanan Biometrik & App Lock (Face ID / Touch ID)

Aplikasi finansial memerlukan proteksi tambahan saat perangkat sedang tidak terkunci:

1. **Biometric Authentication:** Integrasi modul `expo-local-authentication` untuk verifikasi Face ID / Touch ID sebelum membuka aplikasi atau mengakses ringkasan saldo.
2. **Auto-Lock Interval:** Opsi jeda penguncian: *Segera*, *1 menit*, atau *5 menit* setelah app masuk ke background.
3. **App Switcher Privacy Shield (Multitasking Blur):**
   - Saat pengguna berpindah aplikasi (iOS App Switcher / background state), aplikasi otomatis menampilkan overlay blur / splash screen netral.
   - Mencegah nominal saldo atau mutasi sensitif terbaca pada snapshot layar multitasking iOS.

## 31.5 Konfigurasi iOS App Store & Info.plist

- **Target Minimal:** iOS 16.0+
- **Kunci Info.plist Wajib (`app.json` / iOS native):**
  ```json
  {
    "expo": {
      "ios": {
        "supportsTablet": false,
        "bundleIdentifier": "com.uangku.ios",
        "infoPlist": {
          "NSFaceIDUsageDescription": "UangKu memerlukan Face ID untuk mengamankan data keuangan dan catatan transaksimu dari akses yang tidak berizin."
        }
      }
    }
  }
  ```
- **App Store Privacy Nutrition Labels Mapping:**
  * **Data Used to Track You:** Tidak ada (None).
  * **Data Linked to You:**
    - Contact Info (Email Address): Digunakan murni untuk autentikasi akun.
    - Financial Info (Other Financial Info): Digunakan untuk fungsi inti aplikasi (catatan transaksi personal).
    - User Content (Customer Support / Notes): Catatan transaksi opsional.
    - Identifiers (User ID): Pengenal acak unik untuk isolasi data.
  * **Data Not Linked to You:**
    - Crash Data & Performance Metrics (Diagnostics): Agregat anonim melalui Sentry untuk stabilitas build.

## 31.6 Rate Limiting & Network Hardening

Untuk mencegah brute-force dan eksploitasi API ElysiaJS, diterapkan middleware pembatas laju request:

| Tipe Endpoint | Batas Maksimum | Parameter Pembatas | Respons Saat Terlampaui |
|---|---|---|---|
| `POST /api/v1/auth/*` | 5 requests / menit | IP Address | `429 RATE_LIMITED` + `Retry-After` header |
| `POST /api/v1/sync/push` | 30 requests / menit | `user_id` dari JWT | `429 RATE_LIMITED` |
| `GET /api/v1/sync/pull` | 60 requests / menit | `user_id` dari JWT | `429 RATE_LIMITED` |
| Query Umum (`/transactions`, dll.) | 120 requests / menit | `user_id` dari JWT | `429 RATE_LIMITED` |

---

# 32. Privacy & Data Governance

Data keuangan dianggap data sensitif dan private.

### 32.1 Kebijakan & Prinsip:

1. **Minimasi Data (Data Minimization):** Hanya mencatat informasi yang esensial untuk pembukuan pengguna (tidak meminta nomor NIK, KTP, atau kredensial perbankan).
2. **Zero Third-Party Sharing:** Data keuangan pengguna tidak pernah dijual, dipinjamkan, atau dibagikan ke pihak ketiga.
3. **No IDFA Tracking:** Tidak meminta izin pelacakan iklan (*App Tracking Transparency*) karena aplikasi tidak menyematkan ad network.
4. **Sanitisasi Log & Telemetri:**
   - Error tracking (Sentry) dan logging backend dilarang keras mencatat nominal uang, catatan transaksi pribadi, atau token otorisasi.
   - Event analitik hanya mencatat aksi generik tanpa nilai finansial:
     ```json
     {
       "event": "transaction_created",
       "type": "expense",
       "has_note": true,
       "timestamp": "2026-10-04T12:00:00Z"
     }
     ```

### 32.2 Kebijakan Retensi & Pembersihan Tombstone (90-Day Tombstone Purge)

Data transaksi yang dihapus secara lunak (*soft delete*) membawa nilai `deleted_at`:

1. **Retensi 90 Hari untuk Sinkronisasi:** Record tombstone dipertahankan minimal **90 hari** di database server untuk memastikan perangkat sekunder pengguna yang offline berbulan-bulan tetap menerima sinyal penghapusan saat kembali tersambung ke jaringan via `/api/v1/sync/pull`.
2. **Automated Cron Purge:** Cron job database berkala membersihkan baris transaksi yang memiliki `deleted_at < NOW() - INTERVAL '90 days'` secara permanen (*hard delete*) untuk menjaga efisiensi penyimpanan database.

---

# 33. Testing Strategy

## Unit Test

Backend:

- transaction service;
- balance calculation;
- category rules;
- authorization;
- sync conflict;
- idempotency.

Mobile:

- form validation;
- local transaction reducer/service;
- sync state transitions.

## Integration Test

Test:

```text
API → Service → Repository → Test Database
```

## E2E

Minimal:

1. Register/login.
2. Create expense.
3. Create income.
4. View transaction.
5. Edit transaction.
6. Delete transaction.
7. View monthly report.
8. Offline create → reconnect → sync.
9. Retry same mutation → no duplicate.

---

# 34. Definition of Done

Feature dianggap selesai jika:

- requirement terpenuhi;
- TypeScript type-check pass;
- unit tests pass;
- integration tests pass jika applicable;
- error state tersedia;
- loading state tersedia;
- empty state tersedia jika applicable;
- authorization telah diuji;
- migration tersedia;
- API contract terdokumentasi;
- logging tidak membocorkan data sensitif;
- code review selesai;
- iOS build berhasil.

---

# 35. MVP Scope

## Must Have

- authentication;
- profile;
- one or more accounts at data-model level;
- default/custom categories;
- income transaction;
- expense transaction;
- edit/delete;
- transaction history;
- dashboard;
- monthly summary;
- expense by category;
- offline local transaction creation;
- sync/outbox;
- idempotency;
- basic security;
- error handling.

## Should Have

- search;
- custom date range;
- category management;
- account management UI;
- export CSV.

## Could Have

- recurring transaction;
- budget;
- biometric lock;
- receipt attachment;
- Sign in with Apple.

## Won't Have in MVP

- bank integration;
- investment tracking;
- payment;
- AI advisor;
- shared household wallet;
- web application.

---

# 36. Product Metrics

Primary metrics:

### Activation

Percentage of new users who create their first transaction.

### Transaction Completion

Percentage of started transaction forms successfully saved.

### Retention

- D1
- D7
- D30

### Engagement

- transactions per active user;
- active days per month;
- reports viewed per active user.

### Reliability

- sync success rate;
- duplicate transaction rate;
- API error rate;
- crash-free sessions.

### Performance

- API p50/p95 latency;
- transaction local-save latency;
- cold-start time.

---

# 37. Analytics Events

Recommended event schema:

```json
{
  "event": "transaction_created",
  "userId": "hashed-or-internal-id",
  "timestamp": "..."
}
```

Events:

```text
app_opened
sign_up_completed
login_completed
transaction_form_opened
transaction_created
transaction_updated
transaction_deleted
report_viewed
sync_started
sync_completed
sync_failed
```

Do not send raw transaction amount or financial note to analytics provider.

---

# 38. API Versioning Strategy

Initial:

```text
/api/v1/*
```

Breaking changes require:

```text
/api/v2/*
```

Non-breaking changes may be introduced within v1.

Examples of breaking changes:

- remove field;
- change field type;
- change required behavior;
- change semantics of existing endpoint.

---

# 39. Deployment Architecture

## Production

```text
iOS
 |
 | HTTPS
 v
API / Load Balancer
 |
 v
Bun + ElysiaJS
 |
 v
Supabase Postgres
```

Recommended operational properties:

- stateless API instances;
- horizontal scaling;
- connection pooling;
- environment separation;
- automated database migrations;
- automated CI/CD.

## Environments

```text
local
development
staging
production
```

Each environment should have isolated database/configuration.

---

# 40. CI/CD

Pipeline:

```text
Pull Request
   ↓
Lint
   ↓
Typecheck
   ↓
Unit Test
   ↓
Integration Test
   ↓
Build
   ↓
Review
   ↓
Staging
   ↓
Smoke Test
   ↓
Production
```

Database migration must be reviewed and executed through controlled deployment.

---

# 41. Migration Strategy

Drizzle migrations are the source-controlled database schema changes.

Example:

```text
drizzle/
├── 0001_create_profiles.sql
├── 0002_create_accounts.sql
├── 0003_create_categories.sql
├── 0004_create_transactions.sql
└── 0005_create_idempotency_keys.sql
```

Rules:

- migration must be forward-compatible;
- avoid destructive migration in the same release as application code that still requires the old schema;
- production migration must be tested on staging;
- backup/recovery process must exist before risky migrations.

---

# 42. Important Architectural Decision: Supabase + Drizzle

The recommended relationship is:

```text
Supabase = managed infrastructure + Postgres + Auth
Drizzle = application database access layer / ORM
ElysiaJS = business/API layer
```

Do not treat Drizzle as a replacement for Supabase.

Recommended:

```text
React Native
    ↓
ElysiaJS
    ↓
Drizzle
    ↓
Supabase Postgres
```

Supabase Auth remains responsible for identity.

---

# 43. Transaction Consistency Rules

Creating a transaction may require:

1. validate authenticated user;
2. validate account ownership;
3. validate category ownership;
4. validate amount;
5. insert transaction;
6. create/record idempotency result;
7. commit.

These operations should be atomic where necessary.

If any required step fails, the mutation should not leave partially-created state.

---

# 44. Balance Calculation Strategy

Untuk MVP, saldo tidak disimpan sebagai mutable counter melainkan dihitung secara deterministik melalui database aggregation untuk mencegah *balance drift*:

### Formula Saldo per Akun

```sql
SELECT
  a.id,
  a.name,
  (
    a.initial_balance
    + COALESCE(SUM(CASE WHEN t.account_id = a.id AND t.type = 'income' THEN t.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.account_id = a.id AND t.type = 'expense' THEN t.amount ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN t.destination_account_id = a.id AND t.type = 'transfer' THEN t.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.account_id = a.id AND t.type = 'transfer' THEN (t.amount + t.transfer_fee) ELSE 0 END), 0)
  ) AS current_balance
FROM accounts a
LEFT JOIN transactions t ON (t.account_id = a.id OR t.destination_account_id = a.id) AND t.deleted_at IS NULL
WHERE a.user_id = $1 AND a.id = $2 AND a.is_archived = FALSE
GROUP BY a.id;
```

### Formula Total Kekayaan Bersih (Total Net Worth)

Total saldo seluruh dompet aktif:

```sql
SELECT
  SUM(a.initial_balance)
  + COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN t.type = 'transfer' THEN t.transfer_fee ELSE 0 END), 0)
  AS total_net_worth
FROM accounts a
LEFT JOIN transactions t ON (t.account_id = a.id) AND t.deleted_at IS NULL
WHERE a.user_id = $1 AND a.is_archived = FALSE;
```

---

# 45. Report Calculation

Seluruh agregasi laporan dieksekusi di database server:

### Monthly Cash Flow Query

```sql
SELECT
  COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
  COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
  COALESCE(SUM(CASE WHEN type = 'transfer' THEN transfer_fee ELSE 0 END), 0) AS total_transfer_fees,
  (
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN type = 'transfer' THEN transfer_fee ELSE 0 END), 0)
  ) AS net_cash_flow
FROM transactions
WHERE user_id = $1
  AND transaction_date >= $2
  AND transaction_date < $3
  AND deleted_at IS NULL;
```

### Monthly Expense by Category Query

```sql
SELECT
  c.id AS category_id,
  c.name AS category_name,
  c.icon AS category_icon,
  COALESCE(SUM(t.amount), 0) AS total_amount,
  ROUND(
    (COALESCE(SUM(t.amount), 0)::NUMERIC / NULLIF(
      (SELECT SUM(amount) FROM transactions WHERE user_id = $1 AND type = 'expense' AND transaction_date >= $2 AND transaction_date < $3 AND deleted_at IS NULL), 0
    )) * 100, 2
  ) AS percentage
FROM categories c
JOIN transactions t ON t.category_id = c.id
WHERE t.user_id = $1
  AND t.type = 'expense'
  AND t.transaction_date >= $2
  AND t.transaction_date < $3
  AND t.deleted_at IS NULL
GROUP BY c.id, c.name, c.icon
ORDER BY total_amount DESC;
```

---

# 46. Sync API Concept

## Push

```http
POST /api/v1/sync/push
```

Request:

```json
{
  "mutations": [
    {
      "id": "uuid",
      "entity": "transaction",
      "operation": "create",
      "entityId": "uuid",
      "version": 1,
      "payload": {}
    }
  ]
}
```

Response:

```json
{
  "data": {
    "accepted": [],
    "rejected": [],
    "conflicts": []
  }
}
```

## Pull

```http
GET /api/v1/sync/pull?cursor=<cursor>
```

Response:

```json
{
  "data": {
    "changes": [],
    "nextCursor": "opaque"
  }
}
```

Cursor must be opaque to the client.

---

# 47. Sync State Machine

```text
LOCAL_ONLY
    ↓
PENDING_SYNC
    ↓
SYNCING
   / \
  /   \
ACK   FAILED
 |      |
SYNCED  RETRY
          |
       SYNCING
```

Conflict:

```text
SYNCING
   ↓
CONFLICT
   ↓
RESOLVE
   ↓
SYNCED
```

---

# 48. Edge Cases & Resiliency

Sistem dan aplikasi secara eksplisit menangani skenario batas (edge cases) berikut:

1. **User Taps Save Multiple Times:** Tombol simpan dinonaktifkan seketika setelah tap pertama. Kunci idempoten (`client_id`) memastikan hanya 1 mutasi yang tercatat di SQLite lokal dan server database.
2. **Timezone Boundary Rollover (WIB/WITA/WIT vs UTC):** Transaksi yang dicatat pukul 23:55 WIB (UTC+7) disimpan dengan timezone offset lengkap (`TIMESTAMPTZ`). Agregasi laporan bulanan dan filter tanggal dikonversi berdasarkan zona waktu profil pengguna (`profiles.timezone`), bukan UTC murni, sehingga tidak meloncat ke hari atau bulan berikutnya.
3. **Device Clock Drift / Jam iOS Salah:** Jika jam di perangkat pengguna mundur atau melompat maju (> 5 menit), transaksi tetap dicatat dengan timestamp lokal untuk integritas kronologis perangkat pengguna, namun server database mencatat `created_at` kanonikal server untuk pengurutan sync audit.
4. **Network Drop Mid-Push:** Jika koneksi terputus saat payload HTTP sedang transit, client akan mengulang push saat internet kembali. Server mengenali `Idempotency-Key` dan mengembalikan respons transaksi yang sudah tersimpan tanpa menciptakan rekaman ganda.
5. **App Killed During Sync:** Mutasi di SQLite lokal yang masih berstatus `'syncing'` otomatis di-reset menjadi `'pending'` saat aplikasi dibuka kembali pada lifecycle berikutnya.
6. **Token Expired During Mutation:** Interceptor HTTP mendeteksi kode `401 UNAUTHORIZED`, melakukan silent token refresh via Supabase SDK di latar belakang, dan mengulang mutasi yang tertunda tanpa gangguan bagi pengguna.
7. **Logout dengan Transaksi Belum Tersinkron:** Aplikasi memeriksa antrean outbox. Jika `pending_sync > 0`, sistem menampilkan modal konfirmasi destruktif: *"Terdapat X transaksi yang belum tersimpan ke server. Jika kamu keluar sekarang, data lokal tersebut akan hilang. Yakin ingin keluar?"*
8. **Transfer Antar Akun yang Sama:** Validasi form dan skema backend secara ketat menolak transaksi transfer jika `account_id === destination_account_id` dengan error code `SAME_ACCOUNT_TRANSFER`.
9. **Kategori atau Akun Telah Diarsipkan:** Transaksi offline lama yang menggunakan kategori/akun yang baru saja diarsipkan tetap diterima oleh server demi integritas historis, tetapi di UI mobile ditandai dengan label `(Diarsipkan)`.
10. **Nominal Angka Sangat Besar (Overflow Protection):** Sistem membatasi nominal transaksi maksimal Rp 999.999.999.999 (dibawah batas signed 64-bit integer PostgreSQL BIGINT `9.22 × 10^18`), dan UI input menolak pengetikan digit ke-13.
11. **Apple App Store Review Account Purge:** Proses hapus akun mengeksekusi cascading hard purge dalam satu transaksi atomik di backend PostgreSQL dan membersihkan database SQLite serta Keychain di iPhone secara tuntas.

---

# 49. UX Copy Principles

Use concise Bahasa Indonesia.

Bad:

> "Terjadi sebuah kesalahan yang tidak diketahui yang mengakibatkan proses penyimpanan data transaksi tidak dapat dilanjutkan."

Better:

> "Transaksi belum tersimpan. Coba lagi."

Network error:

> "Kamu sedang offline. Transaksi disimpan dan akan disinkronkan saat internet kembali."

Sync error:

> "Beberapa transaksi belum tersinkronisasi."

---

# 50. Roadmap

## Phase 1 — Foundation

- repository setup;
- Expo app;
- Bun/Elysia API;
- Supabase project;
- Drizzle;
- authentication;
- CI;
- environments.

## Phase 2 — Core Transaction

- account;
- category;
- income/expense;
- transaction CRUD;
- local database;
- basic dashboard.

## Phase 3 — Sync

- outbox;
- push;
- pull;
- idempotency;
- conflict handling;
- offline UX.

## Phase 4 — Reports

- monthly summary;
- category breakdown;
- cash flow;
- date filters.

## Phase 5 — Hardening

- security review;
- performance testing;
- crash monitoring;
- accessibility;
- TestFlight;
- App Store preparation.

---

# 51. Future Roadmap

Potential post-MVP features:

### V1.1

- CSV export;
- recurring transactions;
- better search;
- custom category icons.

### V1.2

- budget;
- spending limits;
- monthly goals.

### V1.3

- receipt photo;
- OCR;
- biometric app lock;
- Sign in with Apple.

### V2

- bank integration;
- shared household;
- financial goals;
- advanced analytics.

AI features should only be introduced after sufficient user value, privacy model, and data governance have been established.

---

# 52. Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Duplicate transaction | High | Idempotency key + client_id |
| Data leakage | Critical | Auth + authorization + RLS/DB boundaries |
| Offline conflict | High | Versioning + deterministic conflict strategy |
| Floating point money bug | Critical | Integer minor-unit representation |
| API becomes bottleneck | Medium | Stateless API + indexes + pooling |
| Complex sync | High | Outbox + incremental pull |
| Lost local data | High | SQLite transaction + persistent outbox |
| Schema migration failure | High | Staging + backup + reversible strategy |
| Excessive feature scope | Medium | Strict MVP boundary |
| Poor UX due to too many fields | Medium | Amount-first transaction flow |

---

# 53. Acceptance Criteria — MVP

## Authentication

- [ ] User can register.
- [ ] User can login.
- [ ] User can logout.
- [ ] Session persists across app restart.
- [ ] Unauthorized API request is rejected.
- [ ] User can delete account completely from Settings (Apple App Store Guideline 5.1.1(v) compliance).

## Transaction & Multi-Account

- [ ] User can create income.
- [ ] User can create expense.
- [ ] User can create transfer between accounts.
- [ ] Transfer deducts source account and adds to destination account without corrupting net cash flow.
- [ ] Transfer fee is properly tracked and accounted for.
- [ ] User cannot transfer to the same account.
- [ ] User can edit transaction.
- [ ] User can delete transaction (soft-delete).
- [ ] Duplicate submit does not create duplicate transaction.
- [ ] Amount is stored exactly in integer minor units (no floating-point drift).

## Dashboard & Reports

- [ ] Current balance (per-account & total net worth) is correct.
- [ ] Income summary is correct.
- [ ] Expense summary is correct.
- [ ] Net cash flow is correct (excludes internal transfer principals).
- [ ] Monthly expense can be viewed with category breakdown.
- [ ] Category percentage aggregation is correct.
- [ ] Empty states and loading shimmer work properly.

## iOS Experience & Performance

- [ ] Custom in-app numeric keypad opens instantly when adding transaction.
- [ ] Real-time Rupiah auto-formatting works smoothly (`Rp 50.000`).
- [ ] Haptic feedback fires on keypress, segment change, save, and error.
- [ ] Swipe-to-delete gesture functions on transaction list.
- [ ] Dark Mode and Light Mode render seamlessly with compliant contrast.
- [ ] Multitasking privacy blur shield activates when app enters background.
- [ ] Face ID / Touch ID app lock works reliably.

## Offline & Sync

- [ ] User can create transaction without network connection.
- [ ] Transaction is persisted locally to Expo SQLite.
- [ ] Mutation enters `mutation_outbox`.
- [ ] Mutation syncs automatically after internet reconnects.
- [ ] Duplicate sync does not duplicate data (idempotency key verification).
- [ ] Sync conflicts are resolved deterministically (LWW / Tombstone wins).

## Security & Reliability

- [ ] User A cannot access User B's transactions or accounts (strict tenant boundary).
- [ ] Supabase Service role secret is never shipped to mobile client.
- [ ] Sensitive financial values and tokens are never logged to console/monitoring.
- [ ] API validates all mutation input with TypeBox schema.

## Quality

- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Production build succeeds.
- [ ] Staging smoke test passes.

---

# 54. Recommended Initial Repository

Monorepo:

```text
finance-app/
├── apps/
│   ├── mobile/
│   │   ├── app/
│   │   ├── src/
│   │   ├── app.json
│   │   └── package.json
│   │
│   └── api/
│       ├── src/
│       ├── drizzle/
│       └── package.json
│
├── packages/
│   ├── contracts/
│   ├── config/
│   └── utils/
│
├── package.json
├── bun.lock
├── turbo.json
└── README.md
```

A monorepo is optional, but recommended if API contracts/types are intentionally shared between mobile and server.

---

# 55. Recommended Technology Choices

| Area | Recommendation |
|---|---|
| Mobile | React Native + Expo |
| Language | TypeScript |
| Navigation | Expo Router |
| Server runtime | Bun |
| API framework | ElysiaJS |
| Database | Supabase PostgreSQL |
| ORM | Drizzle |
| Auth | Supabase Auth |
| Local DB | Expo SQLite |
| Secure storage | Expo SecureStore |
| Validation | Elysia-compatible schema / TypeBox or Zod |
| API state | TanStack Query or equivalent |
| Testing | Vitest + React Native testing tools + E2E framework |
| CI/CD | GitHub Actions |
| Distribution | TestFlight / App Store |
| Error monitoring | Sentry or equivalent |
| Logging | Structured JSON logs |

---

# 56. Architecture Decision Records

## ADR-001 — API Layer

**Decision:** Mobile communicates with business backend through ElysiaJS.

**Reason:**

- centralized authorization;
- business rules;
- consistent API contract;
- easier observability;
- easier future clients;
- prevents business logic from being coupled to mobile.

## ADR-002 — Database Access

**Decision:** Drizzle accesses Supabase PostgreSQL from the server.

**Reason:**

- typed queries;
- migration control;
- SQL-friendly;
- good fit for TypeScript/Bun.

## ADR-003 — Money Representation

**Decision:** integer minor units.

**Reason:**

- deterministic arithmetic;
- no floating point errors;
- easier database aggregation.

## ADR-004 — Offline Writes

**Decision:** local SQLite + outbox.

**Reason:**

- robust offline behavior;
- retry capability;
- persistence through app restart;
- clear synchronization model.

## ADR-005 — Delete Strategy

**Decision:** soft delete for sync-sensitive entities.

**Reason:**

- deletion must propagate across devices;
- avoids resurrection during pull sync;
- enables safer recovery.

## ADR-006 — Local-First Reactivity via TanStack Query over SQLite

**Decision:** TanStack Query `queryFn` membaca langsung dari SQLite lokal untuk seluruh operasi read UI, bukan memanggil HTTP API secara blocking.

**Reason:**

- menjamin waktu render UI seketika ($\le 16\text{ ms}$ / 60 FPS) tanpa terhambat latensi jaringan atau status offline;
- pemisahan bersih antara *UI data presentation* dengan *background sync engine worker*;
- simplifikasi state management: SQLite adalah single source of truth di perangkat klien.

## ADR-007 — App Store Review Guidelines 5.1.1 Compliance (Account Deletion)

**Decision:** Menyediakan alur penghapusan akun mandiri di menu Pengaturan dengan cascading hard purge.

**Reason:**

- syarat wajib Apple App Store Review Guideline 5.1.1(v) untuk setiap aplikasi dengan fitur registrasi;
- perlindungan privasi pengguna secara absolut (GDPR/UU PDP compliance);
- mencegah kebocoran data pengguna non-aktif.

## ADR-008 — UTF-8 BOM Encoding for CSV Export

**Decision:** File CSV yang diekspor disisipkan UTF-8 Byte Order Mark (`\uFEFF`) di awal file.

**Reason:**

- memastikan Microsoft Excel pada sistem operasi Windows dan macOS dapat membuka file CSV tanpa karakter rusak (*mojibake*);
- format nominal dan penulisan teks deskripsi transaksi tetap rapi secara otomatis.

---

# 57. Final Product Definition

The MVP is successful when a user can:

```text
Open app
   ↓
Login
   ↓
See balance
   ↓
Tap +
   ↓
Enter amount
   ↓
Select category
   ↓
Save
   ↓
Immediately see updated balance
   ↓
Review transaction history
   ↓
View monthly spending
   ↓
Go offline
   ↓
Create another transaction
   ↓
Reconnect
   ↓
Transaction automatically syncs
```

The architecture must preserve the following invariant:

> **A transaction should be created once, owned by exactly one user, represented with exact monetary precision, remain recoverable through synchronization, and never become visible to another user.**

This invariant is more important than adding a large number of secondary features in the MVP.
