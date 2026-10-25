"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Moon, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Card, Button } from "@/components/ui";
import { createBrowserClient } from "@/lib/supabase";
import { toast } from "sonner";
import { sanitizeRedirectUrl } from "@/lib/utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirectTo = searchParams.get("redirectTo");
  const redirectTo = sanitizeRedirectUrl(rawRedirectTo, "/dashboard");
  const errorCode = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (errorCode === "auth-code-error") {
      setErrorMessage("Tautan verifikasi tidak valid atau telah kedaluwarsa. Silakan coba masuk kembali.");
    }
  }, [errorCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Silakan masukkan alamat email Anda.");
      return;
    }
    if (!password) {
      setErrorMessage("Silakan masukkan kata sandi Anda.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createBrowserClient();
      if (!supabase) {
        throw new Error("Koneksi Supabase belum dikonfigurasi.");
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setErrorMessage("Email atau kata sandi yang Anda masukkan salah.");
        } else if (error.message.toLowerCase().includes("email not confirmed")) {
          setErrorMessage(
            "Email Anda belum diverifikasi. Silakan periksa kotak masuk atau spam email Anda untuk mengaktifkan akun."
          );
        } else {
          setErrorMessage(error.message);
        }
        setIsLoading(false);
        return;
      }

      if (data.session) {
        toast.success("Berhasil masuk! Mengalihkan ke dashboard...");
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Terjadi kesalahan saat masuk. Silakan coba lagi.";
      setErrorMessage(message);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Brand Header */}
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-primary-dark flex items-center justify-center mx-auto mb-3 shadow-md">
          <Moon className="w-7 h-7 text-white fill-white/20" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Masuk ke Noctis</h1>
        <p className="text-sm text-muted mt-1">
          Pusat produktivitas dan ruang kerja pribadi Anda
        </p>
      </div>

      {/* Login Card */}
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
              htmlFor="email"
              className="block text-xs font-semibold text-foreground mb-1.5"
            >
              Email
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
              Kata Sandi
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
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
                <span>Sedang masuk...</span>
              </>
            ) : (
              <span>Masuk</span>
            )}
          </Button>

          <div className="pt-2 text-center text-xs text-muted border-t border-border/60">
            Belum memiliki akun?{" "}
            <Link
              href="/register"
              className="text-primary hover:text-primary-dark font-semibold transition-colors underline-offset-4 hover:underline"
            >
              Daftar sekarang
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md mx-auto p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
