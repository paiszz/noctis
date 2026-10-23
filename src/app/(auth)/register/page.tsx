"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Moon, Eye, EyeOff, Loader2, AlertCircle, MailCheck, CheckCircle2 } from "lucide-react";
import { Card, Button } from "@/components/ui";
import { createBrowserClient } from "@/lib/supabase";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Verification state if Supabase requires email confirmation
  const [needsVerification, setNeedsVerification] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setErrorMessage("Silakan masukkan nama lengkap Anda.");
      return;
    }
    if (!cleanEmail) {
      setErrorMessage("Silakan masukkan alamat email Anda.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Kata sandi minimal terdiri dari 6 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createBrowserClient();
      if (!supabase) {
        throw new Error("Koneksi Supabase belum dikonfigurasi.");
      }

      const origin = typeof window !== "undefined" ? window.location.origin : "";

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanName,
            title: "Personal Workspace",
          },
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) {
        if (
          error.message.toLowerCase().includes("user already registered") ||
          error.message.toLowerCase().includes("already registered")
        ) {
          setErrorMessage("Alamat email ini sudah terdaftar. Silakan gunakan menu masuk.");
        } else {
          setErrorMessage(error.message);
        }
        setIsLoading(false);
        return;
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        setRegisteredEmail(cleanEmail);
        setNeedsVerification(true);
        setIsLoading(false);
        return;
      }

      // Direct login if confirmation is disabled or auto-confirmed
      if (data.session) {
        toast.success("Pendaftaran berhasil! Mengalihkan ke dashboard...");
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Terjadi kesalahan saat pendaftaran. Silakan coba lagi.";
      setErrorMessage(message);
      setIsLoading(false);
    }
  };

  // State: Needs Email Verification
  if (needsVerification) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-primary-dark flex items-center justify-center mx-auto mb-3 shadow-md">
            <MailCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Periksa Email Anda</h1>
          <p className="text-sm text-muted mt-1">
            Konfirmasi pendaftaran akun Noctis Anda
          </p>
        </div>

        <Card className="border border-border/70 shadow-card text-center space-y-5 p-6">
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/15 text-sm text-foreground space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-primary font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Tautan konfirmasi telah dikirim</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Kami telah mengirimkan email aktivasi ke{" "}
              <strong className="text-foreground font-semibold">{registeredEmail}</strong>. Silakan
              buka tautan di dalam email tersebut untuk memverifikasi akun Anda sebelum masuk.
            </p>
          </div>

          <p className="text-xs text-muted">
            Tidak menerima email? Periksa folder spam atau pastikan alamat email yang Anda masukkan sudah benar.
          </p>

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full bg-primary text-white py-2.5 rounded-xl font-medium text-sm hover:bg-primary-dark transition-colors shadow-sm"
            >
              Kembali ke Halaman Masuk
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brand Header */}
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-primary-dark flex items-center justify-center mx-auto mb-3 shadow-md">
          <Moon className="w-7 h-7 text-white fill-white/20" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Buat Akun Noctis</h1>
        <p className="text-sm text-muted mt-1">
          Daftarkan akun untuk mulai mengelola aktivitas pribadi
        </p>
      </div>

      {/* Register Card */}
      <Card className="border border-border/70 shadow-card">
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-danger-light border border-danger/20 text-danger text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <div>
            <label
              htmlFor="name"
              className="block text-xs font-semibold text-foreground mb-1.5"
            >
              Nama Lengkap
            </label>
            <input
              id="name"
              type="text"
              required
              disabled={isLoading}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Contoh: Faiz Maulana"
              className="w-full px-3.5 py-2.5 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-foreground mb-1.5"
            >
              Alamat Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              disabled={isLoading}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="nama@email.com"
              className="w-full px-3.5 py-2.5 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-foreground mb-1.5"
            >
              Kata Sandi (minimal 6 karakter)
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                disabled={isLoading}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="••••••••"
                className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors p-1"
                aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-xs font-semibold text-foreground mb-1.5"
            >
              Konfirmasi Kata Sandi
            </label>
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              disabled={isLoading}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 text-sm bg-surface-muted border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors disabled:opacity-60"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mendaftarkan akun...</span>
              </>
            ) : (
              <span>Daftar Akun</span>
            )}
          </Button>

          <div className="pt-2 text-center text-xs text-muted border-t border-border/60">
            Sudah memiliki akun?{" "}
            <Link
              href="/login"
              className="text-primary hover:text-primary-dark font-semibold transition-colors underline-offset-4 hover:underline"
            >
              Masuk di sini
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
