"use client";

import { Settings, User, Bell, Palette, Globe, Database } from "lucide-react";
import { Card, CardHeader, Button } from "@/components/ui";

export function SettingsView() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile */}
      <Card>
        <CardHeader title="Profil" description="Informasi akun pengguna." />
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-soft-accent flex items-center justify-center">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">Pengguna Noctis</p>
            <p className="text-sm text-muted">user@example.com</p>
          </div>
        </div>
        <p className="text-xs text-muted mt-4">
          Login dan profil akan tersedia setelah integrasi Supabase Auth.
        </p>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader
          title="Notifikasi"
          description="Atur preferensi pengingat dan push notification."
        />
        <div className="space-y-4">
          {[
            { label: "Pengingat jadwal kuliah", desc: "30 menit sebelum kelas", enabled: true },
            { label: "Pengingat deadline tugas", desc: "1 hari sebelum deadline", enabled: true },
            { label: "Pengingat agenda", desc: "15 menit sebelum acara", enabled: false },
          ].map((pref, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {pref.label}
                </p>
                <p className="text-xs text-muted">{pref.desc}</p>
              </div>
              <button
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  pref.enabled ? "bg-primary" : "bg-border"
                }`}
                aria-label={`Toggle ${pref.label}`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-1 transition-transform ${
                    pref.enabled ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-4">
          Push notification memerlukan konfigurasi VAPID dan akan tersedia di fase berikutnya.
        </p>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader
          title="Tampilan"
          description="Sesuaikan tema dan zona waktu."
        />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Palette className="w-5 h-5 text-muted" />
              <div>
                <p className="text-sm font-medium text-foreground">Tema</p>
                <p className="text-xs text-muted">Mode terang (default)</p>
              </div>
            </div>
            <span className="text-xs text-muted bg-background px-2 py-1 rounded">
              Coming soon
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-muted" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Zona Waktu
                </p>
                <p className="text-xs text-muted">
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Data */}
      <Card>
        <CardHeader
          title="Data"
          description="Ekspor dan impor data pribadi."
        />
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" icon={<Database className="w-4 h-4" />}>
            Ekspor Data
          </Button>
          <Button variant="ghost" size="sm" icon={<Database className="w-4 h-4" />}>
            Impor Data
          </Button>
        </div>
        <p className="text-xs text-muted mt-3">
          Fitur ekspor/impor akan berfungsi penuh setelah integrasi database.
        </p>
      </Card>
    </div>
  );
}
