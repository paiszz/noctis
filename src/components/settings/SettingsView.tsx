"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Bell,
  Palette,
  Globe,
  Database,
  Download,
  Upload,
  Check,
  AlertCircle,
  Edit2,
  Moon,
  Sun,
  Laptop,
  LogOut,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Button, Badge, Modal } from "@/components/ui";
import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { noctisExportSchema } from "@/lib/validation/import-schema";
import type { ValidatedNoctisExport } from "@/lib/validation/import-schema";
import type { AppTheme } from "@/types";
import { toast } from "sonner";
import { format } from "date-fns";

const TIMEZONE_OPTIONS = [
  { value: "Asia/Jakarta", label: "Asia/Jakarta (WIB, UTC+7)" },
  { value: "Asia/Makassar", label: "Asia/Makassar (WITA, UTC+8)" },
  { value: "Asia/Jayapura", label: "Asia/Jayapura (WIT, UTC+9)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT, UTC+8)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
];

export function SettingsView() {
  const {
    profile,
    updateProfile,
    preferences,
    updatePreferences,
    setNotificationPreference,
    exportAllData,
    importAllData,
    isLoaded,
    isProfileLoading,
  } = useData();

  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Profile modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const [emailInput, setEmailInput] = useState(profile.email);
  const [titleInput, setTitleInput] = useState(profile.title || "");
  const [profileErrors, setProfileErrors] = useState<{
    name?: string;
    email?: string;
  }>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Browser notification permission state (safe from SSR hydration mismatch)
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  // File import ref and state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] =
    useState<ValidatedNoctisExport | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Timezone display (loaded on client to prevent SSR hydration mismatch)
  const [currentTimezone, setCurrentTimezone] = useState("Asia/Jakarta");

  useEffect(() => {
    // Check Notification API support and permission
    if (typeof window !== "undefined") {
      if ("Notification" in window) {
        setBrowserPermission(Notification.permission);
      } else {
        setBrowserPermission("unsupported");
      }
    }

    if (preferences.timezone) {
      setCurrentTimezone(preferences.timezone);
    }
  }, [preferences.timezone]);

  // Sync profile form when profile changes or modal opens
  useEffect(() => {
    if (isProfileModalOpen) {
      setNameInput(profile.name);
      setEmailInput(profile.email);
      setTitleInput(profile.title || "");
      setProfileErrors({});
    }
  }, [profile, isProfileModalOpen]);

  // ── Handlers ──

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; email?: string } = {};

    if (!nameInput.trim()) {
      errors.name = "Nama tidak boleh kosong.";
    }

    if (!user) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailInput.trim() || !emailRegex.test(emailInput.trim())) {
        errors.email = "Format alamat email tidak valid.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateProfile({
        name: nameInput.trim(),
        email: user ? undefined : emailInput.trim(),
        title: titleInput.trim() || undefined,
      });

      toast.success("Profil berhasil diperbarui.");
      setIsProfileModalOpen(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan profil ke server.";
      toast.error(`Gagal menyimpan profil: ${message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRequestBrowserPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Browser ini tidak mendukung Web Notification API.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);

      if (permission === "granted") {
        toast.success("Izin notifikasi browser berhasil diberikan!");
      } else if (permission === "denied") {
        toast.error("Izin notifikasi ditolak oleh pengguna.");
      } else {
        toast.info("Permintaan izin notifikasi ditutup.");
      }
    } catch (err) {
      toast.error("Gagal meminta izin notifikasi browser.");
    }
  };

  const handleExportData = () => {
    try {
      const exportData = exportAllData();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(exportData, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      const dateStr = format(new Date(), "yyyy-MM-dd");
      downloadAnchor.setAttribute("download", `noctis-backup-${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast.success("Data berhasil diekspor sebagai file JSON.");
    } catch (err) {
      toast.error("Terjadi kesalahan saat mengekspor data.");
    }
  };

  const handleSelectImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Validate structure with Zod schema
        const validationResult = noctisExportSchema.safeParse(parsed);

        if (!validationResult.success) {
          const firstError = validationResult.error.issues[0]?.message || "Format data tidak sesuai.";
          toast.error(`File JSON tidak valid: ${firstError}`);
          return;
        }

        // Valid: prompt confirmation modal with summary
        setPendingImport(validationResult.data);
      } catch (err) {
        toast.error("File yang dipilih bukan JSON yang valid.");
      } finally {
        // Reset file input so same file can be selected again if needed
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };

    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;

    try {
      setIsImporting(true);
      await importAllData(pendingImport);
      toast.success("Data berhasil diimpor dan disinkronkan ke seluruh aplikasi.");
      setPendingImport(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal mengimpor data ke penyimpanan aplikasi.";
      toast.error(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      toast.success("Berhasil keluar dari akun.");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Gagal keluar dari akun. Silakan coba lagi.");
    } finally {
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
    }
  };

  const avatarInitial = profile.name ? profile.name.trim()[0].toUpperCase() : "U";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ── 1. Profile Card ── */}
      <Card>
        <CardHeader
          title="Profil Pengguna"
          description="Informasi identitas akun dan personal workspace."
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<Edit2 className="w-3.5 h-3.5" />}
                onClick={() => setIsProfileModalOpen(true)}
              >
                Edit Profil
              </Button>
              {user && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-danger hover:bg-danger-light border-danger/30"
                  icon={<LogOut className="w-3.5 h-3.5 text-danger" />}
                  onClick={() => setIsLogoutModalOpen(true)}
                >
                  Keluar
                </Button>
              )}
            </div>
          }
        />
        {!isLoaded || isProfileLoading ? (
          <div className="flex items-center gap-4 animate-pulse">
            <div className="w-16 h-16 rounded-2xl bg-muted/20 shrink-0" />
            <div className="min-w-0 space-y-2 flex-1">
              <div className="h-5 w-40 bg-muted/25 rounded" />
              <div className="h-4 w-48 bg-muted/20 rounded" />
              <div className="h-4 w-24 bg-muted/15 rounded" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/40 border-2 border-white shadow-sm flex items-center justify-center text-primary font-bold text-2xl shrink-0">
              {avatarInitial}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg text-foreground truncate">
                {profile.name || "User"}
              </h3>
              <p className="text-sm text-muted-dark truncate">{user?.email || profile.email}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {user ? (
                  <Badge variant="primary" className="text-[11px] flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Supabase Auth</span>
                  </Badge>
                ) : null}
                {profile.title && (
                  <Badge variant="default" className="text-[11px]">
                    {profile.title}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
        <p className="text-xs text-muted mt-4 border-t border-border/70 pt-3">
          {user
            ? `Terautentikasi sebagai ${user.email}. ID Pengguna: ${user.id.slice(0, 8)}...`
            : "Perubahan profil disimpan di penyimpanan lokal perangkat."}
        </p>
      </Card>

      {/* ── 2. Notification Preferences Card ── */}
      <Card>
        <CardHeader
          title="Preferensi Notifikasi"
          description="Atur pengingat aktivitas harian dan izin notifikasi browser."
        />
        <div className="space-y-4">
          {/* Notification toggles */}
          {[
            {
              key: "course_schedule" as const,
              label: "Pengingat jadwal kuliah",
              desc: "30 menit sebelum kelas dimulai",
            },
            {
              key: "task_deadline" as const,
              label: "Pengingat deadline tugas",
              desc: "1 hari sebelum tenggat waktu tugas berakhir",
            },
            {
              key: "agenda_event" as const,
              label: "Pengingat agenda kegiatan",
              desc: "15 menit sebelum acara atau pertemuan dimulai",
            },
          ].map((pref) => {
            const isEnabled = preferences.notifications[pref.key];
            return (
              <div key={pref.key} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {pref.label}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{pref.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const nextVal = !isEnabled;
                    try {
                      await setNotificationPreference(pref.key, nextVal);
                      toast.success(
                        `${pref.label} ${nextVal ? "diaktifkan" : "dinonaktifkan"}.`
                      );
                    } catch (err: unknown) {
                      const msg =
                        err instanceof Error ? err.message : "Gagal memperbarui preferensi notifikasi.";
                      toast.error(`Gagal mengubah preferensi: ${msg}`);
                    }
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    isEnabled ? "bg-primary" : "bg-border"
                  }`}
                  aria-label={`Toggle ${pref.label}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-1 transition-transform ${
                      isEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            );
          })}

          {/* Browser Permission Block */}
          <div className="pt-3 border-t border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-primary" />
                <span>Izin Notifikasi Browser:</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                    browserPermission === "granted"
                      ? "bg-success-light text-success"
                      : browserPermission === "denied"
                      ? "bg-danger-light text-danger"
                      : "bg-surface-muted text-muted-dark border border-border"
                  }`}
                >
                  {browserPermission === "granted"
                    ? "Diizinkan"
                    : browserPermission === "denied"
                    ? "Diblokir"
                    : "Belum Diminta"}
                </span>
              </p>
              <p className="text-[11px] text-muted">
                Push notification di latar belakang memerlukan Service Worker & backend VAPID.
              </p>
            </div>

            {browserPermission !== "granted" && browserPermission !== "unsupported" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestBrowserPermission}
                className="shrink-0 text-xs"
              >
                Minta Izin Notifikasi
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ── 3. Appearance & Preferences Card ── */}
      <Card>
        <CardHeader
          title="Tampilan & Zona Waktu"
          description="Sesuaikan tema visual aplikasi dan zona waktu perhitungan jadwal."
        />
        <div className="space-y-4">
          {/* Theme selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-soft-accent flex items-center justify-center text-primary shrink-0">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Tema Antarmuka</p>
                <p className="text-xs text-muted">Pilih mode tampilan Noctis yang nyaman.</p>
              </div>
            </div>

            {/* Theme buttons */}
            <div className="flex bg-surface-muted p-1 rounded-xl border border-border/80 shrink-0">
              {(
                [
                  { value: "light", label: "Terang", icon: Sun },
                  { value: "dark", label: "Gelap", icon: Moon },
                  { value: "system", label: "Sistem", icon: Laptop },
                ] as const
              ).map((t) => {
                const isActive = preferences.theme === t.value;
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={async () => {
                      try {
                        await updatePreferences({ theme: t.value });
                        toast.success(`Tema diubah ke mode ${t.label}.`);
                      } catch (err: unknown) {
                        const msg =
                          err instanceof Error ? err.message : "Gagal mengubah tema.";
                        toast.error(`Gagal mengubah tema: ${msg}`);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? "bg-primary text-white shadow-sm font-bold"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timezone selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/70">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-soft-accent flex items-center justify-center text-primary shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Zona Waktu</p>
                <p className="text-xs text-muted">Perhitungan jadwal kuliah dan tanggal.</p>
              </div>
            </div>

            <select
              value={currentTimezone}
              onChange={async (e) => {
                const tz = e.target.value;
                const prevTz = currentTimezone;
                setCurrentTimezone(tz);
                try {
                  await updatePreferences({ timezone: tz });
                  toast.success(`Zona waktu diatur ke ${tz}.`);
                } catch (err: unknown) {
                  setCurrentTimezone(prevTz);
                  const msg =
                    err instanceof Error ? err.message : "Gagal mengubah zona waktu.";
                  toast.error(`Gagal mengubah zona waktu: ${msg}`);
                }
              }}
              className="bg-surface border border-border/80 text-foreground text-xs sm:text-sm rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:border-border-focus cursor-pointer shrink-0"
              aria-label="Pilih zona waktu"
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* ── 4. Data Management Card (Export & Import) ── */}
      <Card>
        <CardHeader
          title="Pengelolaan Data"
          description="Cadangkan data pribadi atau pulihkan data dari file cadangan JSON."
        />
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={handleExportData}
            >
              Ekspor Data (JSON)
            </Button>

            {/* Hidden file input for import */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleSelectImportFile}
              className="hidden"
            />

            <Button
              variant="outline"
              size="sm"
              icon={<Upload className="w-4 h-4" />}
              onClick={() => fileInputRef.current?.click()}
            >
              Impor Data (JSON)
            </Button>
          </div>

          <p className="text-xs text-muted">
            File cadangan mencakup seluruh daftar Tugas, Catatan, Jadwal Kuliah, Agenda, serta preferensi pribadi tanpa menyertakan kredensial rahasia.
          </p>
        </div>
      </Card>

      {/* ── Edit Profile Modal ── */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Edit Profil Pengguna"
        description="Perbarui informasi profil pengguna yang ditampilkan di Noctis."
        maxWidth="md"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label
              htmlFor="profile-name"
              className="block text-xs font-semibold text-foreground mb-1"
            >
              Nama Lengkap <span className="text-danger">*</span>
            </label>
            <input
              id="profile-name"
              type="text"
              required
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                if (profileErrors.name) setProfileErrors((p) => ({ ...p, name: undefined }));
              }}
              placeholder="Contoh: Faiz"
              className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground focus:outline-none focus:border-border-focus"
            />
            {profileErrors.name && (
              <p className="text-xs text-danger mt-1">{profileErrors.name}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="profile-email"
              className="block text-xs font-semibold text-foreground mb-1"
            >
              Alamat Email {user ? "" : <span className="text-danger">*</span>}
            </label>
            <input
              id="profile-email"
              type="email"
              required={!user}
              disabled={Boolean(user)}
              value={user ? (user.email || profile.email) : emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                if (profileErrors.email) setProfileErrors((p) => ({ ...p, email: undefined }));
              }}
              placeholder="email@example.com"
              className={`w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground focus:outline-none focus:border-border-focus ${
                user ? "opacity-75 cursor-not-allowed bg-border/20" : ""
              }`}
            />
            {user ? (
              <p className="text-[11px] text-muted mt-1">
                Alamat email akun terhubung dengan Supabase Auth dan tidak dapat diubah di sini.
              </p>
            ) : profileErrors.email ? (
              <p className="text-xs text-danger mt-1">{profileErrors.email}</p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="profile-title"
              className="block text-xs font-semibold text-foreground mb-1"
            >
              Status / Peran (opsional)
            </label>
            <input
              id="profile-title"
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Contoh: Mahasiswa Teknik Informatika"
              className="w-full px-3.5 py-2 text-sm bg-surface-muted border border-border rounded-xl text-foreground focus:outline-none focus:border-border-focus"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/70">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSavingProfile}
              onClick={() => setIsProfileModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={isSavingProfile}>
              {isSavingProfile ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Profil"
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Import Confirmation Modal ── */}
      <Modal
        isOpen={Boolean(pendingImport)}
        onClose={() => setPendingImport(null)}
        title="Konfirmasi Impor Data"
        description="Tinjau ringkasan data sebelum menggantikan data saat ini."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-surface-muted rounded-2xl border border-border/80 space-y-2 text-xs">
            <p className="font-semibold text-foreground text-sm mb-1">
              Ringkasan Data Cadangan:
            </p>
            <div className="grid grid-cols-2 gap-2 text-muted-dark">
              <p>• Versi Format: <span className="font-bold text-foreground">{pendingImport?.version}</span></p>
              <p>• Nama Profil: <span className="font-bold text-foreground">{pendingImport?.profile?.name || "-"}</span></p>
              <p>• Jumlah Tugas: <span className="font-bold text-foreground">{pendingImport?.data.tasks.length ?? 0}</span></p>
              <p>• Jumlah Catatan: <span className="font-bold text-foreground">{pendingImport?.data.notes.length ?? 0}</span></p>
              <p>• Jadwal Kuliah: <span className="font-bold text-foreground">{pendingImport?.data.schedules.length ?? 0}</span></p>
              <p>• Agenda Kegiatan: <span className="font-bold text-foreground">{pendingImport?.data.agendaEvents.length ?? 0}</span></p>
            </div>
            {pendingImport?.exported_at && (
              <p className="text-[11px] text-muted pt-1">
                Waktu ekspor: {format(new Date(pendingImport.exported_at), "dd MMM yyyy, HH:mm")}
              </p>
            )}
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-warning-light text-warning text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              <strong>Peringatan:</strong> Seluruh data Tugas, Catatan, Jadwal, dan Agenda yang sedang tersimpan saat ini akan digantikan dengan data dari file cadangan ini.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/70">
            <Button
              variant="ghost"
              size="sm"
              disabled={isImporting}
              onClick={() => !isImporting && setPendingImport(null)}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isImporting}
              onClick={handleConfirmImport}
            >
              {isImporting ? "Mengimpor..." : "Ganti Data & Impor"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── 4. Logout Confirmation Modal ── */}
      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => !isLoggingOut && setIsLogoutModalOpen(false)}
        title="Konfirmasi Keluar Akun"
        description="Apakah Anda yakin ingin mengakhiri sesi login saat ini?"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-dark leading-relaxed">
            Sesi Anda pada perangkat ini akan diakhiri. Anda perlu memasukkan email dan kata sandi kembali untuk mengakses akun Anda.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/70">
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoggingOut}
              onClick={() => setIsLogoutModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isLoggingOut}
              className="bg-danger hover:bg-danger/90 text-white"
              onClick={handleConfirmLogout}
            >
              {isLoggingOut ? "Sedang keluar..." : "Keluar Akun"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
