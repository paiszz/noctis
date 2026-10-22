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

## Catatan Kompatibilitas & Idempotensi
- Skrip menggunakan `DROP POLICY IF EXISTS` dan `DROP TRIGGER IF EXISTS` sehingga aman dijalankan ulang (*re-runnable*) tanpa menimbulkan galat duplikasi policy atau trigger.
- Sintaks `ON DELETE SET NULL (course_schedule_id)` memanfaatkan fitur PostgreSQL 15+ yang merupakan versi standar pada project Supabase modern.
