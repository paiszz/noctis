# Noctis — Your Personal Productivity Space

**Product Requirements Document (PRD)**

**Versi:** 1.2  
**Status:** Draft untuk acuan pengembangan  
**Tanggal:** 21 Oktober 2026  
**Platform:** Web responsif dan Progressive Web App (PWA)  
**Target pengguna:** Penggunaan pribadi, dengan fokus awal pada kebutuhan mahasiswa

---

## 1. Ringkasan Produk

Noctis adalah aplikasi produktivitas pribadi berbasis web yang mengintegrasikan jadwal kuliah, tugas, catatan, agenda, dan pengingat dalam satu tempat. Dashboard menjadi pusat aktivitas harian agar pengguna dapat mengetahui hal yang perlu dilakukan tanpa berpindah-pindah aplikasi.

Produk menggunakan pendekatan **cloud-first**: data utama disimpan di database online dan dapat diakses dari perangkat lain setelah autentikasi. Noctis juga dirancang sebagai PWA dan mendukung Web Push Notification pada browser serta perangkat yang kompatibel.

### Visi

Menjadi pusat aktivitas pribadi yang sederhana, terintegrasi, privat, dan dapat diandalkan.

### Tujuan

- Memusatkan jadwal kuliah, tugas, catatan, agenda, dan pengingat.
- Membantu pengguna melihat aktivitas hari ini dan aktivitas berikutnya.
- Mengurangi risiko melewatkan kelas dan tenggat tugas melalui pengingat.
- Menyediakan penyimpanan online yang persisten dan dapat diakses lintas perangkat.
- Menjaga struktur kode tetap modular agar fitur baru dapat ditambahkan bertahap.

---

## 2. Target Pengguna dan Ruang Lingkup

### Target pengguna

Pengguna utama adalah pemilik aplikasi yang ingin mengelola aktivitas akademik dan personal. Autentikasi tetap digunakan untuk melindungi data dan memungkinkan akses dari beberapa perangkat.

### Dalam ruang lingkup MVP

- Dashboard aktivitas harian.
- CRUD jadwal kuliah dan kalender harian/mingguan.
- CRUD catatan, kategori, pencarian dasar, dan favorit.
- CRUD tugas dengan tenggat, prioritas, dan status.
- Agenda pribadi dan pengaturan pengingat.
- Penyimpanan database online dengan autentikasi dan Row Level Security (RLS).
- Preferensi notifikasi dan fondasi push notification.
- Desain responsif untuk desktop dan ponsel.

### Di luar ruang lingkup MVP

- Kolaborasi, pembagian tugas, dan banyak workspace.
- Integrasi Google Calendar atau layanan eksternal lainnya.
- Integrasi WhatsApp atau Discord.
- AI assistant, analitik produktivitas lanjutan, dan gamifikasi.
- Sinkronisasi offline penuh dengan resolusi konflik.

---

## 3. Kebutuhan Fungsional

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-01 | Dashboard menampilkan jadwal, tugas, agenda, dan aktivitas berikutnya. | Must have |
| FR-02 | Pengguna dapat menambah, melihat, mengubah, dan menghapus jadwal kuliah. | Must have |
| FR-03 | Jadwal dapat ditampilkan dalam tampilan harian dan mingguan. | Must have |
| FR-04 | Jadwal mendukung pengulangan mingguan dan pengecualian tanggal tertentu. | Must have |
| FR-05 | Pengguna dapat mengelola catatan, kategori, dan favorit. | Must have |
| FR-06 | Pengguna dapat mengelola tugas, prioritas, tenggat, dan status. | Must have |
| FR-07 | Pengguna dapat membuat agenda dan menentukan waktu pengingat. | Must have |
| FR-08 | Pengguna dapat mengatur preferensi notifikasi. | Must have |
| FR-09 | Sistem mendukung Web Push untuk browser/perangkat yang kompatibel. | Must have |
| FR-10 | Sistem mencegah pengiriman pengingat yang sama berulang kali. | Must have |
| FR-11 | Pengguna dapat mencari catatan dan tugas berdasarkan kata kunci. | Should have |
| FR-12 | Aplikasi dapat dipasang sebagai PWA. | Should have |
| FR-13 | Pengguna dapat mengekspor atau mengimpor data pribadi. | Could have |
| FR-14 | Pengguna dapat menggunakan aplikasi secara offline dengan sinkronisasi. | Could have |

