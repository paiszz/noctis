# Panduan Penerapan Migrasi Database Supabase — Noctis

Dokumen ini merupakan panduan resmi untuk mengonfigurasi arsitektur database Supabase (PostgreSQL) bagi aplikasi **Noctis — Your Personal Productivity Space**.

---

## Ringkasan Arsitektur Database

Arsitektur database Noctis dirancang dengan standar keamanan dan integritas data tinggi:
- **6 Tabel Inti**: `profiles`, `user_preferences`, `schedules`, `tasks`, `notes`, dan `agenda_events`.
- **Integritas Relasi Multi-Tenant**: Composite foreign key `tasks(user_id, course_schedule_id)` merujuk ke `schedules(user_id, id)` dengan aturan `ON DELETE SET NULL (course_schedule_id)`. Pengguna tidak dapat mengaitkan tugas ke jadwal milik akun lain.
- **Trigger Registrasi Akun Otomatis**: Fungsi trigger `handle_new_user()` yang berjalan pada event `AFTER INSERT` di `auth.users` dengan keamanan `SECURITY DEFINER` dan `SET search_path = ''` untuk mencegah *search path hijacking*. Trigger ini memastikan baris `profiles` dan `user_preferences` selalu dibuat tanpa menyembunyikan (*swallow*) error sistem.
- **Row Level Security (RLS) Granular**: Seluruh tabel mengaktifkan RLS dengan kebijakan eksplisit untuk `SELECT`, `INSERT`, `UPDATE`, dan `DELETE` yang membatasi hak akses strictly pada `auth.uid()`.
- **Indeks Performa Terindeks**: Indeks filter dan pengurutan berbasis `user_id`, tanggal, dan status untuk memastikan latensi query minimal.
- **Atomic Import RPC**: Fungsi PostgreSQL `public.import_user_data_atomic(payload jsonb)` untuk mendukung operasi penggantian data cadangan secara atomik, aman, dan transaksional.

---

## Keterbatasan & Status Penerapan Saat Ini

> [!IMPORTANT]
> **File migrasi di repositori TIDAK diterapkan secara otomatis ke database remote.**
> Menyimpan file SQL di dalam folder `supabase/migrations/` tidak berarti database Supabase Anda telah terbarui secara otomatis. Anda wajib memeriksa database target dan menerapkan file migrasi secara manual atau menggunakan Supabase CLI.
>
> **Status Migrasi Ke-3:**
> Berkas migrasi `20261025000000_validate_import_schedule_date_range.sql` telah disiapkan dan diverifikasi di repositori, tetapi **belum dikonfirmasi telah dijalankan pada database Supabase remote**. Operator database wajib menerapkannya sebelum fitur impor jadwal berbatas tanggal digunakan di lingkungan production.

---

## Katalog & Urutan Berkas Migrasi

Migrasi database Noctis tersusun secara kronologis berdasarkan stempel waktu (*timestamp*) pada nama berkas. Urutan ini wajib dipatuhi:

| Urutan | Nama Berkas Migrasi | Deskripsi & Tujuan SQL |
| :---: | :--- | :--- |
| **1** | [`20261022000000_create_noctis_schema.sql`](./migrations/20261022000000_create_noctis_schema.sql) | **Skema Dasar, Tabel, RLS, & Trigger**<br>Membuat 6 tabel inti, fungsi penanganan timestamp `update_updated_at_column()`, trigger pendaftaran akun `handle_new_user()`, foreign key komposit, indeks performa, serta mengaktifkan RLS dengan kebijakan 4 aksi (SELECT, INSERT, UPDATE, DELETE) per tabel. |
| **2** | [`20261023000000_import_user_data_atomic.sql`](./migrations/20261023000000_import_user_data_atomic.sql) | **Fungsi RPC Import Atomik Awal**<br>Membuat fungsi RPC `public.import_user_data_atomic(payload jsonb)` dengan `SECURITY DEFINER`. Menyediakan pre-validasi payload, penggantian data atomik (replace), pemetaan UUID jadwal lama ke baru pada tugas, dan perlindungan relasi foreign key. |
| **3** | [`20261025000000_validate_import_schedule_date_range.sql`](./migrations/20261025000000_validate_import_schedule_date_range.sql) | **Pembaruan Validasi Rentang Tanggal Jadwal pada RPC Import**<br>Memperbarui fungsi `public.import_user_data_atomic(payload jsonb)` menggunakan `CREATE OR REPLACE FUNCTION`. Menambahkan pre-validasi relasi tanggal (`start_date <= end_date`) dan validasi kecocokan hari (`day_of_week`) sebelum operasi DELETE/INSERT dijalankan. |

