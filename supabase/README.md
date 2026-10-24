# Panduan Penerapan Migrasi Database Supabase (Stage 4.2 — Hardened)

File migrasi utama: `supabase/migrations/20261022000000_create_noctis_schema.sql`

Migrasi ini mengonfigurasi arsitektur database Supabase untuk **Noctis — Your Personal Productivity Space** dengan standar keamanan tinggi:
- **6 Tabel Inti**: `profiles`, `user_preferences`, `schedules`, `tasks`, `notes`, dan `agenda_events`.
- **Integritas Relasi Multi-Tenant**: Composite foreign key `tasks(user_id, course_schedule_id)` ke `schedules(user_id, id)` dengan `ON DELETE SET NULL (course_schedule_id)` memastikan pengguna tidak dapat mengaitkan tugas ke jadwal milik pengguna lain.
- **Trigger Registrasi User Aman**: Fungsi `handle_new_user()` menggunakan `SECURITY DEFINER` dengan `SET search_path = ''` untuk mencegah *search path hijacking*, serta tidak menyembunyikan (*swallow*) error sistem sehingga menjamin konsistensi data akun.
- **Row Level Security (RLS)**: Kebijakan granular `SELECT`, `INSERT`, `UPDATE`, dan `DELETE` di ke-6 tabel yang membatasi akses strictly pada `auth.uid()`.
- **Indeks Performa**: Indeks filter dan sorting berdasarkan `user_id`.

---

## Opsi 1: Melalui Supabase Dashboard SQL Editor (Direkomendasikan)

1. Buka dashboard proyek Anda di [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Pilih proyek Noctis Anda (`uucyzknumoznufrxwgzk`).
3. Di navigasi sebelah kiri, klik menu **SQL Editor**.
4. Klik tombol **+ New Query**.
5. Buka berkas [`supabase/migrations/20261022000000_create_noctis_schema.sql`](./migrations/20261022000000_create_noctis_schema.sql), salin (*copy*) seluruh isinya, lalu tempel (*paste*) ke dalam SQL Editor.
6. Klik tombol **Run** (atau tekan `Ctrl + Enter` / `Cmd + Enter`).
7. Tunggu hingga muncul pesan `Success. No rows returned`.

### Verifikasi Hasil:
- Buka menu **Table Editor**: Pastikan 6 tabel muncul (`profiles`, `user_preferences`, `schedules`, `tasks`, `notes`, `agenda_events`).
- Buka menu **Authentication → Policies**: Pastikan setiap tabel berstatus `RLS enabled` dengan 4 policy terdaftar (`select`, `insert`, `update`, `delete`).

---

## Opsi 2: Melalui Supabase CLI

Jika Supabase CLI terpasang di sistem Anda:

```bash
# 1. Login ke akun Supabase
supabase login

# 2. Hubungkan ke remote project
supabase link --project-ref uucyzknumoznufrxwgzk

# 3. Dorong migrasi ke database
supabase db push
```

---

## Migrasi Stage 6.2: Atomic Import RPC (`20261023000000_import_user_data_atomic.sql`)

File migrasi: `supabase/migrations/20261023000000_import_user_data_atomic.sql`

Migrasi ini menambahkan fungsi database PostgreSQL `public.import_user_data_atomic(payload jsonb)` untuk mendukung impor data aman dan transaksional:
- **Atomisitas Total (All-or-Nothing)**: Seluruh proses penggantian data lama dan penyisipan data baru dieksekusi dalam satu transaksi database PostgreSQL. Jika terjadi kesalahan validasi atau kegagalan sistem, seluruh operasi di-rollback otomatis dan data lama tetap utuh.
- **Pre-Validation Pass**: Memeriksa seluruh payload (struktur objek, tipe data, nilai wajib, enum, format waktu HH:mm, urutan start_time < end_time, dan rentang tanggal) *sebelum* instruksi DELETE, UPDATE, atau INSERT pertama dieksekusi.
- **Semantik Payload Parsial**:
  - Kunci kategori tidak tersedia: data lama kategori tersebut tetap dipertahankan.
  - Kunci kategori tersedia dengan array kosong `[]`: data lama kategori tersebut dikosongkan.
  - Kunci kategori tersedia dengan array data `[...]`: data lama kategori tersebut digantikan.
- **Perlindungan Relasi Tasks–Schedules**: Menolak penggantian `schedules` tanpa menyertakan `tasks` jika pengguna memiliki tugas aktif yang terhubung ke jadwal lama, mencegah pemutusan relasi foreign key yang tidak disengaja.
- **Penanganan Tags Aman**: Aman memproses tags berupa array string valid, JSON null, SQL NULL, tidak tersedia, maupun scalar tanpa memicu error ekstraksi scalar PostgreSQL (`jsonb_array_elements`).
- **Fidelitas Database Nyata (`RETURNING to_jsonb(...)`)**: Mengembalikan data hasil insert dan update langsung dari tabel PostgreSQL, menjamin konsistensi UUID, timestamp ISO default (`created_at`, `updated_at`), dan relasi `course_schedule_id` ke frontend.
- **Profil & Preferensi Terproteksi (UPSERT)**: Menggunakan UPSERT aman berdasarkan `auth.uid()`, mengabaikan email dari payload, dan selalu mengunci email profil ke email autentikasi pengguna dari `auth.users`.
- **Isolasi Akun Terautentikasi**: Menggunakan `v_user_id := auth.uid()` dari JWT sesi aktif dengan `SECURITY DEFINER` dan `SET search_path = public, pg_catalog`. Panggilan anonim ditolak (`REVOKE FROM anon`), dan pengguna tidak dapat menghapus atau menyisipkan data pengguna lain.

### Cara Menerapkan:
1. Buka Supabase Dashboard SQL Editor pada proyek Anda.
2. Buka berkas [`supabase/migrations/20261023000000_import_user_data_atomic.sql`](./migrations/20261023000000_import_user_data_atomic.sql).
3. Salin seluruh isi skrip, tempel ke SQL Editor, lalu jalankan (**Run**).