### 3.1 Dashboard

- Menampilkan tanggal lokal dan sapaan pengguna.
- Menampilkan aktivitas berikutnya, jadwal hari ini, tugas prioritas, dan agenda mendatang.
- Menyediakan tombol tambah cepat untuk jadwal, tugas, catatan, dan agenda.
- Menampilkan *empty state* jika belum ada aktivitas.

### 3.2 Jadwal Kuliah dan Kalender

- Data mencakup nama mata kuliah, kode opsional, hari, jam mulai/selesai, lokasi, dan aturan pengulangan.
- Pengguna dapat menentukan tanggal mulai dan akhir jadwal jika diperlukan.
- Perubahan pertemuan tertentu tidak boleh otomatis mengubah seluruh rangkaian jadwal.
- Sistem menghasilkan kejadian jadwal konkret untuk hari yang relevan dan pengingatnya.

### 3.3 Tugas

- Data mencakup judul, deskripsi opsional, tenggat, prioritas, status, dan relasi mata kuliah opsional.
- Status: belum dikerjakan, sedang dikerjakan, dan selesai.
- Tugas yang belum selesai dan melewati tenggat ditandai terlambat.
- Pengingat tugas selesai atau tidak lagi relevan harus dibatalkan.

### 3.4 Catatan

- Catatan memiliki judul, isi, kategori, tag opsional, favorit, serta waktu pembuatan dan pembaruan.
- Versi awal dapat menggunakan teks biasa atau Markdown.
- Pengguna dapat mencari berdasarkan judul atau isi.

### 3.5 Agenda

- Agenda memiliki judul, deskripsi opsional, waktu mulai/selesai, lokasi opsional, dan pengingat.
- Agenda mencakup rapat organisasi, kegiatan pribadi, jadwal belajar, dan aktivitas nonkuliah.

---

## 4. Kebutuhan Nonfungsional

| Kategori | Persyaratan |
|---|---|
| Usability | Alur utama dapat diakses dalam sedikit langkah; label dan pesan status jelas. |
| Performance | Halaman dan operasi umum terasa responsif pada koneksi normal. |
| Responsiveness | Layout mendukung desktop, tablet, dan ponsel. |
| Reliability | Data persisten; kegagalan ditampilkan dengan pesan yang dapat ditindaklanjuti. |
| Security | Autentikasi, otorisasi server, RLS, dan validasi input diterapkan. |
| Privacy | Data hanya dapat diakses oleh pemilik yang berwenang. |
| Maintainability | Kode dipisahkan berdasarkan fitur dan tanggung jawab. |
| Accessibility | Kontras memadai, navigasi keyboard, label input, dan status tidak bergantung pada warna saja. |
| Notification reliability | Status pengiriman, deduplikasi, dan percobaan ulang tersedia; waktu kirim tidak dijamin presisi detik. |

---

## 5. Struktur Halaman dan Navigasi

| Halaman | Komponen dan tanggung jawab |
|---|---|
| Dashboard | Sapaan, tanggal, aktivitas berikutnya, jadwal hari ini, tugas mendesak, agenda, aksi cepat. |
| Calendar | Tampilan hari/minggu/bulan, navigasi tanggal, blok jadwal, formulir jadwal. |
| Tasks | Daftar tugas, filter status/prioritas, tenggat, indikator terlambat. |
| Notes | Pencarian, kategori/tag, daftar catatan, editor, favorit. |
| Agenda | Kegiatan pribadi, waktu, lokasi, dan pengingat. |
| Settings | Profil, zona waktu, preferensi notifikasi, tema, dan pengelolaan data. |
| Login | Autentikasi dan pemulihan akses sesuai konfigurasi Supabase Auth. |