---

## Risiko Urutan & Penanganan Riwayat Migrasi

1. **Risiko Urutan Salah (Dependency Failure)**:
   - Jika Migrasi 2 atau Migrasi 3 dijalankan **sebelum** Migrasi 1, eksekusi SQL akan langsung gagal (*fatal error*) karena fungsi RPC merujuk ke tabel-tabel (`schedules`, `tasks`, `notes`, `agenda_events`, `profiles`, `user_preferences`) yang belum dibuat.
   - Jika Migrasi 2 dijalankan **setelah** Migrasi 3, fungsi RPC akan mengalami *downgrade* ke implementasi lama, sehingga validasi rentang tanggal jadwal dan kecocokan hari kuliah akan hilang.
2. **Peringatan Penerapan Ulang Skrip**:
   - Menjalankan ulang skrip SQL secara manual tidak sama dengan mengelola riwayat migrasi secara benar.
   - Meskipun Migrasi 1 menggunakan `IF NOT EXISTS` dan Migrasi 2 & 3 menggunakan `CREATE OR REPLACE FUNCTION`, mengeksekusi ulang file secara acak dapat merusak riwayat pelacakan migrasi pada alat seperti Supabase CLI.
   - **Peringatan keras**: Jangan pernah menjalankan kembali Migrasi 2 setelah Migrasi 3 diterapkan pada database yang sama.

### Skenario Penerapan:

- **Skenario A: Setup Database Baru dari Nol (Direkomendasikan)**
  Terapkan seluruh migrasi secara berurutan sesuai timestamp:
  1. `20261022000000_create_noctis_schema.sql` (Skema dasar, 6 tabel inti, trigger registrasi, dan kebijakan RLS)
  2. `20261023000000_import_user_data_atomic.sql` (Fungsi RPC import data atomik awal)
  3. `20261025000000_validate_import_schedule_date_range.sql` (Pembaruan fungsi RPC dengan validasi rentang tanggal jadwal)
  *(Urutan kronologis 1 → 2 → 3 memastikan riwayat migrasi tercatat lengkap dan fungsi RPC aktif berada pada implementasi terbaru).*

- **Skenario B: Memperbarui Database yang Sudah Ada (Sudah Memiliki Migrasi 1 & 2)**
  Cukup terapkan migrasi pembaruan:
  1. `20261025000000_validate_import_schedule_date_range.sql`
  *(Migrasi ketiga akan langsung memperbarui definisi fungsi RPC `public.import_user_data_atomic` yang dibuat pada migrasi kedua tanpa mengubah tabel atau data yang sudah ada).*

---

## Panduan Penerapan Migrasi

### Metode 1: Melalui Supabase Dashboard SQL Editor (Direkomendasikan)

Metode ini paling mudah dan aman dilakukan tanpa memerlukan instalasi CLI lokal:

