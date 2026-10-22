import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Halaman Tidak Ditemukan",
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-soft-accent flex items-center justify-center mx-auto mb-6">
        <span className="text-3xl font-bold text-primary">N</span>
      </div>
      <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
      <p className="text-lg font-medium text-foreground mb-1">
        Halaman Tidak Ditemukan
      </p>
      <p className="text-sm text-muted mb-8 max-w-sm">
        Halaman yang kamu cari tidak ada atau telah dipindahkan.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
      >
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