### Layout responsif

- **Desktop:** sidebar di kiri, header di atas, dashboard dua atau tiga kolom.
- **Tablet:** sidebar dapat diciutkan.
- **Mobile:** navigasi bawah atau menu ringkas, formulir satu kolom, tombol aksi mudah dijangkau.

---

## 6. Identitas Visual dan UX

Arah desain: modern, tenang, minimalis, dan berorientasi pada aktivitas harian. Noctis — Your Personal Productivity Space — memadukan kesan tenang yang terinspirasi suasana malam dengan antarmuka terang yang nyaman digunakan sehari-hari. Identitas merek menggunakan hijau teal sebagai warna utama, aksen lembut, ruang kosong yang cukup, dan tipografi yang jelas. Nama Noctis adalah nama merek, bukan singkatan fitur yang wajib ditampilkan di antarmuka.

| Token | Nilai awal | Penggunaan |
|---|---|---|
| Background | `#F7F8F6` | Latar halaman terang |
| Surface | `#FFFFFF` | Kartu dan panel |
| Primary | `#0F766E` | Aksi utama dan identitas merek |
| Primary dark | `#115E59` | Hover dan aksen gelap |
| Soft accent | `#E8F3EF` | Latar aksen lembut |
| Reminder accent | `#FFF1D6` | Pengingat dan perhatian |
| Text | `#202923` | Teks utama |
| Muted text | `#69746C` | Teks sekunder |

Prinsip desain:

- Gunakan batas halus dan hindari bayangan berlebihan.
- Gunakan indikator teks dan ikon bersama warna untuk status.
- Gunakan mode terang sebagai tampilan awal MVP; mode gelap dapat ditambahkan kemudian untuk memperkuat pilihan suasana malam tanpa mengorbankan keterbacaan.
- Setiap halaman harus memiliki *loading*, *error*, dan *empty states*.

---

## 7. Arsitektur Sistem

### Stack teknologi

| Komponen | Teknologi | Tanggung jawab |
|---|---|---|
| Web application | Next.js App Router + TypeScript | Halaman, UI, validasi, dan operasi server. |
| UI | Tailwind CSS + shadcn/ui | Komponen konsisten dan desain responsif. |
| Database | Supabase PostgreSQL | Penyimpanan data dan relasi. |
| Authentication | Supabase Auth | Login dan sesi pengguna. |
| Authorization | PostgreSQL RLS | Membatasi akses berdasarkan pemilik data. |
| Push | Service Worker + Web Push API | Menerima dan menampilkan push notification. |
| Scheduler | Scheduled job + backend endpoint | Memproses pengingat yang jatuh tempo. |
| Hosting | Vercel dan layanan pendukung | Deployment aplikasi dan pekerjaan terjadwal. |
| Version control | Git + GitHub | Riwayat kode. |

### Alur sistem

1. Pengguna berinteraksi melalui browser dan Next.js.
2. Permintaan data diautentikasi dan dibatasi oleh kebijakan akses.
3. Data utama disimpan di PostgreSQL.
4. Scheduler mencari reminder yang jatuh tempo dan belum diproses.
5. Backend mengirim push ke endpoint subscription yang tersimpan.
6. Service worker menampilkan notifikasi pada perangkat yang kompatibel.

> **Catatan:** Service worker saja tidak dapat menjamin pengiriman saat browser ditutup. Pengiriman latar memerlukan push subscription, backend yang mengirim push, scheduler yang tetap berjalan, serta dukungan browser/perangkat.

---

## 8. Model Data