1. Buka dashboard proyek Supabase Anda di [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Pilih proyek Noctis Anda.
3. Di panel navigasi sebelah kiri, klik menu **SQL Editor**.
4. Klik tombol **+ New Query**.
5. Buka berkas migrasi yang akan diterapkan, salin (*copy*) seluruh isinya, lalu tempel (*paste*) ke dalam SQL Editor.
6. Klik tombol **Run** (atau tekan `Ctrl + Enter` / `Cmd + Enter`).
7. Pastikan query berhasil dieksekusi dengan pesan status: `Success. No rows returned`.
8. Ulangi untuk file migrasi berikutnya sesuai urutan yang ditentukan.

#### Verifikasi Hasil di Dashboard:
- Buka menu **Table Editor**: Pastikan ke-6 tabel muncul (`profiles`, `user_preferences`, `schedules`, `tasks`, `notes`, `agenda_events`).
- Buka menu **Authentication → Policies**: Pastikan setiap tabel berstatus `RLS enabled` dengan 4 kebijakan terdaftar (`select`, `insert`, `update`, `delete`).
- Buka menu **Database → Functions**: Pastikan fungsi `import_user_data_atomic` terdaftar dengan return type `jsonb` dan security setting `SECURITY DEFINER`.

---

### Metode 2: Melalui Supabase CLI

Jika Supabase CLI terpasang di sistem pengembang:

```bash
# 1. Login ke akun Supabase
supabase login

# 2. Hubungkan ke remote project
# Ganti <your-project-ref> dengan Reference ID proyek Anda (dapat dilihat di Project Settings -> General)
supabase link --project-ref <your-project-ref>

# 3. Terapkan migrasi ke database remote
supabase db push
```

---

## Prasyarat Konfigurasi Autentikasi & Environment

Agar frontend Noctis dapat berkomunikasi dengan database Supabase secara aman, konfigurasikan hal berikut:

### 1. Authentication URL Configuration di Supabase
Buka menu **Authentication → URL Configuration** di Supabase Dashboard:
- **Site URL**:
  - Development: `http://localhost:3000`
  - Production: `https://your-production-domain.com`
- **Redirect URLs**:
  Wajib menambahkan URL callback aplikasi untuk menangani pertukaran sesi login:
  - `http://localhost:3000/auth/callback` (untuk pengujian lokal)
  - `https://your-production-domain.com/auth/callback` (untuk deployment production)

### 2. Environment Variables Frontend
Salin `.env.example` menjadi `.env.local` pada root project, lalu isi nilai publik berikut:

```env
# URL endpoint proyek Supabase Anda
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co

# Kunci API publik (Publishable / Anon key)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

> [!CAUTION]
> **Peringatan Keamanan Kredensial:**
> - Hanya variabel berawalan `NEXT_PUBLIC_` yang boleh digunakan pada frontend.
> - **Jangan pernah memasukkan `SUPABASE_SERVICE_ROLE_KEY` ke dalam frontend atau repositori publik.** Kunci service role memiliki hak akses penuh yang membypass seluruh kebijakan Row Level Security (RLS).
> - Variabel Web Push (`VAPID_*`) dan scheduler secret di `.env.example` merupakan variabel cadangan backend masa depan dan tidak diperlukan untuk menjalankan aplikasi saat ini.

---

## Verifikasi Pasca-Penerapan

Setelah menerapkan migrasi dan menghubungkan aplikasi, lakukan checklist verifikasi berikut:

1. **Uji Trigger Pendaftaran Akun**:
   Buka halaman `/register` pada aplikasi Noctis dan daftarkan akun uji coba. Periksa tabel `profiles` dan `user_preferences` di Supabase Table Editor untuk memastikan baris data profil otomatis terbuat dengan ID yang sesuai dengan akun pengguna baru.
2. **Uji Isolasi Data (RLS)**:
   Buat catatan atau tugas pada akun pertama, lalu login menggunakan akun kedua. Pastikan data dari akun pertama sama sekali tidak terlihat oleh akun kedua.
3. **Uji Validasi Impor Data**:
   Buka menu **Settings → Import Data** dan coba lakukan ekspor serta impor cadangan JSON. Jika berkas migrasi ke-3 sudah diterapkan, payload dengan rentang tanggal jadwal yang tidak valid akan ditolak sebelum data lama diubah.