| Tabel | Kolom utama yang disarankan | Catatan |
|---|---|---|
| `course_schedules` | `id`, `user_id`, `course_name`, `course_code`, `day_of_week`, `start_time`, `end_time`, `location`, `recurrence_rule` | Aturan jadwal mingguan. |
| `schedule_exceptions` | `id`, `schedule_id`, `occurrence_date`, `exception_type`, `override_start`, `override_end`, `location` | Perubahan atau pembatalan pertemuan tertentu. |
| `tasks` | `id`, `user_id`, `title`, `description`, `due_at`, `priority`, `status`, `course_schedule_id` | Tenggat dan progres tugas. |
| `notes` | `id`, `user_id`, `title`, `content`, `category`, `is_favorite`, `created_at`, `updated_at` | Konten catatan. |
| `agenda_events` | `id`, `user_id`, `title`, `description`, `start_at`, `end_at`, `location` | Agenda nonkuliah. |
| `reminders` | `id`, `user_id`, `source_type`, `source_id`, `scheduled_at`, `status`, `sent_at`, `attempts` | Status pemrosesan pengingat. |
| `push_subscriptions` | `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `created_at`, `last_used_at` | Subscription per browser/perangkat. |
| `notification_preferences` | `id`, `user_id`, `category`, `enabled`, `default_reminder_minutes` | Preferensi notifikasi. |

### Aturan data

- Gunakan UUID untuk ID entitas.
- Setiap data pribadi memiliki `user_id` dan kebijakan RLS yang membatasi akses pemilik.
- Gunakan `timestamptz` untuk waktu absolut; simpan zona waktu pengguna sebagai preferensi.
- Jadwal berulang disimpan sebagai hari/jam lokal dan menghasilkan kejadian konkret berdasarkan zona waktu.
- Tambahkan indeks untuk `user_id`, `due_at`, `scheduled_at`, dan status reminder sesuai pola query.
- Jangan pernah mengekspos service role key atau private VAPID key ke frontend.

---

## 9. Spesifikasi Push Notification

### 9.1 Alur pendaftaran

1. Pengguna membuka **Settings → Notifications**.
2. Aplikasi menjelaskan fungsi notifikasi sebelum meminta izin browser.
3. Browser meminta izin notifikasi.
4. Jika diizinkan, browser membuat push subscription.
5. Backend menyimpan endpoint dan kunci subscription dengan `user_id` yang sesuai.
6. Pengguna dapat mengirim notifikasi percobaan dan mencabut subscription.

### 9.2 Alur pengiriman

1. Reminder dibuat ketika pengguna mengatur jadwal atau tenggat.
2. Scheduler memeriksa reminder yang `scheduled_at`-nya telah tiba dan statusnya masih `pending`.
3. Pekerjaan diklaim secara aman agar tidak diproses bersamaan oleh beberapa worker.
4. Backend mengirim push melalui Web Push Service menggunakan VAPID.
5. Status dan hasil pengiriman dicatat.
6. Kegagalan sementara dapat dicoba ulang; subscription tidak valid dinonaktifkan atau dihapus.

### 9.3 Status pengiriman

| Status | Makna |
|---|---|
| `pending` | Menunggu waktu pengiriman. |
| `processing` | Sedang diklaim atau diproses oleh worker. |
| `sent` | Layanan push menerima permintaan pengiriman; bukan jaminan notifikasi sudah dilihat. |
| `failed` | Gagal setelah kebijakan percobaan ulang atau kegagalan permanen. |
| `cancelled` | Tidak perlu dikirim lagi, misalnya tugas selesai. |

### 9.4 Keandalan

- Gunakan identitas unik untuk satu kejadian reminder agar tidak terkirim ganda.
- Jadwalkan waktu absolut dalam UTC, tetapi hitung kejadian kuliah berdasarkan zona waktu lokal.
- Jangan menjanjikan waktu kirim presisi detik; jaringan, layanan push, dan mode hemat daya dapat menyebabkan keterlambatan.
- Uji tab tertutup dan browser ditutup secara terpisah pada browser/perangkat target.
- Jika izin ditolak, tampilkan panduan untuk mengubah izin dan jangan meminta izin berulang kali.

---

## 10. Aturan Bisnis

| Area | Aturan |
|---|---|
| Jadwal berulang | Mendukung tanggal mulai/akhir opsional dan pengecualian tanggal tertentu. |
| Tugas terlambat | Tugas belum selesai dengan `due_at` di masa lalu ditandai terlambat. |
| Tugas selesai | Reminder yang tidak lagi relevan dibatalkan. |
| Reminder | Hanya dikirim jika relevan, jatuh tempo, dan belum diproses berhasil. |
| Zona waktu | Tampilan dan perhitungan jadwal mengikuti zona waktu pengguna. |
| Privasi | Pengguna hanya mengakses data miliknya; validasi dilakukan di server dan database. |
| Penghapusan | Minta konfirmasi untuk penghapusan permanen. |
| Data kosong | Sediakan petunjuk dan aksi untuk membuat data pertama. |
| Pencarian | Catatan dan tugas dapat dicari berdasarkan kata kunci. |

---

## 11. Rencana Implementasi

Estimasi berikut ditujukan untuk pengerjaan paruh waktu dan dapat berubah sesuai pengalaman serta kendala integrasi.

| Fase | Estimasi | Aktivitas | Hasil |
|---|---|---|---|
| 1. Foundation | Minggu 1 | Setup Next.js, UI, Supabase Auth, skema DB, RLS, layout. | Fondasi aplikasi dan autentikasi. |
| 2. Core CRUD | Minggu 2–3 | CRUD jadwal, tugas, catatan, agenda; kalender mingguan. | Data utama dapat dikelola. |
| 3. Dashboard | Minggu 4 | Integrasi aktivitas harian, aktivitas berikutnya, aksi cepat, empty states. | Dashboard terintegrasi. |
| 4. Notifications | Minggu 5–6 | Service worker, subscription, scheduler, status pengiriman, retry, deduplikasi. | Push pada lingkungan yang didukung. |
| 5. PWA & polish | Minggu 7 | Manifest, ikon, responsivitas, aksesibilitas, loading/error states. | UX siap diuji. |
| 6. Testing & release | Minggu 8 | Tes keamanan, RLS, CRUD, notifikasi, konfigurasi environment, deployment. | MVP siap digunakan. |

Push notification dapat ditunda sampai fitur inti stabil.

---

## 12. Kriteria Penerimaan dan Pengujian

### Data dan autentikasi

- [ ] Data tetap tersimpan setelah logout dan login kembali.
- [ ] Pengguna tidak dapat membaca atau mengubah data pengguna lain.
- [ ] Operasi CRUD menampilkan hasil atau error yang jelas.

### Aktivitas harian

- [ ] Dashboard menampilkan aktivitas berdasarkan tanggal lokal pengguna.
- [ ] Jadwal mingguan muncul pada hari dan waktu yang benar.
- [ ] Tugas terlambat, selesai, dan mendekati tenggat memiliki status yang benar.

### Push notification

- [ ] Pengguna dapat mendaftarkan dan mencabut subscription.
- [ ] Reminder yang sama tidak diproses berulang kali.
- [ ] Notifikasi diuji saat tab tidak aktif dan browser ditutup pada perangkat yang didukung.
- [ ] Kegagalan jaringan dan subscription tidak valid ditangani.

### Pengalaman penggunaan

- [ ] Layout berfungsi pada desktop dan ponsel.
- [ ] Formulir memvalidasi input dan menampilkan pesan kesalahan.
- [ ] Halaman kosong menyediakan tindakan untuk menambahkan data pertama.

---

## 13. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Dukungan push berbeda | Notifikasi tidak tersedia pada semua kombinasi browser/perangkat. | Dokumentasikan lingkungan yang didukung dan uji perangkat target. |
| Browser/perangkat offline | Notifikasi terlambat atau tidak segera muncul. | Gunakan scheduler, status pengiriman, retry, dan indikator di dashboard. |
| Jadwal berulang dan perubahan zona waktu | Waktu kejadian dapat bergeser jika zona waktu tidak ditangani. | Simpan aturan lokal, zona waktu, serta pengecualian kejadian. |
| Pengiriman ganda | Pengguna menerima reminder berulang. | Unique key, claim atomik, idempotensi, dan log pengiriman. |
| Akses data tidak sah | Data pribadi dapat terekspos. | RLS, autentikasi, validasi server, dan secret server-only. |
| Scope terlalu luas | MVP terlambat selesai. | Prioritaskan jadwal, tugas, catatan, dashboard, lalu push. |

---

## 14. Definisi Selesai (Definition of Done)

- [ ] Seluruh fitur MVP berfungsi sesuai kebutuhan dalam PRD.
- [ ] Data persisten dan dapat diakses setelah login dari perangkat lain.
- [ ] Dashboard menampilkan aktivitas berdasarkan tanggal dan zona waktu yang benar.
- [ ] Pengingat dapat diuji pada browser/perangkat yang didukung dengan status pengiriman yang dapat diperiksa.
- [ ] Tidak ada masalah kritis pada alur CRUD, autentikasi, dan otorisasi data.
- [ ] RLS telah diuji agar pengguna hanya mengakses data miliknya.
- [ ] Aplikasi responsif pada desktop dan ponsel.
- [ ] Deployment dan environment variables telah diverifikasi; secret tidak disimpan di frontend.
- [ ] README memuat cara setup, migrasi database, konfigurasi push, pengujian, dan deployment.

---

## Lampiran A — Struktur Folder yang Disarankan

```text
noctis/
├── public/
│   ├── icons/
│   ├── manifest.json
│   └── sw.js
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (app)/
│   │   │   ├── dashboard/
│   │   │   ├── calendar/
│   │   │   ├── tasks/
│   │   │   ├── notes/
│   │   │   ├── agenda/
│   │   │   └── settings/
│   │   ├── api/push/
│   │   ├── api/reminders/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── layout/
│   │   ├── dashboard/
│   │   ├── calendar/
│   │   ├── tasks/
│   │   ├── notes/
│   │   └── ui/
│   ├── features/
│   │   ├── schedules/
│   │   ├── tasks/
│   │   ├── notes/
│   │   ├── agenda/
│   │   └── notifications/
│   ├── lib/
│   │   ├── supabase/
│   │   └── validation/
│   ├── types/
│   └── styles/
├── supabase/migrations/
├── tests/
├── .env.example
├── package.json
└── README.md
```

## Lampiran B — Environment Variables

Nama berikut merupakan contoh konfigurasi. Isi nilainya melalui environment deployment dan jangan commit secret ke Git.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
REMINDER_SCHEDULER_SECRET=
```

**Keamanan:** `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, dan `REMINDER_SCHEDULER_SECRET` hanya boleh digunakan di server. Nama variabel dapat disesuaikan dengan konfigurasi proyek.

## Lampiran C — User Stories Prioritas

| ID | User story | Ringkasan penerimaan |
|---|---|---|
| US-01 | Sebagai pengguna, saya ingin melihat jadwal kuliah hari ini. | Dashboard menampilkan kelas sesuai hari dan waktu lokal. |
| US-02 | Sebagai pengguna, saya ingin mengingat tenggat tugas. | Tugas dapat memiliki tenggat dan reminder. |
| US-03 | Sebagai pengguna, saya ingin mencatat materi kuliah. | Catatan dapat dibuat, diedit, dicari, dan disimpan. |
| US-04 | Sebagai pengguna, saya ingin menerima pengingat saat browser tidak terbuka. | Push dikirim pada perangkat/browser yang mendukung dan subscription aktif. |
| US-05 | Sebagai pengguna, saya ingin data saya aman. | RLS dan validasi server membatasi akses hanya kepada pemilik. |

---

**Akhir dokumen — Noctis PRD v1.2**
